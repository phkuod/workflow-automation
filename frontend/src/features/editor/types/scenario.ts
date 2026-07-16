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
