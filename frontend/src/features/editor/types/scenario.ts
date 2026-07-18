import type { ExecutionResult } from '../../../shared/types/workflow';

export interface ScenarioOverrideInput {
  /** Client-side identity for stable React keys; stripped before POST. */
  id?: string;
  stepId: string;
  mockOutput?: unknown;
  mockError?: string;
}

export interface ScenarioInput {
  /** Client-side identity for stable React keys; stripped before POST. */
  id?: string;
  name: string;
  inputData?: Record<string, unknown>;
  stepOverrides?: ScenarioOverrideInput[];
}

export interface ScenarioResult {
  name: string;
  result: ExecutionResult;
}
