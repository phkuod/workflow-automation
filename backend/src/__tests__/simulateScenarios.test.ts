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
