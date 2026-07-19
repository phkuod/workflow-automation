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

  // Iterator stations emit one StepResult per loop iteration, so several StepResults
  // can share the same (stationId, stepId). Precompute each key's sequence positions
  // in order so the k-th duplicate resolves to the k-th occurrence rather than the
  // first match — and so this doesn't rescan the whole sequence per step (O(S) total
  // instead of O(S^2), which matters since this runs on every 1s playback tick).
  const positionsByKey = new Map<string, number[]>();
  sequence.forEach((r, i) => {
    const key = `${r.stationId}::${r.stepId}`;
    const positions = positionsByKey.get(key);
    if (positions) positions.push(i);
    else positionsByKey.set(key, [i]);
  });
  const occurrenceByKey = new Map<string, number>();

  const stations: StationResult[] = result.stations.map((station, stationIndex) => {
    let status: StationResult['status'];
    if (stationIndex < currentStationIndex) status = 'completed';
    else if (stationIndex === currentStationIndex) status = 'running';
    else status = 'pending';

    const steps: StepResult[] = station.steps.map((step) => {
      const key = `${station.stationId}::${step.stepId}`;
      const occurrence = occurrenceByKey.get(key) ?? 0;
      occurrenceByKey.set(key, occurrence + 1);
      const seqPos = positionsByKey.get(key)?.[occurrence] ?? -1;
      return seqPos > index ? { ...step, status: 'pending' } : step;
    });

    return { ...station, status, steps };
  });

  return { ...base, result: { ...result, stations } };
}
