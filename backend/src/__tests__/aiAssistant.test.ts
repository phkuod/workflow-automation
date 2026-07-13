import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { isAiEnabled, parseDraft, draftAutomation, explainRunError } from '../services/aiAssistant';

const VALID_DRAFT_JSON = JSON.stringify({
  name: 'Daily weather email',
  description: 'Fetch weather and email the team',
  stations: [
    {
      name: 'Fetch',
      steps: [
        { name: 'Every morning', type: 'trigger-cron', config: { cronExpression: '0 8 * * *' } },
        { name: 'Get weather', type: 'http-request', config: { url: 'https://api.example.com/weather', method: 'GET' } },
      ],
    },
    {
      name: 'Send',
      steps: [{ name: 'Email team', type: 'action-email', config: { emailTo: 'team@example.com', emailSubject: 'Weather' } }],
    },
  ],
});

function chatResponse(content: string) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response;
}

describe('isAiEnabled', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is false when AI_API_KEY is missing', () => {
    vi.stubEnv('AI_API_KEY', '');
    vi.stubEnv('AI_MODEL', 'meta/llama-3.1-70b-instruct');
    expect(isAiEnabled()).toBe(false);
  });

  it('is false when AI_MODEL is missing', () => {
    vi.stubEnv('AI_API_KEY', 'sk-test');
    vi.stubEnv('AI_MODEL', '');
    expect(isAiEnabled()).toBe(false);
  });

  it('is true when both key and model are set', () => {
    vi.stubEnv('AI_API_KEY', 'sk-test');
    vi.stubEnv('AI_MODEL', 'meta/llama-3.1-70b-instruct');
    expect(isAiEnabled()).toBe(true);
  });
});

describe('parseDraft', () => {
  it('parses a valid draft and normalizes ids and positions', () => {
    const draft = parseDraft(VALID_DRAFT_JSON);
    expect(draft.name).toBe('Daily weather email');
    expect(draft.definition.stations).toHaveLength(2);
    const [s1, s2] = draft.definition.stations;
    expect(s1.id).toBeTruthy();
    expect(s1.id).not.toBe(s2.id);
    expect(s1.position).toEqual({ x: 100, y: 150 });
    expect(s2.position).toEqual({ x: 400, y: 150 });
    expect(s1.steps[0].position).toEqual({ x: 100, y: 100 });
    expect(s1.steps[1].position).toEqual({ x: 300, y: 100 });
    const stepIds = draft.definition.stations.flatMap(s => s.steps.map(st => st.id));
    expect(new Set(stepIds).size).toBe(stepIds.length);
  });

  it('strips markdown code fences before parsing', () => {
    const fenced = '```json\n' + VALID_DRAFT_JSON + '\n```';
    expect(parseDraft(fenced).name).toBe('Daily weather email');
  });

  it('rejects non-JSON content', () => {
    expect(() => parseDraft('I cannot help with that.')).toThrow(/not valid JSON/i);
  });

  it('rejects an unknown step type', () => {
    const bad = JSON.parse(VALID_DRAFT_JSON);
    bad.stations[0].steps[0].type = 'teleport';
    expect(() => parseDraft(JSON.stringify(bad))).toThrow(/unknown step type/i);
  });

  it('rejects empty stations', () => {
    const bad = JSON.parse(VALID_DRAFT_JSON);
    bad.stations = [];
    expect(() => parseDraft(JSON.stringify(bad))).toThrow(/at least one stage/i);
  });

  it('rejects a station with no steps', () => {
    const bad = JSON.parse(VALID_DRAFT_JSON);
    bad.stations[1].steps = [];
    expect(() => parseDraft(JSON.stringify(bad))).toThrow(/at least one action/i);
  });

  it('rejects a null entry in stations', () => {
    const bad = JSON.parse(VALID_DRAFT_JSON);
    bad.stations = [null];
    expect(() => parseDraft(JSON.stringify(bad))).toThrow(/every stage must be an object/i);
  });

  it('rejects a null entry in steps', () => {
    const bad = JSON.parse(VALID_DRAFT_JSON);
    bad.stations[0].steps = [null];
    expect(() => parseDraft(JSON.stringify(bad))).toThrow(/every action must be an object/i);
  });

  it('defaults a missing config to an empty object', () => {
    const loose = JSON.parse(VALID_DRAFT_JSON);
    delete loose.stations[0].steps[0].config;
    const draft = parseDraft(JSON.stringify(loose));
    expect(draft.definition.stations[0].steps[0].config).toEqual({});
  });
});

describe('draftAutomation / explainRunError (fetch behavior)', () => {
  beforeEach(() => {
    vi.stubEnv('AI_API_KEY', 'sk-test');
    vi.stubEnv('AI_MODEL', 'test-model');
    vi.stubEnv('AI_API_BASE_URL', 'https://llm.example.com/v1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('POSTs to the configured base url with bearer auth and returns the parsed draft', async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_DRAFT_JSON));
    vi.stubGlobal('fetch', fetchMock);

    const draft = await draftAutomation('email me the weather every morning');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://llm.example.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('test-model');
    expect(body.messages.at(-1).content).toContain('email me the weather every morning');
    expect(draft.definition.stations).toHaveLength(2);
    expect(init.signal).toBeDefined();
  });

  it('rejects when the request times out', async () => {
    const timeoutError = typeof DOMException !== 'undefined'
      ? new DOMException('The operation timed out', 'TimeoutError')
      : new Error('The operation timed out');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError));
    await expect(draftAutomation('x')).rejects.toThrow();
  });

  it('defaults the base url to OpenRouter when AI_API_BASE_URL is unset', async () => {
    vi.stubEnv('AI_API_BASE_URL', '');
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_DRAFT_JSON));
    vi.stubGlobal('fetch', fetchMock);
    await draftAutomation('anything');
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('throws when the provider responds non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response));
    await expect(draftAutomation('x')).rejects.toThrow(/401/);
  });

  it('throws when the provider returns no content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) } as Response));
    await expect(draftAutomation('x')).rejects.toThrow(/no content/i);
  });

  it('explainRunError returns the trimmed provider text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatResponse('  The email address was rejected by the mail server. Check the recipient.  ')));
    const text = await explainRunError({
      workflowName: 'Orders', stationName: 'Notify', stepName: 'Email', stepType: 'action-email',
      errorMessage: 'Invalid login: 535',
    });
    expect(text).toBe('The email address was rejected by the mail server. Check the recipient.');
  });
});
