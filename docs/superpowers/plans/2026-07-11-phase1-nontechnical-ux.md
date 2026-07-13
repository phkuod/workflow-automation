# Phase 1: Non-Technical UX — Entry & Presentation Reshape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the product's language and presentation for non-technical users — plain-English terminology, a template gallery entry point, a story-style run timeline — and clear all remaining UI/UX test-report items.

**Architecture:** Display-layer changes only. Internal step-type keys, DB schema, and API contracts are untouched. New pure-function modules (`runSummary`, `errorTranslation`) feed a new `RunTimeline` component; templates are static frontend data feeding a new gallery page. One frontend API addition (`scheduleApi.getAll`) calls the *existing* backend `GET /api/schedules`.

**Tech Stack:** React 18 + TypeScript (strict), Vite, Zustand, react-router-dom, Recharts, lucide-react, Vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-11-nontechnical-ux-redesign-design.md`

## Global Constraints

- UI language is **English** (plain English terms; no i18n framework).
- **No backend changes.** `GET /api/schedules` already exists; the frontend merely starts calling it.
- Internal `StepType` keys (`action-email`, `script-js`, …), DB columns, and API routes are **unchanged** — only display strings change.
- TypeScript strict mode; no `any` without justification; no `console.log` in shipped code.
- Frontend tests: run from `frontend/` with `npm run test:run` (all) or `npm run test:run -- <path>` (one file).
- Working branch: `fix/ui-ux-enhancements`. Commit after every task, format `<type>: <description>`.
- Terminology glossary (authoritative — apply to every user-visible string you touch):
  - Workflow → **Automation** · Station → **Stage** · Step → **Action** · Execution → **Run** · Simulate → **Test**
  - Triggers: manual → "Start manually", cron → "On a schedule", webhook → "When another system calls"

---

### Task 1: Plain-English terminology sweep

**Files:**
- Modify: `frontend/src/shared/types/workflow.ts:223-236` (STEP_TYPE_INFO labels)
- Modify: `frontend/src/features/editor/components/NodeLibrary.tsx:13-26` (categories)
- Modify: `frontend/src/shared/components/Sidebar.tsx:17-20` (nav labels)
- Modify: `frontend/src/features/executions/ExecutionsPage.tsx` (page copy)
- Modify: `frontend/src/features/editor/EditorPage.tsx` (Simulate→Test, toasts)
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx` (headings, column labels, button)
- Test: existing `*.test.tsx` files whose copy assertions break

**Interfaces:**
- Consumes: nothing.
- Produces: new `STEP_TYPE_INFO` labels (record shape unchanged: `Record<StepType, { label: string; icon: string; color: string }>`). All later tasks display these labels via existing lookups — no signature changes.

- [ ] **Step 1: Update STEP_TYPE_INFO labels**

In `frontend/src/shared/types/workflow.ts`, replace the body of `STEP_TYPE_INFO` (keys, icons, colors unchanged):

```ts
export const STEP_TYPE_INFO: Record<StepType, { label: string; icon: string; color: string }> = {
  'trigger-manual': { label: 'Start manually', icon: '🔘', color: '#22c55e' },
  'trigger-cron': { label: 'On a schedule', icon: '⏰', color: '#22c55e' },
  'script-js': { label: 'Custom Script (JavaScript)', icon: '📜', color: '#f59e0b' },
  'script-python': { label: 'Custom Script (Python)', icon: '🐍', color: '#3b82f6' },
  'http-request': { label: 'Call an external service', icon: '🔗', color: '#8b5cf6' },
  'if-else': { label: 'Decision', icon: '🔀', color: '#ec4899' },
  'set-variable': { label: 'Remember a value', icon: '📝', color: '#6366f1' },
  'wait': { label: 'Wait', icon: '⏳', color: '#64748b' },
  'trigger-webhook': { label: 'When another system calls', icon: '⚡', color: '#22c55e' },
  'action-email': { label: 'Send an email', icon: '📧', color: '#3b82f6' },
  'action-slack': { label: 'Send a Slack message', icon: '💬', color: '#4a154b' },
  'connector-db': { label: 'Query a database', icon: '🗄️', color: '#0ea5e9' },
};
```

- [ ] **Step 2: Recategorize the Node Library**

In `frontend/src/features/editor/components/NodeLibrary.tsx`, replace `NODE_CATEGORIES` (lines 13–26) and the default expanded list (line 30):

```ts
const NODE_CATEGORIES = {
  triggers: {
    label: '📌 When it starts',
    types: ['trigger-manual', 'trigger-cron', 'trigger-webhook'] as StepType[],
  },
  actions: {
    label: '⚙️ Do something',
    types: ['http-request', 'set-variable', 'action-email', 'action-slack'] as StepType[],
  },
  flow: {
    label: '🔀 Flow control',
    types: ['if-else', 'wait'] as StepType[],
  },
  advanced: {
    label: '🛠️ Advanced',
    types: ['script-js', 'script-python', 'connector-db'] as StepType[],
  },
};
```

```ts
const [expandedCategories, setExpandedCategories] = useState<string[]>(['triggers', 'actions', 'flow', 'advanced']);
```

- [ ] **Step 3: Sidebar nav label**

In `frontend/src/shared/components/Sidebar.tsx` line 19: `label: 'Executions'` → `label: 'Runs'`.

- [ ] **Step 4: ExecutionsPage copy**

In `frontend/src/features/executions/ExecutionsPage.tsx` change these user-visible strings (find each exact old string):

| Old | New |
|---|---|
| `Execution History` | `Run History` |
| `` `${executions.length} executions` `` | `` `${executions.length} runs` `` |
| `` `${filteredExecutions.length} of ${executions.length} executions` `` | `` `${filteredExecutions.length} of ${executions.length} runs` `` |
| `Loading executions...` | `Loading runs...` |
| `No Executions Yet` | `No runs yet` |
| `Run a workflow to see execution history here.` | `Run an automation to see its history here.` |
| `No Matching Executions` | `No matching runs` |
| `Search by workflow name...` | `Search by automation name...` |
| `Delete Execution` (confirm title) | `Delete run record` |
| `Are you sure you want to delete this execution record? This action cannot be undone.` | `Are you sure you want to delete this run record? This action cannot be undone.` |
| `Cancel execution` (title attr) | `Cancel run` |
| `Delete execution` (title attr) | `Delete run record` |
| `Workflow` (table header) | `Automation` |

- [ ] **Step 5: EditorPage copy**

In `frontend/src/features/editor/EditorPage.tsx`:
- Button text `Simulate` (line ~442) → `Test`
- Toast `'Workflow saved'` → `'Automation saved'`; `'Failed to save workflow'` → `'Failed to save automation'`; `'Simulation failed'` → `'Test run failed'`

- [ ] **Step 6: DashboardPage copy**

In `frontend/src/features/dashboard/DashboardPage.tsx`:
- Button text `New Workflow` → `New Automation` (keep the modal working for now — Task 7 replaces it)
- Table header `Stations` → `Stages`; cell text `'station'/'stations'` → `'stage'/'stages'` (line ~294)
- Any heading/metric-card copy containing "Workflow(s)" → "Automation(s)" (grep the file for `Workflow` and rewrite user-visible strings only — component names, types, and imports stay unchanged)
- Modal title `Create New Workflow` → `Create New Automation` (and its `aria-label`)
- Toast `'Failed to create workflow'` → `'Failed to create automation'`, `'Failed to copy workflow'` → `'Failed to copy automation'`, `'Workflow imported successfully'` → `'Automation imported successfully'`, import error strings likewise

- [ ] **Step 7: Sweep the rest of the frontend for stragglers**

Run: `grep -rn "Workflow\|Execution\|Simulate\|Station" frontend/src --include="*.tsx" -l` and inspect each file for **user-visible** strings still using old terms (breadcrumbs in `EditorBreadcrumb.tsx`, `NodeConfigPanel.tsx` headings, `NodeLibrary.tsx` "Add to Station" → "Add to Stage", monitoring cards "Total Workflows" → "Total Automations", etc.). Rewrite copy only — never identifiers, types, or API paths.

- [ ] **Step 8: Run the full frontend suite and fix copy assertions**

Run: `cd frontend; npm run test:run`
Expected: failures only in copy assertions (e.g. `getByText('Execution History')`). Update each failing assertion to the new copy. Re-run until green. If a failure is NOT a copy assertion, stop and investigate — the sweep broke something structural.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src
git commit -m "feat: plain-English terminology across UI (Automation/Stage/Action/Run/Test)"
```

---

### Task 2: `summarizeStep` — plain-language run summaries

**Files:**
- Create: `frontend/src/shared/utils/runSummary.ts`
- Test: `frontend/src/shared/utils/runSummary.test.ts`

**Interfaces:**
- Consumes: `StepResult` from `frontend/src/shared/types/workflow.ts`.
- Produces: `summarizeStep(step: StepResult): string` — one plain-English sentence per action. Task 4's `RunTimeline` calls this.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/utils/runSummary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { summarizeStep } from './runSummary';
import type { StepResult } from '../types/workflow';

function step(partial: Partial<StepResult>): StepResult {
  return {
    stepId: 's1', stepName: 'My step', stepType: 'wait', status: 'completed',
    ...partial,
  } as StepResult;
}

describe('summarizeStep', () => {
  it('summarizes an email send with recipient', () => {
    expect(summarizeStep(step({
      stepType: 'action-email',
      input: { emailTo: 'team@company.com' },
    }))).toBe('Sent an email to team@company.com');
  });

  it('summarizes an email send without recipient info', () => {
    expect(summarizeStep(step({ stepType: 'action-email' }))).toBe('Sent an email');
  });

  it('summarizes an http request with url', () => {
    expect(summarizeStep(step({
      stepType: 'http-request',
      input: { url: 'https://api.example.com/data' },
    }))).toBe('Called https://api.example.com/data');
  });

  it('summarizes a decision taking the yes path', () => {
    expect(summarizeStep(step({
      stepType: 'if-else',
      output: { result: true },
    }))).toBe('Decision: took the "yes" path');
  });

  it('summarizes a decision taking the no path', () => {
    expect(summarizeStep(step({
      stepType: 'if-else',
      output: { result: false },
    }))).toBe('Decision: took the "no" path');
  });

  it('summarizes remembering a value', () => {
    expect(summarizeStep(step({
      stepType: 'set-variable',
      input: { variableName: 'orderCount' },
    }))).toBe('Remembered "orderCount"');
  });

  it('summarizes a wait', () => {
    expect(summarizeStep(step({
      stepType: 'wait',
      input: { duration: 5, unit: 'seconds' },
    }))).toBe('Waited 5 seconds');
  });

  it('summarizes triggers', () => {
    expect(summarizeStep(step({ stepType: 'trigger-manual' }))).toBe('Started manually');
    expect(summarizeStep(step({ stepType: 'trigger-cron' }))).toBe('Started on schedule');
    expect(summarizeStep(step({ stepType: 'trigger-webhook' }))).toBe('Started by another system');
  });

  it('summarizes scripts and db queries generically', () => {
    expect(summarizeStep(step({ stepType: 'script-js' }))).toBe('Ran a custom script');
    expect(summarizeStep(step({ stepType: 'script-python' }))).toBe('Ran a custom script');
    expect(summarizeStep(step({ stepType: 'connector-db' }))).toBe('Queried the database');
  });

  it('summarizes slack messages', () => {
    expect(summarizeStep(step({ stepType: 'action-slack' }))).toBe('Sent a Slack message');
  });

  it('falls back to the step name for unknown types', () => {
    expect(summarizeStep(step({
      stepType: 'something-new' as StepResult['stepType'],
      stepName: 'Mystery step',
    }))).toBe('Mystery step');
  });

  it('describes skipped steps', () => {
    expect(summarizeStep(step({ stepType: 'action-email', status: 'skipped' })))
      .toBe('Skipped: Send an email');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/shared/utils/runSummary.test.ts`
Expected: FAIL — cannot resolve `./runSummary`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/shared/utils/runSummary.ts`:

```ts
import type { StepResult } from '../types/workflow';
import { STEP_TYPE_INFO } from '../types/workflow';

function inputStr(step: StepResult, key: string): string | undefined {
  const v = step.input?.[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** One plain-English sentence describing what an action did. */
export function summarizeStep(step: StepResult): string {
  if (step.status === 'skipped') {
    const label = STEP_TYPE_INFO[step.stepType]?.label ?? step.stepName;
    return `Skipped: ${label}`;
  }

  switch (step.stepType) {
    case 'trigger-manual':
      return 'Started manually';
    case 'trigger-cron':
      return 'Started on schedule';
    case 'trigger-webhook':
      return 'Started by another system';
    case 'action-email': {
      const to = inputStr(step, 'emailTo');
      return to ? `Sent an email to ${to}` : 'Sent an email';
    }
    case 'action-slack':
      return 'Sent a Slack message';
    case 'http-request': {
      const url = inputStr(step, 'url');
      return url ? `Called ${url}` : 'Called an external service';
    }
    case 'if-else':
      return step.output?.result === true
        ? 'Decision: took the "yes" path'
        : 'Decision: took the "no" path';
    case 'set-variable': {
      const name = inputStr(step, 'variableName');
      return name ? `Remembered "${name}"` : 'Remembered a value';
    }
    case 'wait': {
      const duration = step.input?.duration;
      const unit = inputStr(step, 'unit');
      return typeof duration === 'number' && unit
        ? `Waited ${duration} ${unit}`
        : 'Waited';
    }
    case 'script-js':
    case 'script-python':
      return 'Ran a custom script';
    case 'connector-db':
      return 'Queried the database';
    default:
      return step.stepName;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test:run -- src/shared/utils/runSummary.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/utils/runSummary.ts frontend/src/shared/utils/runSummary.test.ts
git commit -m "feat: plain-language step summaries for run timeline"
```

---

### Task 3: Error translation layer

**Files:**
- Create: `frontend/src/shared/utils/errorTranslation.ts`
- Test: `frontend/src/shared/utils/errorTranslation.test.ts`

**Interfaces:**
- Consumes: nothing project-specific (pure string matching).
- Produces:
  ```ts
  interface TranslatedError { title: string; suggestion?: string; raw: string; matched: boolean }
  function translateError(message: string): TranslatedError
  ```
  Task 4's `RunTimeline` calls `translateError`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/utils/errorTranslation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { translateError } from './errorTranslation';

describe('translateError', () => {
  it('translates timeouts', () => {
    const t = translateError('connect ETIMEDOUT 93.184.216.34:443');
    expect(t.matched).toBe(true);
    expect(t.title).toBe('The service took too long to respond');
    expect(t.suggestion).toContain('Try again');
    expect(t.raw).toBe('connect ETIMEDOUT 93.184.216.34:443');
  });

  it('translates unknown hosts', () => {
    const t = translateError('getaddrinfo ENOTFOUND api.exampel.com');
    expect(t.matched).toBe(true);
    expect(t.title).toBe("Couldn't find the service address");
  });

  it('translates refused connections', () => {
    const t = translateError('connect ECONNREFUSED 127.0.0.1:8080');
    expect(t.matched).toBe(true);
    expect(t.title).toBe('The service refused the connection');
  });

  it('translates SMTP auth failures', () => {
    const t = translateError('Invalid login: 535-5.7.8 Username and Password not accepted');
    expect(t.matched).toBe(true);
    expect(t.title).toBe('Email sign-in failed');
    expect(t.suggestion).toContain('SMTP');
  });

  it('translates JSON parse errors', () => {
    const t = translateError("Unexpected token '<' in JSON at position 0");
    expect(t.matched).toBe(true);
    expect(t.title).toBe("The data received wasn't in the expected format");
  });

  it('translates HTTP 404', () => {
    const t = translateError('Request failed with status code 404');
    expect(t.matched).toBe(true);
    expect(t.title).toBe("The address wasn't found (404)");
  });

  it('translates HTTP 401/403 as access denied', () => {
    expect(translateError('Request failed with status code 401').title)
      .toBe('Access to the service was denied');
    expect(translateError('Request failed with status code 403').title)
      .toBe('Access to the service was denied');
  });

  it('translates HTTP 5xx', () => {
    const t = translateError('Request failed with status code 503');
    expect(t.matched).toBe(true);
    expect(t.title).toBe('The external service had an internal problem');
  });

  it('falls back to the raw message unmatched', () => {
    const t = translateError('some totally novel failure');
    expect(t.matched).toBe(false);
    expect(t.title).toBe('some totally novel failure');
    expect(t.suggestion).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/shared/utils/errorTranslation.test.ts`
Expected: FAIL — cannot resolve `./errorTranslation`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/shared/utils/errorTranslation.ts`:

```ts
export interface TranslatedError {
  title: string;
  suggestion?: string;
  raw: string;
  matched: boolean;
}

interface ErrorPattern {
  pattern: RegExp;
  title: string;
  suggestion: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /ETIMEDOUT|ESOCKETTIMEDOUT|timed? ?out/i,
    title: 'The service took too long to respond',
    suggestion: 'Try again later, or increase the timeout in Advanced settings.',
  },
  {
    pattern: /ENOTFOUND|EAI_AGAIN|getaddrinfo/i,
    title: "Couldn't find the service address",
    suggestion: 'Check the URL for typos.',
  },
  {
    pattern: /ECONNREFUSED/i,
    title: 'The service refused the connection',
    suggestion: 'The service may be down, or the port may be wrong.',
  },
  {
    pattern: /invalid login|EAUTH|535/i,
    title: 'Email sign-in failed',
    suggestion: 'Check the SMTP username and password settings.',
  },
  {
    pattern: /unexpected token|JSON at position|is not valid JSON/i,
    title: "The data received wasn't in the expected format",
    suggestion: 'The service may have returned an error page instead of data.',
  },
  {
    pattern: /status code 404/i,
    title: "The address wasn't found (404)",
    suggestion: 'Check the URL path.',
  },
  {
    pattern: /status code 40[13]/i,
    title: 'Access to the service was denied',
    suggestion: 'Check the credentials or API key in Advanced settings.',
  },
  {
    pattern: /status code 5\d\d/i,
    title: 'The external service had an internal problem',
    suggestion: 'This is on their side — try again later.',
  },
];

/** Map a raw error message to a plain-English explanation. */
export function translateError(message: string): TranslatedError {
  for (const { pattern, title, suggestion } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return { title, suggestion, raw: message, matched: true };
    }
  }
  return { title: message, raw: message, matched: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test:run -- src/shared/utils/errorTranslation.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/utils/errorTranslation.ts frontend/src/shared/utils/errorTranslation.test.ts
git commit -m "feat: plain-English error translation layer"
```

---

### Task 4: RunTimeline component + ExecutionsPage integration

**Files:**
- Create: `frontend/src/features/executions/components/RunTimeline.tsx`
- Test: `frontend/src/features/executions/components/RunTimeline.test.tsx`
- Modify: `frontend/src/features/executions/ExecutionsPage.tsx:330-406` (expanded row body)

**Interfaces:**
- Consumes: `summarizeStep` (Task 2), `translateError` (Task 3), `ExecutionResult`/`StationResult`/`StepResult` types, `STEP_TYPE_INFO`.
- Produces: `RunTimeline` React component, props `{ result: ExecutionResult }`, default export.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/executions/components/RunTimeline.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RunTimeline from './RunTimeline';
import type { ExecutionResult } from '../../../shared/types/workflow';

const result: ExecutionResult = {
  stations: [
    {
      stationId: 'st1',
      stationName: 'Collect data',
      status: 'completed',
      steps: [
        {
          stepId: 's1', stepName: 'Fetch', stepType: 'http-request',
          status: 'completed', input: { url: 'https://api.example.com/data' },
        },
      ],
    },
    {
      stationId: 'st2',
      stationName: 'Send report',
      status: 'failed',
      steps: [
        {
          stepId: 's2', stepName: 'Email', stepType: 'action-email',
          status: 'failed', input: { emailTo: 'team@company.com' },
          error: { message: 'connect ETIMEDOUT 1.2.3.4:587' },
        },
      ],
    },
  ],
};

describe('RunTimeline', () => {
  it('renders one node per stage', () => {
    render(<RunTimeline result={result} />);
    expect(screen.getByText('Collect data')).toBeInTheDocument();
    expect(screen.getByText('Send report')).toBeInTheDocument();
  });

  it('renders plain-language summaries per action', () => {
    render(<RunTimeline result={result} />);
    expect(screen.getByText('Called https://api.example.com/data')).toBeInTheDocument();
  });

  it('renders translated errors for failed actions', () => {
    render(<RunTimeline result={result} />);
    expect(screen.getByText('The service took too long to respond')).toBeInTheDocument();
    // raw error available in collapsed details
    expect(screen.getByText(/connect ETIMEDOUT/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/features/executions/components/RunTimeline.test.tsx`
Expected: FAIL — cannot resolve `./RunTimeline`.

- [ ] **Step 3: Write the component**

Create `frontend/src/features/executions/components/RunTimeline.tsx`:

```tsx
import { CheckCircle, XCircle, MinusCircle, Loader } from 'lucide-react';
import type { ExecutionResult, StationResult, StepResult } from '../../../shared/types/workflow';
import { STEP_TYPE_INFO } from '../../../shared/types/workflow';
import { summarizeStep } from '../../../shared/utils/runSummary';
import { translateError } from '../../../shared/utils/errorTranslation';
import { EDGE_COLORS } from '../../../shared/constants/colors';

function StatusIcon({ status }: { status: StationResult['status'] | StepResult['status'] }) {
  switch (status) {
    case 'completed': return <CheckCircle size={16} style={{ color: EDGE_COLORS.success }} />;
    case 'failed': return <XCircle size={16} style={{ color: EDGE_COLORS.error }} />;
    case 'running': return <Loader size={16} className="loading-spinner" style={{ color: EDGE_COLORS.primary }} />;
    default: return <MinusCircle size={16} style={{ color: EDGE_COLORS.muted }} />;
  }
}

function StepLine({ step }: { step: StepResult }) {
  const info = STEP_TYPE_INFO[step.stepType] ?? { icon: '📦' };
  const failed = step.status === 'failed';
  const translated = failed && step.error ? translateError(step.error.message) : null;

  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <StatusIcon status={step.status} />
        <span aria-hidden>{info.icon}</span>
        <span style={{ color: failed ? EDGE_COLORS.error : 'var(--text-primary)' }}>
          {summarizeStep(step)}
        </span>
      </div>
      {translated && (
        <div style={{
          marginTop: '6px', marginLeft: '24px', padding: '8px 12px',
          borderRadius: '8px', background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)', fontSize: '12px',
        }}>
          <div style={{ fontWeight: 600, color: EDGE_COLORS.error }}>{translated.title}</div>
          {translated.suggestion && (
            <div style={{ marginTop: '2px', color: 'var(--text-secondary)' }}>{translated.suggestion}</div>
          )}
          {translated.matched && (
            <details style={{ marginTop: '4px' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>Technical details</summary>
              <code style={{ fontSize: '11px', wordBreak: 'break-all' }}>{translated.raw}</code>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default function RunTimeline({ result }: { result: ExecutionResult }) {
  return (
    <div style={{ marginTop: '12px' }}>
      {result.stations.map((station, i) => (
        <div key={station.stationId} style={{ display: 'flex', gap: '12px' }}>
          {/* Timeline rail */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20px' }}>
            <StatusIcon status={station.status} />
            {i < result.stations.length - 1 && (
              <div style={{ flex: 1, width: '2px', background: 'var(--border-color)', marginTop: '4px' }} />
            )}
          </div>
          {/* Stage content */}
          <div style={{ flex: 1, paddingBottom: '16px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>
              {station.stationName}
            </div>
            {station.steps.map((step) => (
              <StepLine key={step.stepId} step={step} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

Note: if the raw error is *unmatched*, `translateError` puts it in `title` already, so the nested "Technical details" only renders for matched errors (no duplication). The test's `getByText(/connect ETIMEDOUT/)` matches the `<code>` inside details (jsdom renders details content).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test:run -- src/features/executions/components/RunTimeline.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Integrate into ExecutionsPage expanded row**

In `frontend/src/features/executions/ExecutionsPage.tsx`:

1. Add import: `import RunTimeline from './components/RunTimeline';`
2. In the expanded `<td colSpan={8}>` block, **replace** the "Station Results" section (the `execution.result?.stations && ...` block, lines ~333–364) with:

```tsx
{execution.result?.stations && execution.result.stations.length > 0 && (
  <RunTimeline result={execution.result} />
)}
```

3. Wrap the existing Logs section (lines ~366–403) in a collapsed details element — change the outer `<div style={{ marginTop: '12px' }}>` to:

```tsx
{logs && logs.length > 0 && (
  <details style={{ marginTop: '12px' }}>
    <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
      Technical details ({logs.length} log entries)
    </summary>
    {/* existing log list div moves here unchanged */}
  </details>
)}
```

Keep the inner monospace log list exactly as it is today.

- [ ] **Step 6: Run the executions page tests**

Run: `cd frontend; npm run test:run -- src/features/executions`
Expected: PASS. If `ExecutionsPage.test.tsx` asserted on "Station Results", update those assertions to timeline content (stage names still render).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/executions
git commit -m "feat: story-style run timeline with translated errors"
```

---

### Task 5: Runs page — multi-expand (X-1) and pagination (X-3)

**Files:**
- Modify: `frontend/src/features/executions/ExecutionsPage.tsx`
- Test: `frontend/src/features/executions/ExecutionsPage.test.tsx`

**Interfaces:**
- Consumes: existing `executionApi.getAll(50)`.
- Produces: no exports — page behavior only. Expanded rows keyed by a `Set<string>` (multiple rows stay open independently; nothing auto-collapses). Client-side pagination, `PAGE_SIZE = 10`.

- [ ] **Step 1: Write failing tests**

Add to `frontend/src/features/executions/ExecutionsPage.test.tsx` (follow the file's existing mock setup for `executionApi`):

```tsx
it('keeps a row expanded when another row is expanded', async () => {
  // render with >=2 mocked executions, click row 1 then row 2
  // assert both expanded details are in the document
});

it('paginates runs 10 per page', async () => {
  // mock 25 executions; assert 10 rows on page 1,
  // "Page 1 of 3" text, clicking Next shows the next 10
});
```

Write these as real tests using the file's existing render helpers and `executionApi.getAll` mock — mock data factory: `Array.from({ length: 25 }, (_, i) => ({ id: 'e' + i, workflowId: 'w1', workflowName: 'WF ' + i, status: 'completed', triggeredBy: 'manual', startTime: new Date(2026, 0, 1, 0, i).toISOString(), endTime: new Date(2026, 0, 1, 0, i, 30).toISOString(), successRate: 100 }))`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend; npm run test:run -- src/features/executions/ExecutionsPage.test.tsx`
Expected: FAIL — second expansion collapses the first; no pagination controls exist.

- [ ] **Step 3: Implement multi-expand**

In `ExecutionsPage.tsx`:

```tsx
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

const toggleExpand = async (id: string) => {
  setExpandedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });
  if (!expandedIds.has(id) && !logs[id]) {
    try {
      const logData = await executionApi.getLogs(id);
      setLogs(prev => ({ ...prev, [id]: logData }));
    } catch {
      // silently fail for logs
    }
  }
};
```

Update `ExecutionRow` call site: `isExpanded={expandedIds.has(exec.id)}`. In `handleDelete`, replace the `if (expandedId === id) setExpandedId(null)` line with `setExpandedIds(prev => { const next = new Set(prev); next.delete(id); return next; });`.

- [ ] **Step 4: Implement pagination**

```tsx
const PAGE_SIZE = 10;
const [page, setPage] = useState(1);
const totalPages = Math.max(1, Math.ceil(filteredExecutions.length / PAGE_SIZE));
const pagedExecutions = filteredExecutions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
```

- Reset page when filters change: `useEffect(() => { setPage(1); }, [searchQuery, statusFilter]);`
- Map over `pagedExecutions` instead of `filteredExecutions` in the table body.
- Below the table card, render controls when `totalPages > 1`:

```tsx
<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
  <button className="btn btn-sm btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
    Previous
  </button>
  <span className="text-sm text-muted">Page {page} of {totalPages}</span>
  <button className="btn btn-sm btn-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
    Next
  </button>
</div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend; npm run test:run -- src/features/executions/ExecutionsPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/executions
git commit -m "feat: multi-expand run rows and client-side pagination"
```

---

### Task 6: Automation templates data module

**Files:**
- Create: `frontend/src/features/templates/templates.ts`
- Test: `frontend/src/features/templates/templates.test.ts`

**Interfaces:**
- Consumes: `WorkflowDefinition`, `StepType` types.
- Produces:
  ```ts
  type TemplateCategory = 'Notifications' | 'Reports' | 'Data Processing' | 'Approvals';
  interface AutomationTemplate {
    id: string;
    name: string;
    description: string;
    category: TemplateCategory;
    definition: WorkflowDefinition;
  }
  const AUTOMATION_TEMPLATES: AutomationTemplate[];
  const TEMPLATE_CATEGORIES: TemplateCategory[];
  ```
  Task 7's gallery consumes both exports.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/templates/templates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AUTOMATION_TEMPLATES, TEMPLATE_CATEGORIES } from './templates';
import { STEP_TYPE_INFO } from '../../shared/types/workflow';

describe('AUTOMATION_TEMPLATES', () => {
  it('provides at least 6 templates', () => {
    expect(AUTOMATION_TEMPLATES.length).toBeGreaterThanOrEqual(6);
  });

  it('has unique template ids', () => {
    const ids = AUTOMATION_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has a valid category', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      expect(TEMPLATE_CATEGORIES).toContain(t.category);
    }
  });

  it('every template definition has at least one stage with steps', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      expect(t.definition.stations.length).toBeGreaterThanOrEqual(1);
      for (const station of t.definition.stations) {
        expect(station.steps.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every step uses a known type and unique id within its template', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      const stepIds = t.definition.stations.flatMap(s => s.steps.map(st => st.id));
      expect(new Set(stepIds).size).toBe(stepIds.length);
      for (const station of t.definition.stations) {
        for (const step of station.steps) {
          expect(Object.keys(STEP_TYPE_INFO)).toContain(step.type);
        }
      }
    }
  });

  it('every stage and step carries canvas positions', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      for (const station of t.definition.stations) {
        expect(station.position).toEqual({ x: expect.any(Number), y: expect.any(Number) });
        for (const step of station.steps) {
          expect(step.position).toEqual({ x: expect.any(Number), y: expect.any(Number) });
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/features/templates/templates.test.ts`
Expected: FAIL — cannot resolve `./templates`.

- [ ] **Step 3: Write the templates module**

Create `frontend/src/features/templates/templates.ts`. Full content (6 templates; positions follow the editor's left-to-right layout convention, stages 300px apart, steps 200px apart):

```ts
import type { WorkflowDefinition } from '../../shared/types/workflow';

export type TemplateCategory = 'Notifications' | 'Reports' | 'Data Processing' | 'Approvals';

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  definition: WorkflowDefinition;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Notifications', 'Reports', 'Data Processing', 'Approvals',
];

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'daily-report',
    name: 'Scheduled Daily Report',
    description: 'Every morning, fetch fresh data and email a report to your team.',
    category: 'Reports',
    definition: {
      stations: [
        {
          id: 'stage-collect', name: 'Collect data', position: { x: 100, y: 150 },
          steps: [
            { id: 'step-trigger', name: 'Every day at 9:00', type: 'trigger-cron', config: { cronExpression: '0 9 * * *' }, position: { x: 100, y: 100 } },
            { id: 'step-fetch', name: 'Fetch report data', type: 'http-request', config: { url: 'https://api.example.com/report-data', method: 'GET' }, position: { x: 300, y: 100 } },
          ],
        },
        {
          id: 'stage-send', name: 'Send report', position: { x: 400, y: 150 },
          steps: [
            { id: 'step-email', name: 'Email the team', type: 'action-email', config: { emailTo: 'team@example.com', emailSubject: 'Daily Report', emailBody: 'Report data: ${stage-collect.output.stepResults}' }, position: { x: 100, y: 100 } },
          ],
        },
      ],
    },
  },
  {
    id: 'data-pipeline',
    name: 'Data Processing Pipeline',
    description: 'Fetch data from a service, transform it, and keep the result.',
    category: 'Data Processing',
    definition: {
      stations: [
        {
          id: 'stage-fetch', name: 'Fetch', position: { x: 100, y: 150 },
          steps: [
            { id: 'step-trigger', name: 'Start manually', type: 'trigger-manual', config: {}, position: { x: 100, y: 100 } },
            { id: 'step-get', name: 'Get source data', type: 'http-request', config: { url: 'https://api.example.com/data', method: 'GET' }, position: { x: 300, y: 100 } },
          ],
        },
        {
          id: 'stage-transform', name: 'Transform', position: { x: 400, y: 150 },
          steps: [
            { id: 'step-transform', name: 'Reshape the data', type: 'script-js', config: { code: 'const items = input.data || [];\nreturn { count: items.length, items };' }, position: { x: 100, y: 100 } },
            { id: 'step-store', name: 'Remember the result', type: 'set-variable', config: { variableName: 'processedData', variableValue: '${step-transform.output}' }, position: { x: 300, y: 100 } },
          ],
        },
      ],
    },
  },
  {
    id: 'webhook-orders',
    name: 'Webhook Order Processor',
    description: 'When another system sends an order, validate it and notify the channel.',
    category: 'Data Processing',
    definition: {
      stations: [
        {
          id: 'stage-receive', name: 'Receive order', position: { x: 100, y: 150 },
          steps: [
            { id: 'step-trigger', name: 'When an order arrives', type: 'trigger-webhook', config: { webhookMethod: 'POST' }, position: { x: 100, y: 100 } },
            { id: 'step-check', name: 'Is the total above 0?', type: 'if-else', config: { condition: 'input.total > 0' }, position: { x: 300, y: 100 } },
          ],
        },
        {
          id: 'stage-notify', name: 'Notify', position: { x: 400, y: 150 },
          steps: [
            { id: 'step-slack', name: 'Post to Slack', type: 'action-slack', config: { slackWebhookUrl: '', slackMessage: 'New order received: ${step-trigger.output.body}' }, position: { x: 100, y: 100 } },
          ],
        },
      ],
    },
  },
  {
    id: 'health-alert',
    name: 'Service Health Alert',
    description: 'Check a service on a schedule and alert Slack if it looks unhealthy.',
    category: 'Notifications',
    definition: {
      stations: [
        {
          id: 'stage-check', name: 'Check service', position: { x: 100, y: 150 },
          steps: [
            { id: 'step-trigger', name: 'Every 30 minutes', type: 'trigger-cron', config: { cronExpression: '*/30 * * * *' }, position: { x: 100, y: 100 } },
            { id: 'step-ping', name: 'Ping the service', type: 'http-request', config: { url: 'https://api.example.com/health', method: 'GET' }, position: { x: 300, y: 100 } },
            { id: 'step-healthy', name: 'Is it healthy?', type: 'if-else', config: { condition: 'input.status === "ok"' }, position: { x: 500, y: 100 } },
          ],
        },
        {
          id: 'stage-alert', name: 'Alert', position: { x: 400, y: 150 },
          steps: [
            { id: 'step-slack', name: 'Alert the channel', type: 'action-slack', config: { slackWebhookUrl: '', slackMessage: '⚠️ Service health check failed!' }, position: { x: 100, y: 100 } },
          ],
        },
      ],
    },
  },
  {
    id: 'welcome-email',
    name: 'New Signup Welcome Email',
    description: 'When a new user signs up, send them a welcome email.',
    category: 'Notifications',
    definition: {
      stations: [
        {
          id: 'stage-welcome', name: 'Welcome', position: { x: 100, y: 150 },
          steps: [
            { id: 'step-trigger', name: 'When a signup arrives', type: 'trigger-webhook', config: { webhookMethod: 'POST' }, position: { x: 100, y: 100 } },
            { id: 'step-email', name: 'Send the welcome email', type: 'action-email', config: { emailTo: '${step-trigger.output.body.email}', emailSubject: 'Welcome!', emailBody: 'Thanks for signing up. We are glad you are here.' }, position: { x: 300, y: 100 } },
          ],
        },
      ],
    },
  },
  {
    id: 'approval-reminder',
    name: 'Pending Approval Reminder',
    description: 'Each afternoon, check for pending approvals and remind the approver by email.',
    category: 'Approvals',
    definition: {
      stations: [
        {
          id: 'stage-check', name: 'Check approvals', position: { x: 100, y: 150 },
          steps: [
            { id: 'step-trigger', name: 'Every day at 15:00', type: 'trigger-cron', config: { cronExpression: '0 15 * * *' }, position: { x: 100, y: 100 } },
            { id: 'step-fetch', name: 'Fetch pending approvals', type: 'http-request', config: { url: 'https://api.example.com/approvals?status=pending', method: 'GET' }, position: { x: 300, y: 100 } },
            { id: 'step-any', name: 'Anything pending?', type: 'if-else', config: { condition: 'input.count > 0' }, position: { x: 500, y: 100 } },
          ],
        },
        {
          id: 'stage-remind', name: 'Remind', position: { x: 400, y: 150 },
          steps: [
            { id: 'step-email', name: 'Email the approver', type: 'action-email', config: { emailTo: 'approver@example.com', emailSubject: 'You have pending approvals', emailBody: 'There are items waiting for your approval.' }, position: { x: 100, y: 100 } },
          ],
        },
      ],
    },
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test:run -- src/features/templates/templates.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/templates
git commit -m "feat: automation template definitions"
```

---

### Task 7: Template Gallery page ("New Automation")

**Files:**
- Create: `frontend/src/features/templates/TemplateGalleryPage.tsx`
- Test: `frontend/src/features/templates/TemplateGalleryPage.test.tsx`
- Modify: `frontend/src/App.tsx:42-49` (add route)
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx` (button navigates to `/new`; remove create modal)

**Interfaces:**
- Consumes: `AUTOMATION_TEMPLATES`, `TEMPLATE_CATEGORIES` (Task 6); `workflowApi.create({ name, description?, definition })` (existing, `frontend/src/shared/api/workflowApi.ts:32`); `STEP_TYPE_INFO` for icon sequences; `toast` from `shared/stores/toastStore`.
- Produces: `TemplateGalleryPage` default-export component at route `/new`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/templates/TemplateGalleryPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TemplateGalleryPage from './TemplateGalleryPage';
import { AUTOMATION_TEMPLATES } from './templates';
import { workflowApi } from '../../shared/api/workflowApi';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock('../../shared/api/workflowApi', () => ({
  workflowApi: { create: vi.fn() },
}));

function renderPage() {
  return render(<MemoryRouter><TemplateGalleryPage /></MemoryRouter>);
}

describe('TemplateGalleryPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders every template as a card', () => {
    renderPage();
    for (const t of AUTOMATION_TEMPLATES) {
      expect(screen.getByText(t.name)).toBeInTheDocument();
    }
  });

  it('renders a start-from-scratch entry', () => {
    renderPage();
    expect(screen.getByText(/start from scratch/i)).toBeInTheDocument();
  });

  it('creates a draft from a template and navigates to the editor', async () => {
    vi.mocked(workflowApi.create).mockResolvedValue({ id: 'wf-new' } as never);
    renderPage();
    fireEvent.click(screen.getByText(AUTOMATION_TEMPLATES[0].name));
    await waitFor(() => {
      expect(workflowApi.create).toHaveBeenCalledWith({
        name: AUTOMATION_TEMPLATES[0].name,
        description: AUTOMATION_TEMPLATES[0].description,
        definition: AUTOMATION_TEMPLATES[0].definition,
      });
      expect(navigateMock).toHaveBeenCalledWith('/editor/wf-new');
    });
  });

  it('creates an empty draft from scratch', async () => {
    vi.mocked(workflowApi.create).mockResolvedValue({ id: 'wf-blank' } as never);
    renderPage();
    fireEvent.click(screen.getByText(/start from scratch/i));
    await waitFor(() => {
      expect(workflowApi.create).toHaveBeenCalledWith({
        name: 'Untitled Automation',
        description: undefined,
        definition: { stations: [] },
      });
      expect(navigateMock).toHaveBeenCalledWith('/editor/wf-blank');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test:run -- src/features/templates/TemplateGalleryPage.test.tsx`
Expected: FAIL — cannot resolve `./TemplateGalleryPage`.

- [ ] **Step 3: Write the page component**

Create `frontend/src/features/templates/TemplateGalleryPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Sparkles } from 'lucide-react';
import { AUTOMATION_TEMPLATES, TEMPLATE_CATEGORIES } from './templates';
import type { AutomationTemplate } from './templates';
import { workflowApi } from '../../shared/api/workflowApi';
import { STEP_TYPE_INFO } from '../../shared/types/workflow';
import { toast } from '../../shared/stores/toastStore';

function iconSequence(template: AutomationTemplate): string[] {
  return template.definition.stations
    .flatMap(s => s.steps)
    .map(step => STEP_TYPE_INFO[step.type]?.icon ?? '📦');
}

export default function TemplateGalleryPage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const createFrom = async (name: string, description: string | undefined, definition: AutomationTemplate['definition']) => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const created = await workflowApi.create({ name, description, definition });
      navigate(`/editor/${created.id}`);
    } catch {
      toast.error('Failed to create automation');
      setIsCreating(false);
    }
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')} title="Back to dashboard">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>
              <Sparkles size={24} style={{ marginRight: '10px', color: 'var(--accent-primary)' }} />
              New Automation
            </h1>
            <p className="text-sm text-muted">Pick a template that's close to what you need — you can change everything after.</p>
          </div>
        </div>
      </header>

      <main className="main-content">
        {TEMPLATE_CATEGORIES.map(category => {
          const templates = AUTOMATION_TEMPLATES.filter(t => t.category === category);
          if (templates.length === 0) return null;
          return (
            <section key={category} style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '12px' }}>{category}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {templates.map(t => (
                  <button
                    key={t.id}
                    className="card"
                    onClick={() => createFrom(t.name, t.description, t.definition)}
                    disabled={isCreating}
                    style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                  >
                    <div style={{ fontSize: '18px', marginBottom: '8px', letterSpacing: '4px' }} aria-hidden>
                      {iconSequence(t).join(' → ')}
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{t.name}</div>
                    <div className="text-sm text-muted">{t.description}</div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        <section style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button
            className="btn btn-secondary"
            onClick={() => createFrom('Untitled Automation', undefined, { stations: [] })}
            disabled={isCreating}
          >
            <Plus size={16} /> Start from scratch
          </button>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test:run -- src/features/templates/TemplateGalleryPage.test.tsx`
Expected: PASS (4 tests). If the `button.card` nesting breaks a click target, use `getByRole('button', { name: new RegExp(t.name) })` in the test instead.

- [ ] **Step 5: Add the route**

In `frontend/src/App.tsx`, import the page and add inside `<Routes>` (after the `/executions` route):

```tsx
<Route path="/new" element={<MainLayout><TemplateGalleryPage /></MainLayout>} />
```

- [ ] **Step 6: Point the Dashboard button at the gallery and remove the modal**

In `frontend/src/features/dashboard/DashboardPage.tsx`:
- Change the "New Automation" button's `onClick` from `setShowCreateModal(true)` to `navigate('/new')`.
- Delete the now-dead create-modal JSX block, the `showCreateModal` state, and `handleCreate` **if and only if** nothing else references them (the import-workflow flow uses `createWorkflow` directly — keep that).
- Update `DashboardPage.test.tsx`: replace modal-open assertions with an assertion that clicking "New Automation" calls `navigate('/new')` (the file already mocks `useNavigate` — follow its existing pattern; if it doesn't, add the same `vi.mock('react-router-dom', ...)` pattern used in `TemplateGalleryPage.test.tsx`).

- [ ] **Step 7: Run the dashboard and template tests**

Run: `cd frontend; npm run test:run -- src/features/dashboard src/features/templates`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx frontend/src/features/dashboard frontend/src/features/templates
git commit -m "feat: template gallery as the new-automation entry point"
```

---

### Task 8: Remaining test-report fixes (D-2, D-3, D-5, E-1, E-2, M-2, M-3)

**Files:**
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx` (D-2, D-3, D-5)
- Modify: `frontend/src/index.css` (D-2 utility class)
- Modify: `frontend/src/features/editor/EditorPage.tsx:267-283` (E-2)
- Modify: `frontend/src/features/monitoring/MonitoringPage.tsx:401-437` (M-2, M-3)
- Modify: `frontend/src/shared/api/workflowApi.ts` (M-3: `scheduleApi`)
- Test: `frontend/src/features/dashboard/DashboardPage.test.tsx`, `frontend/src/features/monitoring/MonitoringPage.test.tsx`

**Interfaces:**
- Consumes: existing backend `GET /api/schedules` returning `ApiResponse<ScheduleInfo[]>` where each item is `{ workflowId, workflowName, cronExpression, isActive, nextRun?, lastRun?, lastExecution? }` (dates serialized as ISO strings).
- Produces: `scheduleApi.getAll(): Promise<ScheduleInfo[]>` and exported `interface ScheduleInfo` in `workflowApi.ts`.

- [ ] **Step 1: D-5 failing test — draft automations cannot be run**

Add to `DashboardPage.test.tsx` (using its existing mock/render helpers, with a draft-status workflow in the mock data):

```tsx
it('disables the run button for draft automations', async () => {
  // render with a workflow whose status is 'draft'
  // expect the button titled /activate .* to run/i to be disabled
});
```

Write it fully against the file's existing patterns. Run `cd frontend; npm run test:run -- src/features/dashboard` — expect FAIL.

- [ ] **Step 2: Implement D-5, D-2, D-3 in DashboardPage**

D-5 — the Execute button (line ~300) becomes:

```tsx
<button
  className="btn btn-sm btn-success btn-icon"
  onClick={(e) => handleExecute(workflow, e)}
  disabled={workflow.status === 'draft'}
  title={workflow.status === 'draft' ? 'Activate this automation to run it' : 'Run'}
>
  <Play size={14} />
</button>
```

D-2 — add to `frontend/src/index.css`:

```css
.cell-description {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  max-width: 480px;
}
```

Apply to the description div (line ~290): `<div className="text-sm text-muted cell-description">{workflow.description}</div>`.

D-3 — on the actions cell `<td>` add `style={{ whiteSpace: 'nowrap' }}`, and ensure the table's containing card has `overflowX: 'auto'` (add `style={{ overflowX: 'auto' }}` to the card div wrapping the `<table className="table">`).

- [ ] **Step 3: E-2 — Ctrl+S saves in the editor**

In `frontend/src/features/editor/EditorPage.tsx`, inside the existing `handleKeyDown` (line ~269), add before the Escape branch:

```ts
if ((e.ctrlKey || e.metaKey) && e.key === 's') {
  e.preventDefault();
  handleSave();
  return;
}
```

Add `handleSave` to the effect's dependency array.

- [ ] **Step 4: E-1 — verify Node Library behavior (likely already fixed)**

`EditorPage.tsx:450` already gates the library on `editorView.type === 'step-view'`, so it cannot render on the stage view. Verify in the browser during Task 9; no code change expected. If it somehow still shows, the fix is adding `setShowLibrary(false)` inside `handleBackToStageView`.

- [ ] **Step 5: M-2 — enlarge the pie chart**

In `MonitoringPage.tsx` (lines ~407–415): container height `'250px'` → `'340px'`, `innerRadius={60}` → `innerRadius={85}`, `outerRadius={90}` → `outerRadius={125}`.

- [ ] **Step 6: M-3 failing test — scheduled automations section**

Add to `MonitoringPage.test.tsx` (follow its existing metrics-mock pattern; also mock `scheduleApi.getAll` to resolve one schedule):

```tsx
it('lists scheduled automations with next run time', async () => {
  // mock scheduleApi.getAll -> [{ workflowId: 'w1', workflowName: 'Daily Report',
  //   cronExpression: '0 9 * * *', isActive: true, nextRun: '2026-07-12T09:00:00.000Z' }]
  // expect 'Scheduled Automations' heading and 'Daily Report' row to appear
});
```

Run `cd frontend; npm run test:run -- src/features/monitoring` — expect FAIL.

- [ ] **Step 7: M-3 — implement scheduleApi and the section**

In `frontend/src/shared/api/workflowApi.ts` add (near the other api objects, reusing the module's `api` axios instance and `ApiResponse`):

```ts
export interface ScheduleInfo {
  workflowId: string;
  workflowName: string;
  cronExpression: string;
  isActive: boolean;
  nextRun?: string;
  lastRun?: string;
}

export const scheduleApi = {
  getAll: async (): Promise<ScheduleInfo[]> => {
    const response = await api.get<ApiResponse<ScheduleInfo[]>>('/schedules');
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },
};
```

In `MonitoringPage.tsx`:
- Fetch schedules alongside metrics (same effect / refresh handler): `const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);` and `scheduleApi.getAll().then(setSchedules).catch(() => setSchedules([]));`
- Render a new card after the charts grid:

```tsx
<div className="card" style={{ marginTop: '1.5rem' }}>
  <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
    <Clock size={18} />
    Scheduled Automations
  </h3>
  {schedules.length === 0 ? (
    <p className="text-muted text-sm">No automations are on a schedule.</p>
  ) : (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
          <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Automation</th>
          <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Schedule</th>
          <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Next run</th>
          <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {schedules.map(s => (
          <tr key={s.workflowId} style={{ borderBottom: '1px solid var(--border-color)' }}>
            <td style={{ padding: '8px', fontSize: '13px', fontWeight: 500 }}>{s.workflowName}</td>
            <td style={{ padding: '8px', fontSize: '13px', fontFamily: 'monospace' }}>{s.cronExpression}</td>
            <td style={{ padding: '8px', fontSize: '13px' }}>
              {s.nextRun ? new Date(s.nextRun).toLocaleString() : '—'}
            </td>
            <td style={{ padding: '8px', fontSize: '13px' }}>{s.isActive ? 'Active' : 'Paused'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>
```

Import `Clock` from `lucide-react` and `scheduleApi, type ScheduleInfo` from the api module.

- [ ] **Step 8: Run all affected tests**

Run: `cd frontend; npm run test:run -- src/features/dashboard src/features/monitoring src/features/editor`
Expected: PASS, including the new D-5 and M-3 tests.

- [ ] **Step 9: Commit**

```bash
git add frontend/src
git commit -m "fix: draft run guard, description clamp, ctrl+s, larger pie chart, scheduled automations panel"
```

---

### Task 9: Full-suite run and browser verification

**Files:** none created — verification only.

- [ ] **Step 1: Full frontend suite**

Run: `cd frontend; npm run test:run`
Expected: PASS, zero failures.

- [ ] **Step 2: Backend suite (guard against accidental cross-impact)**

Run: `cd backend; npm run test -- --run`
Expected: PASS (nothing in this plan touches backend code; this confirms it).

- [ ] **Step 3: Build check**

Run: `cd frontend; npm run build`
Expected: clean production build, no TS errors.

- [ ] **Step 4: Browser verification (required before claiming done)**

Start the app (`npm run dev` from repo root) and, using Chrome automation:
1. Dashboard — new terminology visible, draft rows' Run button disabled, descriptions clamp to one line, delete button fully visible at ~1280px.
2. `/new` — gallery renders grouped template cards + Start from scratch; clicking a card lands in the editor with pre-filled stages.
3. Editor — Node Library shows the four new categories; "Test" button; Ctrl+S saves (toast appears); library absent on stage view (E-1).
4. Runs page — expand two rows simultaneously; timeline with plain-language lines; "Technical details" collapsed; pagination when >10 runs.
5. Monitoring — larger pie chart; "Scheduled Automations" card (seed a scheduled workflow via `node scripts/create_scheduled_workflow.js` if none exists).
6. Screenshot each page at ~1280px AND ~375px; browser console must be clean.

- [ ] **Step 5: Commit any verification fixes, then wrap up**

If verification exposed issues, fix and re-verify before proceeding. Final state: all tests green, screenshots taken, console clean.
