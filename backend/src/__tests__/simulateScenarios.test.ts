import { describe, it, expect, vi } from 'vitest';

vi.mock('../models/execution', () => ({
  ExecutionModel: { create: vi.fn(), update: vi.fn() },
  LogModel: { createMany: vi.fn() },
}));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { ExecutionEngine } from '../services/executionEngine';
import { ExecutionModel, LogModel } from '../models/execution';
import type { Workflow } from '../types/workflow';

function workflow(): Workflow {
  return {
    id: 'w1', name: 'W', status: 'active',
    createdAt: '', updatedAt: '',
    definition: {
      stations: [
        {
          id: 'st1', name: 'Stage 1', position: { x: 0, y: 0 }, steps: [
            { id: 's1', name: 'Fetch', type: 'http-request', config: { url: 'https://api.test', method: 'GET' }, position: { x: 0, y: 0 } },
            { id: 's2', name: 'Decide', type: 'if-else', config: { condition: 'steps["Fetch"].output.status === 200' }, position: { x: 0, y: 0 } },
          ],
        },
      ],
    },
  };
}

describe('ExecutionEngine.simulateScenarios', () => {
  it('applies mockOutput without executing the step, and it flows downstream', async () => {
    const results = await ExecutionEngine.simulateScenarios(workflow(), [
      { name: 'happy', stepOverrides: [{ stepId: 's1', mockOutput: { status: 200 } }] },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('happy');
    const fetchStep = results[0].result.stations[0].steps.find((s) => s.stepId === 's1')!;
    expect(fetchStep.status).toBe('completed');
    expect(fetchStep.output).toEqual({ status: 200 });
    // the if-else read the mocked output (status===200 → true branch)
    const decideStep = results[0].result.stations[0].steps.find((s) => s.stepId === 's2')!;
    expect(decideStep.output?.branch).toBe('true');
  });

  it('applies mockError so the step fails and the station fails', async () => {
    const results = await ExecutionEngine.simulateScenarios(workflow(), [
      { name: 'boom', stepOverrides: [{ stepId: 's1', mockError: 'API down' }] },
    ]);
    const fetchStep = results[0].result.stations[0].steps.find((s) => s.stepId === 's1')!;
    expect(fetchStep.status).toBe('failed');
    expect(fetchStep.error?.message).toBe('API down');
    expect(results[0].result.stations[0].status).toBe('failed');
  });

  it('runs multiple scenarios in order and persists nothing', async () => {
    const results = await ExecutionEngine.simulateScenarios(workflow(), [
      { name: 'a', stepOverrides: [{ stepId: 's1', mockOutput: { status: 200 } }] },
      { name: 'b', stepOverrides: [{ stepId: 's1', mockError: 'x' }] },
    ]);
    expect(results.map((r) => r.name)).toEqual(['a', 'b']);
    expect(ExecutionModel.create).not.toHaveBeenCalled();
    expect(ExecutionModel.update).not.toHaveBeenCalled();
    expect(LogModel.createMany).not.toHaveBeenCalled();
  });

  it('applies a falsy-but-valid mockOutput (0) without coercing it to {}', async () => {
    const results = await ExecutionEngine.simulateScenarios(workflow(), [
      { name: 'zero', stepOverrides: [{ stepId: 's1', mockOutput: 0 as unknown as Record<string, unknown> }] },
    ]);
    const fetchStep = results[0].result.stations[0].steps.find((s) => s.stepId === 's1')!;
    expect(fetchStep.status).toBe('completed');
    expect(fetchStep.output).toBe(0);
  });

  it('a scenario missing a required input yields an error result, not a thrown batch', async () => {
    const wf = workflow();
    wf.definition.inputParameters = [{ name: 'token', type: 'string', required: true }];
    const results = await ExecutionEngine.simulateScenarios(wf, [
      { name: 'no-input', inputData: {}, stepOverrides: [{ stepId: 's1', mockOutput: { status: 200 } }] },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].result.error?.message).toMatch(/Missing required input parameter/);
  });
});

describe('ExecutionEngine log buffer overflow (ephemeral vs persisted contexts)', () => {
  // log() is private; reach it through a typed cast so we can hit the overflow
  // branch deterministically by pre-seeding the buffer to the flush threshold.
  type TestLogEntry = { executionId: string; level: string; message: string };
  type TestContext = {
    executionId: string;
    workflow: Workflow;
    variables: Record<string, unknown>;
    stations: Record<string, unknown>;
    steps: Record<string, unknown>;
    logs: TestLogEntry[];
    simulate: boolean;
    ephemeral?: boolean;
  };
  const engine = ExecutionEngine as unknown as {
    MAX_BUFFERED_LOGS: number;
    log: (context: TestContext, level: string, message: string) => void;
  };

  function overflowContext(ephemeral: boolean): TestContext {
    const logs: TestLogEntry[] = Array.from({ length: engine.MAX_BUFFERED_LOGS - 1 }, (_, i) => ({
      executionId: 'ctx', level: 'info', message: `entry ${i}`,
    }));
    return {
      executionId: 'ctx', workflow: workflow(), variables: {}, stations: {}, steps: {},
      logs, simulate: true, ephemeral,
    };
  }

  it('ephemeral context never flushes logs to the database at overflow; buffer stays bounded', () => {
    vi.mocked(LogModel.createMany).mockClear();
    const ctx = overflowContext(true);
    engine.log(ctx, 'info', 'tips the buffer over the threshold');
    expect(LogModel.createMany).not.toHaveBeenCalled();
    expect(ctx.logs.length).toBeLessThan(engine.MAX_BUFFERED_LOGS);
  });

  it('non-ephemeral context still flushes logs to the database at overflow', () => {
    vi.mocked(LogModel.createMany).mockClear();
    const ctx = overflowContext(false);
    engine.log(ctx, 'info', 'tips the buffer over the threshold');
    expect(LogModel.createMany).toHaveBeenCalledTimes(1);
    expect(ctx.logs.length).toBe(0);
  });
});
