import { describe, it, expect } from 'vitest';
import { describeTrigger, describeAction } from './planSummary';
import type { Step } from '../../../shared/types/workflow';

function step(partial: Partial<Step>): Step {
  return {
    id: 's1', name: 'My step', type: 'wait', config: {},
    position: { x: 0, y: 0 },
    ...partial,
  } as Step;
}

describe('describeTrigger', () => {
  it('describes a cron trigger with its expression', () => {
    expect(describeTrigger(step({ type: 'trigger-cron', config: { cronExpression: '0 9 * * *' } })))
      .toBe('On a schedule (0 9 * * *)');
  });

  it('describes a cron trigger without expression', () => {
    expect(describeTrigger(step({ type: 'trigger-cron', config: {} })))
      .toBe('On a schedule');
  });

  it('describes a manual trigger', () => {
    expect(describeTrigger(step({ type: 'trigger-manual' }))).toBe('Start manually');
  });

  it('describes a webhook trigger', () => {
    expect(describeTrigger(step({ type: 'trigger-webhook' }))).toBe('When another system calls');
  });

  it('falls back to the step name for non-trigger types', () => {
    expect(describeTrigger(step({ type: 'wait', name: 'Odd trigger' }))).toBe('Odd trigger');
  });
});

describe('describeAction', () => {
  it('adds the url for external service calls', () => {
    expect(describeAction(step({ type: 'http-request', config: { url: 'https://api.example.com/data' } })))
      .toBe('Call an external service (api.example.com)');
  });

  it('omits the parenthetical when url is missing', () => {
    expect(describeAction(step({ type: 'http-request', config: {} })))
      .toBe('Call an external service');
  });

  it('adds the recipient for emails', () => {
    expect(describeAction(step({ type: 'action-email', config: { emailTo: 'team@company.com' } })))
      .toBe('Send an email (to team@company.com)');
  });

  it('adds the variable name for remember-a-value', () => {
    expect(describeAction(step({ type: 'set-variable', config: { variableName: 'orderCount' } })))
      .toBe('Remember a value ("orderCount")');
  });

  it('adds duration for waits', () => {
    expect(describeAction(step({ type: 'wait', config: { duration: 5, unit: 'minutes' } })))
      .toBe('Wait (5 minutes)');
  });

  it('uses the plain label alone for other types', () => {
    expect(describeAction(step({ type: 'if-else' }))).toBe('Decision');
    expect(describeAction(step({ type: 'action-slack' }))).toBe('Send a Slack message');
  });

  it('falls back to the step name for unknown types', () => {
    expect(describeAction(step({ type: 'mystery' as Step['type'], name: 'Mystery' }))).toBe('Mystery');
  });
});
