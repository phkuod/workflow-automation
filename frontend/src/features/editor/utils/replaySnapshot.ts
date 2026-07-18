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
