import type { Workflow, Step, StepType } from '../types/workflow';

/**
 * Find the first step of a given type across all stations in a workflow.
 */
export function findTriggerStep(workflow: Workflow, type: StepType): Step | null {
  for (const station of workflow.definition.stations) {
    for (const step of station.steps) {
      if (step.type === type) {
        return step;
      }
    }
  }
  return null;
}
