import { describe, it, expect } from 'vitest';
import { buildReplaySequence, buildPartialExecution } from './replaySnapshot';
import type { Execution, WorkflowDefinition } from '../../../shared/types/workflow';

function execution(): Execution {
  return {
    id: 'exec-1', workflowId: 'w1', workflowName: 'W', status: 'failed',
    triggeredBy: 'manual', startTime: '2026-07-14T06:00:00.000Z', successRate: 50,
    result: {
      stations: [
        {
          stationId: 'st1', stationName: 'Stage 1', status: 'completed', steps: [
            { stepId: 's1', stepName: 'Fetch', stepType: 'http-request', status: 'completed', output: { orderId: 1 } },
            { stepId: 's2', stepName: 'Transform', stepType: 'script-js', status: 'completed', output: { ok: true } },
          ],
        },
        {
          stationId: 'st2', stationName: 'Stage 2', status: 'failed', steps: [
            { stepId: 's3', stepName: 'Mail', stepType: 'action-email', status: 'failed', error: { message: 'SMTP down' } },
          ],
        },
      ],
    },
  };
}

describe('buildReplaySequence', () => {
  it('flattens stations then steps in order', () => {
    const seq = buildReplaySequence(execution().result!);
    expect(seq.map((r) => r.stepId)).toEqual(['s1', 's2', 's3']);
    expect(seq.map((r) => r.stationIndex)).toEqual([0, 0, 1]);
    expect(seq[2].stationName).toBe('Stage 2');
  });

  it('marks existsInDefinition against the current definition', () => {
    const def: WorkflowDefinition = {
      stations: [{ id: 'st1', name: 'Stage 1', position: { x: 0, y: 0 }, steps: [
        { id: 's1', name: 'Fetch', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
      ] }],
    };
    const seq = buildReplaySequence(execution().result!, def);
    expect(seq.find((r) => r.stepId === 's1')!.existsInDefinition).toBe(true);
    expect(seq.find((r) => r.stepId === 's3')!.existsInDefinition).toBe(false);
  });

  it('treats every step as existing when no definition is supplied', () => {
    const seq = buildReplaySequence(execution().result!);
    expect(seq.every((r) => r.existsInDefinition)).toBe(true);
  });
});

describe('buildPartialExecution', () => {
  it('marks past stations completed, current running, future pending', () => {
    const base = execution();
    const seq = buildReplaySequence(base.result!);
    const partial = buildPartialExecution(base, seq, 0); // at s1, station 0
    expect(partial.result!.stations[0].status).toBe('running');
    expect(partial.result!.stations[1].status).toBe('pending');
  });

  it('marks steps after the playback position as pending', () => {
    const base = execution();
    const seq = buildReplaySequence(base.result!);
    const partial = buildPartialExecution(base, seq, 0); // at s1
    const st1 = partial.result!.stations[0];
    expect(st1.steps.find((s) => s.stepId === 's1')!.status).toBe('completed'); // reached
    expect(st1.steps.find((s) => s.stepId === 's2')!.status).toBe('pending');   // not yet
  });

  it('at the last index the final station is the running (active) one', () => {
    const base = execution();
    const seq = buildReplaySequence(base.result!);
    const partial = buildPartialExecution(base, seq, 2); // at s3, station 1
    expect(partial.result!.stations[0].status).toBe('completed');
    expect(partial.result!.stations[1].status).toBe('running');
  });

  it('does not mutate the base execution', () => {
    const base = execution();
    const seq = buildReplaySequence(base.result!);
    buildPartialExecution(base, seq, 0);
    expect(base.result!.stations[1].status).toBe('failed'); // original untouched
  });
});
