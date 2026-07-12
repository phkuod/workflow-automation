import type { Step } from '../../../shared/types/workflow';
import { STEP_TYPE_INFO } from '../../../shared/types/workflow';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname || url;
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
