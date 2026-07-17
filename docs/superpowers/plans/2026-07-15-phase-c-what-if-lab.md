# Phase C — What-If Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the editor, a "What-If Lab" panel lets a user define named scenarios (input data + per-action forced outcomes) and run them all in one click, showing the results as a scenario × stage matrix whose cells open the simulated action data.

**Architecture:** The backend extends the existing simulate endpoint to accept `scenarios`, each with `stepOverrides` (mockOutput/mockError). The execution engine gains a persistence-free scenario runner: overrides short-circuit a step inside the existing `executeStep` choke point, and a new `simulateScenarios` runs each scenario through the same station loop **without touching the executions/logs tables**. The frontend adds scenario types + an API client method + session-local store state, a `ScenarioMatrix` grid, a `WhatIfLab` builder panel, and an editor toolbar toggle.

**Tech Stack:** Express + better-sqlite3 (sync), vitest + supertest (backend, no `any`), React + Vite + TS strict, Zustand, vitest + @testing-library/react (frontend), lucide-react. This plan **stacks on the unmerged Phase B branch** `feature/phase-b-run-replay`.

**Spec:** `docs/superpowers/specs/2026-07-13-data-visible-automation-design.md` (Phase C — What-If Lab).

## Global Constraints

- **Nothing is persisted:** scenario runs must never create/update rows in `executions` or `execution_logs`, and never register with `executionManager`. They return `ExecutionResult`s in memory only.
- **Backward compatible:** `POST /api/workflows/:id/simulate` with no `scenarios` field behaves exactly as today (returns `{ success, data: Execution }`).
- **Guardrails (exact):** max **10** scenarios per request (else 400); every override `stepId` must exist in the workflow definition (unknown → 400); each override must carry exactly one of `mockOutput` / `mockError` (else 400).
- **Override semantics:** in simulate mode, a step with an override is **not executed** — `mockOutput` → step completes with that output (and it flows to downstream steps via the existing `context.variables`/`context.steps` wiring); `mockError` → step fails with that message and normal failure propagation follows (station fails, workflow stops).
- **Response shape when scenarios present:** `{ success: true, data: { results: [{ name: string, result: ExecutionResult }] } }`, one entry per scenario in request order. A scenario that throws during setup (e.g. missing required input) yields a result with a top-level `error`, never aborts the batch.
- **Deliberate deviation (approved, consistent with Phase A/B):** the matrix cell detail shows **actual simulated values via `JsonTreeView`**, not `<ShapeTree>` (which needs a backend-derived `ShapeNode` and is lossy for real values). The spec's "`<ShapeTree>`" wording is superseded for the same reason recorded in Phase B.
- **Scenarios are session-local:** held in the Zustand store, never written into the workflow `definition`.
- **What-If is hidden during replay mode** (`isReplay`) — it is an editing-time tool.
- Backend CommonJS + strict TS, no `any`; `better-sqlite3` synchronous. Frontend strict TS. New feature code gets a failing-first test. Don't push; commits stay local.

---

### Task 0: Branch

- [ ] **Step 1: Create the feature branch stacked on Phase B**

```bash
git checkout feature/phase-b-run-replay
git checkout -b feature/phase-c-what-if-lab
```

---

### Task 1: Engine — step overrides + persistence-free scenario runner

**Files:**
- Modify: `backend/src/services/executionEngine.ts`
- Modify: `backend/src/types/workflow.ts` (add scenario/override types)
- Test: `backend/src/__tests__/simulateScenarios.test.ts`

**Interfaces:**
- Consumes: existing engine internals.
- Produces (in `types/workflow.ts`):
  ```ts
  export type StepOverride = { mockOutput: Record<string, unknown> } | { mockError: string };
  export interface ScenarioOverride { stepId: string; mockOutput?: Record<string, unknown>; mockError?: string; }
  export interface Scenario { name: string; inputData?: Record<string, unknown>; stepOverrides?: ScenarioOverride[]; }
  export interface ScenarioResult { name: string; result: ExecutionResult; }
  ```
  and `ExecutionEngine.simulateScenarios(workflow: Workflow, scenarios: Scenario[]): Promise<ScenarioResult[]>`. Task 2 consumes it.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/__tests__/simulateScenarios.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../models/execution', () => ({
  ExecutionModel: { create: vi.fn(), update: vi.fn() },
  LogModel: { createMany: vi.fn() },
}));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { ExecutionEngine } from '../services/executionEngine';
import { ExecutionModel, LogModel } from '../models/execution';
import type { Workflow } from '../types/workflow';

function workflow(): Workflow {
  return {
    id: 'w1', name: 'W', status: 'active',
    createdAt: '', updatedAt: '',
    definition: {
      stations: [
        {
          id: 'st1', name: 'Stage 1', position: { x: 0, y: 0 }, steps: [
            { id: 's1', name: 'Fetch', type: 'http-request', config: { url: 'https://api.test', method: 'GET' }, position: { x: 0, y: 0 } },
            { id: 's2', name: 'Decide', type: 'if-else', config: { condition: 'steps["Fetch"].output.status === 200' }, position: { x: 0, y: 0 } },
          ],
        },
      ],
    },
  };
}

describe('ExecutionEngine.simulateScenarios', () => {
  it('applies mockOutput without executing the step, and it flows downstream', async () => {
    const results = await ExecutionEngine.simulateScenarios(workflow(), [
      { name: 'happy', stepOverrides: [{ stepId: 's1', mockOutput: { status: 200 } }] },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('happy');
    const fetchStep = results[0].result.stations[0].steps.find((s) => s.stepId === 's1')!;
    expect(fetchStep.status).toBe('completed');
    expect(fetchStep.output).toEqual({ status: 200 });
    // the if-else read the mocked output (status===200 → true branch)
    const decideStep = results[0].result.stations[0].steps.find((s) => s.stepId === 's2')!;
    expect(decideStep.output?.branch).toBe('true');
  });

  it('applies mockError so the step fails and the station fails', async () => {
    const results = await ExecutionEngine.simulateScenarios(workflow(), [
      { name: 'boom', stepOverrides: [{ stepId: 's1', mockError: 'API down' }] },
    ]);
    const fetchStep = results[0].result.stations[0].steps.find((s) => s.stepId === 's1')!;
    expect(fetchStep.status).toBe('failed');
    expect(fetchStep.error?.message).toBe('API down');
    expect(results[0].result.stations[0].status).toBe('failed');
  });

  it('runs multiple scenarios in order and persists nothing', async () => {
    const results = await ExecutionEngine.simulateScenarios(workflow(), [
      { name: 'a', stepOverrides: [{ stepId: 's1', mockOutput: { status: 200 } }] },
      { name: 'b', stepOverrides: [{ stepId: 's1', mockError: 'x' }] },
    ]);
    expect(results.map((r) => r.name)).toEqual(['a', 'b']);
    expect(ExecutionModel.create).not.toHaveBeenCalled();
    expect(ExecutionModel.update).not.toHaveBeenCalled();
    expect(LogModel.createMany).not.toHaveBeenCalled();
  });

  it('a scenario missing a required input yields an error result, not a thrown batch', async () => {
    const wf = workflow();
    wf.definition.inputParameters = [{ name: 'token', type: 'string', required: true }];
    const results = await ExecutionEngine.simulateScenarios(wf, [
      { name: 'no-input', inputData: {}, stepOverrides: [{ stepId: 's1', mockOutput: { status: 200 } }] },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].result.error?.message).toMatch(/Missing required input parameter/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run src/__tests__/simulateScenarios.test.ts`
Expected: FAIL — `simulateScenarios` is not a function.

- [ ] **Step 3: Add the types**

In `backend/src/types/workflow.ts`, after the `ExecutionResult` interface (near line 164), add:

```ts
export type StepOverride = { mockOutput: Record<string, unknown> } | { mockError: string };

export interface ScenarioOverride {
  stepId: string;
  mockOutput?: Record<string, unknown>;
  mockError?: string;
}

export interface Scenario {
  name: string;
  inputData?: Record<string, unknown>;
  stepOverrides?: ScenarioOverride[];
}

export interface ScenarioResult {
  name: string;
  result: ExecutionResult;
}
```

- [ ] **Step 4: Add `stepOverrides` to the context and inject the override in `executeStep`**

In `backend/src/services/executionEngine.ts`:

Add to the `ExecutionContext` interface (after `signal?: AbortSignal;`):
```ts
  stepOverrides?: Map<string, StepOverride>;
```
Add `StepOverride` to the import from `../types/workflow` (the top import block).

In `executeStep`, right after `input: this.resolveInputVariables(step, context)` block closes (after line ~442, before `this.emitEvent(context, 'step:start', …)`), insert the override short-circuit:
```ts
    const override = context.stepOverrides?.get(step.id);
    if (override) {
      const now = new Date().toISOString();
      this.emitEvent(context, 'step:start', { stepId: step.id, stepName: step.name });
      if ('mockError' in override) {
        const failedResult: StepResult = { ...stepResult, status: 'failed', endTime: now, error: { message: override.mockError } };
        this.log(context, 'error', `[SIMULATE] Forced failure for ${step.name}: ${override.mockError}`, undefined, step.id);
        this.emitEvent(context, 'step:failed', { stepId: step.id, stepName: step.name, error: override.mockError });
        return failedResult;
      }
      const completedResult: StepResult = { ...stepResult, status: 'completed', endTime: now, output: override.mockOutput };
      this.log(context, 'info', `[SIMULATE] Forced output for ${step.name}`, override.mockOutput, step.id);
      this.emitEvent(context, 'step:complete', { stepId: step.id, stepName: step.name, output: override.mockOutput });
      return completedResult;
    }
```
(The `'mockError' in override` discriminates the union; `StepOverride` guarantees exactly one branch.)

- [ ] **Step 5: Extract the station loop and add `simulateScenarios`**

The station loop currently lives inline in `executeInternal` (roughly lines 108–177: build `result`, the `for (const station of stations)` loop, and the successRate/finalStatus computation). Extract it into a private helper that does **no persistence**, then have both `executeInternal` and the new scenario runner call it.

Add this private method (place it right after `executeInternal`):
```ts
  /** Run all stations against a prepared context. Pure of DB/log persistence. */
  private static async runStations(context: ExecutionContext): Promise<{
    result: ExecutionResult; totalSteps: number; completedSteps: number; failed: boolean; cancelled: boolean;
  }> {
    const result: ExecutionResult = { stations: [] };
    let totalSteps = 0;
    let completedSteps = 0;
    let failed = false;
    let cancelled = false;

    const stations = context.workflow.definition.stations || [];
    for (const station of stations) {
      if (failed) break;
      if (context.signal?.aborted) {
        cancelled = true; failed = true;
        result.error = { message: 'Execution cancelled', code: 'CANCELLED' };
        break;
      }
      if (!this.shouldExecuteStation(station, context)) {
        this.log(context, 'info', `Skipping station: ${station.name} (condition not met)`, undefined, station.id);
        result.stations.push(this.createSkippedStationResult(station));
        continue;
      }
      this.log(context, 'info', `Starting station: ${station.name}`, undefined, station.id);
      this.emitEvent(context, 'station:start', { stationId: station.id, stationName: station.name });

      const stationResult = await this.executeStation(station, context);
      result.stations.push(stationResult);
      totalSteps += station.steps.length;
      completedSteps += stationResult.steps.filter((s) => s.status === 'completed').length;

      if (stationResult.status === 'failed') {
        failed = true;
        if (context.signal?.aborted) {
          cancelled = true;
          result.error = { message: 'Execution cancelled', code: 'CANCELLED' };
        } else {
          result.error = { message: `Workflow stopped at station: ${station.name}`, code: 'STATION_FAILED' };
        }
        this.log(context, 'error', `Station failed: ${station.name}`, undefined, station.id);
        this.emitEvent(context, 'station:failed', { stationId: station.id, stationName: station.name, error: result.error.message });
      } else {
        this.log(context, 'info', `Station completed: ${station.name}`, stationResult.output, station.id);
        this.emitEvent(context, 'station:complete', { stationId: station.id, stationName: station.name, output: stationResult.output });
      }
      context.stations[station.id] = stationResult;
      context.stations[station.name] = stationResult;
    }
    return { result, totalSteps, completedSteps, failed, cancelled };
  }
```

Then in `executeInternal`, replace the inline block (the `const result: ExecutionResult = { stations: [] };` declaration through the end of the station `for` loop and the `successRate`/`finalStatus` lines) with:
```ts
    const { result, totalSteps, completedSteps, failed, cancelled } = await this.runStations(context);
    const successRate = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    const finalStatus = cancelled ? 'cancelled' : (failed ? 'failed' : 'completed');
```
Leave everything after that (save logs, unregister, emit terminal, `ExecutionModel.update`, return) unchanged. Do not remove the `ExecutionModel.create` in `execute` or the manager registration in `executeInternal` — the persisted path keeps them.

Add the new public method (place after `execute`):
```ts
  /**
   * Run scenarios in memory with per-step overrides. Persists nothing:
   * no executions/logs rows, no executionManager registration.
   */
  static async simulateScenarios(workflow: Workflow, scenarios: Scenario[]): Promise<ScenarioResult[]> {
    const results: ScenarioResult[] = [];
    for (const scenario of scenarios) {
      const inputData: Record<string, any> = { ...(scenario.inputData || {}) };
      try {
        if (workflow.definition.inputParameters?.length) {
          for (const param of workflow.definition.inputParameters) {
            if (inputData[param.name] === undefined && param.defaultValue !== undefined) {
              inputData[param.name] = param.defaultValue;
            } else if (param.required && inputData[param.name] === undefined) {
              throw new Error(`Missing required input parameter: ${param.name}`);
            }
          }
        }
        const overrides = new Map<string, StepOverride>();
        for (const o of scenario.stepOverrides || []) {
          overrides.set(o.stepId, o.mockError !== undefined ? { mockError: o.mockError } : { mockOutput: o.mockOutput || {} });
        }
        const context: ExecutionContext = {
          executionId: `scenario-${uuidv4()}`,
          workflow,
          variables: { ...inputData, input: { ...inputData } },
          stations: {},
          steps: {},
          logs: [],
          simulate: true,
          signal: new AbortController().signal,
          stepOverrides: overrides,
        };
        const { result } = await this.runStations(context);
        results.push({ name: scenario.name, result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ name: scenario.name, result: { stations: [], error: { message } } });
      }
    }
    return results;
  }
```
Add `Scenario`, `ScenarioResult`, `StepOverride` to the `../types/workflow` import block.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/__tests__/simulateScenarios.test.ts`
Expected: PASS (4 tests). Then the full backend suite to confirm the `runStations` extraction didn't regress real execution: `npm run test -- --run` — all green (executionEngine/executionFlow/ifElseRouting/stationCondition suites especially).

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/executionEngine.ts backend/src/types/workflow.ts backend/src/__tests__/simulateScenarios.test.ts
git commit -m "feat: engine step overrides and persistence-free simulateScenarios"
```

---

### Task 2: Route — `/simulate` accepts `scenarios`

**Files:**
- Modify: `backend/src/routes/workflows.ts` (the `POST /:id/simulate` handler, ~line 174)
- Test: `backend/src/__tests__/simulateScenarios.route.test.ts`

**Interfaces:**
- Consumes: `ExecutionEngine.simulateScenarios` (Task 1); `WorkflowModel.getById`.
- Produces: `POST /api/workflows/:id/simulate` — when `scenarios` present → `{ success, data: { results: ScenarioResult[] } }`; validation as in Global Constraints; unchanged when absent. Task 3's client consumes the `{ results }` shape.

- [ ] **Step 1: Write the failing test**

Follows the mock style of `backend/src/__tests__/ai.route.test.ts` (mock modules, mount only the router).

```ts
// backend/src/__tests__/simulateScenarios.route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../models/workflow', () => ({ WorkflowModel: { getById: vi.fn() } }));
vi.mock('../services/executionEngine', () => ({
  ExecutionEngine: { execute: vi.fn(), simulateScenarios: vi.fn() },
}));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import workflowsRouter from '../routes/workflows';
import { WorkflowModel } from '../models/workflow';
import { ExecutionEngine } from '../services/executionEngine';

const app = express();
app.use(express.json());
app.use('/api/workflows', workflowsRouter);

const wf = {
  id: 'w1', name: 'W', status: 'active', createdAt: '', updatedAt: '',
  definition: { stations: [{ id: 'st1', name: 'S', position: { x: 0, y: 0 }, steps: [
    { id: 's1', name: 'Fetch', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
  ] }] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(WorkflowModel.getById).mockReturnValue(wf as never);
});

describe('POST /api/workflows/:id/simulate with scenarios', () => {
  it('returns one result per scenario in order', async () => {
    vi.mocked(ExecutionEngine.simulateScenarios).mockResolvedValue([
      { name: 'a', result: { stations: [] } }, { name: 'b', result: { stations: [] } },
    ] as never);
    const res = await request(app).post('/api/workflows/w1/simulate').send({
      scenarios: [
        { name: 'a', stepOverrides: [{ stepId: 's1', mockOutput: { ok: true } }] },
        { name: 'b', stepOverrides: [{ stepId: 's1', mockError: 'x' }] },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.results.map((r: { name: string }) => r.name)).toEqual(['a', 'b']);
  });

  it('400 when more than 10 scenarios', async () => {
    const scenarios = Array.from({ length: 11 }, (_, i) => ({ name: `s${i}` }));
    const res = await request(app).post('/api/workflows/w1/simulate').send({ scenarios });
    expect(res.status).toBe(400);
    expect(ExecutionEngine.simulateScenarios).not.toHaveBeenCalled();
  });

  it('400 when an override targets an unknown step id', async () => {
    const res = await request(app).post('/api/workflows/w1/simulate').send({
      scenarios: [{ name: 'a', stepOverrides: [{ stepId: 'ghost', mockOutput: {} }] }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown step/i);
  });

  it('400 when an override has neither or both of mockOutput/mockError', async () => {
    const neither = await request(app).post('/api/workflows/w1/simulate').send({
      scenarios: [{ name: 'a', stepOverrides: [{ stepId: 's1' }] }],
    });
    expect(neither.status).toBe(400);
    const both = await request(app).post('/api/workflows/w1/simulate').send({
      scenarios: [{ name: 'a', stepOverrides: [{ stepId: 's1', mockOutput: {}, mockError: 'x' }] }],
    });
    expect(both.status).toBe(400);
  });

  it('404 when the workflow does not exist', async () => {
    vi.mocked(WorkflowModel.getById).mockReturnValue(null as never);
    const res = await request(app).post('/api/workflows/nope/simulate').send({ scenarios: [{ name: 'a' }] });
    expect(res.status).toBe(404);
  });

  it('without scenarios, falls through to the existing single simulate', async () => {
    vi.mocked(ExecutionEngine.execute).mockResolvedValue({ id: 'e1' } as never);
    const res = await request(app).post('/api/workflows/w1/simulate').send({ inputData: {} });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 'e1' });
    expect(ExecutionEngine.simulateScenarios).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/simulateScenarios.route.test.ts`
Expected: FAIL — scenarios path not handled (returns single-simulate shape / 200 for over-cap).

- [ ] **Step 3: Extend the route**

In `backend/src/routes/workflows.ts`, add `Scenario` to the type imports from `../types/workflow` if you reference it. Replace the body of the `POST /:id/simulate` handler with a scenarios branch before the existing single-simulate logic:

```ts
router.post('/:id/simulate', async (req: Request, res: Response) => {
  try {
    const workflow = WorkflowModel.getById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const scenarios = req.body?.scenarios;
    if (scenarios !== undefined) {
      if (!Array.isArray(scenarios) || scenarios.length === 0) {
        return res.status(400).json({ success: false, error: 'scenarios must be a non-empty array' });
      }
      if (scenarios.length > 10) {
        return res.status(400).json({ success: false, error: 'At most 10 scenarios per request' });
      }
      const knownStepIds = new Set<string>();
      for (const station of workflow.definition.stations) {
        for (const step of station.steps) knownStepIds.add(step.id);
      }
      for (const scenario of scenarios) {
        for (const o of scenario?.stepOverrides || []) {
          if (!o || typeof o.stepId !== 'string' || !knownStepIds.has(o.stepId)) {
            return res.status(400).json({ success: false, error: `Unknown step id in override: ${String(o?.stepId)}` });
          }
          const hasOutput = o.mockOutput !== undefined;
          const hasError = o.mockError !== undefined;
          if (hasOutput === hasError) {
            return res.status(400).json({ success: false, error: 'Each override needs exactly one of mockOutput or mockError' });
          }
        }
      }
      const normalized = scenarios.map((s: { name?: unknown }, i: number) => ({
        name: typeof s?.name === 'string' && s.name.trim() ? s.name.trim() : `Scenario ${i + 1}`,
        inputData: (s as { inputData?: Record<string, unknown> }).inputData,
        stepOverrides: (s as { stepOverrides?: unknown[] }).stepOverrides,
      }));
      const results = await ExecutionEngine.simulateScenarios(workflow, normalized as never);
      return res.json({ success: true, data: { results } });
    }

    const { inputData = {} }: ExecuteWorkflowRequest = req.body;
    const execution = await ExecutionEngine.execute(workflow, 'manual', inputData, true);
    res.json({ success: true, data: execution });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('Missing required input parameter')) {
      res.status(400).json({ success: false, error: message });
    } else {
      log.error({ err: error }, 'Unexpected error');
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/simulateScenarios.route.test.ts`
Expected: PASS (6 tests). Then full backend suite: `npm run test -- --run` — all green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/workflows.ts backend/src/__tests__/simulateScenarios.route.test.ts
git commit -m "feat: simulate route accepts scenarios with validation guardrails"
```

---

### Task 3: Frontend scenario plumbing — types, API client, store

**Files:**
- Create: `frontend/src/features/editor/types/scenario.ts`
- Modify: `frontend/src/shared/api/workflowApi.ts` (add `simulateScenarios` in `workflowApi`)
- Modify: `frontend/src/features/editor/stores/workflowStore.ts` (scenario state + actions)
- Test: `frontend/src/shared/api/workflowApi.test.ts` (append), `frontend/src/features/editor/stores/workflowStore.scenarios.test.ts`

**Interfaces:**
- Consumes: backend endpoint from Task 2.
- Produces:
  ```ts
  // scenario.ts
  export interface ScenarioOverrideInput { stepId: string; mockOutput?: unknown; mockError?: string; }
  export interface ScenarioInput { name: string; inputData?: Record<string, unknown>; stepOverrides?: ScenarioOverrideInput[]; }
  export interface ScenarioResult { name: string; result: import('../../../shared/types/workflow').ExecutionResult; }
  ```
  `workflowApi.simulateScenarios(id: string, scenarios: ScenarioInput[]): Promise<ScenarioResult[]>` (unwraps `data.results`). Store gains `whatIfScenarios: ScenarioInput[]`, `whatIfResults: ScenarioResult[] | null`, `isRunningScenarios: boolean`, and actions `setWhatIfScenarios(s: ScenarioInput[]): void`, `runScenarios(): Promise<void>`. Tasks 4–6 consume these.

- [ ] **Step 1: Create the types file**

```ts
// frontend/src/features/editor/types/scenario.ts
import type { ExecutionResult } from '../../../shared/types/workflow';

export interface ScenarioOverrideInput {
  stepId: string;
  mockOutput?: unknown;
  mockError?: string;
}

export interface ScenarioInput {
  name: string;
  inputData?: Record<string, unknown>;
  stepOverrides?: ScenarioOverrideInput[];
}

export interface ScenarioResult {
  name: string;
  result: ExecutionResult;
}
```

- [ ] **Step 2: Write the failing API test**

Append to `frontend/src/shared/api/workflowApi.test.ts`, mirroring the file's existing axios-mock helpers:

```ts
describe('simulateScenarios API', () => {
  it('posts scenarios and unwraps data.results', async () => {
    const results = [{ name: 'a', result: { stations: [] } }];
    mockPost.mockResolvedValue({ data: { success: true, data: { results } } }); // adapt to file's helper
    await expect(workflowApi.simulateScenarios('w1', [{ name: 'a' }])).resolves.toEqual(results);
    expect(mockPost).toHaveBeenCalledWith('/workflows/w1/simulate', { scenarios: [{ name: 'a' }] });
  });
});
```

- [ ] **Step 3: Add the client method**

In `frontend/src/shared/api/workflowApi.ts`, add `import type { ScenarioInput, ScenarioResult } from '../../features/editor/types/scenario';` at the top, and inside the `workflowApi` object (after `simulate`):

```ts
  simulateScenarios: async (id: string, scenarios: ScenarioInput[]): Promise<ScenarioResult[]> => {
    const response = await api.post<ApiResponse<{ results: ScenarioResult[] }>>(`/workflows/${id}/simulate`, { scenarios });
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!.results;
  },
```

- [ ] **Step 4: Write the failing store test**

```ts
// frontend/src/features/editor/stores/workflowStore.scenarios.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/api/workflowApi', () => ({
  workflowApi: { simulateScenarios: vi.fn() },
  executionApi: {},
}));

import { useWorkflowStore } from './workflowStore';
import { workflowApi } from '../../../shared/api/workflowApi';

const wf = { id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '', definition: { stations: [] } };

beforeEach(() => {
  vi.clearAllMocks();
  useWorkflowStore.setState({ currentWorkflow: wf as never, whatIfScenarios: [], whatIfResults: null, isRunningScenarios: false, error: null });
});

describe('workflowStore What-If', () => {
  it('setWhatIfScenarios stores scenarios', () => {
    useWorkflowStore.getState().setWhatIfScenarios([{ name: 'a' }]);
    expect(useWorkflowStore.getState().whatIfScenarios).toEqual([{ name: 'a' }]);
  });

  it('runScenarios calls the API with current scenarios and stores results', async () => {
    const results = [{ name: 'a', result: { stations: [] } }];
    vi.mocked(workflowApi.simulateScenarios).mockResolvedValue(results as never);
    useWorkflowStore.getState().setWhatIfScenarios([{ name: 'a' }]);
    await useWorkflowStore.getState().runScenarios();
    expect(workflowApi.simulateScenarios).toHaveBeenCalledWith('w1', [{ name: 'a' }]);
    expect(useWorkflowStore.getState().whatIfResults).toEqual(results);
    expect(useWorkflowStore.getState().isRunningScenarios).toBe(false);
  });

  it('runScenarios records an error and clears the running flag on failure', async () => {
    vi.mocked(workflowApi.simulateScenarios).mockRejectedValue(new Error('boom'));
    useWorkflowStore.getState().setWhatIfScenarios([{ name: 'a' }]);
    await useWorkflowStore.getState().runScenarios();
    expect(useWorkflowStore.getState().error).toBe('boom');
    expect(useWorkflowStore.getState().isRunningScenarios).toBe(false);
  });
});
```

- [ ] **Step 5: Add store state + actions**

In `frontend/src/features/editor/stores/workflowStore.ts`:
- Add `import type { ScenarioInput, ScenarioResult } from '../types/scenario';` to the top imports.
- In the `WorkflowState` interface (after `replayExecution`): 
  ```ts
  whatIfScenarios: ScenarioInput[];
  whatIfResults: ScenarioResult[] | null;
  isRunningScenarios: boolean;
  ```
  and in the actions block:
  ```ts
  setWhatIfScenarios: (scenarios: ScenarioInput[]) => void;
  runScenarios: () => Promise<void>;
  ```
- In the initial state (after `replayExecution: null,`):
  ```ts
  whatIfScenarios: [],
  whatIfResults: null,
  isRunningScenarios: false,
  ```
- Add the implementations near the replay actions:
  ```ts
  setWhatIfScenarios: (scenarios) => set({ whatIfScenarios: scenarios }),

  runScenarios: async () => {
    const { currentWorkflow, whatIfScenarios } = get();
    if (!currentWorkflow) throw new Error('No workflow selected');
    set({ isRunningScenarios: true, error: null });
    try {
      const results = await workflowApi.simulateScenarios(currentWorkflow.id, whatIfScenarios);
      set({ whatIfResults: results, isRunningScenarios: false });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error), isRunningScenarios: false });
    }
  },
  ```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/shared/api/workflowApi.test.ts src/features/editor/stores/workflowStore.scenarios.test.ts`
Expected: PASS. Then `npx tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/editor/types/scenario.ts frontend/src/shared/api/workflowApi.ts frontend/src/shared/api/workflowApi.test.ts frontend/src/features/editor/stores/workflowStore.ts frontend/src/features/editor/stores/workflowStore.scenarios.test.ts
git commit -m "feat: frontend scenario types, simulateScenarios client, store state/actions"
```

---

### Task 4: `ScenarioMatrix` component

**Files:**
- Create: `frontend/src/features/editor/components/ScenarioMatrix.tsx`
- Test: `frontend/src/features/editor/components/ScenarioMatrix.test.tsx`

**Interfaces:**
- Consumes: `ScenarioResult` (Task 3); `Station`, `StationResult` from `shared/types/workflow`; `JsonTreeView` (`shared/components/JsonTreeView`, default export, props `{ data }`).
- Produces: `ScenarioMatrix({ results, stations }: { results: ScenarioResult[]; stations: Station[] })`. Renders a grid: rows = scenarios (by name), columns = stages (by `stations`), each cell a status icon for that stage in that scenario (✓ completed / ✗ failed / − skipped / blank not-run). Clicking a cell shows that stage's step results (name + status + output via `JsonTreeView`) in a detail area below. Task 5 renders it.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/editor/components/ScenarioMatrix.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ScenarioMatrix } from './ScenarioMatrix';
import type { Station } from '../../../shared/types/workflow';
import type { ScenarioResult } from '../types/scenario';

const stations: Station[] = [
  { id: 'st1', name: 'Fetch stage', position: { x: 0, y: 0 }, steps: [] },
  { id: 'st2', name: 'Notify stage', position: { x: 0, y: 0 }, steps: [] },
];

const results: ScenarioResult[] = [
  {
    name: 'Happy path',
    result: { stations: [
      { stationId: 'st1', stationName: 'Fetch stage', status: 'completed', steps: [
        { stepId: 's1', stepName: 'Fetch', stepType: 'http-request', status: 'completed', output: { orderId: 42 } },
      ] },
      { stationId: 'st2', stationName: 'Notify stage', status: 'completed', steps: [] },
    ] },
  },
  {
    name: 'API fails',
    result: { stations: [
      { stationId: 'st1', stationName: 'Fetch stage', status: 'failed', steps: [
        { stepId: 's1', stepName: 'Fetch', stepType: 'http-request', status: 'failed', error: { message: 'API down' } },
      ] },
      // st2 never ran
    ] },
  },
];

describe('ScenarioMatrix', () => {
  it('renders a row per scenario and a column per stage', () => {
    render(<ScenarioMatrix results={results} stations={stations} />);
    expect(screen.getByText('Happy path')).toBeInTheDocument();
    expect(screen.getByText('API fails')).toBeInTheDocument();
    expect(screen.getByText('Fetch stage')).toBeInTheDocument();
    expect(screen.getByText('Notify stage')).toBeInTheDocument();
  });

  it('marks the failed cell and shows step output when a completed cell is clicked', () => {
    render(<ScenarioMatrix results={results} stations={stations} />);
    // clicking Happy path × Fetch stage reveals the step output
    fireEvent.click(screen.getByRole('button', { name: /Happy path.*Fetch stage/i }));
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows the error message when a failed cell is opened', () => {
    render(<ScenarioMatrix results={results} stations={stations} />);
    fireEvent.click(screen.getByRole('button', { name: /API fails.*Fetch stage/i }));
    expect(screen.getByText(/API down/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/editor/components/ScenarioMatrix.test.tsx`
Expected: FAIL — cannot resolve `./ScenarioMatrix`.

- [ ] **Step 3: Implement the component**

```tsx
// frontend/src/features/editor/components/ScenarioMatrix.tsx
import { useState } from 'react';
import { CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import type { Station, StationResult } from '../../../shared/types/workflow';
import type { ScenarioResult } from '../types/scenario';
import JsonTreeView from '../../../shared/components/JsonTreeView';
import { EDGE_COLORS } from '../../../shared/constants/colors';

interface ScenarioMatrixProps {
  results: ScenarioResult[];
  stations: Station[];
}

function CellIcon({ status }: { status?: StationResult['status'] }) {
  if (status === 'completed') return <CheckCircle size={16} style={{ color: EDGE_COLORS.success }} />;
  if (status === 'failed') return <XCircle size={16} style={{ color: EDGE_COLORS.error }} />;
  if (status === 'skipped') return <MinusCircle size={16} style={{ color: EDGE_COLORS.muted }} />;
  return <span style={{ color: 'var(--text-muted)' }}>–</span>;
}

export function ScenarioMatrix({ results, stations }: ScenarioMatrixProps) {
  const [selected, setSelected] = useState<{ s: number; stationId: string } | null>(null);

  const selectedStation: StationResult | undefined =
    selected != null ? results[selected.s]?.result.stations.find((st) => st.stationId === selected.stationId) : undefined;

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Scenario</th>
              {stations.map((st) => (
                <th key={st.id} style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{st.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r, s) => (
              <tr key={`${r.name}-${s}`}>
                <td style={{ padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.name}</td>
                {stations.map((st) => {
                  const sr = r.result.stations.find((x) => x.stationId === st.id);
                  return (
                    <td key={st.id} style={{ padding: '2px', textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        aria-label={`${r.name} — ${st.name}`}
                        onClick={() => setSelected({ s, stationId: st.id })}
                      >
                        <CellIcon status={sr?.status} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedStation && (
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <div className="text-xs font-semibold" style={{ marginBottom: '8px' }}>
            {results[selected!.s].name} · {selectedStation.stationName}
          </div>
          {selectedStation.steps.length === 0 && (
            <div className="text-xs text-muted" style={{ fontStyle: 'italic' }}>No actions ran in this stage.</div>
          )}
          {selectedStation.steps.map((step) => (
            <div key={step.stepId} style={{ marginBottom: '10px' }}>
              <div className="text-xs font-semibold" style={{ marginBottom: '4px' }}>
                {step.stepName} — {step.status}
              </div>
              {step.error ? (
                <div className="text-xs" style={{ color: EDGE_COLORS.error }}>{step.error.message}</div>
              ) : (
                <div style={{ background: 'var(--bg-primary)', borderRadius: '6px', padding: '8px', border: '1px solid var(--border-color)' }}>
                  {step.output && Object.keys(step.output).length > 0
                    ? <JsonTreeView data={step.output} />
                    : <span className="text-xs text-muted" style={{ fontStyle: 'italic' }}>No output</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Note on the test's cell-button query: the aria-label is `"<scenario> — <stage>"`, so `{ name: /Happy path.*Fetch stage/i }` matches. `within` is imported for optional scoping but the simple queries above suffice.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/editor/components/ScenarioMatrix.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/editor/components/ScenarioMatrix.tsx frontend/src/features/editor/components/ScenarioMatrix.test.tsx
git commit -m "feat: ScenarioMatrix — scenario × stage grid with cell detail"
```

---

### Task 5: `WhatIfLab` panel + `ScenarioEditor`

**Files:**
- Create: `frontend/src/features/editor/components/ScenarioEditor.tsx`
- Create: `frontend/src/features/editor/components/WhatIfLab.tsx`
- Test: `frontend/src/features/editor/components/WhatIfLab.test.tsx`

**Interfaces:**
- Consumes: store fields/actions `whatIfScenarios`, `whatIfResults`, `isRunningScenarios`, `setWhatIfScenarios`, `runScenarios` (Task 3); `ScenarioMatrix` (Task 4); `ScenarioInput`/`ScenarioOverrideInput` (Task 3); the current workflow (for the stage/action list and matrix columns).
- Produces: `WhatIfLab({ workflow, onClose }: { workflow: Workflow; onClose: () => void })` — a right-side panel. `ScenarioEditor({ scenario, steps, onChange, onRemove })` edits one scenario. Task 6 mounts `WhatIfLab`.

**Behavior:** the panel lists scenarios (each an `ScenarioEditor`: name input, optional input-data JSON textarea with inline "invalid JSON" validation, and per-action overrides — add an override → pick an action from a dropdown of all steps, choose "Succeeds and returns…" (JSON textarea) or "Fails with…" (message), remove override). "Add scenario" appends a blank one; "Run all scenarios" calls `runScenarios()` (disabled while `isRunningScenarios` or when there are no scenarios); results render in a `ScenarioMatrix` below. Scenario edits flow through `setWhatIfScenarios` so they persist in the store across panel toggles.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/editor/components/WhatIfLab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WhatIfLab } from './WhatIfLab';
import type { Workflow } from '../../../shared/types/workflow';

const setWhatIfScenarios = vi.fn();
const runScenarios = vi.fn();
let storeState: Record<string, unknown>;

vi.mock('../stores/workflowStore', () => ({
  useWorkflowStore: () => storeState,
}));

const workflow: Workflow = {
  id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
  definition: { stations: [
    { id: 'st1', name: 'Stage 1', position: { x: 0, y: 0 }, steps: [
      { id: 's1', name: 'Fetch', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
    ] },
  ] },
};

beforeEach(() => {
  vi.clearAllMocks();
  storeState = {
    whatIfScenarios: [], whatIfResults: null, isRunningScenarios: false,
    setWhatIfScenarios, runScenarios,
  };
});

describe('WhatIfLab', () => {
  it('adds a scenario when Add scenario is clicked', () => {
    render(<WhatIfLab workflow={workflow} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add scenario/i }));
    expect(setWhatIfScenarios).toHaveBeenCalled();
    const next = setWhatIfScenarios.mock.calls[0][0];
    expect(next).toHaveLength(1);
    expect(next[0]).toHaveProperty('name');
  });

  it('runs scenarios when Run all is clicked', () => {
    storeState.whatIfScenarios = [{ name: 'Scenario 1' }];
    render(<WhatIfLab workflow={workflow} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /run all scenarios/i }));
    expect(runScenarios).toHaveBeenCalled();
  });

  it('disables Run all when there are no scenarios', () => {
    render(<WhatIfLab workflow={workflow} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /run all scenarios/i })).toBeDisabled();
  });

  it('renders the matrix when results exist', () => {
    storeState.whatIfScenarios = [{ name: 'S1' }];
    storeState.whatIfResults = [{ name: 'S1', result: { stations: [
      { stationId: 'st1', stationName: 'Stage 1', status: 'completed', steps: [] },
    ] } }];
    render(<WhatIfLab workflow={workflow} onClose={vi.fn()} />);
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('Stage 1')).toBeInTheDocument();
  });
});
```

Note: `WhatIfLab.tsx` imports the store from `../stores/workflowStore` — that is the path this test mocks.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/editor/components/WhatIfLab.test.tsx`
Expected: FAIL — cannot resolve `./WhatIfLab`.

- [ ] **Step 3: Implement `ScenarioEditor`**

```tsx
// frontend/src/features/editor/components/ScenarioEditor.tsx
import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import type { Step } from '../../../shared/types/workflow';
import type { ScenarioInput, ScenarioOverrideInput } from '../types/scenario';

interface ScenarioEditorProps {
  scenario: ScenarioInput;
  steps: Step[];
  onChange: (next: ScenarioInput) => void;
  onRemove: () => void;
}

export function ScenarioEditor({ scenario, steps, onChange, onRemove }: ScenarioEditorProps) {
  const [inputText, setInputText] = useState(scenario.inputData ? JSON.stringify(scenario.inputData, null, 2) : '');
  const [inputError, setInputError] = useState<string | null>(null);

  const commitInput = (text: string) => {
    setInputText(text);
    if (!text.trim()) { setInputError(null); onChange({ ...scenario, inputData: undefined }); return; }
    try {
      const parsed = JSON.parse(text);
      setInputError(null);
      onChange({ ...scenario, inputData: parsed });
    } catch {
      setInputError('Invalid JSON');
    }
  };

  const overrides = scenario.stepOverrides || [];
  const setOverrides = (next: ScenarioOverrideInput[]) => onChange({ ...scenario, stepOverrides: next });

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
        <input
          className="form-input"
          aria-label="Scenario name"
          value={scenario.name}
          onChange={(e) => onChange({ ...scenario, name: e.target.value })}
          style={{ flex: 1, fontSize: '13px' }}
        />
        <button className="btn btn-ghost btn-icon btn-sm" aria-label="Remove scenario" onClick={onRemove}>
          <Trash2 size={14} />
        </button>
      </div>

      <label className="text-xs text-muted">Input data (JSON, optional)</label>
      <textarea
        className="form-input"
        aria-label="Input data"
        value={inputText}
        onChange={(e) => commitInput(e.target.value)}
        rows={2}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px' }}
      />
      {inputError && <div className="text-xs" style={{ color: 'var(--accent-error)' }}>{inputError}</div>}

      <div className="text-xs text-muted" style={{ margin: '8px 0 4px' }}>Force action outcomes</div>
      {overrides.map((o, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px', borderLeft: '2px solid var(--border-color)', paddingLeft: '8px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <select
              className="form-select"
              aria-label="Action"
              value={o.stepId}
              onChange={(e) => setOverrides(overrides.map((x, j) => j === i ? { ...x, stepId: e.target.value } : x))}
              style={{ flex: 1, fontSize: '12px' }}
            >
              <option value="">Pick an action…</option>
              {steps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="btn btn-ghost btn-icon btn-sm" aria-label="Remove override" onClick={() => setOverrides(overrides.filter((_, j) => j !== i))}>
              <Trash2 size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
            <label><input type="radio" checked={o.mockError === undefined} onChange={() => setOverrides(overrides.map((x, j) => j === i ? { stepId: x.stepId, mockOutput: {} } : x))} /> Succeeds and returns</label>
            <label><input type="radio" checked={o.mockError !== undefined} onChange={() => setOverrides(overrides.map((x, j) => j === i ? { stepId: x.stepId, mockError: '' } : x))} /> Fails with</label>
          </div>
          {o.mockError === undefined ? (
            <textarea
              className="form-input" aria-label="Mock output JSON" rows={2}
              value={typeof o.mockOutput === 'string' ? o.mockOutput : JSON.stringify(o.mockOutput ?? {}, null, 2)}
              onChange={(e) => {
                let parsed: unknown = e.target.value;
                try { parsed = JSON.parse(e.target.value); } catch { /* keep raw string; validated on run */ }
                setOverrides(overrides.map((x, j) => j === i ? { stepId: x.stepId, mockOutput: parsed } : x));
              }}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px' }}
            />
          ) : (
            <input
              className="form-input" aria-label="Mock error message"
              value={o.mockError}
              onChange={(e) => setOverrides(overrides.map((x, j) => j === i ? { stepId: x.stepId, mockError: e.target.value } : x))}
              style={{ fontSize: '12px' }}
            />
          )}
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => setOverrides([...overrides, { stepId: '', mockOutput: {} }])}>
        <Plus size={12} /> Add override
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Implement `WhatIfLab`**

```tsx
// frontend/src/features/editor/components/WhatIfLab.tsx
import { X, Play, Plus } from 'lucide-react';
import type { Workflow, Step } from '../../../shared/types/workflow';
import { useWorkflowStore } from '../stores/workflowStore';
import { ScenarioEditor } from './ScenarioEditor';
import { ScenarioMatrix } from './ScenarioMatrix';
import type { ScenarioInput } from '../types/scenario';

interface WhatIfLabProps {
  workflow: Workflow;
  onClose: () => void;
}

export function WhatIfLab({ workflow, onClose }: WhatIfLabProps) {
  const { whatIfScenarios, whatIfResults, isRunningScenarios, setWhatIfScenarios, runScenarios } = useWorkflowStore();

  const allSteps: Step[] = workflow.definition.stations.flatMap((st) => st.steps);

  const addScenario = () => {
    const next: ScenarioInput = { name: `Scenario ${whatIfScenarios.length + 1}` };
    setWhatIfScenarios([...whatIfScenarios, next]);
  };
  const updateScenario = (i: number, next: ScenarioInput) =>
    setWhatIfScenarios(whatIfScenarios.map((s, j) => (j === i ? next : s)));
  const removeScenario = (i: number) =>
    setWhatIfScenarios(whatIfScenarios.filter((_, j) => j !== i));

  return (
    <div style={{ width: '380px', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontWeight: 600, fontSize: '14px' }}>What-If Lab</h3>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label="Close What-If Lab" onClick={onClose}><X size={14} /></button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        <p className="text-xs text-muted" style={{ marginBottom: '10px' }}>
          Try "what if" situations without side effects. Force any action to succeed with a value or fail with a message, then run every scenario at once.
        </p>

        {whatIfScenarios.map((scenario, i) => (
          <ScenarioEditor
            key={i}
            scenario={scenario}
            steps={allSteps}
            onChange={(next) => updateScenario(i, next)}
            onRemove={() => removeScenario(i)}
          />
        ))}

        <button className="btn btn-secondary btn-sm" onClick={addScenario} style={{ marginBottom: '12px' }}>
          <Plus size={14} /> Add scenario
        </button>

        <button
          className="btn btn-primary"
          onClick={() => runScenarios()}
          disabled={isRunningScenarios || whatIfScenarios.length === 0}
          style={{ width: '100%', marginBottom: '12px' }}
        >
          {isRunningScenarios ? <span className="loading-spinner" /> : <Play size={16} />}
          Run all scenarios
        </button>

        {whatIfResults && whatIfResults.length > 0 && (
          <ScenarioMatrix results={whatIfResults} stations={workflow.definition.stations} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/editor/components/WhatIfLab.test.tsx`
Expected: PASS (4 tests). Then `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/editor/components/ScenarioEditor.tsx frontend/src/features/editor/components/WhatIfLab.tsx frontend/src/features/editor/components/WhatIfLab.test.tsx
git commit -m "feat: WhatIfLab panel and ScenarioEditor scenario builder"
```

---

### Task 6: EditorPage integration — toolbar toggle + panel mount

**Files:**
- Modify: `frontend/src/features/editor/EditorPage.tsx`
- Test: `frontend/src/features/editor/EditorPage.whatif.test.tsx`

**Interfaces:**
- Consumes: `WhatIfLab` (Task 5).
- Produces: a "What-If" toolbar button (styled like the existing Params/Version buttons) that toggles the `WhatIfLab` panel; hidden during replay (`!isReplay`). No new exports.

**Behavior:** a new `showWhatIf` boolean state; a toolbar button (gated with the other editing chrome under `!isReplay`) toggles it; when true and a workflow is loaded and not in replay, render `<WhatIfLab workflow={currentWorkflow} onClose={() => setShowWhatIf(false)} />` in the main editor flex row (a sibling of the other side panels).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/editor/EditorPage.whatif.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditorPage from './EditorPage';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'w1' }),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()], // no replay
}));

const workflow = {
  id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
  definition: { stations: [
    { id: 'st1', name: 'Stage 1', position: { x: 0, y: 0 }, steps: [
      { id: 's1', name: 'Fetch', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
    ] },
  ] },
};

vi.mock('./stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    currentWorkflow: workflow, fetchWorkflow: vi.fn(), setCurrentWorkflow: vi.fn(), createWorkflow: vi.fn(),
    saveWorkflow: vi.fn(), addStation: vi.fn(), addStep: vi.fn(), updateStep: vi.fn(), deleteStep: vi.fn(),
    selectStep: vi.fn(), selectedStepId: null, selectedStationId: null, selectStation: vi.fn(),
    updateStation: vi.fn(), deleteStation: vi.fn(), connectSteps: vi.fn(), simulateWorkflow: vi.fn(),
    executeWorkflow: vi.fn(), isSimulating: false, currentExecution: null, executionLogs: [],
    isLoading: false, isSaving: false, isDirty: false, updateWorkflow: vi.fn(),
    replayExecution: null, enterReplay: vi.fn(), exitReplay: vi.fn(), error: null,
    whatIfScenarios: [], whatIfResults: null, isRunningScenarios: false, setWhatIfScenarios: vi.fn(), runScenarios: vi.fn(),
  }),
}));
vi.mock('../../shared/hooks/useAiEnabled', () => ({ useAiEnabled: () => false }));

// EditorPage uses useInput()/useConfirm()/toast — mirror the mock set that
// EditorPage.replay.test.tsx already uses (read that file and copy its
// InputDialog/ConfirmDialog/toastStore vi.mock calls here) so the page renders.

beforeEach(() => vi.clearAllMocks());

describe('EditorPage What-If toggle', () => {
  it('opens the What-If Lab from the toolbar', () => {
    render(<EditorPage />);
    expect(screen.queryByText('What-If Lab')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /what-if/i }));
    expect(screen.getByText('What-If Lab')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/editor/EditorPage.whatif.test.tsx`
Expected: FAIL — no "What-If" button.

- [ ] **Step 3: Wire EditorPage**

In `frontend/src/features/editor/EditorPage.tsx`:
- Import: `import { WhatIfLab } from './components/WhatIfLab';` and add `FlaskConical` to the existing `lucide-react` import.
- Add state near the other panel toggles (`const [showWhatIf, setShowWhatIf] = useState(false);`).
- Add the toolbar button inside the `{!isReplay && (…)}`-gated chrome, next to the Params button (mirror its markup):
  ```tsx
  <button
    className={`btn btn-secondary ${showWhatIf ? 'btn-active' : ''}`}
    onClick={() => setShowWhatIf((v) => !v)}
    title="What-If Lab"
  >
    <FlaskConical size={18} />
    What-If
  </button>
  ```
  If Params/Save/etc. are individually wrapped in `{!isReplay && (…)}`, wrap this the same way.
- Render the panel as a sibling of the other side panels (after the Version History panel block, before the closing `</div>` of the main editor flex row):
  ```tsx
  {showWhatIf && currentWorkflow && !isReplay && (
    <WhatIfLab workflow={currentWorkflow} onClose={() => setShowWhatIf(false)} />
  )}
  ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/editor/EditorPage.whatif.test.tsx`
Expected: PASS. Then the whole editor suite: `npx vitest run src/features/editor` — all green (the replay test's store mock lacks the new What-If fields, but EditorPage only reads them when the panel is open, which the replay tests don't trigger; if any replay test errors on a missing field, add the four What-If fields to that test's store mock).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/editor/EditorPage.tsx frontend/src/features/editor/EditorPage.whatif.test.tsx
git commit -m "feat: What-If Lab toolbar toggle and panel in the editor"
```

---

### Task 7: Full verification + browser smoke

**Files:** none (verification only).

- [ ] **Step 1: Full suites and builds**

```bash
cd backend && npm run test -- --run && npm run build
cd ../frontend && npm run test:run && npm run build
```
Expected: both suites green, both builds clean (strict TS).

- [ ] **Step 2: Live browser smoke**

Start `npm run dev` from the repo root (check ports first). Open a workflow with at least two stages in the editor:
1. Click **What-If** in the toolbar → the panel opens.
2. **Add scenario**, name it "API fails", add an override on the first HTTP action → "Fails with" → "boom". Add a second scenario "Happy path" with the same action → "Succeeds and returns" `{"status":200}`.
3. **Run all scenarios** → the matrix shows two rows × the stages, with the failing scenario's stage marked ✗ and the happy one ✓.
4. Click a ✓ cell → the simulated action output appears; click the ✗ cell → the "boom" error appears.
5. Confirm nothing new appears in **Runs** (`/executions`) — scenarios are not persisted.
6. Screenshot wide + as narrow as the window allows; browser console clean (no failed `/simulate` calls).

- [ ] **Step 3: Fix anything found, re-run the affected suite, commit**

```bash
git add -A && git commit -m "fix: Phase C smoke-test findings"   # only if fixes were needed
```

---

## Self-Review Notes (done at plan-writing time)

- **Spec coverage (Phase C):** simulate accepts `scenarios`/`stepOverrides` with mockOutput/mockError → Tasks 1–2; override does-not-execute + downstream flow + failure propagation → Task 1 (executeStep injection); nothing persisted → Task 1 (`runStations` extraction, ephemeral context, no ExecutionModel/LogModel) with a test asserting the mocks are never called; backward compatible → Task 2 (no-scenarios branch) with a test; guardrails (≤10, unknown stepId → 400, exactly-one-of override) → Task 2; scenario builder (name, input JSON, per-action succeeds/fails overrides), session-local in store → Tasks 3, 5; "Run all" → matrix rows=scenarios cols=stages, cell click → detail → Tasks 4, 5; editor panel + toggle → Task 6. The "Suggest scenarios" AI stretch is explicitly a may-slip stretch in the spec — deferred (recorded as a follow-up).
- **Deliberate deviation (surface to user):** cell detail uses `JsonTreeView` (actual values) instead of `<ShapeTree>` (needs a backend `ShapeNode`, lossy) — same rationale as Phase B, recorded in Global Constraints.
- **Type consistency:** backend `Scenario`/`ScenarioResult`/`StepOverride` (Task 1) ↔ route (Task 2); frontend `ScenarioInput`/`ScenarioOverrideInput`/`ScenarioResult` (Task 3) ↔ matrix (Task 4) ↔ panel (Task 5); store field/action names identical Tasks 3↔5↔6; response `{ data: { results } }` identical Task 2↔3.
- **Risk noted for review:** the `runStations` extraction touches the real execution path — Task 1's full-backend-suite run is the guard against regressing production execution; the reviewer should confirm the extracted block is behavior-identical to the inline original.
- **Follow-ups seeded:** "Suggest scenarios" AI button; a per-scenario input-data schema hint from `inputParameters`; matrix column handling when scenarios skip different stages (currently columns come from the definition, which is correct).

## Deferred follow-ups (recorded at final review 2026-07-18, non-blocking — Phase C merge-ready)

1. Engine `simulateScenarios` override coercion is silently lossy for direct callers (both-set → mockError wins; neither-set → `mockOutput:{}`); the HTTP route enforces exactly-one-of, so unreachable via the API — assert or document the invariant.
2. Empty `mockError` (`''`) passes validation — a forced failure can carry an empty message; consider requiring non-empty.
3. `store.runScenarios` throws synchronously when no workflow selected (vs error-state convention); unreachable while the panel requires `currentWorkflow`.
4. Scenario DTO types live in `features/editor` but are imported by `shared/api` (reversed layering, plan-mandated) — cleaner home is `shared/types`.
5. ScenarioMatrix: pending/running statuses render the same dash as not-run (scenario results are always terminal today); `selected!` assertion; no click-test on a never-reached cell.
6. WhatIfLab: `id ?? index` key fallback for programmatically injected id-less scenarios; empty mock-output shows "Invalid JSON" (friendlier copy possible); radio toggle discards the other mode's value.
7. "Suggest scenarios" AI button remains the spec's deferred stretch.
