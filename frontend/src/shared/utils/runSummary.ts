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
