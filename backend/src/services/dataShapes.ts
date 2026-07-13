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
