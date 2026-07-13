import { describe, it, expect } from 'vitest';
import { summarizeStep } from './runSummary';
import type { StepResult } from '../types/workflow';

function step(partial: Partial<StepResult>): StepResult {
  return {
    stepId: 's1', stepName: 'My step', stepType: 'wait', status: 'completed',
    ...partial,
  } as StepResult;
}

describe('summarizeStep', () => {
  it('summarizes an email send with recipient', () => {
    expect(summarizeStep(step({
      stepType: 'action-email',
      input: { emailTo: 'team@company.com' },
    }))).toBe('Sent an email to team@company.com');
  });

  it('summarizes an email send without recipient info', () => {
    expect(summarizeStep(step({ stepType: 'action-email' }))).toBe('Sent an email');
  });

  it('summarizes an http request with url', () => {
    expect(summarizeStep(step({
      stepType: 'http-request',
      input: { url: 'https://api.example.com/data' },
    }))).toBe('Called https://api.example.com/data');
  });

  it('summarizes a decision taking the yes path', () => {
    expect(summarizeStep(step({
      stepType: 'if-else',
      output: { result: true },
    }))).toBe('Decision: took the "yes" path');
  });

  it('summarizes a decision taking the no path', () => {
    expect(summarizeStep(step({
      stepType: 'if-else',
      output: { result: false },
    }))).toBe('Decision: took the "no" path');
  });

  it('summarizes remembering a value', () => {
    expect(summarizeStep(step({
      stepType: 'set-variable',
      input: { variableName: 'orderCount' },
    }))).toBe('Remembered "orderCount"');
  });

  it('summarizes a wait', () => {
    expect(summarizeStep(step({
      stepType: 'wait',
      input: { duration: 5, unit: 'seconds' },
    }))).toBe('Waited 5 seconds');
  });

  it('summarizes triggers', () => {
    expect(summarizeStep(step({ stepType: 'trigger-manual' }))).toBe('Started manually');
    expect(summarizeStep(step({ stepType: 'trigger-cron' }))).toBe('Started on schedule');
    expect(summarizeStep(step({ stepType: 'trigger-webhook' }))).toBe('Started by another system');
  });

  it('summarizes scripts and db queries generically', () => {
    expect(summarizeStep(step({ stepType: 'script-js' }))).toBe('Ran a custom script');
    expect(summarizeStep(step({ stepType: 'script-python' }))).toBe('Ran a custom script');
    expect(summarizeStep(step({ stepType: 'connector-db' }))).toBe('Queried the database');
  });

  it('summarizes slack messages', () => {
    expect(summarizeStep(step({ stepType: 'action-slack' }))).toBe('Sent a Slack message');
  });

  it('falls back to the step name for unknown types', () => {
    expect(summarizeStep(step({
      stepType: 'something-new' as StepResult['stepType'],
      stepName: 'Mystery step',
    }))).toBe('Mystery step');
  });

  it('describes skipped steps', () => {
    expect(summarizeStep(step({ stepType: 'action-email', status: 'skipped' })))
      .toBe('Skipped: Send an email');
  });
});
