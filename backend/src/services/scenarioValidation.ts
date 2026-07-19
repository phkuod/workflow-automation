import type { Scenario, ScenarioOverride, Workflow } from '../types/workflow';

const MAX_SCENARIOS = 10;

export type ScenarioValidationResult =
  | { ok: true; scenarios: Scenario[] }
  | { ok: false; error: string };

/**
 * Validate and normalize the `scenarios` array from a POST /:id/simulate request body.
 * Pure business logic (no HTTP concerns) — the route maps a failure result to its
 * existing 400 { success, data, error } envelope.
 */
export function validateScenarios(workflow: Workflow, scenariosInput: unknown): ScenarioValidationResult {
  if (!Array.isArray(scenariosInput) || scenariosInput.length === 0) {
    return { ok: false, error: 'scenarios must be a non-empty array' };
  }
  if (scenariosInput.length > MAX_SCENARIOS) {
    return { ok: false, error: `At most ${MAX_SCENARIOS} scenarios per request` };
  }

  const knownStepIds = new Set<string>();
  for (const station of workflow.definition.stations || []) {
    for (const step of station.steps) knownStepIds.add(step.id);
  }

  const rawScenarios = scenariosInput as Array<Record<string, unknown>>;
  for (const scenario of rawScenarios) {
    if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
      return { ok: false, error: 'Each scenario must be an object' };
    }
    if (scenario.stepOverrides !== undefined && !Array.isArray(scenario.stepOverrides)) {
      return { ok: false, error: 'stepOverrides must be an array' };
    }
    if (scenario.inputData !== undefined
      && (typeof scenario.inputData !== 'object' || scenario.inputData === null || Array.isArray(scenario.inputData))) {
      return { ok: false, error: 'inputData must be an object' };
    }
    const overrides = (scenario.stepOverrides as unknown[] | undefined) || [];
    for (const o of overrides) {
      const override = o as Record<string, unknown> | null | undefined;
      if (!override || typeof override.stepId !== 'string' || !knownStepIds.has(override.stepId)) {
        return { ok: false, error: `Unknown step id in override: ${String(override?.stepId)}` };
      }
      const hasOutput = override.mockOutput !== undefined;
      const hasError = override.mockError !== undefined;
      if (hasOutput === hasError) {
        return { ok: false, error: 'Each override needs exactly one of mockOutput or mockError' };
      }
    }
  }

  const scenarios: Scenario[] = rawScenarios.map((s, i) => ({
    name: typeof s?.name === 'string' && s.name.trim() ? s.name.trim() : `Scenario ${i + 1}`,
    inputData: s?.inputData as Record<string, unknown> | undefined,
    stepOverrides: s?.stepOverrides as ScenarioOverride[] | undefined,
  }));

  return { ok: true, scenarios };
}
