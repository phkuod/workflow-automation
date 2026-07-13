# Phase 3: AI Assist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Natural-language automation drafting and plain-language run-failure explanations, powered by any OpenAI-compatible LLM provider (OpenRouter, NVIDIA NIM), with every AI surface hidden when unconfigured.

**Architecture:** One backend service (`aiAssistant.ts`) owns provider calls via global `fetch` against an OpenAI-compatible `/chat/completions` endpoint. The LLM returns a *simplified* draft schema (no ids/positions); the service validates it and normalizes it into a full `WorkflowDefinition` (uuid ids, canvas positions) before anything is persisted. Thin `/api/ai` routes wrap the service in the standard envelope. The frontend learns availability from `GET /api/ai/status` through a cached hook; the gallery gains a describe-it box, and RunTimeline's error card gains "Explain this".

**Tech Stack:** Backend: Express + TS, global fetch (Node ≥18), uuid, Pino, Vitest + supertest. Frontend: React + TS, axios client, Vitest + Testing Library. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-07-11-nontechnical-ux-redesign-design.md` (Phase 3, amended 2026-07-12)

## Global Constraints

- Provider config env vars, exact names: `AI_API_KEY` (enables the feature), `AI_API_BASE_URL` (default `https://openrouter.ai/api/v1`), `AI_MODEL` (required). Works with OpenRouter and NVIDIA NIM (`https://integrate.api.nvidia.com/v1`).
- **When AI is not configured, the product is byte-for-byte as functional as before:** `GET /api/ai/status` → `{ enabled: false }`, draft/explain return 503, all AI UI hidden.
- LLM output is validated before persisting; on any AI failure the user-facing error is exactly `AI draft failed — try a template instead` (draft) / a graceful inline message (explain). Never a stack trace.
- API envelope `{ success, data, error }`; routes thin, logic in services; Pino via `createLogger`; parameterized queries only (no new SQL here).
- The API key is never logged and never sent to the frontend.
- TS strict both packages; no console.log; backend tests `cd backend; npm run test -- --run <path>`; frontend `cd frontend; npm run test:run -- <path>`.
- Working branch: `feature/phase3-ai-assist`. Commit per task, format `<type>: <description>`.

## Verified interfaces (do not re-derive)

- Route mounting: `backend/src/app.ts:30-34` (`app.use('/api/…', router)`), global error middleware at `:54`. Mount the new router with the others, before the error handler.
- Envelope + route shape: copy `backend/src/routes/metrics.ts` structure (Router, `createLogger('…')`, try/catch → `{ success:false, error:'Internal server error' }`).
- `WorkflowModel.create(data: CreateWorkflowRequest): Workflow` (`backend/src/models/workflow.ts:59`), uuid via `uuid` package. `CreateWorkflowRequest` in `backend/src/types/workflow.ts` — verify its exact fields before use (name, description?, definition expected).
- Backend `StepType` union has **13** members incl. `notification-slack` (`backend/src/types/workflow.ts:75-88`).
- Route-test pattern: `backend/src/__tests__/schedules.route.test.ts:1-30` (supertest + express app + `vi.mock` service + logger mock).
- Frontend axios client + api-object pattern: `frontend/src/shared/api/workflowApi.ts:11-16`, `executionApi` at `:81`.
- RunTimeline failed-step error card: `frontend/src/features/executions/components/RunTimeline.tsx:17-51`.
- Backend `package.json` engines is `>=16.0.0` — global fetch needs 18; Task 1 bumps engines to `>=18.0.0` (Docker already runs Node 18).

---

### Task 1: `aiAssistant` service (backend)

**Files:**
- Create: `backend/src/services/aiAssistant.ts`
- Modify: `backend/package.json` (engines → `">=18.0.0"`), `backend/.env.example` (document the three AI vars)
- Test: `backend/src/__tests__/aiAssistant.test.ts`

**Interfaces:**
- Consumes: `WorkflowDefinition, Station, Step, StepType` from `backend/src/types/workflow.ts`; `uuid`; `createLogger`.
- Produces (Task 2 consumes):
  ```ts
  function isAiEnabled(): boolean
  interface AiDraft { name: string; description: string; definition: WorkflowDefinition }
  function draftAutomation(userDescription: string): Promise<AiDraft>
  function parseDraft(content: string): AiDraft        // exported for tests
  interface ExplainContext { workflowName: string; stationName: string; stepName: string; stepType: string; errorMessage: string }
  function explainRunError(ctx: ExplainContext): Promise<string>
  ```

- [ ] **Step 1: Write the failing tests**

Create `backend/src/__tests__/aiAssistant.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend; npm run test -- --run src/__tests__/aiAssistant.test.ts`
Expected: FAIL — cannot resolve `../services/aiAssistant`.

- [ ] **Step 3: Write the service**

Create `backend/src/services/aiAssistant.ts`:

```ts
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowDefinition, Station, Step, StepType } from '../types/workflow';
import { createLogger } from '../utils/logger';

const log = createLogger('aiAssistant');

const VALID_STEP_TYPES: StepType[] = [
  'trigger-manual', 'trigger-cron', 'trigger-webhook',
  'script-js', 'script-python', 'http-request', 'if-else',
  'set-variable', 'wait', 'notification-slack', 'action-email',
  'action-slack', 'connector-db',
];

export function isAiEnabled(): boolean {
  return Boolean(process.env.AI_API_KEY && process.env.AI_MODEL);
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

async function chat(messages: ChatMessage[]): Promise<string> {
  const baseUrl = process.env.AI_API_BASE_URL || 'https://openrouter.ai/api/v1';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      messages,
      temperature: 0.2,
    }),
  });
  if (!response.ok) {
    throw new Error(`AI provider returned status ${response.status}`);
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI provider returned no content');
  }
  return content;
}

const DRAFT_SYSTEM_PROMPT = `You design automations for a workflow tool. Respond with ONLY a JSON object, no prose, no markdown fences.
Schema:
{
  "name": string,                       // short automation name
  "description": string,                // one sentence
  "stations": [                         // 1-4 sequential stages
    {
      "name": string,                   // short stage name
      "steps": [                        // 1-4 actions per stage
        { "name": string, "type": string, "config": object }
      ]
    }
  ]
}
Allowed step types and their config keys:
- "trigger-manual" {} | "trigger-cron" {"cronExpression"} | "trigger-webhook" {"webhookMethod"}
- "http-request" {"url","method"} | "action-email" {"emailTo","emailSubject","emailBody"}
- "action-slack" {"slackWebhookUrl","slackMessage"} | "if-else" {"condition"}
- "set-variable" {"variableName","variableValue"} | "wait" {"duration","unit"}
- "script-js" {"code"} | "script-python" {"code"} | "connector-db" {"dbType","dbQuery"}
Rules: exactly one trigger step, placed first in the first stage. Prefer simple 2-stage designs. Use realistic placeholder values the user can edit.`;

export interface AiDraft {
  name: string;
  description: string;
  definition: WorkflowDefinition;
}

interface RawDraftStep {
  name?: unknown;
  type?: unknown;
  config?: unknown;
}

interface RawDraftStation {
  name?: unknown;
  steps?: unknown;
}

/** Parse and validate LLM draft output; normalize into a full WorkflowDefinition. */
export function parseDraft(content: string): AiDraft {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let raw: { name?: unknown; description?: unknown; stations?: unknown };
  try {
    raw = JSON.parse(stripped);
  } catch {
    throw new Error('AI response was not valid JSON');
  }

  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Untitled Automation';
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';

  if (!Array.isArray(raw.stations) || raw.stations.length === 0) {
    throw new Error('Draft must contain at least one stage');
  }

  const stations: Station[] = (raw.stations as RawDraftStation[]).map((st, i) => {
    if (!Array.isArray(st.steps) || st.steps.length === 0) {
      throw new Error('Every stage must contain at least one action');
    }
    const steps: Step[] = (st.steps as RawDraftStep[]).map((s, j) => {
      if (typeof s.type !== 'string' || !VALID_STEP_TYPES.includes(s.type as StepType)) {
        throw new Error(`Unknown step type: ${String(s.type)}`);
      }
      const config = s.config && typeof s.config === 'object' && !Array.isArray(s.config)
        ? (s.config as Step['config'])
        : {};
      return {
        id: uuidv4(),
        name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : `Action ${j + 1}`,
        type: s.type as StepType,
        config,
        position: { x: 100 + j * 200, y: 100 },
      };
    });
    return {
      id: uuidv4(),
      name: typeof st.name === 'string' && st.name.trim() ? st.name.trim() : `Stage ${i + 1}`,
      steps,
      position: { x: 100 + i * 300, y: 150 },
    };
  });

  return { name, description, definition: { stations } };
}

export async function draftAutomation(userDescription: string): Promise<AiDraft> {
  const content = await chat([
    { role: 'system', content: DRAFT_SYSTEM_PROMPT },
    { role: 'user', content: userDescription },
  ]);
  const draft = parseDraft(content);
  log.info({ name: draft.name, stations: draft.definition.stations.length }, 'AI draft generated');
  return draft;
}

const EXPLAIN_SYSTEM_PROMPT = `You explain automation failures to non-technical office workers.
Answer in 2-3 plain sentences: what went wrong in everyday language, then one concrete suggestion to fix it.
No stack traces, no jargon, no markdown.`;

export interface ExplainContext {
  workflowName: string;
  stationName: string;
  stepName: string;
  stepType: string;
  errorMessage: string;
}

export async function explainRunError(ctx: ExplainContext): Promise<string> {
  const content = await chat([
    { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Automation "${ctx.workflowName}", stage "${ctx.stationName}", action "${ctx.stepName}" (type ${ctx.stepType}) failed with: ${ctx.errorMessage}`,
    },
  ]);
  return content.trim();
}
```

- [ ] **Step 4: Update engines + env example**

`backend/package.json`: `"engines": { "node": ">=18.0.0" }` (global fetch requirement; Docker already runs Node 18).
`backend/.env.example` — append:

```
# AI assist (optional — all AI features hidden when unset)
# Any OpenAI-compatible provider works. Examples:
#   OpenRouter: AI_API_BASE_URL=https://openrouter.ai/api/v1
#   NVIDIA NIM: AI_API_BASE_URL=https://integrate.api.nvidia.com/v1
AI_API_KEY=
AI_API_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=
```

If `backend/.env.example` does not exist, create it with only this block.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend; npm run test -- --run src/__tests__/aiAssistant.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/aiAssistant.ts backend/src/__tests__/aiAssistant.test.ts backend/package.json backend/.env.example
git commit -m "feat: provider-agnostic AI assistant service"
```

---

### Task 2: `/api/ai` routes (backend)

**Files:**
- Create: `backend/src/routes/ai.ts`
- Modify: `backend/src/app.ts:30-34` (mount), `CLAUDE.md` (env table + API routes table rows)
- Test: `backend/src/__tests__/ai.route.test.ts`

**Interfaces:**
- Consumes: `isAiEnabled, draftAutomation, explainRunError, AiDraft, ExplainContext` (Task 1); `WorkflowModel.create` (`backend/src/models/workflow.ts:59` — verify `CreateWorkflowRequest` fields in `backend/src/types/workflow.ts` before use).
- Produces (frontend consumes):
  - `GET /api/ai/status` → `{ success: true, data: { enabled: boolean } }`
  - `POST /api/ai/draft` body `{ description: string }` → 201 `{ success: true, data: Workflow }` | 503 disabled | 400 bad input | 502 `{ success: false, error: 'AI draft failed — try a template instead' }`
  - `POST /api/ai/explain` body `{ workflowName, stationName, stepName, stepType, errorMessage }` → 200 `{ success: true, data: { explanation: string } }` | 503 | 400 | 502

- [ ] **Step 1: Write the failing tests**

Create `backend/src/__tests__/ai.route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../services/aiAssistant', () => ({
  isAiEnabled: vi.fn(),
  draftAutomation: vi.fn(),
  explainRunError: vi.fn(),
}));
vi.mock('../models/workflow', () => ({
  WorkflowModel: { create: vi.fn() },
}));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import aiRouter from '../routes/ai';
import { isAiEnabled, draftAutomation, explainRunError } from '../services/aiAssistant';
import { WorkflowModel } from '../models/workflow';

const app = express();
app.use(express.json());
app.use('/api/ai', aiRouter);

const DRAFT = {
  name: 'Weather mail',
  description: 'desc',
  definition: { stations: [{ id: 's1', name: 'S', steps: [], position: { x: 0, y: 0 } }] },
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/ai/status', () => {
  it('reports enabled', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    const res = await request(app).get('/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { enabled: true } });
  });

  it('reports disabled', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(false);
    const res = await request(app).get('/api/ai/status');
    expect(res.body).toEqual({ success: true, data: { enabled: false } });
  });
});

describe('POST /api/ai/draft', () => {
  it('503 when AI is disabled', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(false);
    const res = await request(app).post('/api/ai/draft').send({ description: 'x' });
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });

  it('400 when description is missing or blank', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    const res = await request(app).post('/api/ai/draft').send({ description: '   ' });
    expect(res.status).toBe(400);
  });

  it('400 when description exceeds 2000 chars', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    const res = await request(app).post('/api/ai/draft').send({ description: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it('creates a draft workflow and returns 201', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(draftAutomation).mockResolvedValue(DRAFT);
    const created = { id: 'wf-1', name: 'Weather mail', status: 'draft' };
    vi.mocked(WorkflowModel.create).mockReturnValue(created as never);

    const res = await request(app).post('/api/ai/draft').send({ description: 'weather email' });

    expect(draftAutomation).toHaveBeenCalledWith('weather email');
    expect(WorkflowModel.create).toHaveBeenCalledWith({
      name: DRAFT.name,
      description: DRAFT.description,
      definition: DRAFT.definition,
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: created });
  });

  it('502 with the graceful message when the service throws', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(draftAutomation).mockRejectedValue(new Error('provider exploded'));
    const res = await request(app).post('/api/ai/draft').send({ description: 'x' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ success: false, error: 'AI draft failed — try a template instead' });
  });
});

describe('POST /api/ai/explain', () => {
  const CTX = {
    workflowName: 'W', stationName: 'S', stepName: 'A',
    stepType: 'action-email', errorMessage: 'boom',
  };

  it('503 when AI is disabled', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(false);
    const res = await request(app).post('/api/ai/explain').send(CTX);
    expect(res.status).toBe(503);
  });

  it('400 when errorMessage is missing', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    const res = await request(app).post('/api/ai/explain').send({ ...CTX, errorMessage: '' });
    expect(res.status).toBe(400);
  });

  it('returns the explanation', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(explainRunError).mockResolvedValue('The mail server said no.');
    const res = await request(app).post('/api/ai/explain').send(CTX);
    expect(explainRunError).toHaveBeenCalledWith(CTX);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { explanation: 'The mail server said no.' } });
  });

  it('502 when the service throws', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(explainRunError).mockRejectedValue(new Error('nope'));
    const res = await request(app).post('/api/ai/explain').send(CTX);
    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend; npm run test -- --run src/__tests__/ai.route.test.ts`
Expected: FAIL — cannot resolve `../routes/ai`.

- [ ] **Step 3: Write the router**

Create `backend/src/routes/ai.ts`:

```ts
import { Router } from 'express';
import { isAiEnabled, draftAutomation, explainRunError } from '../services/aiAssistant';
import { WorkflowModel } from '../models/workflow';
import { createLogger } from '../utils/logger';

const router = Router();
const log = createLogger('ai');

const MAX_DESCRIPTION_LENGTH = 2000;

router.get('/status', (req, res) => {
  res.json({ success: true, data: { enabled: isAiEnabled() } });
});

router.post('/draft', async (req, res) => {
  if (!isAiEnabled()) {
    return res.status(503).json({ success: false, error: 'AI assist is not configured' });
  }
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (!description) {
    return res.status(400).json({ success: false, error: 'description is required' });
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return res.status(400).json({ success: false, error: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters` });
  }
  try {
    const draft = await draftAutomation(description);
    const workflow = WorkflowModel.create({
      name: draft.name,
      description: draft.description,
      definition: draft.definition,
    });
    res.status(201).json({ success: true, data: workflow });
  } catch (error: unknown) {
    log.error({ err: error }, 'AI draft failed');
    res.status(502).json({ success: false, error: 'AI draft failed — try a template instead' });
  }
});

router.post('/explain', async (req, res) => {
  if (!isAiEnabled()) {
    return res.status(503).json({ success: false, error: 'AI assist is not configured' });
  }
  const { workflowName, stationName, stepName, stepType, errorMessage } = req.body ?? {};
  if (typeof errorMessage !== 'string' || !errorMessage.trim()) {
    return res.status(400).json({ success: false, error: 'errorMessage is required' });
  }
  try {
    const explanation = await explainRunError({
      workflowName: String(workflowName ?? ''),
      stationName: String(stationName ?? ''),
      stepName: String(stepName ?? ''),
      stepType: String(stepType ?? ''),
      errorMessage,
    });
    res.json({ success: true, data: { explanation } });
  } catch (error: unknown) {
    log.error({ err: error }, 'AI explain failed');
    res.status(502).json({ success: false, error: 'Could not generate an explanation' });
  }
});

export default router;
```

Note for the 200-path test `expect(explainRunError).toHaveBeenCalledWith(CTX)`: the `String(...)` coercions preserve already-string fields, so the assertion holds.

- [ ] **Step 4: Mount + document**

In `backend/src/app.ts`: import `aiRoutes from './routes/ai';` and add `app.use('/api/ai', aiRoutes);` alongside the other mounts (lines 30-34).
In `CLAUDE.md`: add rows — API table: `GET /api/ai/status`, `POST /api/ai/draft`, `POST /api/ai/explain`; env table: `AI_API_KEY`, `AI_API_BASE_URL` (default `https://openrouter.ai/api/v1`), `AI_MODEL`.

- [ ] **Step 5: Run tests, full backend suite, commit**

Run: `cd backend; npm run test -- --run src/__tests__/ai.route.test.ts` then `cd backend; npm run test -- --run`
Expected: PASS all.

```bash
git add backend/src/routes/ai.ts backend/src/__tests__/ai.route.test.ts backend/src/app.ts CLAUDE.md
git commit -m "feat: AI status, draft, and explain endpoints"
```

---

### Task 3: Frontend `aiApi` + availability hook

**Files:**
- Modify: `frontend/src/shared/api/workflowApi.ts` (add `aiApi`)
- Create: `frontend/src/shared/hooks/useAiEnabled.ts`
- Test: `frontend/src/shared/hooks/useAiEnabled.test.ts`

**Interfaces:**
- Consumes: the module's existing axios `api` instance + `ApiResponse` (`workflowApi.ts:11-16`); backend endpoints (Task 2).
- Produces (Tasks 4-5 consume):
  ```ts
  const aiApi = {
    getStatus(): Promise<{ enabled: boolean }>,
    draft(description: string): Promise<Workflow>,
    explain(ctx: { workflowName: string; stationName: string; stepName: string; stepType: string; errorMessage: string }): Promise<string>,
  }
  function useAiEnabled(): boolean   // false until /api/ai/status resolves true; result cached module-wide
  ```

- [ ] **Step 1: Write the failing hook test**

Create `frontend/src/shared/hooks/useAiEnabled.ts` consumers' test first — `frontend/src/shared/hooks/useAiEnabled.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../api/workflowApi', () => ({
  aiApi: { getStatus: vi.fn() },
}));

import { aiApi } from '../api/workflowApi';

describe('useAiEnabled', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns false initially and true after status resolves enabled', async () => {
    vi.mocked(aiApi.getStatus).mockResolvedValue({ enabled: true });
    const { useAiEnabled } = await import('./useAiEnabled');
    const { result } = renderHook(() => useAiEnabled());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays false when the status call fails', async () => {
    vi.mocked(aiApi.getStatus).mockRejectedValue(new Error('network'));
    const { useAiEnabled } = await import('./useAiEnabled');
    const { result } = renderHook(() => useAiEnabled());
    await waitFor(() => expect(aiApi.getStatus).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('fetches status only once across multiple mounts', async () => {
    vi.mocked(aiApi.getStatus).mockResolvedValue({ enabled: true });
    const { useAiEnabled } = await import('./useAiEnabled');
    const a = renderHook(() => useAiEnabled());
    const b = renderHook(() => useAiEnabled());
    await waitFor(() => expect(a.result.current).toBe(true));
    await waitFor(() => expect(b.result.current).toBe(true));
    expect(aiApi.getStatus).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/shared/hooks/useAiEnabled.test.ts`
Expected: FAIL — cannot resolve `./useAiEnabled`.

- [ ] **Step 3: Implement aiApi and the hook**

In `frontend/src/shared/api/workflowApi.ts`, add alongside the other api objects (reusing `api` and `ApiResponse`):

```ts
export const aiApi = {
  getStatus: async (): Promise<{ enabled: boolean }> => {
    const response = await api.get<ApiResponse<{ enabled: boolean }>>('/ai/status');
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  draft: async (description: string): Promise<Workflow> => {
    const response = await api.post<ApiResponse<Workflow>>('/ai/draft', { description });
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  explain: async (ctx: {
    workflowName: string; stationName: string; stepName: string; stepType: string; errorMessage: string;
  }): Promise<string> => {
    const response = await api.post<ApiResponse<{ explanation: string }>>('/ai/explain', ctx);
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!.explanation;
  },
};
```

Note: axios throws on non-2xx by default, so the 502/503 paths surface as thrown errors with the envelope in `error.response` — callers just catch.

Create `frontend/src/shared/hooks/useAiEnabled.ts`:

```ts
import { useEffect, useState } from 'react';
import { aiApi } from '../api/workflowApi';

let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;

function fetchEnabled(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached);
  if (!pending) {
    pending = aiApi
      .getStatus()
      .then(s => {
        cached = s.enabled;
        return cached;
      })
      .catch(() => {
        cached = false;
        return false;
      });
  }
  return pending;
}

/** Whether AI assist is configured on the server. False until known; cached for the session. */
export function useAiEnabled(): boolean {
  const [enabled, setEnabled] = useState(cached ?? false);

  useEffect(() => {
    let mounted = true;
    fetchEnabled().then(value => {
      if (mounted) setEnabled(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return enabled;
}
```

- [ ] **Step 4: Run tests, commit**

Run: `cd frontend; npm run test:run -- src/shared/hooks/useAiEnabled.test.ts`
Expected: PASS (3 tests).

```bash
git add frontend/src/shared/api/workflowApi.ts frontend/src/shared/hooks
git commit -m "feat: ai api client and availability hook"
```

---

### Task 4: Gallery describe-it box

**Files:**
- Modify: `frontend/src/features/templates/TemplateGalleryPage.tsx`
- Test: `frontend/src/features/templates/TemplateGalleryPage.test.tsx` (extend)

**Interfaces:**
- Consumes: `aiApi.draft`, `useAiEnabled` (Task 3); existing `toast`, `useNavigate`.
- Produces: UI only.

- [ ] **Step 1: Write the failing tests**

Extend `TemplateGalleryPage.test.tsx`. Add to the existing mock of `../../shared/api/workflowApi` the `aiApi` export, and mock the hook:

```tsx
// extend the existing vi.mock('../../shared/api/workflowApi', ...) factory with:
//   aiApi: { draft: vi.fn() },
// and add:
vi.mock('../../shared/hooks/useAiEnabled', () => ({ useAiEnabled: vi.fn() }));
import { useAiEnabled } from '../../shared/hooks/useAiEnabled';
import { aiApi } from '../../shared/api/workflowApi';

describe('AI describe-it box', () => {
  it('is hidden when AI is disabled', () => {
    vi.mocked(useAiEnabled).mockReturnValue(false);
    renderPage();
    expect(screen.queryByPlaceholderText('Describe what you want to automate…')).not.toBeInTheDocument();
  });

  it('drafts an automation and navigates to the editor', async () => {
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.draft).mockResolvedValue({ id: 'wf-ai' } as never);
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Describe what you want to automate…'), {
      target: { value: 'email me the weather every morning' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Draft it for me' }));
    await waitFor(() => {
      expect(aiApi.draft).toHaveBeenCalledWith('email me the weather every morning');
      expect(navigateMock).toHaveBeenCalledWith('/editor/wf-ai');
    });
  });

  it('shows the graceful error toast when drafting fails', async () => {
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.draft).mockRejectedValue(new Error('bad'));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Describe what you want to automate…'), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Draft it for me' }));
    await waitFor(() => expect(aiApi.draft).toHaveBeenCalled());
    // toast is mocked in this file's existing pattern — assert toast.error called with:
    // 'AI draft failed — try a template instead'
  });
});
```

Adapt the toast assertion to this test file's existing toast mock (check how the file mocks `toastStore`; if it doesn't yet, add `vi.mock('../../shared/stores/toastStore', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))` and assert on it). All other existing tests must keep passing with `useAiEnabled` mocked to `false` by default — set that in `beforeEach`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend; npm run test:run -- src/features/templates/TemplateGalleryPage.test.tsx`
Expected: new tests FAIL (no describe box exists).

- [ ] **Step 3: Implement the describe-it box**

In `TemplateGalleryPage.tsx`, add imports (`useAiEnabled`, `aiApi`, `Wand2` from lucide-react) and state:

```tsx
const aiEnabled = useAiEnabled();
const [aiDescription, setAiDescription] = useState('');
const [isDrafting, setIsDrafting] = useState(false);

const draftWithAi = async () => {
  const description = aiDescription.trim();
  if (!description || isDrafting) return;
  setIsDrafting(true);
  try {
    const created = await aiApi.draft(description);
    navigate(`/editor/${created.id}`);
  } catch {
    toast.error('AI draft failed — try a template instead');
    setIsDrafting(false);
  }
};
```

Render above the first category section (directly inside `<main className="main-content">`), only when enabled:

```tsx
{aiEnabled && (
  <section className="card" style={{ marginBottom: '2rem', padding: '16px 18px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
      <Wand2 size={18} style={{ color: 'var(--accent-primary)' }} />
      <h3 style={{ fontSize: '15px' }}>Describe it, we'll draft it</h3>
    </div>
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      <input
        type="text"
        className="form-input"
        style={{ flex: '1 1 320px' }}
        placeholder="Describe what you want to automate…"
        value={aiDescription}
        onChange={(e) => setAiDescription(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') draftWithAi(); }}
        disabled={isDrafting}
      />
      <button
        className="btn btn-primary"
        onClick={draftWithAi}
        disabled={isDrafting || !aiDescription.trim()}
      >
        {isDrafting ? 'Drafting…' : 'Draft it for me'}
      </button>
    </div>
  </section>
)}
```

- [ ] **Step 4: Run tests, commit**

Run: `cd frontend; npm run test:run -- src/features/templates`
Expected: PASS (existing 4 + new 3).

```bash
git add frontend/src/features/templates
git commit -m "feat: describe-it AI drafting box on template gallery"
```

---

### Task 5: "Explain this" in RunTimeline

**Files:**
- Modify: `frontend/src/features/executions/components/RunTimeline.tsx` (props + error card), `frontend/src/features/executions/ExecutionsPage.tsx` (pass workflowName)
- Test: `frontend/src/features/executions/components/RunTimeline.test.tsx` (extend)

**Interfaces:**
- Consumes: `aiApi.explain`, `useAiEnabled` (Task 3). RunTimeline currently takes `{ result: ExecutionResult }` — gains optional `workflowName?: string`; `StepLine` gains `stationName`/`workflowName` pass-through.
- Produces: UI only. `ExecutionsPage` call site becomes `<RunTimeline result={execution.result} workflowName={execution.workflowName} />`.

- [ ] **Step 1: Write the failing tests**

Extend `RunTimeline.test.tsx`:

```tsx
vi.mock('../../../shared/hooks/useAiEnabled', () => ({ useAiEnabled: vi.fn() }));
vi.mock('../../../shared/api/workflowApi', () => ({ aiApi: { explain: vi.fn() } }));
import { useAiEnabled } from '../../../shared/hooks/useAiEnabled';
import { aiApi } from '../../../shared/api/workflowApi';

describe('Explain this', () => {
  it('is hidden when AI is disabled', () => {
    vi.mocked(useAiEnabled).mockReturnValue(false);
    render(<RunTimeline result={result} workflowName="My flow" />);
    expect(screen.queryByRole('button', { name: 'Explain this' })).not.toBeInTheDocument();
  });

  it('fetches and shows the explanation for a failed action', async () => {
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.explain).mockResolvedValue('The mail server took too long. Try again later.');
    render(<RunTimeline result={result} workflowName="My flow" />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain this' }));
    await waitFor(() => {
      expect(aiApi.explain).toHaveBeenCalledWith({
        workflowName: 'My flow',
        stationName: 'Send report',
        stepName: 'Email',
        stepType: 'action-email',
        errorMessage: 'connect ETIMEDOUT 1.2.3.4:587',
      });
      expect(screen.getByText('The mail server took too long. Try again later.')).toBeInTheDocument();
    });
  });

  it('shows a gentle inline message when the explanation fails', async () => {
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.explain).mockRejectedValue(new Error('nope'));
    render(<RunTimeline result={result} workflowName="My flow" />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain this' }));
    await waitFor(() => {
      expect(screen.getByText("Couldn't get an explanation right now.")).toBeInTheDocument();
    });
  });
});
```

(Existing 3 tests must keep passing — add `vi.mocked(useAiEnabled).mockReturnValue(false)` default in a `beforeEach`, and add the imports `fireEvent, waitFor` to the RTL import.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend; npm run test:run -- src/features/executions/components/RunTimeline.test.tsx`
Expected: new tests FAIL (no button exists).

- [ ] **Step 3: Implement**

In `RunTimeline.tsx`:

1. Props: `export default function RunTimeline({ result, workflowName }: { result: ExecutionResult; workflowName?: string })`; pass `workflowName` and `station.stationName` down: `<StepLine key={step.stepId} step={step} stationName={station.stationName} workflowName={workflowName} />`.
2. Extend `StepLine`:

```tsx
import { useState } from 'react';
import { useAiEnabled } from '../../../shared/hooks/useAiEnabled';
import { aiApi } from '../../../shared/api/workflowApi';

function StepLine({ step, stationName, workflowName }: {
  step: StepResult; stationName: string; workflowName?: string;
}) {
  const info = STEP_TYPE_INFO[step.stepType] ?? { icon: '📦' };
  const failed = step.status === 'failed';
  const translated = failed && step.error ? translateError(step.error.message) : null;
  const aiEnabled = useAiEnabled();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const explain = async () => {
    if (isExplaining || !step.error) return;
    setIsExplaining(true);
    try {
      setExplanation(await aiApi.explain({
        workflowName: workflowName ?? '',
        stationName,
        stepName: step.stepName,
        stepType: step.stepType,
        errorMessage: step.error.message,
      }));
    } catch {
      setExplanation("Couldn't get an explanation right now.");
    } finally {
      setIsExplaining(false);
    }
  };
  // ... existing JSX; inside the translated-error box, after the suggestion div, add:
  //
  // {aiEnabled && !explanation && (
  //   <button className="btn btn-ghost btn-sm" style={{ marginTop: '6px' }} onClick={explain} disabled={isExplaining}>
  //     {isExplaining ? 'Thinking…' : 'Explain this'}
  //   </button>
  // )}
  // {explanation && (
  //   <div style={{ marginTop: '6px', color: 'var(--text-secondary)' }}>{explanation}</div>
  // )}
```

(The commented JSX above is the exact code to insert — uncommented — into the error-box block after the `translated.suggestion` div and before the technical-details `<details>`.)

3. In `ExecutionsPage.tsx`, update the call site: `<RunTimeline result={execution.result} workflowName={execution.workflowName} />`.

- [ ] **Step 4: Run tests, full frontend suite, commit**

Run: `cd frontend; npm run test:run -- src/features/executions` then `cd frontend; npm run test:run`
Expected: PASS.

```bash
git add frontend/src/features/executions
git commit -m "feat: AI explain-this on failed run actions"
```

---

### Task 6: Full-suite run and live verification

**Files:** none — verification only.

- [ ] **Step 1: Suites + build**

Run: `cd backend; npm run test -- --run` → all green.
Run: `cd frontend; npm run test:run` → all green.
Run: `cd frontend; npm run build` and `cd backend; npm run build` → clean.

- [ ] **Step 2: Disabled-state verification (no key)**

With dev servers running WITHOUT AI env vars:
- `curl http://localhost:3002/api/ai/status` → `{"success":true,"data":{"enabled":false}}`
- `curl -X POST http://localhost:3002/api/ai/draft -H "Content-Type: application/json" -d '{"description":"x"}'` → 503
- Browser: gallery shows NO describe-it box; failed run error cards show NO "Explain this" button. Console clean.

- [ ] **Step 3: Enabled-state verification (needs a real key)**

Requires the user's OpenRouter or NVIDIA key. Set in `backend/.env.development` (or environment): `AI_API_KEY=…`, `AI_MODEL=…` (and `AI_API_BASE_URL=https://integrate.api.nvidia.com/v1` for NVIDIA). Restart backend. Then:
- `/api/ai/status` → enabled true; gallery box appears.
- Type a description (e.g. "every morning fetch the weather and email the team") → Draft it for me → lands in the editor Plan View with a plausible multi-stage draft.
- Trigger a failing run (e.g. an automation with an unreachable URL) → Runs page → expand → "Explain this" → plain-language explanation appears.
- Console clean; screenshots of both AI surfaces.
If no key is available at execution time, mark Step 3 as pending-user and report it explicitly — do NOT fake it.

- [ ] **Step 4: Commit any fixes, done**
