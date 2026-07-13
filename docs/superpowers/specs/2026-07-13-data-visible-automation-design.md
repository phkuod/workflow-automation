# Design: Data-Visible Automation (Live Data Lens, Run Replay, What-If Lab)

**Date:** 2026-07-13
**Status:** Approved by user (conversation 2026-07-13); pending spec review
**Depends on:** Non-technical UX redesign Phases 1–3 (merged to master `ad346eb`)

## Problem

Users design, run, and activate automations without ever *seeing the data* that flows through them:

- **At design time** they must guess what an earlier action produces and hand-type `${steps['...'].output.x}` references. The current VariablePicker offers only generic buttons plus hardcoded helpers for HTTP requests.
- **After a run** the RunTimeline tells the story in words, but there is no way to watch data move through the canvas or inspect what an action actually received and returned at each point.
- **Before activating** the single Test (simulate) pass answers only the happy path. "What if the API returns 500?" or "what if the amount is 0?" cannot be answered without risking a live run.

The raw material to fix all three already exists: the execution engine records every action's `input` and `output` in `StepResult` (`backend/src/services/executionEngine.ts`), persisted as JSON in `executions.result`. This data is currently write-only from the user's perspective.

## Goal

One shared foundation ("data shape layer") plus three independently shippable features, delivered in this order:

- **Phase A — Live Data Lens:** the step config panel shows the real field tree of each earlier action's output; clicking a field inserts the reference.
- **Phase B — Run Replay:** play back a past run on the canvas, action by action, inspecting each snapshot.
- **Phase C — What-If Lab:** define named scenarios (inputs + forced action outcomes), run them all in simulate mode, and read the results as a scenario × stage matrix.

## Design Principles

1. **Reuse the sleeping snapshots** — no new tables, no new persistence; `executions.result` is the source of truth. (A dedicated snapshots table was considered and rejected: it would duplicate existing data and add sync/cleanup burden.)
2. **Real data first, AI inference second** — a shape from an actual run always outranks an AI guess, and every shape is labeled with its source.
3. **Never worse than today** — with no runs and no AI configured, every surface degrades to current behavior.
4. **One viewer everywhere** — a single `<ShapeTree>` component renders data in the picker, the replay inspector, and the scenario matrix.

Terminology follows the UX redesign display layer (Automation / Stage / Action / Run / Test); internal type names, DB schema, and API paths are unchanged.

---

## Shared Foundation: Data Shape Layer

### `deriveShape(value)` — backend util (`backend/src/utils/deriveShape.ts`)

Converts an arbitrary JSON value into a **shape tree**:

```ts
interface ShapeNode {
  name: string;                 // field name ('' at root)
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  sample?: string;              // truncated printable sample value
  children?: ShapeNode[];       // object fields / array element shape
  truncated?: boolean;          // children omitted beyond caps
}
```

Rules:
- Strings truncated to 100 chars for `sample`.
- Arrays: shape derived from the first element only; `sample` shows length (e.g. `"12 items"`).
- Depth cap 4; field cap 30 per level — beyond caps, mark `truncated: true` and report omitted count.
- **Redaction:** when a field name matches `/password|token|secret|api[_-]?key|authorization/i`, `sample` is replaced with `***` (structure/type still shown).

### `GET /api/workflows/:id/data-shapes`

- Finds the most recent **completed** execution for the workflow (`executions` ordered by `start_time`).
- Extracts each step's `output` from `result` and runs `deriveShape`.
- Response (standard `ApiResponse` envelope):

```json
{
  "source": { "kind": "run", "executionId": "…", "time": "…" },
  "steps": { "<stepId>": { "shape": { …ShapeNode }, "status": "completed" } }
}
```

- No completed execution → `{ "source": { "kind": "none" }, "steps": {} }` (200, not 404).
- Failed runs still count: steps that completed before the failure contribute shapes.

### `POST /api/ai/infer-shape`

- Body: `{ step: Step, workflowName?: string }`. Returns the same `ShapeNode` format with `source: { kind: 'ai-inferred' }`.
- Implemented in `aiAssistant.ts` following the existing draft/explain pattern: OpenAI-compatible endpoint, 60 s AbortSignal timeout, strict JSON-only response prompt, graceful 503 when AI is not configured.
- Prompt includes the step type and config (config values run through the same redaction regex before being sent to the AI provider).

### `<ShapeTree>` — frontend shared component (`frontend/src/shared/components/`)

- Renders a `ShapeNode` as a collapsible field tree: name, type chip, sample value.
- Optional `onSelectPath(path)` callback — when provided, fields are clickable and return the dot/bracket path from the root.
- Used by all three features; styling matches existing panel components.

---

## Phase A — Live Data Lens (upgraded VariablePicker)

**Data source priority per earlier step:** ① shape from `data-shapes` (badge: "📸 From run at {time}") → ② AI-inferred shape (badge: "✨ AI guess — verify before relying on it") → ③ current generic buttons (unchanged fallback).

Behavior:

- When the step config panel opens, the frontend fetches `data-shapes` once per workflow (cached in the editor store until the next Test/Run or definition save).
- Each earlier action in the picker expands to its `<ShapeTree>`. Clicking a field inserts `steps['<Action Name>'].output.<path>` via the existing `onSelect` mechanism (both "as code" and interpolated `${…}` variants, matching current picker buttons).
- AI inference is **on-demand** (a "Predict fields" button per step, shown only when no run shape exists and AI is available via `useAiAvailability`), not automatic — avoids a burst of AI calls when opening a panel. Results cached keyed by a hash of the step's `type + config`; config unchanged → no repeat call.
- Steps whose latest-run status was `skipped`/`failed` show the badge "No data from last run" and offer AI prediction.

Out of scope (deliberate): shapes displayed on canvas nodes; single-step "test just this action" execution (revisit after Phase C).

## Phase B — Run Replay

**Entry points:** Run detail / RunTimeline gains a **"Replay on canvas"** button → opens the editor in a read-only replay mode (`/editor/:workflowId?replay=<executionId>`).

Behavior:

- Frontend fetches `GET /api/executions/:id` (**no backend change needed** — per-step `input`/`output`/timestamps are already in `result`) and builds an ordered timeline of step results sorted by `startTime`.
- Playback bar (bottom): ⏮ prev / ▶ play–pause / ⏭ next + a scrubber over the step sequence. Play advances one action per ~1 s tick (no wall-clock realism — clarity over fidelity).
- Current action is highlighted on the canvas; traversed edges animate; stages/actions not reached stay dimmed.
- Side inspector panel shows the current action's **input and output snapshots** via `<ShapeTree>` (full sample values from the stored result, same redaction display rules applied client-side for consistency).
- A failed run replays up to the failing action, stops, shows the error, and offers the existing **"Explain this"** AI integration.
- Replay mode is strictly read-only: config panels open in disabled state, save/test actions hidden.

Out of scope (deferred by explicit decision): **"Re-run from stage N with this data"** — requires execution-engine changes; natural follow-up after replay ships. Also deferred: live replay of an in-progress run (replay works on finished runs only).

**Consistency guard:** if the workflow definition changed after the run (a step in the result no longer exists on canvas), those steps render in the inspector list with a "no longer in this automation" note; replay does not crash.

## Phase C — What-If Lab

**Backend:** extend the existing simulate endpoint.

- `POST /api/workflows/:id/simulate` additionally accepts:

```json
{
  "scenarios": [
    {
      "name": "API returns 500",
      "inputData": { … },
      "stepOverrides": [
        { "stepId": "…", "mockOutput": { … } }
        // or { "stepId": "…", "mockError": "message" }
      ]
    }
  ]
}
```

- In simulate mode, when the engine reaches a step with an override it **does not execute it**: `mockOutput` → step completes with that output; `mockError` → step fails with that error (normal failure propagation follows).
- Response: one `ExecutionResult` per scenario, returned in order. **Nothing is persisted** — scenario runs never appear in Run history (explicit decision to avoid polluting it).
- Backward compatible: request without `scenarios` behaves exactly as today.
- Guardrails: max 10 scenarios per request; overrides validated against existing step IDs (unknown ID → 400).

**Frontend:** a "What-If Lab" panel in the editor.

- Scenario builder: name, optional input data (JSON textarea with validation), and per-action overrides — pick an action, choose "Succeeds and returns…" (JSON) or "Fails with…" (message). Scenarios stored in the workflow store (session-local; not saved into the definition).
- "Run all scenarios" → matrix view: **rows = scenarios, columns = stages**, each cell a status icon (✓ / ✗ / − skipped). Clicking a cell opens the corresponding action results with `<ShapeTree>`.
- Stretch (may slip): "Suggest scenarios" button — AI proposes edge cases from the workflow definition, reusing the aiAssistant pattern.

---

## Error Handling

- **AI unavailable / times out:** all features remain fully functional minus inference; existing `useAiAvailability` + graceful 503 pattern governs visibility of AI buttons.
- **Oversized payloads:** all truncation happens server-side in `deriveShape`; the data-shapes response is bounded by depth/field caps regardless of stored result size.
- **Sensitive values:** redaction by field-name pattern in `deriveShape` and before AI prompts (see above). Replay inspector shows stored values (the user's own run data) with the same client-side redaction display.
- **Malformed stored results** (old runs, nulls): `deriveShape` treats unparseable/absent output as `{ kind: 'none' }` for that step; UI shows "No data recorded".

## Testing

Backend (vitest + supertest, existing patterns):
- `deriveShape` unit tests: truncation (string/array/depth/field caps), redaction patterns, null/edge inputs.
- `data-shapes` endpoint: with runs, without runs, failed-run partial shapes.
- Simulate `stepOverrides`: mockOutput substitution, mockError failure propagation, unknown stepId → 400, no-scenarios backward compatibility, scenario cap.
- `infer-shape`: mocked fetch, 503 when unconfigured, redaction of config before prompt.

Frontend (RTL + vitest):
- `<ShapeTree>` rendering, collapse, path selection callback.
- VariablePicker: real-shape tree insertion, AI-guess badge, fallback to generic buttons.
- Replay: timeline ordering from a fixture result, failed-run stop behavior, stale-step guard.
- What-If matrix: scenario × stage rendering, cell click → detail.

## Delivery

Three phases, each an independently mergeable, demoable branch (stacked like the UX redesign):

| Phase | Contents | Backend change |
|---|---|---|
| A | `deriveShape` + data-shapes API + infer-shape + `<ShapeTree>` + VariablePicker upgrade | new endpoints |
| B | Replay mode (route, playback bar, canvas highlight, inspector) | none |
| C | Simulate `scenarios`/`stepOverrides` + What-If Lab panel + matrix | extend simulate |
