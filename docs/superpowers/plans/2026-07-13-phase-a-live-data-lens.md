# Phase A — Live Data Lens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The step config panel's VariablePicker shows the real field tree of each earlier action's output (from the latest finished run, or AI-predicted when none exists); clicking a field inserts the `steps['…'].output.…` reference.

**Architecture:** A backend `deriveShape` util converts stored `executions.result` step outputs into bounded, redacted "shape trees"; `GET /api/workflows/:id/data-shapes` serves them; `POST /api/ai/infer-shape` asks the LLM for a realistic example output and derives its shape server-side. The frontend gets a shared `<ShapeTree>` component and an upgraded VariablePicker. No schema changes, no new persistence.

**Tech Stack:** Express + better-sqlite3 (sync), vitest + supertest (backend), React + RTL + vitest/jsdom (frontend), axios client, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-13-data-visible-automation-design.md` (Phase A + Shared Foundation sections).

## Global Constraints

- Truncation caps (exact values from spec): string samples 100 chars, arrays derive shape from first element only, depth cap 4, field cap 30 per level.
- Redaction pattern (verbatim): `/password|token|secret|api[_-]?key|authorization/i` — matching field names get `sample: '***'`; step config is redacted with the same pattern before being sent to the AI provider.
- API responses use the `{ success, data, error }` envelope; AI endpoints return 503 when unconfigured, 502 on provider failure (match `backend/src/routes/ai.ts`).
- No completed run → data-shapes returns 200 with `{ source: { kind: 'none' }, steps: {} }`, never 404 (404 only when the workflow itself doesn't exist).
- "Latest finished run" = most recent execution with status `completed` **or** `failed` (failed runs contribute shapes for the steps that completed before the failure).
- UI copy is plain English (UX-redesign terminology: Automation/Stage/Action/Run). AI-derived data is always labeled as a guess.
- Backend is CommonJS + strict TS, no `any`; `better-sqlite3` is synchronous — no async model methods.
- With no runs and no AI configured, VariablePicker must behave exactly as today (generic buttons) — zero regression; the existing three tests in `VariablePicker.test.tsx` must keep passing unmodified.
- Don't push; commits stay local on the feature branch.

---

### Task 0: Branch

- [ ] **Step 1: Create the feature branch** (currently on `master`)

```bash
git checkout -b feature/phase-a-data-lens
```

---

### Task 1: `deriveShape` backend util

**Files:**
- Create: `backend/src/utils/deriveShape.ts`
- Test: `backend/src/__tests__/deriveShape.test.ts`

**Interfaces:**
- Consumes: nothing (pure util).
- Produces: `interface ShapeNode { name: string; type: 'string'|'number'|'boolean'|'object'|'array'|'null'; sample?: string; children?: ShapeNode[]; truncated?: boolean; omittedCount?: number }`, `deriveShape(value: unknown, name?: string): ShapeNode`, `SENSITIVE_FIELD_PATTERN: RegExp`, `redactRecord(record: Record<string, unknown>): Record<string, unknown>`. Tasks 2 and 3 import all four.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/__tests__/deriveShape.test.ts
import { describe, it, expect } from 'vitest';
import { deriveShape, redactRecord } from '../utils/deriveShape';

describe('deriveShape', () => {
  it('derives primitive types with samples', () => {
    expect(deriveShape('hello', 'greeting')).toEqual({ name: 'greeting', type: 'string', sample: 'hello' });
    expect(deriveShape(42, 'count')).toEqual({ name: 'count', type: 'number', sample: '42' });
    expect(deriveShape(true, 'ok')).toEqual({ name: 'ok', type: 'boolean', sample: 'true' });
    expect(deriveShape(null, 'gone')).toEqual({ name: 'gone', type: 'null' });
    expect(deriveShape(undefined, 'missing')).toEqual({ name: 'missing', type: 'null' });
  });

  it('truncates string samples to 100 chars with ellipsis', () => {
    const shape = deriveShape('x'.repeat(150), 's');
    expect(shape.sample).toHaveLength(101); // 100 chars + '…'
    expect(shape.sample!.endsWith('…')).toBe(true);
  });

  it('derives object fields as children', () => {
    const shape = deriveShape({ orderId: 10023, customer: 'ACME' });
    expect(shape.type).toBe('object');
    expect(shape.children).toEqual([
      { name: 'orderId', type: 'number', sample: '10023' },
      { name: 'customer', type: 'string', sample: 'ACME' },
    ]);
  });

  it('derives array shape from the first element only, sample shows length', () => {
    const shape = deriveShape([{ id: 1 }, { id: 2 }, { id: 3 }], 'rows');
    expect(shape.type).toBe('array');
    expect(shape.sample).toBe('3 items');
    expect(shape.children).toHaveLength(1);
    expect(shape.children![0].name).toBe('[0]');
    expect(shape.children![0].children).toEqual([{ name: 'id', type: 'number', sample: '1' }]);
  });

  it('caps depth at 4', () => {
    const deep = { a: { b: { c: { d: { e: 'too deep' } } } } };
    const shape = deriveShape(deep);
    // depth 0=root, 1=a, 2=b, 3=c, 4=d — d's children are omitted
    const d = shape.children![0].children![0].children![0].children![0];
    expect(d.name).toBe('d');
    expect(d.truncated).toBe(true);
    expect(d.children).toBeUndefined();
  });

  it('caps fields at 30 per level and reports omitted count', () => {
    const wide: Record<string, number> = {};
    for (let i = 0; i < 35; i++) wide[`f${i}`] = i;
    const shape = deriveShape(wide);
    expect(shape.children).toHaveLength(30);
    expect(shape.truncated).toBe(true);
    expect(shape.omittedCount).toBe(5);
  });

  it('redacts samples for sensitive field names, keeping type', () => {
    const shape = deriveShape({ password: 'hunter2', apiKey: 'sk-123', api_key: 'sk-456', Authorization: 'Bearer x', count: 7 });
    const byName = Object.fromEntries(shape.children!.map(c => [c.name, c]));
    expect(byName.password.sample).toBe('***');
    expect(byName.apiKey.sample).toBe('***');
    expect(byName.api_key.sample).toBe('***');
    expect(byName.Authorization.sample).toBe('***');
    expect(byName.count.sample).toBe('7');
  });

  it('handles an empty object and empty array', () => {
    expect(deriveShape({})).toEqual({ name: '', type: 'object', children: [] });
    expect(deriveShape([], 'list')).toEqual({ name: 'list', type: 'array', sample: '0 items' });
  });
});

describe('redactRecord', () => {
  it('masks sensitive keys and passes others through', () => {
    expect(redactRecord({ url: 'https://x.test', headers: { a: 1 }, slackWebhookUrl: 'https://hooks', dbPassword: 'pw' }))
      .toEqual({ url: 'https://x.test', headers: { a: 1 }, slackWebhookUrl: 'https://hooks', dbPassword: '***' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run src/__tests__/deriveShape.test.ts`
Expected: FAIL — cannot resolve `../utils/deriveShape`.

- [ ] **Step 3: Write the implementation**

```ts
// backend/src/utils/deriveShape.ts
export interface ShapeNode {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  sample?: string;
  children?: ShapeNode[];
  truncated?: boolean;
  omittedCount?: number;
}

export const SENSITIVE_FIELD_PATTERN = /password|token|secret|api[_-]?key|authorization/i;

const MAX_SAMPLE_LENGTH = 100;
const MAX_DEPTH = 4;
const MAX_FIELDS_PER_LEVEL = 30;

/** Convert an arbitrary JSON value into a bounded, redacted shape tree. */
export function deriveShape(value: unknown, name = ''): ShapeNode {
  return derive(value, name, 0);
}

/** Mask values of sensitive keys (shallow) — used before sending configs to the AI provider. */
export function redactRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    out[key] = SENSITIVE_FIELD_PATTERN.test(key) ? '***' : val;
  }
  return out;
}

function derive(value: unknown, name: string, depth: number): ShapeNode {
  const redacted = SENSITIVE_FIELD_PATTERN.test(name);

  if (value === null || value === undefined) {
    return { name, type: 'null' };
  }
  if (typeof value === 'string') {
    return { name, type: 'string', sample: redacted ? '***' : truncateSample(value) };
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { name, type: typeof value === 'number' ? 'number' : 'boolean', sample: redacted ? '***' : String(value) };
  }
  if (Array.isArray(value)) {
    const node: ShapeNode = { name, type: 'array', sample: `${value.length} items` };
    if (value.length > 0) {
      if (depth < MAX_DEPTH) {
        node.children = [derive(value[0], '[0]', depth + 1)];
      } else {
        node.truncated = true;
      }
    }
    return node;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const node: ShapeNode = { name, type: 'object' };
  if (depth >= MAX_DEPTH) {
    node.truncated = true;
    node.omittedCount = entries.length;
    return node;
  }
  node.children = entries.slice(0, MAX_FIELDS_PER_LEVEL).map(([key, val]) => derive(val, key, depth + 1));
  if (entries.length > MAX_FIELDS_PER_LEVEL) {
    node.truncated = true;
    node.omittedCount = entries.length - MAX_FIELDS_PER_LEVEL;
  }
  return node;
}

function truncateSample(s: string): string {
  return s.length > MAX_SAMPLE_LENGTH ? `${s.slice(0, MAX_SAMPLE_LENGTH)}…` : s;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/deriveShape.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/deriveShape.ts backend/src/__tests__/deriveShape.test.ts
git commit -m "feat: deriveShape util — bounded, redacted shape trees from JSON values"
```

---

### Task 2: data-shapes service + endpoint

**Files:**
- Modify: `backend/src/models/execution.ts` (add one query method after `getById`, ~line 55)
- Create: `backend/src/services/dataShapes.ts`
- Modify: `backend/src/routes/workflows.ts` (new route after `GET /:id/executions`, ~line 208)
- Test: `backend/src/__tests__/dataShapes.test.ts`

**Interfaces:**
- Consumes: `deriveShape`, `ShapeNode` from Task 1; `ExecutionModel`, `WorkflowModel` (existing).
- Produces: `ExecutionModel.getLatestFinishedByWorkflowId(workflowId: string): Execution | null`; `getWorkflowDataShapes(workflowId: string): DataShapesResponse` where `interface DataShapesSource { kind: 'run' | 'none'; executionId?: string; time?: string }`, `interface StepShapeEntry { shape?: ShapeNode; status: StepResult['status'] }`, `interface DataShapesResponse { source: DataShapesSource; steps: Record<string, StepShapeEntry> }` (steps keyed by **stepId**); HTTP `GET /api/workflows/:id/data-shapes` → `{ success: true, data: DataShapesResponse }`. Task 4's frontend types mirror these exactly.

- [ ] **Step 1: Write the failing test**

The route test follows the mock style of `backend/src/__tests__/ai.route.test.ts` (mock modules, mount only the router under test).

```ts
// backend/src/__tests__/dataShapes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Execution } from '../types/workflow';

vi.mock('../models/execution', () => ({
  ExecutionModel: { getLatestFinishedByWorkflowId: vi.fn() },
}));
vi.mock('../models/workflow', () => ({
  WorkflowModel: { getById: vi.fn() },
}));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { getWorkflowDataShapes } from '../services/dataShapes';
import { ExecutionModel } from '../models/execution';
import { WorkflowModel } from '../models/workflow';
import workflowsRouter from '../routes/workflows';

const app = express();
app.use(express.json());
app.use('/api/workflows', workflowsRouter);

function finishedExecution(): Execution {
  return {
    id: 'exec-1', workflowId: 'w1', workflowName: 'W', status: 'failed',
    triggeredBy: 'manual', startTime: '2026-07-13T06:00:00.000Z', successRate: 50,
    result: {
      stations: [{
        stationId: 'st1', stationName: 'Stage 1', status: 'failed',
        steps: [
          { stepId: 's1', stepName: 'Fetch', stepType: 'http-request', status: 'completed',
            output: { status: 200, data: { orderId: 10023 } } },
          { stepId: 's2', stepName: 'Mail', stepType: 'action-email', status: 'failed',
            error: { message: 'SMTP down' } },
        ],
      }],
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('getWorkflowDataShapes', () => {
  it('returns kind none when there is no finished run', () => {
    vi.mocked(ExecutionModel.getLatestFinishedByWorkflowId).mockReturnValue(null);
    expect(getWorkflowDataShapes('w1')).toEqual({ source: { kind: 'none' }, steps: {} });
  });

  it('derives shapes for completed steps; failed steps get status but no shape', () => {
    vi.mocked(ExecutionModel.getLatestFinishedByWorkflowId).mockReturnValue(finishedExecution());
    const shapes = getWorkflowDataShapes('w1');
    expect(shapes.source).toEqual({ kind: 'run', executionId: 'exec-1', time: '2026-07-13T06:00:00.000Z' });
    expect(shapes.steps.s1.status).toBe('completed');
    expect(shapes.steps.s1.shape!.type).toBe('object');
    expect(shapes.steps.s1.shape!.children!.map(c => c.name)).toEqual(['status', 'data']);
    expect(shapes.steps.s2).toEqual({ status: 'failed', shape: undefined });
  });

  it('returns kind none when the latest run has no stored result', () => {
    vi.mocked(ExecutionModel.getLatestFinishedByWorkflowId).mockReturnValue({
      ...finishedExecution(), result: undefined,
    });
    expect(getWorkflowDataShapes('w1')).toEqual({ source: { kind: 'none' }, steps: {} });
  });
});

describe('GET /api/workflows/:id/data-shapes', () => {
  it('404 when the workflow does not exist', async () => {
    vi.mocked(WorkflowModel.getById).mockReturnValue(null);
    const res = await request(app).get('/api/workflows/nope/data-shapes');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('200 with shapes for an existing workflow', async () => {
    vi.mocked(WorkflowModel.getById).mockReturnValue({ id: 'w1' } as never);
    vi.mocked(ExecutionModel.getLatestFinishedByWorkflowId).mockReturnValue(finishedExecution());
    const res = await request(app).get('/api/workflows/w1/data-shapes');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.source.kind).toBe('run');
    expect(res.body.data.steps.s1.shape.type).toBe('object');
  });

  it('200 with kind none when the workflow exists but never ran', async () => {
    vi.mocked(WorkflowModel.getById).mockReturnValue({ id: 'w1' } as never);
    vi.mocked(ExecutionModel.getLatestFinishedByWorkflowId).mockReturnValue(null);
    const res = await request(app).get('/api/workflows/w1/data-shapes');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ source: { kind: 'none' }, steps: {} });
  });
});
```

Note: `routes/workflows.ts` imports more modules than these three mocks. Run the test; if unmocked imports touch the real DB at import time (`../db/database`), add `vi.mock('../db/database', () => ({ default: {} }))` — check how `backend/src/__tests__/workflows.test.ts` handles this and copy its mock set exactly.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/dataShapes.test.ts`
Expected: FAIL — cannot resolve `../services/dataShapes`; `getLatestFinishedByWorkflowId` missing.

- [ ] **Step 3: Add the model method**

In `backend/src/models/execution.ts`, after `getById` (line ~55), inside `ExecutionModel`:

```ts
  static getLatestFinishedByWorkflowId(workflowId: string): Execution | null {
    const stmt = db.prepare(`
      SELECT * FROM executions
      WHERE workflow_id = ? AND status IN ('completed', 'failed')
      ORDER BY start_time DESC
      LIMIT 1
    `);
    const row = stmt.get(workflowId) as ExecutionRow | undefined;
    return row ? this.rowToExecution(row) : null;
  }
```

- [ ] **Step 4: Create the service**

```ts
// backend/src/services/dataShapes.ts
import { ExecutionModel } from '../models/execution';
import { deriveShape, ShapeNode } from '../utils/deriveShape';
import type { StepResult } from '../types/workflow';

export interface DataShapesSource {
  kind: 'run' | 'none';
  executionId?: string;
  time?: string;
}

export interface StepShapeEntry {
  shape?: ShapeNode;
  status: StepResult['status'];
}

export interface DataShapesResponse {
  source: DataShapesSource;
  steps: Record<string, StepShapeEntry>;
}

/** Shape trees for every step of a workflow's latest finished run (completed or failed). */
export function getWorkflowDataShapes(workflowId: string): DataShapesResponse {
  const execution = ExecutionModel.getLatestFinishedByWorkflowId(workflowId);
  if (!execution || !execution.result) {
    return { source: { kind: 'none' }, steps: {} };
  }

  const steps: Record<string, StepShapeEntry> = {};
  for (const station of execution.result.stations) {
    for (const step of station.steps) {
      steps[step.stepId] = {
        status: step.status,
        shape: step.status === 'completed' && step.output !== undefined
          ? deriveShape(step.output)
          : undefined,
      };
    }
  }

  return {
    source: { kind: 'run', executionId: execution.id, time: execution.startTime },
    steps,
  };
}
```

- [ ] **Step 5: Add the route**

In `backend/src/routes/workflows.ts`, import at top: `import { getWorkflowDataShapes } from '../services/dataShapes';` and add after the `GET /:id/executions` handler (~line 208), matching the file's existing try/catch response style:

```ts
/**
 * GET /api/workflows/:id/data-shapes
 * Shape trees of each step's output from the latest finished run.
 */
router.get('/:id/data-shapes', (req: Request, res: Response) => {
  try {
    const workflow = WorkflowModel.getById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({ success: true, data: getWorkflowDataShapes(req.params.id) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to compute data shapes' });
  }
});
```

(If the surrounding handlers log errors before responding, do the same here with the file's logger.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/__tests__/dataShapes.test.ts`
Expected: PASS (6 tests). Also run the full backend suite to catch regressions: `npm run test -- --run` — expected all green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/execution.ts backend/src/services/dataShapes.ts backend/src/routes/workflows.ts backend/src/__tests__/dataShapes.test.ts
git commit -m "feat: GET /api/workflows/:id/data-shapes from latest finished run"
```

---

### Task 3: AI shape inference endpoint

**Files:**
- Modify: `backend/src/services/aiAssistant.ts` (append after `explainRunError`)
- Modify: `backend/src/routes/ai.ts` (new route after `/explain`)
- Test: `backend/src/__tests__/aiAssistant.test.ts` (append describe block), `backend/src/__tests__/ai.route.test.ts` (append describe block)

**Interfaces:**
- Consumes: `chat` (existing private helper in aiAssistant.ts), `deriveShape`, `redactRecord`, `ShapeNode` from Task 1.
- Produces: `inferStepShape(step: { name: string; type: string; config: Record<string, unknown> }): Promise<ShapeNode>`; HTTP `POST /api/ai/infer-shape` body `{ step: { name, type, config } }` → 200 `{ success: true, data: { shape: ShapeNode, source: { kind: 'ai-inferred' } } }`, 503 unconfigured, 400 missing/invalid step, 502 provider failure. Task 4's `aiApi.inferShape` calls this.

**Design note (locked in spec discussion):** the AI is asked for a realistic **example output object**, not a shape — the server then runs `deriveShape` on it. Validation reduces to JSON.parse, and format consistency with run-derived shapes is guaranteed.

- [ ] **Step 1: Write the failing service test**

Append to `backend/src/__tests__/aiAssistant.test.ts` (reuse its existing `chatResponse` helper if present; otherwise define locally inside the new describe as shown):

```ts
describe('inferStepShape', () => {
  const shapeChatResponse = (content: string) => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  }) as Response;

  it('derives a ShapeNode from the AI example output', async () => {
    const fetchMock = vi.fn().mockResolvedValue(shapeChatResponse('{"status": 200, "data": {"orderId": 10023}}'));
    vi.stubGlobal('fetch', fetchMock);
    const shape = await inferStepShape({ name: 'Fetch', type: 'http-request', config: { url: 'https://api.test' } });
    expect(shape.type).toBe('object');
    expect(shape.children!.map(c => c.name)).toEqual(['status', 'data']);
  });

  it('strips markdown fences before parsing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(shapeChatResponse('```json\n{"ok": true}\n```')));
    const shape = await inferStepShape({ name: 'S', type: 'script-js', config: {} });
    expect(shape.children).toEqual([{ name: 'ok', type: 'boolean', sample: 'true' }]);
  });

  it('redacts sensitive config values in the prompt sent to the provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue(shapeChatResponse('{"sent": true}'));
    vi.stubGlobal('fetch', fetchMock);
    await inferStepShape({ name: 'Mail', type: 'action-email', config: { emailTo: 'a@b.c', smtpPassword: 'hunter2' } });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user').content;
    expect(userMessage).toContain('a@b.c');
    expect(userMessage).not.toContain('hunter2');
    expect(userMessage).toContain('***');
  });

  it('throws when the AI response is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(shapeChatResponse('Sure! The output would be…')));
    await expect(inferStepShape({ name: 'S', type: 'script-js', config: {} }))
      .rejects.toThrow('AI response was not valid JSON');
  });
});
```

Add `inferStepShape` to the existing import from `../services/aiAssistant` at the top of the file. Match the file's existing env setup (it sets `AI_API_KEY`/`AI_MODEL` in a `beforeEach` or per-test — copy exactly what `draftAutomation` tests do so `chat()` doesn't bail early).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/aiAssistant.test.ts`
Expected: FAIL — `inferStepShape` is not exported.

- [ ] **Step 3: Implement the service function**

Append to `backend/src/services/aiAssistant.ts` (add `import { deriveShape, redactRecord, ShapeNode } from '../utils/deriveShape';` at the top):

```ts
const INFER_SHAPE_SYSTEM_PROMPT = `You predict what data an automation action will output.
Respond with ONLY a realistic example JSON output object — no prose, no markdown fences.
Expected output style per action type (match these key names):
- "http-request": {"status": 200, "statusText": "OK", "data": <realistic response body for the configured URL>}
- "script-js" / "script-python": the object the configured code returns
- "connector-db": {"rows": [<one example row for the configured query>], "count": 1}
- "set-variable": {"<variableName>": <value>}
- "if-else": {"result": true, "branch": "true"}
- "wait": {"waited": true, "duration": 5, "unit": "seconds", "ms": 5000}
- "trigger-manual" / "trigger-cron" / "trigger-webhook": {"triggered": true, "timestamp": "2026-01-01T00:00:00.000Z"}
- "action-email": {"sent": true, "to": "a@b.c", "subject": "…", "messageId": "<id>", "timestamp": "…"}
- "action-slack" / "notification-slack": {"sent": true, "message": "…"}
Keep it small: arrays at most 1 item, strings short.`;

export interface InferShapeInput {
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export async function inferStepShape(step: InferShapeInput): Promise<ShapeNode> {
  const safeConfig = redactRecord(step.config);
  const content = await chat([
    { role: 'system', content: INFER_SHAPE_SYSTEM_PROMPT },
    { role: 'user', content: `Action "${step.name}" of type "${step.type}" with configuration: ${JSON.stringify(safeConfig)}` },
  ]);
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let example: unknown;
  try {
    example = JSON.parse(stripped);
  } catch {
    throw new Error('AI response was not valid JSON');
  }
  log.info({ step: step.name, type: step.type }, 'AI shape inferred');
  return deriveShape(example);
}
```

- [ ] **Step 4: Run service test to verify it passes**

Run: `npx vitest run src/__tests__/aiAssistant.test.ts`
Expected: PASS (existing tests + 4 new).

- [ ] **Step 5: Write the failing route test**

Append to `backend/src/__tests__/ai.route.test.ts`. Add `inferStepShape: vi.fn()` to the existing `vi.mock('../services/aiAssistant', …)` factory and to the import list.

```ts
describe('POST /api/ai/infer-shape', () => {
  it('503 when AI is disabled', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(false);
    const res = await request(app).post('/api/ai/infer-shape').send({ step: { name: 'S', type: 'http-request', config: {} } });
    expect(res.status).toBe(503);
  });

  it('400 when step or step.type is missing', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    expect((await request(app).post('/api/ai/infer-shape').send({})).status).toBe(400);
    expect((await request(app).post('/api/ai/infer-shape').send({ step: { name: 'S' } })).status).toBe(400);
  });

  it('200 with shape and ai-inferred source', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(inferStepShape).mockResolvedValue({ name: '', type: 'object', children: [] });
    const res = await request(app).post('/api/ai/infer-shape').send({ step: { name: 'S', type: 'script-js', config: {} } });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ shape: { name: '', type: 'object', children: [] }, source: { kind: 'ai-inferred' } });
  });

  it('502 when inference fails', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(inferStepShape).mockRejectedValue(new Error('boom'));
    const res = await request(app).post('/api/ai/infer-shape').send({ step: { name: 'S', type: 'script-js', config: {} } });
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 6: Run route test to verify it fails**

Run: `npx vitest run src/__tests__/ai.route.test.ts`
Expected: FAIL — 404 on the new path (route not defined).

- [ ] **Step 7: Add the route**

In `backend/src/routes/ai.ts`, add `inferStepShape` to the import from `../services/aiAssistant`, then append before `export default router;`:

```ts
router.post('/infer-shape', async (req, res) => {
  if (!isAiEnabled()) {
    return res.status(503).json({ success: false, error: 'AI assist is not configured' });
  }
  const step = req.body?.step;
  if (!step || typeof step !== 'object' || typeof step.type !== 'string' || !step.type.trim()) {
    return res.status(400).json({ success: false, error: 'step with a type is required' });
  }
  try {
    const shape = await inferStepShape({
      name: truncateField(step.name),
      type: truncateField(step.type),
      config: step.config && typeof step.config === 'object' && !Array.isArray(step.config)
        ? (step.config as Record<string, unknown>)
        : {},
    });
    res.json({ success: true, data: { shape, source: { kind: 'ai-inferred' } } });
  } catch (error: unknown) {
    log.error({ err: error }, 'AI shape inference failed');
    res.status(502).json({ success: false, error: 'Could not predict fields' });
  }
});
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/ai.route.test.ts src/__tests__/aiAssistant.test.ts`
Expected: PASS. Then full backend suite: `npm run test -- --run` — all green.

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/aiAssistant.ts backend/src/routes/ai.ts backend/src/__tests__/aiAssistant.test.ts backend/src/__tests__/ai.route.test.ts
git commit -m "feat: POST /api/ai/infer-shape — AI-predicted output shapes"
```

---

### Task 4: Frontend shape types + API client methods

**Files:**
- Create: `frontend/src/shared/types/shapes.ts`
- Modify: `frontend/src/shared/api/workflowApi.ts` (add `getDataShapes` inside `workflowApi`, `inferShape` inside `aiApi` at line ~174)
- Test: `frontend/src/shared/api/workflowApi.test.ts` (append)

**Interfaces:**
- Consumes: HTTP endpoints from Tasks 2–3.
- Produces: frontend `ShapeNode`, `DataShapesSource`, `StepShapeEntry`, `DataShapesResponse` (field-for-field mirrors of Task 2's backend interfaces); `workflowApi.getDataShapes(id: string): Promise<DataShapesResponse>`; `aiApi.inferShape(step: { name: string; type: string; config: Record<string, unknown> }): Promise<ShapeNode>`. Tasks 5–6 import these.

- [ ] **Step 1: Create the types file**

```ts
// frontend/src/shared/types/shapes.ts
export interface ShapeNode {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  sample?: string;
  children?: ShapeNode[];
  truncated?: boolean;
  omittedCount?: number;
}

export interface DataShapesSource {
  kind: 'run' | 'none';
  executionId?: string;
  time?: string;
}

export interface StepShapeEntry {
  shape?: ShapeNode;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

export interface DataShapesResponse {
  source: DataShapesSource;
  steps: Record<string, StepShapeEntry>;
}
```

- [ ] **Step 2: Write the failing API test**

Append to `frontend/src/shared/api/workflowApi.test.ts`, following that file's existing axios-mock pattern exactly (read its first ~40 lines and reuse the same mock helpers; the assertions to add):

```ts
describe('data shapes API', () => {
  it('getDataShapes unwraps the envelope', async () => {
    const payload = { source: { kind: 'run', executionId: 'e1', time: 't' }, steps: {} };
    mockGet.mockResolvedValue({ data: { success: true, data: payload } }); // adapt to the file's mock helper
    await expect(workflowApi.getDataShapes('w1')).resolves.toEqual(payload);
    expect(mockGet).toHaveBeenCalledWith('/workflows/w1/data-shapes');
  });

  it('aiApi.inferShape posts the step and unwraps the shape', async () => {
    const shape = { name: '', type: 'object', children: [] };
    mockPost.mockResolvedValue({ data: { success: true, data: { shape, source: { kind: 'ai-inferred' } } } });
    await expect(aiApi.inferShape({ name: 'S', type: 'script-js', config: {} })).resolves.toEqual(shape);
    expect(mockPost).toHaveBeenCalledWith('/ai/infer-shape', { step: { name: 'S', type: 'script-js', config: {} } });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run (from `frontend/`): `npx vitest run src/shared/api/workflowApi.test.ts`
Expected: FAIL — `getDataShapes` / `inferShape` are not functions.

- [ ] **Step 4: Add the client methods**

In `frontend/src/shared/api/workflowApi.ts`, add `import type { DataShapesResponse, ShapeNode } from '../types/shapes';` at the top. Inside the `workflowApi` object:

```ts
  getDataShapes: async (id: string): Promise<DataShapesResponse> => {
    const response = await api.get<ApiResponse<DataShapesResponse>>(`/workflows/${id}/data-shapes`);
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },
```

Inside the `aiApi` object (line ~174):

```ts
  inferShape: async (step: { name: string; type: string; config: Record<string, unknown> }): Promise<ShapeNode> => {
    const response = await api.post<ApiResponse<{ shape: ShapeNode }>>('/ai/infer-shape', { step });
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!.shape;
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/shared/api/workflowApi.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/types/shapes.ts frontend/src/shared/api/workflowApi.ts frontend/src/shared/api/workflowApi.test.ts
git commit -m "feat: frontend shape types and data-shapes/infer-shape API client"
```

---

### Task 5: `<ShapeTree>` shared component

**Files:**
- Create: `frontend/src/shared/components/ShapeTree.tsx`
- Test: `frontend/src/shared/components/ShapeTree.test.tsx`

**Interfaces:**
- Consumes: `ShapeNode` from Task 4.
- Produces: `export function ShapeTree({ shape, onSelectPath }: { shape: ShapeNode; onSelectPath?: (path: string) => void })`. Paths are relative to the shape root, dot notation for identifier-safe names (`data.orderId`), bracket for array samples (`rows[0].id`) and non-identifier names (`['content-type']`). Root itself is not selectable. Task 6 consumes this.

Note: `JsonTreeView.tsx` (raw values) stays untouched — ShapeTree renders *shapes* (type chips + samples + click-to-select), a different job.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/shared/components/ShapeTree.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShapeTree } from './ShapeTree';
import type { ShapeNode } from '../types/shapes';

const shape: ShapeNode = {
  name: '', type: 'object',
  children: [
    { name: 'orderId', type: 'number', sample: '10023' },
    {
      name: 'rows', type: 'array', sample: '3 items',
      children: [{
        name: '[0]', type: 'object',
        children: [{ name: 'id', type: 'number', sample: '1' }],
      }],
    },
    { name: 'content-type', type: 'string', sample: 'application/json' },
    { name: 'big', type: 'object', truncated: true, omittedCount: 12 },
  ],
};

describe('ShapeTree', () => {
  it('renders field names, types, and samples', () => {
    render(<ShapeTree shape={shape} />);
    expect(screen.getByText('orderId')).toBeInTheDocument();
    expect(screen.getByText('number')).toBeInTheDocument();
    expect(screen.getByText('10023')).toBeInTheDocument();
  });

  it('shows omitted-field notice for truncated nodes', () => {
    render(<ShapeTree shape={shape} />);
    expect(screen.getByText('12 more fields omitted')).toBeInTheDocument();
  });

  it('calls onSelectPath with a dot path for identifier-safe fields', () => {
    const onSelectPath = vi.fn();
    render(<ShapeTree shape={shape} onSelectPath={onSelectPath} />);
    fireEvent.click(screen.getByRole('button', { name: /orderId/ }));
    expect(onSelectPath).toHaveBeenCalledWith('orderId');
  });

  it('builds array element paths with [0]', () => {
    const onSelectPath = vi.fn();
    render(<ShapeTree shape={shape} onSelectPath={onSelectPath} />);
    fireEvent.click(screen.getByRole('button', { name: /^id/ }));
    expect(onSelectPath).toHaveBeenCalledWith('rows[0].id');
  });

  it('brackets non-identifier field names', () => {
    const onSelectPath = vi.fn();
    render(<ShapeTree shape={shape} onSelectPath={onSelectPath} />);
    fireEvent.click(screen.getByRole('button', { name: /content-type/ }));
    expect(onSelectPath).toHaveBeenCalledWith("['content-type']");
  });

  it('renders plain text (no buttons) when onSelectPath is not provided', () => {
    render(<ShapeTree shape={shape} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/components/ShapeTree.test.tsx`
Expected: FAIL — cannot resolve `./ShapeTree`.

- [ ] **Step 3: Implement the component**

```tsx
// frontend/src/shared/components/ShapeTree.tsx
import type { ShapeNode } from '../types/shapes';

interface ShapeTreeProps {
  shape: ShapeNode;
  onSelectPath?: (path: string) => void;
}

const IDENTIFIER_SAFE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function childPath(parentPath: string, child: ShapeNode): string {
  if (child.name === '[0]') return `${parentPath}[0]`;
  if (IDENTIFIER_SAFE.test(child.name)) {
    return parentPath ? `${parentPath}.${child.name}` : child.name;
  }
  return `${parentPath}['${child.name.replace(/'/g, "\\'")}']`;
}

export function ShapeTree({ shape, onSelectPath }: ShapeTreeProps) {
  return (
    <div className="font-mono text-[11px] leading-relaxed">
      <ShapeTreeNode node={shape} path="" onSelectPath={onSelectPath} depth={0} />
    </div>
  );
}

interface NodeProps {
  node: ShapeNode;
  path: string;
  depth: number;
  onSelectPath?: (path: string) => void;
}

function ShapeTreeNode({ node, path, depth, onSelectPath }: NodeProps) {
  const isRoot = path === '';
  const label = node.name === '[0]' ? 'each item' : node.name;

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
      {!isRoot && (
        <div className="flex items-center gap-1.5 py-0.5">
          {onSelectPath ? (
            <button
              onClick={() => onSelectPath(path)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
              title={`Insert reference to ${path}`}
            >
              {label}
            </button>
          ) : (
            <span className="text-blue-600 dark:text-blue-400">{label}</span>
          )}
          <span className="text-[9px] px-1 rounded bg-tertiary text-muted uppercase">{node.type}</span>
          {node.sample !== undefined && (
            <span className="text-muted truncate max-w-[160px]" title={node.sample}>{node.sample}</span>
          )}
        </div>
      )}
      {node.children?.map((child) => (
        <ShapeTreeNode
          key={child.name}
          node={child}
          path={childPath(path, child)}
          depth={depth + 1}
          onSelectPath={onSelectPath}
        />
      ))}
      {node.truncated && node.omittedCount !== undefined && (
        <div className="text-muted italic py-0.5" style={{ paddingLeft: 14 }}>
          {node.omittedCount} more fields omitted
        </div>
      )}
    </div>
  );
}
```

(Collapse/expand is intentionally omitted for v1 — shapes are already depth-capped at 4 and field-capped at 30 server-side; YAGNI. If real payloads prove noisy, add JsonTreeView-style chevron toggling later.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/components/ShapeTree.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/components/ShapeTree.tsx frontend/src/shared/components/ShapeTree.test.tsx
git commit -m "feat: ShapeTree shared component for shape trees with path selection"
```

---

### Task 6: VariablePicker upgrade

**Files:**
- Create: `frontend/src/features/editor/hooks/useDataShapes.ts`
- Modify: `frontend/src/features/editor/components/VariablePicker.tsx`
- Test: `frontend/src/features/editor/components/VariablePicker.test.tsx` (append; existing 3 tests stay unmodified and must keep passing)

**Interfaces:**
- Consumes: `workflowApi.getDataShapes`, `aiApi.inferShape` (Task 4), `ShapeTree` (Task 5), `useAiEnabled` (existing, `frontend/src/shared/hooks/useAiEnabled.ts`).
- Produces: `useDataShapes(workflowId: string): DataShapesResponse | null` (null while loading or on error). VariablePicker keeps its exact existing props (`workflow`, `currentStepId`, `onSelect`) — callers (NotificationConfigForm, HttpRequestConfigForm, VariableConfigForm, ConditionConfigForm, StationConfigPanel) need no changes.

**Behavior (from spec):** per earlier step, priority ① run shape (badge "📸 From run at {local time}") → ② on-demand AI guess (button "✨ Predict fields", result badge "✨ AI guess — verify before relying on it") → ③ existing generic buttons. Generic buttons always stay rendered below the tree (no regression). Steps whose latest-run status isn't `completed` show "No data from last run". AI guesses are cached in a module-level Map keyed by `type + JSON.stringify(config)`. Fetch-on-mount, no store caching (each panel open = one small GET, always fresh — deliberate simplification of the spec's "cache until next Test/Run" language).

- [ ] **Step 1: Write the hook**

```ts
// frontend/src/features/editor/hooks/useDataShapes.ts
import { useEffect, useState } from 'react';
import { workflowApi } from '../../../shared/api/workflowApi';
import type { DataShapesResponse } from '../../../shared/types/shapes';

/** Latest-run output shapes for a workflow; null while loading or unavailable. */
export function useDataShapes(workflowId: string): DataShapesResponse | null {
  const [shapes, setShapes] = useState<DataShapesResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    setShapes(null);
    workflowApi
      .getDataShapes(workflowId)
      .then((data) => { if (mounted) setShapes(data); })
      .catch(() => { if (mounted) setShapes(null); });
    return () => { mounted = false; };
  }, [workflowId]);

  return shapes;
}
```

- [ ] **Step 2: Write the failing component tests**

Append to `frontend/src/features/editor/components/VariablePicker.test.tsx`. Mock the API module and AI hook at the top of the file (module-level `vi.mock` calls are hoisted — place them after imports; the existing 3 tests will then exercise the "no shapes" fallback, which must still pass):

```tsx
import { waitFor } from '@testing-library/react';
import { workflowApi, aiApi } from '../../../shared/api/workflowApi';
import { useAiEnabled } from '../../../shared/hooks/useAiEnabled';

vi.mock('../../../shared/api/workflowApi', () => ({
  workflowApi: { getDataShapes: vi.fn().mockResolvedValue({ source: { kind: 'none' }, steps: {} }) },
  aiApi: { inferShape: vi.fn() },
}));
vi.mock('../../../shared/hooks/useAiEnabled', () => ({
  useAiEnabled: vi.fn().mockReturnValue(false),
}));

const runShapes = {
  source: { kind: 'run', executionId: 'e1', time: '2026-07-13T06:00:00.000Z' },
  steps: {
    s1: {
      status: 'completed',
      shape: {
        name: '', type: 'object',
        children: [{
          name: 'data', type: 'object',
          children: [{ name: 'orderId', type: 'number', sample: '10023' }],
        }],
      },
    },
  },
};

describe('VariablePicker with data shapes', () => {
  it('renders the field tree from the latest run with a source badge', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue(runShapes as never);
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={vi.fn()} />);
    expect(await screen.findByText('orderId')).toBeInTheDocument();
    expect(screen.getByText(/From run at/)).toBeInTheDocument();
  });

  it('clicking a field inserts the full steps[…].output path', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue(runShapes as never);
    const onSelect = vi.fn();
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={onSelect} />);
    fireEvent.click(await screen.findByRole('button', { name: /orderId/ }));
    expect(onSelect).toHaveBeenCalledWith("steps['Fetch data'].output.data.orderId");
  });

  it('shows "No data from last run" for steps that did not complete', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue({
      source: { kind: 'run', executionId: 'e1', time: '2026-07-13T06:00:00.000Z' },
      steps: { s1: { status: 'failed' } },
    } as never);
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={vi.fn()} />);
    expect(await screen.findByText('No data from last run')).toBeInTheDocument();
  });

  it('offers Predict fields only when AI is enabled and no run shape exists', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue({ source: { kind: 'none' }, steps: {} } as never);
    vi.mocked(useAiEnabled).mockReturnValue(true);
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={vi.fn()} />);
    expect(await screen.findByRole('button', { name: /Predict fields/ })).toBeInTheDocument();
  });

  it('Predict fields fetches an AI guess and renders it with the guess badge', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue({ source: { kind: 'none' }, steps: {} } as never);
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.inferShape).mockResolvedValue({
      name: '', type: 'object',
      children: [{ name: 'status', type: 'number', sample: '200' }],
    } as never);
    const onSelect = vi.fn();
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={onSelect} />);
    fireEvent.click(await screen.findByRole('button', { name: /Predict fields/ }));
    await waitFor(() => expect(screen.getByText(/AI guess/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /status/ }));
    expect(onSelect).toHaveBeenCalledWith("steps['Fetch data'].output.status");
  });

  it('keeps the generic buttons rendered alongside the tree', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue(runShapes as never);
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'whole result (as text)' })).toBeInTheDocument();
  });
});
```

Note: the AI-guess cache is module-level; call the exported `clearAiShapeCacheForTests()` (defined in Step 4) in a `beforeEach` for this describe block to keep tests independent.

- [ ] **Step 3: Run tests to verify the new ones fail and the old ones still pass**

Run: `npx vitest run src/features/editor/components/VariablePicker.test.tsx`
Expected: 3 existing PASS, 6 new FAIL.

- [ ] **Step 4: Implement the upgrade**

Modify `frontend/src/features/editor/components/VariablePicker.tsx`. New imports and module cache at top:

```tsx
import { useMemo, useState } from 'react';
import type { Workflow, Step } from '../../../shared/types/workflow';
import type { ShapeNode, StepShapeEntry, DataShapesSource } from '../../../shared/types/shapes';
import { Database, Sparkles } from 'lucide-react';
import { ShapeTree } from '../../../shared/components/ShapeTree';
import { aiApi } from '../../../shared/api/workflowApi';
import { useAiEnabled } from '../../../shared/hooks/useAiEnabled';
import { useDataShapes } from '../hooks/useDataShapes';

const aiShapeCache = new Map<string, ShapeNode>();

export function clearAiShapeCacheForTests(): void {
  aiShapeCache.clear();
}

function outputPath(stepName: string, path: string): string {
  return `steps['${stepName}'].output${path.startsWith('[') ? '' : '.'}${path}`;
}
```

Inside the component, after the existing `availableSteps` memo:

```tsx
  const shapes = useDataShapes(workflow.id);
  const aiEnabled = useAiEnabled();
```

Inside the per-step map (between the step-name header div and the generic-buttons div), insert a new section:

```tsx
              <StepShapeSection
                step={step}
                entry={shapes?.steps[step.id]}
                source={shapes?.source}
                aiEnabled={aiEnabled}
                onSelect={onSelect}
              />
```

New component in the same file (below VariablePicker):

```tsx
interface StepShapeSectionProps {
  step: Step;
  entry?: StepShapeEntry;
  source?: DataShapesSource;
  aiEnabled: boolean;
  onSelect: (variablePath: string) => void;
}

function StepShapeSection({ step, entry, source, aiEnabled, onSelect }: StepShapeSectionProps) {
  const [aiShape, setAiShape] = useState<ShapeNode | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle');

  const handleSelect = (path: string) => onSelect(outputPath(step.name, path));

  if (entry?.shape) {
    return (
      <div className="px-2 pb-1">
        <div className="text-[9px] text-muted mb-0.5">
          📸 From run at {source?.time ? new Date(source.time).toLocaleString() : 'unknown time'}
        </div>
        <ShapeTree shape={entry.shape} onSelectPath={handleSelect} />
      </div>
    );
  }

  if (aiShape) {
    return (
      <div className="px-2 pb-1">
        <div className="text-[9px] text-muted mb-0.5">✨ AI guess — verify before relying on it</div>
        <ShapeTree shape={aiShape} onSelectPath={handleSelect} />
      </div>
    );
  }

  const predict = async () => {
    const cacheKey = `${step.type}:${JSON.stringify(step.config)}`;
    const cached = aiShapeCache.get(cacheKey);
    if (cached) {
      setAiShape(cached);
      return;
    }
    setAiState('loading');
    try {
      const shape = await aiApi.inferShape({ name: step.name, type: step.type, config: step.config as Record<string, unknown> });
      aiShapeCache.set(cacheKey, shape);
      setAiShape(shape);
      setAiState('idle');
    } catch {
      setAiState('error');
    }
  };

  return (
    <div className="px-2 pb-1 flex items-center gap-2">
      {entry && entry.status !== 'completed' && (
        <span className="text-[10px] text-muted italic">No data from last run</span>
      )}
      {aiEnabled && (
        <button
          onClick={predict}
          disabled={aiState === 'loading'}
          className="text-[10px] flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50"
        >
          <Sparkles size={10} />
          {aiState === 'loading' ? 'Predicting…' : 'Predict fields'}
        </button>
      )}
      {aiState === 'error' && (
        <span className="text-[10px] text-red-500">Could not predict — try again</span>
      )}
    </div>
  );
}
```

The existing generic buttons and http-request helpers stay exactly where they are, rendered after the new section.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/editor/components/VariablePicker.test.tsx`
Expected: PASS (3 existing + 6 new). Then the full frontend suite: `npm run test:run` — all green (other suites rendering config forms may need the same `vi.mock` of `workflowApi` — if any fail with network-ish errors from `getDataShapes`, add the mock to those files rather than weakening the hook).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/editor/hooks/useDataShapes.ts frontend/src/features/editor/components/VariablePicker.tsx frontend/src/features/editor/components/VariablePicker.test.tsx
git commit -m "feat: VariablePicker shows real output field trees with AI fallback"
```

---

### Task 7: Full verification (suites + live browser)

**Files:** none (verification only).

- [ ] **Step 1: Full test suites and builds**

```bash
cd backend && npm run test -- --run && npm run build
cd ../frontend && npm run test:run && npm run build
```
Expected: both suites green (backend was 311 tests, frontend 194 before this work — now higher), both builds clean (strict TS).

- [ ] **Step 2: Live smoke test in the browser**

Start `npm run dev` from the repo root. Using the seeded demo workflow "Data Processing Pipeline" (id `e9421427…`, which has past runs):
1. Open the editor, open a mid-workflow action's config panel → the picker must show a field tree with the "📸 From run at …" badge.
2. Click a nested field → verify the inserted reference text is `steps['…'].output.…`.
3. Create a fresh automation from a template (never run), open a later action's config → with AI configured (`backend/.env.development`), "✨ Predict fields" appears; click it and verify a plausible tree renders with the AI-guess badge.
4. Screenshot at ~1280px and ~375px; browser console must be clean.

- [ ] **Step 3: Fix anything found, re-run the affected suite, commit fixes**

```bash
git add -A && git commit -m "fix: Phase A smoke-test findings"   # only if fixes were needed
```

---

## Self-Review Notes (done at plan-writing time)

- **Spec coverage:** deriveShape rules ✓ (Task 1), data-shapes endpoint incl. 200-not-404 and failed-run partials ✓ (Task 2), infer-shape with redacted config + 503/502 ✓ (Task 3), ShapeTree ✓ (Task 5), VariablePicker priority ①②③ + badges + on-demand AI + cache-by-config-hash + zero-regression fallback ✓ (Task 6). Malformed stored results are handled upstream by `safeJsonParse` (result → undefined → `kind: 'none'`).
- **Deliberate deviations from spec, to confirm at review:** (1) frontend fetches shapes on panel mount instead of caching in the editor store — simpler and always fresh; (2) ShapeTree v1 has no collapse/expand — server-side caps bound the size.
- **Type consistency:** `ShapeNode` field set is identical in Tasks 1/4; `DataShapesResponse` identical in Tasks 2/4; `inferShape` request/response wire format matches Tasks 3/4.
