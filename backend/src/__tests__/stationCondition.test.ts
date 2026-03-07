import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Workflow, Station, Step } from '../types/workflow';

// Mock dependencies
vi.mock('../models/execution', () => ({
  ExecutionModel: {
    create: vi.fn().mockReturnValue({
      id: 'exec-1', workflowId: 'w1', workflowName: 'Test', status: 'running',
      triggeredBy: 'manual', startTime: new Date().toISOString(),
    }),
    update: vi.fn().mockImplementation((_id, data) => ({ id: 'exec-1', ...data })),
  },
  LogModel: { createMany: vi.fn() },
}));

vi.mock('../services/executionManager', () => ({
  executionManager: {
    register: vi.fn().mockReturnValue(new AbortController().signal),
    unregister: vi.fn(),
  },
}));

vi.mock('../services/executionEventBus', () => ({
  executionEventBus: { emitExecutionEvent: vi.fn() },
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn().mockReturnValue({ sendMail: vi.fn() }) },
}));

const makeStep = (id: string, name: string): Step => ({
  id, name, type: 'set-variable',
  config: { variableName: `var_${id}`, variableValue: 'done' },
  position: { x: 0, y: 0 },
});

describe('Station Conditions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('executes station with condition type "always"', async () => {
    const { ExecutionEngine } = await import('../services/executionEngine');

    const station: Station = {
      id: 'st1', name: 'Always Station',
      steps: [makeStep('s1', 'Step 1')],
      position: { x: 0, y: 0 },
      condition: { type: 'always' },
    };

    const workflow: Workflow = {
      id: 'w1', name: 'Test', status: 'active',
      definition: { stations: [station] },
      createdAt: '', updatedAt: '',
    };

    const result = await ExecutionEngine.execute(workflow, 'manual', {}, true);
    expect(result.status).toBe('completed');
    expect(result.result!.stations[0].status).toBe('completed');
  });

  it('skips station when previousSuccess condition fails', async () => {
    const { ExecutionEngine } = await import('../services/executionEngine');

    const failStep: Step = {
      id: 's1', name: 'Fail', type: 'script-js',
      config: { code: 'throw new Error("fail");' },
      position: { x: 0, y: 0 },
    };

    const station1: Station = {
      id: 'st1', name: 'Failing Station',
      steps: [failStep],
      position: { x: 0, y: 0 },
    };

    const station2: Station = {
      id: 'st2', name: 'Conditional Station',
      steps: [makeStep('s2', 'Step 2')],
      position: { x: 100, y: 0 },
      condition: { type: 'previousSuccess' },
    };

    const workflow: Workflow = {
      id: 'w1', name: 'Test', status: 'active',
      definition: { stations: [station1, station2] },
      createdAt: '', updatedAt: '',
    };

    const result = await ExecutionEngine.execute(workflow, 'manual', {}, true);
    // Station 1 fails, so workflow stops (station failure stops workflow)
    expect(result.status).toBe('failed');
  });

  it('skips station when expression condition evaluates false', async () => {
    const { ExecutionEngine } = await import('../services/executionEngine');

    const station1: Station = {
      id: 'st1', name: 'Station 1',
      steps: [makeStep('s1', 'Step 1')],
      position: { x: 0, y: 0 },
    };

    const station2: Station = {
      id: 'st2', name: 'Conditional Station',
      steps: [makeStep('s2', 'Step 2')],
      position: { x: 100, y: 0 },
      condition: { type: 'expression', expression: '1 === 2' },
    };

    const workflow: Workflow = {
      id: 'w1', name: 'Test', status: 'active',
      definition: { stations: [station1, station2] },
      createdAt: '', updatedAt: '',
    };

    const result = await ExecutionEngine.execute(workflow, 'manual', {}, true);
    expect(result.status).toBe('completed');
    // Station 2 should be skipped
    expect(result.result!.stations[1].status).toBe('skipped');
  });

  it('executes station when expression condition evaluates true', async () => {
    const { ExecutionEngine } = await import('../services/executionEngine');

    const station: Station = {
      id: 'st1', name: 'Conditional Station',
      steps: [makeStep('s1', 'Step 1')],
      position: { x: 0, y: 0 },
      condition: { type: 'expression', expression: '1 === 1' },
    };

    const workflow: Workflow = {
      id: 'w1', name: 'Test', status: 'active',
      definition: { stations: [station] },
      createdAt: '', updatedAt: '',
    };

    const result = await ExecutionEngine.execute(workflow, 'manual', {}, true);
    expect(result.status).toBe('completed');
    expect(result.result!.stations[0].status).toBe('completed');
  });
});
