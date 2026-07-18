# Phase B — Run Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From the Runs list, "Replay on canvas" opens the editor in a read-only replay mode that steps through a past execution action-by-action — highlighting the active stage on the canvas, showing each action's stored input/output snapshot in a side inspector, and offering "Explain this" on the failing action.

**Architecture:** Frontend-only (the backend already returns per-step input/output/timestamps via `GET /api/executions/:id`). A pure `replaySnapshot` util flattens an `ExecutionResult` into an ordered step sequence and derives a partial `Execution` for any playback index; a `useReplay` hook drives the playback state machine; a `ReplayBar` and `ReplayInspector` render the controls and the current snapshot; the existing canvas highlighting (`execution` prop → station/step `data.status`) is reused by feeding it the partial execution. EditorPage reads `?replay=<executionId>`, enters a read-only mode, and swaps its editing chrome for the replay chrome.

**Tech Stack:** React + Vite + TS strict, react-router-dom v6, @xyflow/react (React Flow) v12, Zustand, vitest + @testing-library/react (jsdom), lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-13-data-visible-automation-design.md` (Phase B — Run Replay section). This plan **stacks on the unmerged Phase A branch** `feature/phase-a-data-lens`.

## Global Constraints

- **Backend: zero changes.** `executionApi.getById(id): Promise<Execution>` already returns the full `Execution` with `result.stations[].steps[]` carrying `input`, `output`, `status`, `startTime`, `endTime`, `error`.
- **Replay is strictly read-only:** while a `?replay=<executionId>` param is present, the editor hides Save / Test / Add Stage / Add Action / Params / Version / status-select, disables node dragging and connecting on the canvas, and does not open editable config panels.
- **Deliberate deviations from the spec (approved by the user at plan time — see "Deviations" note at end):**
  1. The inspector shows **actual snapshot values via the existing `StepDataInspector`/`JsonTreeView`**, not `<ShapeTree>`. ShapeTree is lossy (one truncated sample per field, arrays reduced to the first element) — wrong tool for inspecting real run data; JsonTreeView shows the full stored values and is already the editor's per-step data viewer.
  2. Replay v1 highlights at **stage granularity in Stage View** (the active stage lights up as playback crosses into it); the playback bar still steps through individual actions and the inspector shows per-action data. Step-level canvas highlighting during playback is a follow-up.
- **Playback order** = stations in array order, then steps in array order (execution order). No sorting by timestamp.
- **Stale-step guard:** if the run references a step no longer in the current workflow definition, the inspector shows "This action is no longer in this automation" and still renders its snapshot; replay must not crash.
- Frontend strict TS, no `any`; UI copy plain English (Automation/Stage/Action/Run).
- react-router-dom is **mocked wholesale** in existing editor/executions tests (`vi.mock('react-router-dom', …)`) — adding `useSearchParams` to EditorPage means every such mock that renders EditorPage must add a `useSearchParams` stub or the test throws.
- Don't push; commits stay local on the feature branch. New feature/bugfix code gets a failing-first test.

---

### Task 0: Branch

- [ ] **Step 1: Create the feature branch stacked on Phase A**

The current branch is `feature/phase-a-data-lens` (Phase A complete, unmerged). Phase B stacks on it, matching the established phase-stacking pattern.

```bash
git checkout feature/phase-a-data-lens
git checkout -b feature/phase-b-run-replay
```

---

### Task 1: `replaySnapshot` pure util

**Files:**
- Create: `frontend/src/features/editor/utils/replaySnapshot.ts`
- Test: `frontend/src/features/editor/utils/replaySnapshot.test.ts`

**Interfaces:**
- Consumes: `Execution`, `ExecutionResult`, `WorkflowDefinition`, `StationResult`, `StepResult` from `shared/types/workflow`.
- Produces:
  - `interface ReplayStep { stationId: string; stationName: string; stepId: string; stepName: string; stationIndex: number; step: StepResult; existsInDefinition: boolean }`
  - `buildReplaySequence(result: ExecutionResult, definition?: WorkflowDefinition): ReplayStep[]`
  - `buildPartialExecution(base: Execution, sequence: ReplayStep[], index: number): Execution`
  Tasks 2, 4, 7 consume these.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/editor/utils/replaySnapshot.test.ts
import { describe, it, expect } from 'vitest';
import { buildReplaySequence, buildPartialExecution } from './replaySnapshot';
import type { Execution, WorkflowDefinition } from '../../../shared/types/workflow';

function execution(): Execution {
  return {
    id: 'exec-1', workflowId: 'w1', workflowName: 'W', status: 'failed',
    triggeredBy: 'manual', startTime: '2026-07-14T06:00:00.000Z', successRate: 50,
    result: {
      stations: [
        {
          stationId: 'st1', stationName: 'Stage 1', status: 'completed', steps: [
            { stepId: 's1', stepName: 'Fetch', stepType: 'http-request', status: 'completed', output: { orderId: 1 } },
            { stepId: 's2', stepName: 'Transform', stepType: 'script-js', status: 'completed', output: { ok: true } },
          ],
        },
        {
          stationId: 'st2', stationName: 'Stage 2', status: 'failed', steps: [
            { stepId: 's3', stepName: 'Mail', stepType: 'action-email', status: 'failed', error: { message: 'SMTP down' } },
          ],
        },
      ],
    },
  };
}

describe('buildReplaySequence', () => {
  it('flattens stations then steps in order', () => {
    const seq = buildReplaySequence(execution().result!);
    expect(seq.map((r) => r.stepId)).toEqual(['s1', 's2', 's3']);
    expect(seq.map((r) => r.stationIndex)).toEqual([0, 0, 1]);
    expect(seq[2].stationName).toBe('Stage 2');
  });

  it('marks existsInDefinition against the current definition', () => {
    const def: WorkflowDefinition = {
      stations: [{ id: 'st1', name: 'Stage 1', position: { x: 0, y: 0 }, steps: [
        { id: 's1', name: 'Fetch', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
      ] }],
    };
    const seq = buildReplaySequence(execution().result!, def);
    expect(seq.find((r) => r.stepId === 's1')!.existsInDefinition).toBe(true);
    expect(seq.find((r) => r.stepId === 's3')!.existsInDefinition).toBe(false);
  });

  it('treats every step as existing when no definition is supplied', () => {
    const seq = buildReplaySequence(execution().result!);
    expect(seq.every((r) => r.existsInDefinition)).toBe(true);
  });
});

describe('buildPartialExecution', () => {
  it('marks past stations completed, current running, future pending', () => {
    const base = execution();
    const seq = buildReplaySequence(base.result!);
    const partial = buildPartialExecution(base, seq, 0); // at s1, station 0
    expect(partial.result!.stations[0].status).toBe('running');
    expect(partial.result!.stations[1].status).toBe('pending');
  });

  it('marks steps after the playback position as pending', () => {
    const base = execution();
    const seq = buildReplaySequence(base.result!);
    const partial = buildPartialExecution(base, seq, 0); // at s1
    const st1 = partial.result!.stations[0];
    expect(st1.steps.find((s) => s.stepId === 's1')!.status).toBe('completed'); // reached
    expect(st1.steps.find((s) => s.stepId === 's2')!.status).toBe('pending');   // not yet
  });

  it('at the last index the final station is the running (active) one', () => {
    const base = execution();
    const seq = buildReplaySequence(base.result!);
    const partial = buildPartialExecution(base, seq, 2); // at s3, station 1
    expect(partial.result!.stations[0].status).toBe('completed');
    expect(partial.result!.stations[1].status).toBe('running');
  });

  it('does not mutate the base execution', () => {
    const base = execution();
    const seq = buildReplaySequence(base.result!);
    buildPartialExecution(base, seq, 0);
    expect(base.result!.stations[1].status).toBe('failed'); // original untouched
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npx vitest run src/features/editor/utils/replaySnapshot.test.ts`
Expected: FAIL — cannot resolve `./replaySnapshot`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/features/editor/utils/replaySnapshot.ts
import type {
  Execution,
  ExecutionResult,
  WorkflowDefinition,
  StationResult,
  StepResult,
} from '../../../shared/types/workflow';

export interface ReplayStep {
  stationId: string;
  stationName: string;
  stepId: string;
  stepName: string;
  stationIndex: number;
  step: StepResult;
  existsInDefinition: boolean;
}

/** Flatten an execution result into an ordered action sequence (station order, then step order). */
export function buildReplaySequence(result: ExecutionResult, definition?: WorkflowDefinition): ReplayStep[] {
  const known = new Set<string>();
  if (definition) {
    for (const station of definition.stations) {
      for (const step of station.steps) known.add(step.id);
    }
  }

  const sequence: ReplayStep[] = [];
  result.stations.forEach((station, stationIndex) => {
    station.steps.forEach((step) => {
      sequence.push({
        stationId: station.stationId,
        stationName: station.stationName,
        stepId: step.stepId,
        stepName: step.stepName,
        stationIndex,
        step,
        existsInDefinition: definition ? known.has(step.stepId) : true,
      });
    });
  });
  return sequence;
}

/** Derive a partial Execution for the given playback index — drives canvas highlighting. Pure (no mutation of base). */
export function buildPartialExecution(base: Execution, sequence: ReplayStep[], index: number): Execution {
  const currentStationIndex = sequence[index]?.stationIndex ?? -1;
  const result = base.result;
  if (!result) return base;

  const stations: StationResult[] = result.stations.map((station, stationIndex) => {
    let status: StationResult['status'];
    if (stationIndex < currentStationIndex) status = 'completed';
    else if (stationIndex === currentStationIndex) status = 'running';
    else status = 'pending';

    const steps: StepResult[] = station.steps.map((step) => {
      const seqPos = sequence.findIndex((r) => r.stationId === station.stationId && r.stepId === step.stepId);
      return seqPos > index ? { ...step, status: 'pending' } : step;
    });

    return { ...station, status, steps };
  });

  return { ...base, result: { ...result, stations } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/editor/utils/replaySnapshot.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/editor/utils/replaySnapshot.ts frontend/src/features/editor/utils/replaySnapshot.test.ts
git commit -m "feat: replaySnapshot util — ordered step sequence and partial execution"
```

---

### Task 2: `useReplay` playback hook

**Files:**
- Create: `frontend/src/features/editor/hooks/useReplay.ts`
- Test: `frontend/src/features/editor/hooks/useReplay.test.ts`

**Interfaces:**
- Consumes: nothing project-specific.
- Produces: `interface UseReplay { index: number; isPlaying: boolean; total: number; play: () => void; pause: () => void; toggle: () => void; next: () => void; prev: () => void; seek: (i: number) => void }` and `useReplay(total: number, tickMs?: number): UseReplay` (default `tickMs = 1000`). Task 7 consumes it.

**Behavior:** index starts at 0; `play` advances index by 1 every `tickMs` and auto-pauses at `total-1` (if already at the end, restarts from 0); `next`/`prev`/`seek` pause and clamp to `[0, total-1]`; `total === 0` → index stays 0 and controls are no-ops; index/playing reset when `total` changes (new execution).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/editor/hooks/useReplay.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReplay } from './useReplay';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useReplay', () => {
  it('starts paused at index 0', () => {
    const { result } = renderHook(() => useReplay(3));
    expect(result.current.index).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });

  it('advances one step per tick while playing and auto-pauses at the end', () => {
    const { result } = renderHook(() => useReplay(3, 1000));
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.index).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.index).toBe(2);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.index).toBe(2);          // clamped at last
    expect(result.current.isPlaying).toBe(false);  // auto-paused
  });

  it('next/prev pause and clamp', () => {
    const { result } = renderHook(() => useReplay(2));
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    act(() => result.current.next());
    expect(result.current.index).toBe(1);          // clamp high
    act(() => { result.current.prev(); result.current.prev(); });
    expect(result.current.index).toBe(0);          // clamp low
    expect(result.current.isPlaying).toBe(false);
  });

  it('seek clamps and pauses', () => {
    const { result } = renderHook(() => useReplay(5));
    act(() => result.current.seek(99));
    expect(result.current.index).toBe(4);
    act(() => result.current.seek(-3));
    expect(result.current.index).toBe(0);
  });

  it('play from the end restarts at 0', () => {
    const { result } = renderHook(() => useReplay(3));
    act(() => result.current.seek(2));
    act(() => result.current.play());
    expect(result.current.index).toBe(0);
    expect(result.current.isPlaying).toBe(true);
  });

  it('total of 0 keeps index at 0 and controls are inert', () => {
    const { result } = renderHook(() => useReplay(0));
    act(() => result.current.play());
    act(() => result.current.next());
    expect(result.current.index).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });
});
```

Note: if `renderHook` is not exported from `@testing-library/react` in this version, import it from `@testing-library/react` still fails — check the version; RTL ≥13.1 exports it. The project uses a current RTL (Phase A used `waitFor`/`render` from it). If missing, wrap the hook in a trivial probe component instead.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/editor/hooks/useReplay.test.ts`
Expected: FAIL — cannot resolve `./useReplay`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/features/editor/hooks/useReplay.ts
import { useState, useEffect, useCallback } from 'react';

export interface UseReplay {
  index: number;
  isPlaying: boolean;
  total: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (i: number) => void;
}

/** Playback state machine over a fixed-length step sequence. */
export function useReplay(total: number, tickMs = 1000): UseReplay {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const clamp = useCallback((i: number) => Math.max(0, Math.min(i, Math.max(0, total - 1))), [total]);

  const pause = useCallback(() => setIsPlaying(false), []);
  const play = useCallback(() => {
    if (total === 0) return;
    setIndex((i) => (i >= total - 1 ? 0 : i)); // restart if at the end
    setIsPlaying(true);
  }, [total]);
  const toggle = useCallback(() => setIsPlaying((p) => (total === 0 ? false : !p)), [total]);
  const next = useCallback(() => { setIsPlaying(false); setIndex((i) => clamp(i + 1)); }, [clamp]);
  const prev = useCallback(() => { setIsPlaying(false); setIndex((i) => clamp(i - 1)); }, [clamp]);
  const seek = useCallback((i: number) => { setIsPlaying(false); setIndex(clamp(i)); }, [clamp]);

  // Advance while playing; auto-pause at the end.
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setIndex((i) => {
        if (i >= total - 1) { setIsPlaying(false); return i; }
        return i + 1;
      });
    }, tickMs);
    return () => clearInterval(timer);
  }, [isPlaying, total, tickMs]);

  // Reset when the sequence length changes (a new execution was loaded).
  useEffect(() => { setIndex(0); setIsPlaying(false); }, [total]);

  return { index, isPlaying, total, play, pause, toggle, next, prev, seek };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/editor/hooks/useReplay.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/editor/hooks/useReplay.ts frontend/src/features/editor/hooks/useReplay.test.ts
git commit -m "feat: useReplay playback state machine hook"
```

---

### Task 3: `ReplayBar` component

**Files:**
- Create: `frontend/src/features/editor/components/ReplayBar.tsx`
- Test: `frontend/src/features/editor/components/ReplayBar.test.tsx`

**Interfaces:**
- Consumes: nothing project-specific (presentational).
- Produces: `ReplayBar(props: ReplayBarProps)` where `interface ReplayBarProps { index: number; total: number; isPlaying: boolean; currentLabel: string; onPrev: () => void; onNext: () => void; onToggle: () => void; onSeek: (i: number) => void; onExit: () => void }`. Task 7 renders it.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/editor/components/ReplayBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplayBar } from './ReplayBar';

const baseProps = {
  index: 1, total: 3, isPlaying: false, currentLabel: 'Stage 1 · Fetch',
  onPrev: vi.fn(), onNext: vi.fn(), onToggle: vi.fn(), onSeek: vi.fn(), onExit: vi.fn(),
};

describe('ReplayBar', () => {
  it('shows position as 1-based of total and the current label', () => {
    render(<ReplayBar {...baseProps} />);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText('Stage 1 · Fetch')).toBeInTheDocument();
  });

  it('play/pause button reflects isPlaying and calls onToggle', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ReplayBar {...baseProps} isPlaying={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(onToggle).toHaveBeenCalled();
    rerender(<ReplayBar {...baseProps} isPlaying onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('prev/next/exit fire their handlers', () => {
    const onPrev = vi.fn(), onNext = vi.fn(), onExit = vi.fn();
    render(<ReplayBar {...baseProps} onPrev={onPrev} onNext={onNext} onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /previous action/i }));
    fireEvent.click(screen.getByRole('button', { name: /next action/i }));
    fireEvent.click(screen.getByRole('button', { name: /exit replay/i }));
    expect(onPrev).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
    expect(onExit).toHaveBeenCalled();
  });

  it('scrubber reports the seeked index', () => {
    const onSeek = vi.fn();
    render(<ReplayBar {...baseProps} onSeek={onSeek} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '2' } });
    expect(onSeek).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/editor/components/ReplayBar.test.tsx`
Expected: FAIL — cannot resolve `./ReplayBar`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/features/editor/components/ReplayBar.tsx
import { SkipBack, ChevronLeft, Play, Pause, ChevronRight, SkipForward, X } from 'lucide-react';

export interface ReplayBarProps {
  index: number;
  total: number;
  isPlaying: boolean;
  currentLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  onSeek: (i: number) => void;
  onExit: () => void;
}

export function ReplayBar({ index, total, isPlaying, currentLabel, onPrev, onNext, onToggle, onSeek, onExit }: ReplayBarProps) {
  const max = Math.max(0, total - 1);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '8px 16px', borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
      }}
    >
      <button className="btn btn-ghost btn-icon btn-sm" aria-label="Jump to first action" onClick={() => onSeek(0)}>
        <SkipBack size={16} />
      </button>
      <button className="btn btn-ghost btn-icon btn-sm" aria-label="Previous action" onClick={onPrev}>
        <ChevronLeft size={16} />
      </button>
      <button className="btn btn-primary btn-icon btn-sm" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={onToggle}>
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button className="btn btn-ghost btn-icon btn-sm" aria-label="Next action" onClick={onNext}>
        <ChevronRight size={16} />
      </button>
      <button className="btn btn-ghost btn-icon btn-sm" aria-label="Jump to last action" onClick={() => onSeek(max)}>
        <SkipForward size={16} />
      </button>

      <input
        type="range"
        role="slider"
        min={0}
        max={max}
        value={index}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{ flex: 1 }}
        aria-label="Playback position"
      />

      <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>{index + 1} / {total}</span>
      <span className="text-xs" style={{ whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {currentLabel}
      </span>

      <button className="btn btn-secondary btn-sm" aria-label="Exit replay" onClick={onExit}>
        <X size={14} /> Exit replay
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/editor/components/ReplayBar.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/editor/components/ReplayBar.tsx frontend/src/features/editor/components/ReplayBar.test.tsx
git commit -m "feat: ReplayBar playback controls component"
```

---

### Task 4: `ReplayInspector` component

**Files:**
- Create: `frontend/src/features/editor/components/ReplayInspector.tsx`
- Test: `frontend/src/features/editor/components/ReplayInspector.test.tsx`

**Interfaces:**
- Consumes: `ReplayStep` from `../utils/replaySnapshot` (Task 1); the existing `StepDataInspector` (`./StepDataInspector`, props `{ stepResult: StepResult; onClose: () => void }`); `useAiEnabled` (`shared/hooks/useAiEnabled`); `aiApi.explain` (`shared/api/workflowApi`, signature `explain({ workflowName, stationName, stepName, stepType, errorMessage }): Promise<string>`).
- Produces: `ReplayInspector(props: { replayStep: ReplayStep | null; workflowName?: string; onExit: () => void })`. Task 7 renders it.

**Behavior:** renders nothing when `replayStep` is null. Otherwise shows the step's snapshot via `StepDataInspector` (full input/output/error via JsonTreeView). When `!replayStep.existsInDefinition`, shows a "This action is no longer in this automation" banner above the inspector. When the step failed and has an error and AI is enabled, shows an "Explain this" button that calls `aiApi.explain` and renders the plain-language result (mirrors `RunTimeline`'s existing explain affordance). `StepDataInspector`'s close (X) calls `onExit`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/editor/components/ReplayInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReplayInspector } from './ReplayInspector';
import type { ReplayStep } from '../utils/replaySnapshot';
import { aiApi } from '../../../shared/api/workflowApi';
import { useAiEnabled } from '../../../shared/hooks/useAiEnabled';

vi.mock('../../../shared/api/workflowApi', () => ({ aiApi: { explain: vi.fn() } }));
vi.mock('../../../shared/hooks/useAiEnabled', () => ({ useAiEnabled: vi.fn().mockReturnValue(false) }));

function completedStep(): ReplayStep {
  return {
    stationId: 'st1', stationName: 'Stage 1', stepId: 's1', stepName: 'Fetch',
    stationIndex: 0, existsInDefinition: true,
    step: { stepId: 's1', stepName: 'Fetch', stepType: 'http-request', status: 'completed', output: { orderId: 10023 } },
  };
}
function failedStep(): ReplayStep {
  return {
    stationId: 'st2', stationName: 'Stage 2', stepId: 's3', stepName: 'Mail',
    stationIndex: 1, existsInDefinition: true,
    step: { stepId: 's3', stepName: 'Mail', stepType: 'action-email', status: 'failed', error: { message: 'SMTP down' } },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('ReplayInspector', () => {
  it('renders nothing when replayStep is null', () => {
    const { container } = render(<ReplayInspector replayStep={null} onExit={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the step name and its output snapshot', () => {
    render(<ReplayInspector replayStep={completedStep()} onExit={vi.fn()} />);
    expect(screen.getByText('Fetch')).toBeInTheDocument();
    expect(screen.getByText('10023')).toBeInTheDocument();
  });

  it('shows a stale note when the action is no longer in the automation', () => {
    render(<ReplayInspector replayStep={{ ...completedStep(), existsInDefinition: false }} onExit={vi.fn()} />);
    expect(screen.getByText(/no longer in this automation/i)).toBeInTheDocument();
  });

  it('offers Explain this for a failed step only when AI is enabled', () => {
    vi.mocked(useAiEnabled).mockReturnValue(true);
    render(<ReplayInspector replayStep={failedStep()} onExit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /explain this/i })).toBeInTheDocument();
  });

  it('does not offer Explain this when AI is disabled', () => {
    vi.mocked(useAiEnabled).mockReturnValue(false);
    render(<ReplayInspector replayStep={failedStep()} onExit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /explain this/i })).not.toBeInTheDocument();
  });

  it('Explain this calls aiApi.explain and renders the result', async () => {
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.explain).mockResolvedValue('The mail server rejected the message.');
    render(<ReplayInspector replayStep={failedStep()} workflowName="W" onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /explain this/i }));
    await waitFor(() => expect(screen.getByText('The mail server rejected the message.')).toBeInTheDocument());
    expect(aiApi.explain).toHaveBeenCalledWith({
      workflowName: 'W', stationName: 'Stage 2', stepName: 'Mail', stepType: 'action-email', errorMessage: 'SMTP down',
    });
  });

  it('X in the inspector header calls onExit', () => {
    const onExit = vi.fn();
    render(<ReplayInspector replayStep={completedStep()} onExit={onExit} />);
    // StepDataInspector renders a single header close button
    fireEvent.click(screen.getByRole('button', { name: '' }) ?? screen.getAllByRole('button')[0]);
    expect(onExit).toHaveBeenCalled();
  });
});
```

Note on the last test: `StepDataInspector`'s close button is an icon-only `<button>` with no accessible name. If `getByRole('button', { name: '' })` is unreliable in this RTL version, select it by being the only button when AI is disabled and step is completed (no Explain button rendered), e.g. `screen.getAllByRole('button')[0]`. Keep the assertion that clicking it calls `onExit`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/editor/components/ReplayInspector.test.tsx`
Expected: FAIL — cannot resolve `./ReplayInspector`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/features/editor/components/ReplayInspector.tsx
import { useState } from 'react';
import type { ReplayStep } from '../utils/replaySnapshot';
import StepDataInspector from './StepDataInspector';
import { useAiEnabled } from '../../../shared/hooks/useAiEnabled';
import { aiApi } from '../../../shared/api/workflowApi';

interface ReplayInspectorProps {
  replayStep: ReplayStep | null;
  workflowName?: string;
  onExit: () => void;
}

export function ReplayInspector({ replayStep, workflowName, onExit }: ReplayInspectorProps) {
  if (!replayStep) return null;

  return (
    <div
      style={{
        width: 340, borderLeft: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', minHeight: 0,
      }}
    >
      {!replayStep.existsInDefinition && (
        <div
          className="text-xs"
          style={{ padding: '8px 12px', background: 'rgba(234,179,8,0.12)', color: 'var(--text-secondary)' }}
        >
          This action is no longer in this automation.
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <StepDataInspector stepResult={replayStep.step} onClose={onExit} />
      </div>
      {replayStep.step.status === 'failed' && replayStep.step.error && (
        <ExplainFailure
          workflowName={workflowName}
          stationName={replayStep.stationName}
          stepName={replayStep.step.stepName}
          stepType={replayStep.step.stepType}
          errorMessage={replayStep.step.error.message}
        />
      )}
    </div>
  );
}

interface ExplainFailureProps {
  workflowName?: string;
  stationName: string;
  stepName: string;
  stepType: string;
  errorMessage: string;
}

function ExplainFailure({ workflowName, stationName, stepName, stepType, errorMessage }: ExplainFailureProps) {
  const aiEnabled = useAiEnabled();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!aiEnabled) return null;

  const explain = async () => {
    if (isExplaining) return;
    setIsExplaining(true);
    setFailed(false);
    try {
      setExplanation(await aiApi.explain({ workflowName: workflowName ?? '', stationName, stepName, stepType, errorMessage }));
    } catch {
      setFailed(true);
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-color)' }}>
      {!explanation && (
        <button className="btn btn-ghost btn-sm" onClick={explain} disabled={isExplaining}>
          {isExplaining ? 'Thinking…' : 'Explain this'}
        </button>
      )}
      {explanation && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{explanation}</div>}
      {failed && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Couldn't get an explanation right now.</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/editor/components/ReplayInspector.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/editor/components/ReplayInspector.tsx frontend/src/features/editor/components/ReplayInspector.test.tsx
git commit -m "feat: ReplayInspector — snapshot viewer with Explain-this and stale note"
```

---

### Task 5: workflowStore replay actions

**Files:**
- Modify: `frontend/src/features/editor/stores/workflowStore.ts` (add state field + two actions)
- Test: `frontend/src/features/editor/stores/workflowStore.replay.test.ts`

**Interfaces:**
- Consumes: `executionApi.getById(id): Promise<Execution>` (existing).
- Produces: new store state `replayExecution: Execution | null` and actions `enterReplay(executionId: string): Promise<void>` (fetches the execution, sets `replayExecution`; on error sets `error` and leaves `replayExecution` null) and `exitReplay(): void` (sets `replayExecution` null). Task 7 consumes them.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/editor/stores/workflowStore.replay.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/api/workflowApi', () => ({
  workflowApi: {},
  executionApi: { getById: vi.fn() },
}));

import { useWorkflowStore } from './workflowStore';
import { executionApi } from '../../../shared/api/workflowApi';

const execution = {
  id: 'exec-1', workflowId: 'w1', workflowName: 'W', status: 'completed',
  triggeredBy: 'manual', startTime: 't', successRate: 100,
  result: { stations: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  useWorkflowStore.setState({ replayExecution: null, error: null });
});

describe('workflowStore replay', () => {
  it('enterReplay loads the execution into replayExecution', async () => {
    vi.mocked(executionApi.getById).mockResolvedValue(execution as never);
    await useWorkflowStore.getState().enterReplay('exec-1');
    expect(executionApi.getById).toHaveBeenCalledWith('exec-1');
    expect(useWorkflowStore.getState().replayExecution).toEqual(execution);
  });

  it('enterReplay records an error and leaves replayExecution null on failure', async () => {
    vi.mocked(executionApi.getById).mockRejectedValue(new Error('nope'));
    await useWorkflowStore.getState().enterReplay('bad');
    expect(useWorkflowStore.getState().replayExecution).toBeNull();
    expect(useWorkflowStore.getState().error).toBe('nope');
  });

  it('exitReplay clears replayExecution', async () => {
    useWorkflowStore.setState({ replayExecution: execution as never });
    useWorkflowStore.getState().exitReplay();
    expect(useWorkflowStore.getState().replayExecution).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/editor/stores/workflowStore.replay.test.ts`
Expected: FAIL — `enterReplay` is not a function.

- [ ] **Step 3: Add the state field**

In `frontend/src/features/editor/stores/workflowStore.ts`, in the `WorkflowState` interface add after `executionLogs` (line ~30):

```ts
  replayExecution: Execution | null;
```

In the action declarations, after `fetchExecutionLogs` (line ~65) add:

```ts
  enterReplay: (executionId: string) => Promise<void>;
  exitReplay: () => void;
```

In the initial state object, after `executionLogs: [],` (line ~77) add:

```ts
  replayExecution: null,
```

- [ ] **Step 4: Add the actions**

Add the implementations near the other execution actions (after `fetchExecutionLogs`'s implementation). `executionApi` is already imported at the top of the file.

```ts
  // Replay a past execution on the canvas (read-only)
  enterReplay: async (executionId: string) => {
    set({ error: null });
    try {
      const execution = await executionApi.getById(executionId);
      set({ replayExecution: execution });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error), replayExecution: null });
    }
  },

  exitReplay: () => set({ replayExecution: null }),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/editor/stores/workflowStore.replay.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/editor/stores/workflowStore.ts frontend/src/features/editor/stores/workflowStore.replay.test.ts
git commit -m "feat: workflowStore enterReplay/exitReplay actions"
```

---

### Task 6: read-only support on the canvases

**Files:**
- Modify: `frontend/src/features/editor/components/StepCanvas.tsx` (add `readOnly` prop)
- Modify: `frontend/src/features/editor/components/StageCanvas.tsx` (add `readOnly` prop)
- Test: `frontend/src/features/editor/components/CanvasReadOnly.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: both `StepCanvas` and `StageCanvas` accept an optional `readOnly?: boolean`. When true, node dragging and connecting are disabled (`nodesDraggable={false}`, `nodesConnectable={false}`), and position-change writes are suppressed; node clicks still work (for inspection). Task 7 passes `readOnly` during replay.

**Note:** read `StageCanvas.tsx` first — its structure mirrors `StepCanvas.tsx` (React Flow with a `handleNodesChange` that writes positions). Apply the same three changes there. The exact `StepCanvas` changes are given below as the template.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/editor/components/CanvasReadOnly.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import StepCanvas from './StepCanvas';
import type { Station } from '../../../shared/types/workflow';

// React Flow needs these globals in jsdom; setup.ts provides ResizeObserver/matchMedia.
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    ReactFlow: (props: Record<string, unknown>) => (
      <div
        data-testid="reactflow"
        data-nodesdraggable={String(props.nodesDraggable)}
        data-nodesconnectable={String(props.nodesConnectable)}
      />
    ),
  };
});

const station: Station = {
  id: 'st1', name: 'S', position: { x: 0, y: 0 },
  steps: [{ id: 's1', name: 'A', type: 'http-request', config: {}, position: { x: 0, y: 0 } }],
};

describe('StepCanvas readOnly', () => {
  it('disables dragging and connecting when readOnly', () => {
    const { getByTestId } = render(<StepCanvas station={station} readOnly onStepClick={vi.fn()} />);
    expect(getByTestId('reactflow').getAttribute('data-nodesdraggable')).toBe('false');
    expect(getByTestId('reactflow').getAttribute('data-nodesconnectable')).toBe('false');
  });

  it('allows dragging and connecting by default', () => {
    const { getByTestId } = render(<StepCanvas station={station} onStepClick={vi.fn()} />);
    expect(getByTestId('reactflow').getAttribute('data-nodesdraggable')).toBe('true');
    expect(getByTestId('reactflow').getAttribute('data-nodesconnectable')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/editor/components/CanvasReadOnly.test.tsx`
Expected: FAIL — `data-nodesdraggable` is `undefined` (props not yet set).

- [ ] **Step 3: Modify StepCanvas**

In `frontend/src/features/editor/components/StepCanvas.tsx`:

Add `readOnly` to the props interface (after `isSimulating?`):
```ts
  readOnly?: boolean;
```
Destructure it in the component signature (after `isSimulating = false,`):
```ts
  readOnly = false,
```
Guard the position-write in `handleNodesChange` — change the body to:
```ts
    (changes: any[]) => {
      onNodesChange(changes);
      if (readOnly) return;
      changes.forEach((change: any) => {
        if (change.type === 'position' && change.position && onStepUpdate) {
          onStepUpdate(change.id, { position: change.position });
        }
      });
    },
    [onNodesChange, onStepUpdate, readOnly]
```
Add the two props to `<ReactFlow>` (alongside `fitView`):
```tsx
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
```

- [ ] **Step 4: Modify StageCanvas the same way**

Read `frontend/src/features/editor/components/StageCanvas.tsx`, then apply the identical three changes: add `readOnly?: boolean` to its props interface, destructure `readOnly = false`, add `nodesDraggable={!readOnly}` and `nodesConnectable={!readOnly}` to its `<ReactFlow>`, and guard its position-write callback (the handler that calls the station position-update) with `if (readOnly) return;` plus add `readOnly` to that callback's dependency array.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/editor/components/CanvasReadOnly.test.tsx`
Expected: PASS (2 tests). Also run the existing editor suite to confirm no regression: `npx vitest run src/features/editor` — all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/editor/components/StepCanvas.tsx frontend/src/features/editor/components/StageCanvas.tsx frontend/src/features/editor/components/CanvasReadOnly.test.tsx
git commit -m "feat: readOnly mode on Step/Stage canvases (disable drag and connect)"
```

---

### Task 7: EditorPage replay integration

**Files:**
- Modify: `frontend/src/features/editor/EditorPage.tsx`
- Modify: `frontend/src/features/editor/EditorPage.plan.test.tsx` (add `useSearchParams` to its router mock; keep it green)
- Test: `frontend/src/features/editor/EditorPage.replay.test.tsx`

**Interfaces:**
- Consumes: `useSearchParams` (react-router-dom); `useWorkflowStore` fields/actions `replayExecution`, `enterReplay`, `exitReplay` (Task 5); `buildReplaySequence`, `buildPartialExecution` (Task 1); `useReplay` (Task 2); `ReplayBar` (Task 3); `ReplayInspector` (Task 4); `readOnly` prop on canvases (Task 6).
- Produces: replay behavior in the editor. No new exports.

**Behavior:** when `?replay=<executionId>` is present, EditorPage calls `enterReplay` on mount (and `exitReplay` on unmount / when the param clears), forces `viewMode='canvas'` + stage-view, hides all editing chrome (Add Stage/Action, Save, Test, Params, Version, status select), renders the `ReplayBar` at the bottom of the canvas area and the `ReplayInspector` on the right, passes the partial execution (from `buildPartialExecution`) as the canvas `execution` prop, and passes `readOnly` to the canvas. Config panels are suppressed in replay. "Exit replay" navigates to `/editor/:id` (no query), which clears the param and exits.

- [ ] **Step 1: Update the existing test's router mock (prevents a regression when EditorPage starts calling useSearchParams)**

In `frontend/src/features/editor/EditorPage.plan.test.tsx`, find the `vi.mock('react-router-dom', …)` factory and add a `useSearchParams` stub that returns no replay param (normal mode):

```ts
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'w1' }),          // keep the file's existing value
  useNavigate: () => vi.fn(),               // keep the file's existing value
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}));
```
Keep whatever `useParams`/`useNavigate` the file already returns; only add the `useSearchParams` line. Run `npx vitest run src/features/editor/EditorPage.plan.test.tsx` — still green.

- [ ] **Step 2: Write the failing replay test**

```tsx
// frontend/src/features/editor/EditorPage.replay.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import EditorPage from './EditorPage';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'w1' }),
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams('replay=exec-1'), vi.fn()],
}));

const enterReplay = vi.fn();
const exitReplay = vi.fn();
const workflow = {
  id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
  definition: { stations: [
    { id: 'st1', name: 'Stage 1', position: { x: 0, y: 0 }, steps: [
      { id: 's1', name: 'Fetch', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
    ] },
  ] },
};
const replayExecution = {
  id: 'exec-1', workflowId: 'w1', workflowName: 'W', status: 'completed',
  triggeredBy: 'manual', startTime: 't', successRate: 100,
  result: { stations: [
    { stationId: 'st1', stationName: 'Stage 1', status: 'completed', steps: [
      { stepId: 's1', stepName: 'Fetch', stepType: 'http-request', status: 'completed', output: { orderId: 10023 } },
    ] },
  ] },
};

vi.mock('./stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    currentWorkflow: workflow,
    replayExecution,
    enterReplay,
    exitReplay,
    fetchWorkflow: vi.fn(),
    setCurrentWorkflow: vi.fn(),
    createWorkflow: vi.fn(),
    // editing actions/fields the component reads — stubbed
    saveWorkflow: vi.fn(), addStation: vi.fn(), addStep: vi.fn(), updateStep: vi.fn(),
    deleteStep: vi.fn(), selectStep: vi.fn(), selectedStepId: null, selectedStationId: null,
    selectStation: vi.fn(), updateStation: vi.fn(), deleteStation: vi.fn(), connectSteps: vi.fn(),
    simulateWorkflow: vi.fn(), executeWorkflow: vi.fn(), isSimulating: false,
    currentExecution: null, executionLogs: [], isLoading: false, isSaving: false, isDirty: false,
    updateWorkflow: vi.fn(),
  }),
}));
vi.mock('../../shared/hooks/useAiEnabled', () => ({ useAiEnabled: () => false }));

beforeEach(() => vi.clearAllMocks());

describe('EditorPage replay mode', () => {
  it('enters replay for the ?replay= execution', async () => {
    render(<EditorPage />);
    await waitFor(() => expect(enterReplay).toHaveBeenCalledWith('exec-1'));
  });

  it('shows the replay bar and hides Save/Test', () => {
    render(<EditorPage />);
    expect(screen.getByRole('button', { name: /exit replay/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Test$/i })).not.toBeInTheDocument();
  });

  it('shows the current action snapshot in the inspector', () => {
    render(<EditorPage />);
    expect(screen.getByText('10023')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/editor/EditorPage.replay.test.tsx`
Expected: FAIL — no "Exit replay" button; `enterReplay` never called.

- [ ] **Step 4: Wire replay into EditorPage**

Imports (top of `EditorPage.tsx`): add to the `react-router-dom` import and add the new modules:
```ts
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
```
```ts
import { ReplayBar } from './components/ReplayBar';
import { ReplayInspector } from './components/ReplayInspector';
import { useReplay } from './hooks/useReplay';
import { buildReplaySequence, buildPartialExecution } from './utils/replaySnapshot';
```
Add `replayExecution`, `enterReplay`, `exitReplay` to the `useWorkflowStore()` destructure (alongside `currentExecution`).

After the existing `const { id } = useParams…; const navigate = useNavigate();` add:
```ts
  const [searchParams] = useSearchParams();
  const replayId = searchParams.get('replay');
  const isReplay = !!replayId;
```

Add a replay lifecycle effect (near the workflow-load effect):
```ts
  useEffect(() => {
    if (replayId) {
      enterReplay(replayId);
      return () => exitReplay();
    }
  }, [replayId, enterReplay, exitReplay]);
```

Force canvas + stage-view while replaying (after the `viewMode` state is declared):
```ts
  useEffect(() => {
    if (isReplay) {
      setViewMode('canvas');
      setEditorView({ type: 'stage-view' });
    }
  }, [isReplay]);
```

Build the replay sequence, playback state, and current partial execution (after the store destructure and helpers, before `return`):
```ts
  const replaySequence = useMemo(
    () => (replayExecution?.result ? buildReplaySequence(replayExecution.result, currentWorkflow?.definition) : []),
    [replayExecution, currentWorkflow],
  );
  const replay = useReplay(replaySequence.length);
  const currentReplayStep = replaySequence[replay.index] ?? null;
  const replayPartialExecution = useMemo(
    () => (replayExecution && replaySequence.length ? buildPartialExecution(replayExecution, replaySequence, replay.index) : null),
    [replayExecution, replaySequence, replay.index],
  );
  const exitReplayMode = useCallback(() => navigate(`/editor/${id}`), [navigate, id]);
```

**Toolbar gating** — wrap the editing action groups so they don't render in replay. In the header's `header-actions`:
- Wrap the `viewMode === 'canvas' && (…)` Add-Stage/Add-Action block start with `!isReplay && viewMode === 'canvas' && (…)`.
- Wrap the status `<select>` (the `currentWorkflow && (<select…>)`) as `!isReplay && currentWorkflow && (…)`.
- Wrap the **Params**, **Version History**, **Save**, and **Test** buttons each (or as a group) in `{!isReplay && (…)}`.
- Keep the Plan/Canvas toggle **hidden** in replay too (wrap it `{!isReplay && (…)}`) since replay forces canvas.

**Canvas execution prop** — in the Stage/Step canvas render, pass the replay partial execution and read-only flag when replaying:
```tsx
                <StageCanvas
                  workflow={currentWorkflow}
                  execution={isReplay ? replayPartialExecution : currentExecution}
                  isSimulating={isSimulating}
                  readOnly={isReplay}
                  onStageDoubleClick={handleStageDoubleClick}
                  onStageClick={handleStationClick}
                  onAddStation={handleAddStation}
                />
```
Do the same for `StepCanvas` (add `execution={isReplay ? replayPartialExecution : currentExecution}` and `readOnly={isReplay}`).

**Suppress config panels in replay** — change the two panel guards:
```tsx
        {selectedStep && currentWorkflow && !isReplay && !(showSimulation && currentExecution?.result) && (
```
```tsx
        {selectedStation && currentWorkflow && !isReplay && (editorView.type === 'stage-view' || viewMode === 'plan') && (
```

**Render the replay chrome** — wrap the canvas area so the ReplayBar sits under it, and render the inspector on the right. Replace the Canvas Area `<div style={{ flex: 1, height: '100%' }}>…</div>` wrapper with a column that appends the bar when replaying:
```tsx
        <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            {/* existing PlanView / StageCanvas / StepCanvas block unchanged */}
          </div>
          {isReplay && replaySequence.length > 0 && (
            <ReplayBar
              index={replay.index}
              total={replaySequence.length}
              isPlaying={replay.isPlaying}
              currentLabel={currentReplayStep ? `${currentReplayStep.stationName} · ${currentReplayStep.stepName}` : ''}
              onPrev={replay.prev}
              onNext={replay.next}
              onToggle={replay.toggle}
              onSeek={replay.seek}
              onExit={exitReplayMode}
            />
          )}
        </div>
```
And after the config-panel blocks (still inside the main editor flex row), add the inspector:
```tsx
        {isReplay && (
          <ReplayInspector replayStep={currentReplayStep} workflowName={currentWorkflow?.name} onExit={exitReplayMode} />
        )}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/editor/EditorPage.replay.test.tsx src/features/editor/EditorPage.plan.test.tsx`
Expected: both PASS. Then the whole editor suite: `npx vitest run src/features/editor` — all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/editor/EditorPage.tsx frontend/src/features/editor/EditorPage.replay.test.tsx frontend/src/features/editor/EditorPage.plan.test.tsx
git commit -m "feat: replay mode in EditorPage — bar, inspector, read-only gating"
```

---

### Task 8: "Replay on canvas" entry point in the Runs list

**Files:**
- Modify: `frontend/src/features/executions/ExecutionsPage.tsx` (add a Replay button to `ExecutionRow`)
- Test: `frontend/src/features/executions/ExecutionsPage.replay.test.tsx`

**Interfaces:**
- Consumes: `useNavigate` (already used in the file per the router mock) and each row's `execution.workflowId` + `execution.id`.
- Produces: a "Replay" button per run row that navigates to `/editor/<workflowId>?replay=<executionId>`.

**Note:** read the top of `frontend/src/features/executions/ExecutionsPage.tsx` first to confirm how `navigate` is obtained (the file mocks `react-router-dom`'s `useNavigate`). `ExecutionRow` is defined lower in the same file (~line 302). Add the button in the row's action area; if the row does not currently have `navigate` in scope, thread it down as a prop from `ExecutionsPage` (which holds the `useNavigate()` result) or call `useNavigate()` inside `ExecutionRow`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/executions/ExecutionsPage.replay.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExecutionsPage from './ExecutionsPage';
import { executionApi } from '../../shared/api/workflowApi';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../shared/api/workflowApi', () => ({
  executionApi: { getAll: vi.fn(), getLogs: vi.fn(), delete: vi.fn() },
}));

const run = {
  id: 'exec-1', workflowId: 'w1', workflowName: 'Orders', status: 'completed',
  triggeredBy: 'manual', startTime: '2026-07-14T06:00:00.000Z', successRate: 100,
  result: { stations: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(executionApi.getAll).mockResolvedValue([run] as never);
});

describe('ExecutionsPage replay entry', () => {
  it('navigates to the editor in replay mode for a run', async () => {
    render(<ExecutionsPage />);
    const btn = await screen.findByRole('button', { name: /replay on canvas/i });
    fireEvent.click(btn);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/editor/w1?replay=exec-1'));
  });
});
```

If `ExecutionsPage` relies on `ConfirmProvider` or other context the current `ExecutionsPage.test.tsx` mocks, mirror those `vi.mock` calls here (read `ExecutionsPage.test.tsx` and copy its mock set) so the page renders.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/executions/ExecutionsPage.replay.test.tsx`
Expected: FAIL — no "Replay on canvas" button.

- [ ] **Step 3: Add the button**

In `frontend/src/features/executions/ExecutionsPage.tsx`, import the icon (add to the existing `lucide-react` import): `Clapperboard` (or reuse an existing play-like icon already imported — check the file's imports; if `Play` is imported use it). In `ExecutionRow`'s action area, add:

```tsx
        <button
          className="btn btn-ghost btn-sm"
          aria-label="Replay on canvas"
          title="Replay on canvas"
          onClick={() => navigate(`/editor/${execution.workflowId}?replay=${execution.id}`)}
        >
          <Clapperboard size={14} /> Replay
        </button>
```

Ensure `navigate` is in scope in `ExecutionRow` (thread it as a prop from `ExecutionsPage` where `useNavigate()` is already called, or call `const navigate = useNavigate()` at the top of `ExecutionRow`). Match whichever pattern the file already uses for navigation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/executions/ExecutionsPage.replay.test.tsx`
Expected: PASS. Then `npx vitest run src/features/executions` — all green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/executions/ExecutionsPage.tsx frontend/src/features/executions/ExecutionsPage.replay.test.tsx
git commit -m "feat: Replay-on-canvas entry point in the Runs list"
```

---

### Task 9: Full verification + browser smoke

**Files:** none (verification only).

- [ ] **Step 1: Full suites and build**

```bash
cd frontend && npm run test:run && npm run build
```
Expected: all tests green (214 before this work + the new suites), build clean (strict TS). The backend is unchanged — no backend run needed, but confirm nothing under `backend/` was touched: `git diff --stat feature/phase-a-data-lens..HEAD -- backend/` prints nothing.

- [ ] **Step 2: Live browser smoke**

Start `npm run dev` from the repo root (backend :3002 auto-loads `backend/.env.development`; frontend :5173). Check ports aren't already serving first.
1. Go to **Runs** (`/executions`). Pick a run that has a completed execution (e.g. the seeded "Open Weather Data Pipeline" or any workflow with run history). Click **Replay** → the editor opens in replay mode: Save/Test/Add buttons gone, a playback bar at the bottom, an inspector on the right.
2. Press **Play** → the active stage highlights and the inspector advances through actions ~1/sec; press **Pause**, use ◀/▶, and drag the scrubber — the inspector's input/output track the current action.
3. Open a run that **failed** and replay to the failing action → the inspector shows the error; with AI configured, **Explain this** returns a plain-language explanation.
4. Click **Exit replay** → returns to the normal editor for that workflow (editing chrome back). 
5. Screenshot at a wide width and as narrow as the window allows; browser console must be clean (no React warnings, no failed `/api/executions/:id` calls).

If the AI check can't run (provider down), report it SKIPPED with the reason — don't fail the task for it.

- [ ] **Step 3: Fix anything found, re-run the affected suite, commit**

```bash
git add -A && git commit -m "fix: Phase B smoke-test findings"   # only if fixes were needed
```

---

## Self-Review Notes (done at plan-writing time)

- **Spec coverage (Phase B section):** entry point "Replay on canvas" → Task 8; read-only replay route `?replay=` → Task 7; fetch `GET /api/executions/:id` with no backend change → Task 5 (via existing `executionApi.getById`); ordered timeline + playback bar (⏮ ◀ ▶ ⏭ + scrubber, ~1s/tick) → Tasks 2, 3; canvas highlight of the current action + dimmed not-reached → Tasks 1 (partial execution) + 6/7 (reused `execution` prop); side inspector of input/output → Task 4; failed run stops at the failing action + "Explain this" → Tasks 1 (sequence ends at last executed step) + 4; read-only (config panels disabled, save/test hidden) → Tasks 6, 7; stale-step guard → Tasks 1, 4. "Re-run from stage N" is explicitly out of scope per the spec.
- **Deliberate deviations (surface to user before merge):** (1) inspector uses `StepDataInspector`/`JsonTreeView` (full actual values) instead of `<ShapeTree>` (lossy) — better fit for inspecting real run data; (2) canvas highlight is stage-granularity in Stage View for v1, step-level playback highlight deferred. Both are recorded here and in the plan's Global Constraints.
- **Type consistency:** `ReplayStep` shape identical across Tasks 1/4/7; `buildReplaySequence`/`buildPartialExecution` signatures identical Tasks 1↔7; `useReplay` return type identical Tasks 2↔7; `replayExecution`/`enterReplay`/`exitReplay` identical Tasks 5↔7; `readOnly` prop identical Tasks 6↔7.
- **Follow-ups seeded:** step-level canvas highlight during playback; optional seek-on-station-click; the last-frame "current station shows running not completed" cosmetic in `buildPartialExecution`.

## Deferred follow-ups (recorded at final review 2026-07-14, non-blocking — Phase B merged-ready)

1. `buildPartialExecution` last frame shows the current station `'running'` (blue) even for a failed/completed run — cosmetic; inspector still shows the true status/error.
2. `buildPartialExecution` is O(n²) (`findIndex` per step) — fine at current sizes; a `Map<stationId:stepId, seqPos>` would be cleaner if ever called per animation frame.
3. `ReplayBar` has a redundant `role="slider"` on `<input type="range">`.
4. `ReplayInspector.test.tsx` uses `getByRole({name:''}) ?? fallback` (never fires; should be `queryByRole`); `clearAllMocks` vs `resetAllMocks` mock leak (inert today).
5. No test for out-of-range / empty-sequence `index` in `buildReplaySequence`/`buildPartialExecution`.
6. Live/in-progress replay and "re-run from stage N with this data" remain out of scope (deferred by the spec).
