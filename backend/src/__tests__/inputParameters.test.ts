import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Workflow, Station, Step, InputParameter } from '../types/workflow';

// Mock dependencies
vi.mock('../models/execution', () => ({
  ExecutionModel: {
    create: vi.fn().mockReturnValue({
      id: 'exec-1', workflowId: 'w1', workflowName: 'Test', status: 'running',
      triggeredBy: 'manual', startTime: new Date().toISOString(),
    }),
    update: vi.fn().mockImplementation((_id, data) => ({
      id: 'exec-1', ...data,
    })),
  },
  LogModel: {
    createMany: vi.fn(),
  },
}));

vi.mock('../services/executionManager', () => ({
  executionManager: {
    register: vi.fn().mockReturnValue(new AbortController().signal),
    unregister: vi.fn(),
  },
}));

vi.mock('../services/executionEventBus', () => ({
  executionEventBus: {
    emitExecutionEvent: vi.fn(),
  },
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn(),
    }),
  },
}));

describe('Input Parameters Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when required parameter is missing', async () => {
    const { ExecutionEngine } = await import('../services/executionEngine');

    const params: InputParameter[] = [
      { name: 'userId', type: 'string', required: true },
    ];

    const workflow: Workflow = {
      id: 'w1', name: 'Test', status: 'active',
      definition: { stations: [], inputParameters: params },
      createdAt: '', updatedAt: '',
    };

    await expect(ExecutionEngine.execute(workflow, 'manual', {})).rejects.toThrow(
      'Missing required input parameter: userId'
    );
  });

  it('uses default value when parameter not provided', async () => {
    const { ExecutionEngine } = await import('../services/executionEngine');

    const params: InputParameter[] = [
      { name: 'greeting', type: 'string', required: false, defaultValue: 'hello' },
    ];

    const step: Step = {
      id: 's1', name: 'Log', type: 'set-variable',
      config: { variableName: 'result', variableValue: 'done' },
      position: { x: 0, y: 0 },
    };

    const station: Station = {
      id: 'st1', name: 'Station', steps: [step], position: { x: 0, y: 0 },
    };

    const workflow: Workflow = {
      id: 'w1', name: 'Test', status: 'active',
      definition: { stations: [station], inputParameters: params },
      createdAt: '', updatedAt: '',
    };

    const result = await ExecutionEngine.execute(workflow, 'manual', {}, true);
    expect(result.status).toBe('completed');
  });

  it('accepts provided input data', async () => {
    const { ExecutionEngine } = await import('../services/executionEngine');

    const params: InputParameter[] = [
      { name: 'name', type: 'string', required: true },
    ];

    const workflow: Workflow = {
      id: 'w1', name: 'Test', status: 'active',
      definition: { stations: [], inputParameters: params },
      createdAt: '', updatedAt: '',
    };

    const result = await ExecutionEngine.execute(workflow, 'manual', { name: 'Alice' }, true);
    expect(result.status).toBe('completed');
  });
});
