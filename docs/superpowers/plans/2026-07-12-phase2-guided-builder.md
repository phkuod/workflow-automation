# Phase 2: Guided Builder (Plan View) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give non-technical users a linear, plain-language Plan View of their automation (with view toggle, two-tier config panels, friendlier output-reference picker, email preview, and first-visit coach marks) without touching the canvas, store, or backend.

**Architecture:** Plan View is a new presentational component rendering the existing `workflowStore` data — no new data layer; both views stay in sync by construction. Plain-language line rendering comes from new pure helpers (`planSummary.ts`). Config-panel changes are presentational restructuring of `NodeConfigPanel` and one step-config form. The existing `VariablePicker` is reframed in plain language but keeps its insertion strings byte-identical (they are verified against backend resolution: `context.steps[step.name]`, `backend/src/services/executionEngine.ts:335`).

**Tech Stack:** React 18 + TypeScript (strict), Zustand, Vitest + @testing-library/react (jsdom). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-11-nontechnical-ux-redesign-design.md` (Phase 2 section)

## Global Constraints

- Frontend only. **Zero backend changes.**
- Display/presentation changes only — no store-shape changes; the only store consumers added are new components using existing actions/selectors.
- Terminology is already plain English (Automation/Stage/Action/Run/Test) — new copy must match that glossary.
- Variable-reference strings inserted by pickers must remain **byte-identical** to today's (`steps['<step name>'].output...` / `${steps['<step name>'].output}` forms) — they are load-bearing against backend interpolation.
- TypeScript strict; no `console.log`; tests run from `frontend/` with `npm run test:run` (all) or `npm run test:run -- <path>`.
- Working branch: `feature/phase2-guided-builder`. Commit after every task, format `<type>: <description>`.
- localStorage keys introduced here (first in the codebase — this sets the convention): `editor.viewMode`, `editor.coachMarksSeen`.

## Verified interfaces you will consume (do not re-derive)

- `useWorkflowStore` state/actions (`frontend/src/features/editor/stores/workflowStore.ts:24-69`): `currentWorkflow: Workflow | null`, `selectStep(stepId | null)`, `selectStation(stationId | null)`, `addStation(name)`, `updateStep(stepId, data: Partial<Step>)`, `isDirty`.
- `EditorPage.tsx:71`: `const [editorView, setEditorView] = useState<EditorView>({ type: 'stage-view' })`; `EditorView = { type: 'stage-view' } | { type: 'step-view'; stageId: string }`.
- `EditorPage.tsx:131-136`: `selectedStep` is found by flatMap across ALL stations — selecting a step from Plan View opens `NodeConfigPanel` with no other changes.
- `NodeConfigPanel` commits via explicit Save button (`NodeConfigPanel.tsx:376-384` → `handleSave` builds full config → `onUpdate`). Sub-forms are controlled dumb components.
- `STEP_TYPE_INFO: Record<StepType, { label, icon, color }>` (`frontend/src/shared/types/workflow.ts:223`).
- Step/Station types: `Station { id, name, steps, position, ... }`, `Step { id, name, type, config, position, ... }`, `StepConfig` keys incl. `cronExpression, url, method, emailTo, emailSubject, emailBody, duration, unit, variableName, webhookMethod` (`workflow.ts:27-115`).

---

### Task 1: `planSummary` — plain-language line descriptions

**Files:**
- Create: `frontend/src/features/editor/utils/planSummary.ts`
- Test: `frontend/src/features/editor/utils/planSummary.test.ts`

**Interfaces:**
- Consumes: `Step`, `STEP_TYPE_INFO` from `frontend/src/shared/types/workflow.ts`.
- Produces (Task 2 consumes both):
  ```ts
  function describeTrigger(step: Step): string   // e.g. 'On a schedule (0 9 * * *)'
  function describeAction(step: Step): string    // e.g. 'Call an external service (api.example.com)'
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/editor/utils/planSummary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { describeTrigger, describeAction } from './planSummary';
import type { Step } from '../../../shared/types/workflow';

function step(partial: Partial<Step>): Step {
  return {
    id: 's1', name: 'My step', type: 'wait', config: {},
    position: { x: 0, y: 0 },
    ...partial,
  } as Step;
}

describe('describeTrigger', () => {
  it('describes a cron trigger with its expression', () => {
    expect(describeTrigger(step({ type: 'trigger-cron', config: { cronExpression: '0 9 * * *' } })))
      .toBe('On a schedule (0 9 * * *)');
  });

  it('describes a cron trigger without expression', () => {
    expect(describeTrigger(step({ type: 'trigger-cron', config: {} })))
      .toBe('On a schedule');
  });

  it('describes a manual trigger', () => {
    expect(describeTrigger(step({ type: 'trigger-manual' }))).toBe('Start manually');
  });

  it('describes a webhook trigger', () => {
    expect(describeTrigger(step({ type: 'trigger-webhook' }))).toBe('When another system calls');
  });

  it('falls back to the step name for non-trigger types', () => {
    expect(describeTrigger(step({ type: 'wait', name: 'Odd trigger' }))).toBe('Odd trigger');
  });
});

describe('describeAction', () => {
  it('adds the url for external service calls', () => {
    expect(describeAction(step({ type: 'http-request', config: { url: 'https://api.example.com/data' } })))
      .toBe('Call an external service (api.example.com)');
  });

  it('omits the parenthetical when url is missing', () => {
    expect(describeAction(step({ type: 'http-request', config: {} })))
      .toBe('Call an external service');
  });

  it('adds the recipient for emails', () => {
    expect(describeAction(step({ type: 'action-email', config: { emailTo: 'team@company.com' } })))
      .toBe('Send an email (to team@company.com)');
  });

  it('adds the variable name for remember-a-value', () => {
    expect(describeAction(step({ type: 'set-variable', config: { variableName: 'orderCount' } })))
      .toBe('Remember a value ("orderCount")');
  });

  it('adds duration for waits', () => {
    expect(describeAction(step({ type: 'wait', config: { duration: 5, unit: 'minutes' } })))
      .toBe('Wait (5 minutes)');
  });

  it('uses the plain label alone for other types', () => {
    expect(describeAction(step({ type: 'if-else' }))).toBe('Decision');
    expect(describeAction(step({ type: 'action-slack' }))).toBe('Send a Slack message');
  });

  it('falls back to the step name for unknown types', () => {
    expect(describeAction(step({ type: 'mystery' as Step['type'], name: 'Mystery' }))).toBe('Mystery');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/features/editor/utils/planSummary.test.ts`
Expected: FAIL — cannot resolve `./planSummary`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/editor/utils/planSummary.ts`:

```ts
import type { Step } from '../../../shared/types/workflow';
import { STEP_TYPE_INFO } from '../../../shared/types/workflow';

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/** Plain-language description of a trigger step for the Plan View header line. */
export function describeTrigger(step: Step): string {
  switch (step.type) {
    case 'trigger-manual':
      return 'Start manually';
    case 'trigger-cron':
      return step.config.cronExpression
        ? `On a schedule (${step.config.cronExpression})`
        : 'On a schedule';
    case 'trigger-webhook':
      return 'When another system calls';
    default:
      return step.name;
  }
}

/** Plain-language one-liner for an action row in the Plan View. */
export function describeAction(step: Step): string {
  const label = STEP_TYPE_INFO[step.type]?.label;
  if (!label) return step.name;

  switch (step.type) {
    case 'http-request':
      return step.config.url ? `${label} (${hostOf(step.config.url)})` : label;
    case 'action-email':
      return step.config.emailTo ? `${label} (to ${step.config.emailTo})` : label;
    case 'set-variable':
      return step.config.variableName ? `${label} ("${step.config.variableName}")` : label;
    case 'wait':
      return typeof step.config.duration === 'number' && step.config.unit
        ? `${label} (${step.config.duration} ${step.config.unit})`
        : label;
    default:
      return label;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test:run -- src/features/editor/utils/planSummary.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/editor/utils
git commit -m "feat: plain-language plan summaries for trigger and action lines"
```

---

### Task 2: PlanView component

**Files:**
- Create: `frontend/src/features/editor/components/PlanView.tsx`
- Test: `frontend/src/features/editor/components/PlanView.test.tsx`

**Interfaces:**
- Consumes: `describeTrigger`/`describeAction` (Task 1), `STEP_TYPE_INFO`, `Workflow` type.
- Produces (Task 3 consumes): default-export `PlanView` with props:
  ```ts
  interface PlanViewProps {
    workflow: Workflow;
    onEditStep: (stepId: string) => void;
    onEditStage: (stageId: string) => void;
    onAddStage: () => void;
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/editor/components/PlanView.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import PlanView from './PlanView';
import type { Workflow } from '../../../shared/types/workflow';

const workflow: Workflow = {
  id: 'w1', name: 'Daily Report', status: 'draft',
  createdAt: '', updatedAt: '',
  definition: {
    stations: [
      {
        id: 'st1', name: 'Collect data', position: { x: 0, y: 0 },
        steps: [
          { id: 's1', name: 'Every day', type: 'trigger-cron', config: { cronExpression: '0 9 * * *' }, position: { x: 0, y: 0 } },
          { id: 's2', name: 'Fetch', type: 'http-request', config: { url: 'https://api.example.com/data' }, position: { x: 0, y: 0 } },
        ],
      },
      {
        id: 'st2', name: 'Send report', position: { x: 0, y: 0 },
        steps: [
          { id: 's3', name: 'Email', type: 'action-email', config: { emailTo: 'team@co.com' }, position: { x: 0, y: 0 } },
        ],
      },
    ],
  },
};

function renderView(overrides: Partial<ComponentProps<typeof PlanView>> = {}) {
  const props = {
    workflow,
    onEditStep: vi.fn(),
    onEditStage: vi.fn(),
    onAddStage: vi.fn(),
    ...overrides,
  };
  render(<PlanView {...props} />);
  return props;
}

describe('PlanView', () => {
  it('renders the trigger line from the first trigger step', () => {
    renderView();
    expect(screen.getByText('When it starts:')).toBeInTheDocument();
    expect(screen.getByText('On a schedule (0 9 * * *)')).toBeInTheDocument();
  });

  it('renders each stage with numbered heading and its non-trigger actions', () => {
    renderView();
    expect(screen.getByText('Stage 1 — Collect data')).toBeInTheDocument();
    expect(screen.getByText('Stage 2 — Send report')).toBeInTheDocument();
    expect(screen.getByText('Call an external service (api.example.com)')).toBeInTheDocument();
    expect(screen.getByText('Send an email (to team@co.com)')).toBeInTheDocument();
    // trigger step is shown in the header line, not repeated as an action row
    expect(screen.queryByText('On a schedule (0 9 * * *)', { selector: 'li *' })).not.toBeInTheDocument();
  });

  it('fires onEditStep with the action id when an action edit button is clicked', () => {
    const props = renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Call an external service (api.example.com)' }));
    expect(props.onEditStep).toHaveBeenCalledWith('s2');
  });

  it('fires onEditStep with the trigger id from the trigger line edit button', () => {
    const props = renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Edit when it starts' }));
    expect(props.onEditStep).toHaveBeenCalledWith('s1');
  });

  it('fires onEditStage when a stage heading edit button is clicked', () => {
    const props = renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Edit stage Collect data' }));
    expect(props.onEditStage).toHaveBeenCalledWith('st1');
  });

  it('fires onAddStage from the add-stage button', () => {
    const props = renderView();
    fireEvent.click(screen.getByRole('button', { name: '+ Add a stage' }));
    expect(props.onAddStage).toHaveBeenCalled();
  });

  it('shows a friendly hint when there is no trigger yet', () => {
    renderView({
      workflow: {
        ...workflow,
        definition: { stations: [{ id: 'st1', name: 'Only', position: { x: 0, y: 0 }, steps: [] }] },
      },
    });
    expect(screen.getByText(/No start condition yet/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/features/editor/components/PlanView.test.tsx`
Expected: FAIL — cannot resolve `./PlanView`.

- [ ] **Step 3: Write the component**

Create `frontend/src/features/editor/components/PlanView.tsx`:

```tsx
import { Pencil, Plus } from 'lucide-react';
import type { Workflow, Step } from '../../../shared/types/workflow';
import { STEP_TYPE_INFO } from '../../../shared/types/workflow';
import { describeTrigger, describeAction } from '../utils/planSummary';

interface PlanViewProps {
  workflow: Workflow;
  onEditStep: (stepId: string) => void;
  onEditStage: (stageId: string) => void;
  onAddStage: () => void;
}

const isTrigger = (step: Step) => step.type.startsWith('trigger-');

export default function PlanView({ workflow, onEditStep, onEditStage, onAddStage }: PlanViewProps) {
  const trigger = workflow.definition.stations
    .flatMap(st => st.steps)
    .find(isTrigger);

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1.5rem', overflowY: 'auto', height: '100%' }}>
      {/* Trigger line */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', padding: '14px 18px' }}>
        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>When it starts:</span>
        {trigger ? (
          <>
            <span aria-hidden>{STEP_TYPE_INFO[trigger.type]?.icon}</span>
            <span style={{ flex: 1 }}>{describeTrigger(trigger)}</span>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Edit when it starts"
              onClick={() => onEditStep(trigger.id)}
            >
              <Pencil size={14} />
            </button>
          </>
        ) : (
          <span className="text-muted">No start condition yet — add a trigger action to a stage.</span>
        )}
      </div>

      {/* Stages */}
      {workflow.definition.stations.map((station, i) => (
        <section key={station.id} className="card" style={{ marginBottom: '1rem', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '15px', flex: 1 }}>{`Stage ${i + 1} — ${station.name}`}</h3>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={`Edit stage ${station.name}`}
              onClick={() => onEditStage(station.id)}
            >
              <Pencil size={14} />
            </button>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {station.steps.filter(s => !isTrigger(s)).map(step => {
              const line = describeAction(step);
              return (
                <li
                  key={step.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'var(--bg-tertiary)', fontSize: '14px',
                  }}
                >
                  <span aria-hidden>{STEP_TYPE_INFO[step.type]?.icon ?? '📦'}</span>
                  <span style={{ flex: 1 }}>{line}</span>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    aria-label={`Edit ${line}`}
                    onClick={() => onEditStep(step.id)}
                  >
                    <Pencil size={14} />
                  </button>
                </li>
              );
            })}
            {station.steps.filter(s => !isTrigger(s)).length === 0 && (
              <li className="text-muted text-sm" style={{ padding: '4px 12px' }}>No actions in this stage yet.</li>
            )}
          </ul>
        </section>
      ))}

      <button className="btn btn-secondary" onClick={onAddStage} aria-label="+ Add a stage" style={{ width: '100%' }}>
        <Plus size={16} /> Add a stage
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test:run -- src/features/editor/components/PlanView.test.tsx`
Expected: PASS (7 tests). Note: the trigger-not-repeated assertion uses a selector that may need adjusting to the final DOM; if it proves brittle, assert instead that only ONE element contains the schedule text: `expect(screen.getAllByText('On a schedule (0 9 * * *)')).toHaveLength(1)`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/editor/components/PlanView.tsx frontend/src/features/editor/components/PlanView.test.tsx
git commit -m "feat: linear Plan View component"
```

---

### Task 3: EditorPage integration — view toggle + localStorage default

**Files:**
- Modify: `frontend/src/features/editor/EditorPage.tsx` (view-mode state, toolbar toggle, render switch)
- Test: `frontend/src/features/editor/EditorPage.plan.test.tsx` (new focused test file)

**Interfaces:**
- Consumes: `PlanView` (Task 2), existing `editorView` state, `selectStep`, `selectStation`, `handleAddStation` (existing handler used by StageCanvas's `onAddStation`).
- Produces: view mode behavior other tasks rely on: `viewMode: 'plan' | 'canvas'` persisted under localStorage key **`editor.viewMode`**, defaulting to `'plan'` when unset.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/editor/EditorPage.plan.test.tsx`. Follow the mock pattern of any existing editor test (check `frontend/src/features/editor/` and `frontend/src/features/dashboard/DashboardPage.test.tsx` for the store/api/router mock conventions used in this codebase). The test must cover, with real DOM assertions:

```tsx
it('defaults to Plan View when no preference is stored', async () => {
  // render EditorPage with a mocked currentWorkflow (2 stages, 1 cron trigger)
  // assert PlanView content is visible: 'When it starts:' text present
  // assert the React Flow canvas is NOT rendered (e.g. stage node name only appears in plan rows)
});

it('switches to Canvas View via the toolbar toggle and persists the choice', async () => {
  // click the toolbar button named /canvas view/i
  // assert PlanView content gone
  // assert localStorage.getItem('editor.viewMode') === 'canvas'
});

it('opens the action config panel when a plan row edit button is clicked', async () => {
  // click 'Edit Call an external service...' button
  // assert NodeConfigPanel heading/content appears (e.g. 'Action Name' label)
});
```

Write these as complete runnable tests against the actual mock conventions you find; mock `localStorage` per test via `window.localStorage.clear()` in `beforeEach`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/features/editor/EditorPage.plan.test.tsx`
Expected: FAIL — no view toggle exists; PlanView never rendered.

- [ ] **Step 3: Implement the integration**

In `frontend/src/features/editor/EditorPage.tsx`:

1. Add view-mode state near `editorView` (line ~71):

```ts
const [viewMode, setViewMode] = useState<'plan' | 'canvas'>(() =>
  (localStorage.getItem('editor.viewMode') as 'plan' | 'canvas' | null) ?? 'plan'
);

const switchViewMode = useCallback((mode: 'plan' | 'canvas') => {
  setViewMode(mode);
  localStorage.setItem('editor.viewMode', mode);
}, []);
```

2. Toolbar toggle at top-right — insert just before the existing view-indicator badge (line ~330), matching existing `btn` classes:

```tsx
<div style={{ display: 'flex', gap: '2px', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '2px' }}>
  <button
    className={`btn btn-sm ${viewMode === 'plan' ? 'btn-primary' : 'btn-ghost'}`}
    onClick={() => switchViewMode('plan')}
  >
    Plan View
  </button>
  <button
    className={`btn btn-sm ${viewMode === 'canvas' ? 'btn-primary' : 'btn-ghost'}`}
    onClick={() => switchViewMode('canvas')}
  >
    Canvas View
  </button>
</div>
```

3. Render switch — wrap the existing canvas block (lines ~465-490). When `viewMode === 'plan'` and a workflow is loaded, render PlanView INSTEAD of both canvases; canvas mode renders exactly what exists today:

```tsx
{currentWorkflow && viewMode === 'plan' ? (
  <PlanView
    workflow={currentWorkflow}
    onEditStep={(stepId) => selectStep(stepId)}
    onEditStage={(stageId) => selectStation(stageId)}
    onAddStage={handleAddStation}
  />
) : (
  <> {/* existing StageCanvas / StepCanvas block unchanged */} </>
)}
```

4. `StationConfigPanel` is currently gated on `editorView.type === 'stage-view'` (line ~503). Extend the gate so it also opens in plan mode: `(editorView.type === 'stage-view' || viewMode === 'plan')`.

5. Hide the canvas-only toolbar items in plan mode: the "Back to Stages", "Add Stage"/"Add Action", and view-indicator badge buttons make no sense in Plan View — wrap them in `{viewMode === 'canvas' && (...)}`. Keep Save / Test / Params / status select visible in both modes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npm run test:run -- src/features/editor`
Expected: new tests PASS; existing editor tests still PASS (if an existing test assumed the canvas renders by default, set `localStorage.setItem('editor.viewMode', 'canvas')` in its setup rather than weakening the assertion — note this explicitly in your report if you touch any existing test).

- [ ] **Step 5: Run the full frontend suite, then commit**

Run: `cd frontend; npm run test:run`

```bash
git add frontend/src/features/editor
git commit -m "feat: plan/canvas view toggle with persisted default"
```

---

### Task 4: Two-tier config panel — Advanced sections

**Files:**
- Modify: `frontend/src/features/editor/components/NodeConfigPanel.tsx` (Retry Policy block → collapsed Advanced)
- Modify: `frontend/src/features/editor/components/step-configs/HttpRequestConfigForm.tsx` (headers + timeout → collapsed Advanced within the form)
- Test: `frontend/src/features/editor/components/NodeConfigPanel.test.tsx` (new)

**Interfaces:**
- Consumes: existing panel/form structure (NodeConfigPanel.tsx:294-360 common fields; form props unchanged).
- Produces: no interface changes — presentational only. All form props stay identical.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/editor/components/NodeConfigPanel.test.tsx` (render NodeConfigPanel directly with a mock `step`/`workflow` and vi.fn() callbacks — it is a controlled component, no store needed):

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NodeConfigPanel from './NodeConfigPanel';
import type { Step, Workflow } from '../../../shared/types/workflow';

const emailStep: Step = {
  id: 's1', name: 'Email', type: 'action-email',
  config: { emailTo: 'a@b.c', emailSubject: 'Hi', emailBody: 'Hello' },
  position: { x: 0, y: 0 },
};
const workflow = {
  id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
  definition: { stations: [{ id: 'st1', name: 'S', position: { x: 0, y: 0 }, steps: [emailStep] }] },
} as Workflow;

function renderPanel(step: Step) {
  render(
    <NodeConfigPanel
      step={step}
      workflow={workflow}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

describe('NodeConfigPanel two-tier layout', () => {
  it('renders basic email fields immediately', () => {
    renderPanel(emailStep);
    expect(screen.getByText('To')).toBeInTheDocument();
    expect(screen.getByText('Subject')).toBeInTheDocument();
  });

  it('collapses retry policy inside an Advanced section', () => {
    renderPanel(emailStep);
    const advanced = screen.getByText('Advanced').closest('details');
    expect(advanced).not.toBeNull();
    expect(advanced).not.toHaveAttribute('open');
    // retry fields live inside the collapsed details
    expect(advanced!.textContent).toMatch(/Retry/i);
  });
});
```

(Adjust the exact "To"/"Subject" label strings to what `EmailForm` actually renders — read `NotificationConfigForm.tsx:37-109` first; the Subject field is documented at `:70-79`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/features/editor/components/NodeConfigPanel.test.tsx`
Expected: FAIL — no `<details>` "Advanced" exists.

- [ ] **Step 3: Implement NodeConfigPanel Advanced section**

In `NodeConfigPanel.tsx`, wrap the existing Retry Policy block (lines ~306-360) in a collapsed details element (keep the block's internals byte-identical):

```tsx
<details style={{ marginTop: '16px' }}>
  <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
    Advanced
  </summary>
  {/* existing Retry Policy block moves here unchanged */}
</details>
```

Preserve the existing type-based visibility rule (the retry block is hidden for `trigger-*`, `if-else`, `wait`): when the retry block would be hidden AND the step type contributes no other advanced fields, render no Advanced section at all rather than an empty one.

- [ ] **Step 4: Implement HttpRequestConfigForm Advanced section**

In `step-configs/HttpRequestConfigForm.tsx`: keep URL, Method, and Body visible as Basic; move the Headers editor and the Timeout input into a `<details><summary>Advanced</summary>...</details>` at the end of the form (same summary styling as Step 3). Props unchanged. If the form currently renders headers/timeout intermixed, relocate the JSX only — no logic changes.

- [ ] **Step 5: Run tests, full suite, commit**

Run: `cd frontend; npm run test:run -- src/features/editor` then `cd frontend; npm run test:run`
Expected: PASS. Existing NotificationConfigForm/HttpRequest tests (if any assert field order) may need selector updates — note any you touch.

```bash
git add frontend/src/features/editor/components
git commit -m "feat: two-tier config panels with collapsed Advanced section"
```

---

### Task 5: VariablePicker plain-language reframe

**Files:**
- Modify: `frontend/src/features/editor/components/VariablePicker.tsx`
- Test: `frontend/src/features/editor/components/VariablePicker.test.tsx` (new)

**Interfaces:**
- Consumes/Produces: props unchanged (`{ workflow, currentStepId, onSelect }`). **Inserted strings must remain byte-identical** — only labels/headers change.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/editor/components/VariablePicker.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariablePicker } from './VariablePicker';
import type { Workflow } from '../../../shared/types/workflow';

const workflow = {
  id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
  definition: {
    stations: [{
      id: 'st1', name: 'S', position: { x: 0, y: 0 },
      steps: [
        { id: 's1', name: 'Fetch data', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
        { id: 's2', name: 'Email', type: 'action-email', config: {}, position: { x: 0, y: 0 } },
      ],
    }],
  },
} as Workflow;

describe('VariablePicker plain language', () => {
  it('is framed as "Use result from"', () => {
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={vi.fn()} />);
    expect(screen.getByText('Use result from')).toBeInTheDocument();
  });

  it('inserts the identical interpolation string for the whole-result option', () => {
    const onSelect = vi.fn();
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'whole result (as text)' }));
    expect(onSelect).toHaveBeenCalledWith("${steps['Fetch data'].output}");
  });

  it('offers response body for http steps with the identical path', () => {
    const onSelect = vi.fn();
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'response body' }));
    expect(onSelect).toHaveBeenCalledWith("steps['Fetch data'].output.data");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/features/editor/components/VariablePicker.test.tsx`
Expected: FAIL — current header is "Available Variables"; current button labels are "output (JS)" / ".data".

- [ ] **Step 3: Implement the relabel**

In `VariablePicker.tsx`, change display strings only (insertion strings at lines 52, 59, 70, 77, 89 stay byte-identical):

| Element | Old | New |
|---|---|---|
| Header (line 42) | `Available Variables` | `Use result from` |
| Whole-object button (line 56) | `output (JS)` | `whole result (as code)` |
| Interpolated button (line 63) | `output (String)` | `whole result (as text)` |
| `.data` button (line 74) | `.data` | `response body` |
| `.status` button (line 81) | `.status` | `status code` |
| outputVars buttons (line 93) | `.{v.name}` | `{v.name}` |
| Empty state (line 33) | `No upstream variables available.` | `Nothing to use yet — earlier actions' results appear here.` |

Keep all `title` tooltips, adding the raw path to each title so technical users still see the syntax (e.g. `title={"Response Body — steps['" + step.name + "'].output.data"}`).

- [ ] **Step 4: Run tests, commit**

Run: `cd frontend; npm run test:run -- src/features/editor/components/VariablePicker.test.tsx`
Expected: PASS (3 tests).

```bash
git add frontend/src/features/editor/components/VariablePicker.tsx frontend/src/features/editor/components/VariablePicker.test.tsx
git commit -m "feat: plain-language output reference picker"
```

---

### Task 6: Live email preview

**Files:**
- Modify: `frontend/src/features/editor/components/step-configs/NotificationConfigForm.tsx` (EmailForm only)
- Test: `frontend/src/features/editor/components/step-configs/NotificationConfigForm.test.tsx` (new)

**Interfaces:**
- Consumes/Produces: `EmailForm` props unchanged. Preview is derived from existing `emailTo`/`emailSubject`/`emailBody` props.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/editor/components/step-configs/NotificationConfigForm.test.tsx` (render `NotificationConfigForm` with `type="action-email"` and the email props per its documented signature — `type, stepId, workflow, emailTo, emailSubject, emailBody, onEmailToChange, onEmailSubjectChange, onEmailBodyChange`; use a minimal one-station workflow object):

```tsx
it('renders a live preview of the email', () => {
  // render with emailTo="team@co.com", emailSubject="Daily Report", emailBody="Numbers attached."
  // expect screen.getByText('Preview') visible
  // expect the preview region to contain 'team@co.com', 'Daily Report', 'Numbers attached.'
});

it('shows placeholder text in the preview when fields are empty', () => {
  // render with empty strings
  // expect preview to show '(no recipient)' and '(no subject)'
});
```

Write both as complete runnable tests.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/features/editor/components/step-configs/NotificationConfigForm.test.tsx`
Expected: FAIL — no preview exists.

- [ ] **Step 3: Implement the preview**

In `EmailForm` (NotificationConfigForm.tsx:37-109), append after the Body field:

```tsx
<div style={{ marginTop: '12px' }}>
  <div className="form-label">Preview</div>
  <div style={{
    border: '1px solid var(--border-color)', borderRadius: '8px',
    background: 'var(--bg-primary)', padding: '12px 14px', fontSize: '13px',
  }}>
    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
      To: {emailTo || '(no recipient)'}
    </div>
    <div style={{ fontWeight: 600, marginBottom: '8px' }}>
      {emailSubject || '(no subject)'}
    </div>
    <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
      {emailBody || 'Your message will appear here.'}
    </div>
  </div>
</div>
```

- [ ] **Step 4: Run tests, commit**

Run: `cd frontend; npm run test:run -- src/features/editor/components/step-configs`
Expected: PASS.

```bash
git add frontend/src/features/editor/components/step-configs
git commit -m "feat: live email preview in send-email config"
```

---

### Task 7: First-visit coach marks

**Files:**
- Create: `frontend/src/features/editor/components/CoachMarks.tsx`
- Modify: `frontend/src/features/editor/EditorPage.tsx` (mount)
- Test: `frontend/src/features/editor/components/CoachMarks.test.tsx`

**Interfaces:**
- Consumes: localStorage key **`editor.coachMarksSeen`** ('1' when dismissed/completed).
- Produces: default-export `CoachMarks` with props `{ onDone: () => void }`. EditorPage mounts it when the key is unset AND a workflow is loaded AND viewMode is 'plan'.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/editor/components/CoachMarks.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CoachMarks from './CoachMarks';

describe('CoachMarks', () => {
  it('walks through 3 steps with Next and calls onDone at the end', () => {
    const onDone = vi.fn();
    render(<CoachMarks onDone={onDone} />);
    expect(screen.getByText('This is your plan')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Click .* to change any action/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Press Test/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('can be skipped from any step', () => {
    const onDone = vi.fn();
    render(<CoachMarks onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onDone).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/features/editor/components/CoachMarks.test.tsx`
Expected: FAIL — cannot resolve `./CoachMarks`.

- [ ] **Step 3: Write the component**

Create `frontend/src/features/editor/components/CoachMarks.tsx`:

```tsx
import { useState } from 'react';

const STEPS = [
  {
    title: 'This is your plan',
    body: 'Your automation reads top to bottom: when it starts, then what happens stage by stage.',
  },
  {
    title: 'Edit anything',
    body: 'Click ✏️ to change any action — what it does, who it emails, where it calls.',
  },
  {
    title: 'Try it safely',
    body: 'Press Test in the toolbar to do a practice run and watch each stage happen.',
  },
];

export default function CoachMarks({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-label="Editor introduction"
      style={{
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, width: 'min(420px, calc(100vw - 32px))',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: '12px', padding: '16px 18px', boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{step.title}</div>
      <div className="text-sm text-muted" style={{ marginBottom: '12px' }}>{step.body}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="text-sm text-muted" style={{ flex: 1 }}>{index + 1} / {STEPS.length}</span>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>Skip</button>
        {isLast ? (
          <button className="btn btn-primary btn-sm" onClick={onDone}>Got it</button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={() => setIndex(i => i + 1)}>Next</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount in EditorPage**

In `EditorPage.tsx`:

```ts
const [showCoachMarks, setShowCoachMarks] = useState(() => !localStorage.getItem('editor.coachMarksSeen'));

const dismissCoachMarks = useCallback(() => {
  localStorage.setItem('editor.coachMarksSeen', '1');
  setShowCoachMarks(false);
}, []);
```

Render near the end of the layout (sibling of the panels):

```tsx
{showCoachMarks && currentWorkflow && viewMode === 'plan' && (
  <CoachMarks onDone={dismissCoachMarks} />
)}
```

- [ ] **Step 5: Run tests, full suite, commit**

Run: `cd frontend; npm run test:run -- src/features/editor` then `cd frontend; npm run test:run`
Expected: PASS. If existing editor tests now see the coach marks dialog unexpectedly, set `localStorage.setItem('editor.coachMarksSeen', '1')` in their setup — note any test you touch.

```bash
git add frontend/src/features/editor
git commit -m "feat: first-visit coach marks in plan view"
```

---

### Task 8: Full-suite run and browser verification

**Files:** none — verification only.

- [ ] **Step 1: Full frontend suite**

Run: `cd frontend; npm run test:run` — expect all green.

- [ ] **Step 2: Backend suite (cross-impact guard)**

Run: `cd backend; npm run test -- --run` — expect all green; `git diff --stat <phase2-base>..HEAD -- backend/src` must be empty (phase2-base = the commit `feature/phase2-guided-builder` branched from, `cb0e2bb`).

- [ ] **Step 3: Production build**

Run: `cd frontend; npm run build` — expect clean.

- [ ] **Step 4: Browser verification (required before claiming done)**

With dev servers running (`npm run dev`), verify in Chrome:
1. Open a template-created automation → lands in **Plan View** by default: trigger line, numbered stages, plain-language action rows.
2. Coach marks appear on first visit (clear `editor.coachMarksSeen` first); Next → Next → Got it; reload — they don't reappear.
3. Click ✏️ on an action row → NodeConfigPanel opens; email step shows To/Subject/Message + live Preview; Retry Policy is inside collapsed Advanced.
4. HTTP action: URL/Method/Body visible; Headers + Timeout inside Advanced.
5. Variable picker shows "Use result from" with friendly labels; inserting still produces `steps['...'].output...` syntax in the field.
6. Toggle Canvas View → canvas renders exactly as before; toggle persists across reload (localStorage).
7. "+ Add a stage" works from Plan View.
8. Console clean throughout. Screenshot each key state at ~1280px (and ~375px if the environment allows window resize below Chrome's minimum; otherwise note the limitation).

- [ ] **Step 5: Fix anything found, re-verify, done**
