import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Workflow, Station, Step, StationEdge } from '../types/workflow';

// Mock dependencies to test ExecutionEngine in isolation
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
    cancel: vi.fn(),
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

describe('If-Else Routing (graph-based execution)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes to true branch when condition is true', async () => {
    const { ExecutionEngine } = await import('../services/executionEngine');

    const steps: Step[] = [
      { id: 'if-1', name: 'Check', type: 'if-else', config: { condition: '1 === 1' }, position: { x: 0, y: 0 } },
      { id: 'true-step', name: 'True Path', type: 'set-variable', config: { variableName: 'result', variableValue: 'yes' }, position: { x: 0, y: 100 } },
      { id: 'false-step', name: 'False Path', type: 'set-variable', config: { variableName: 'result', variableValue: 'no' }, position: { x: 200, y: 100 } },
    ];

    const edges: StationEdge[] = [
      { id: 'e1', source: 'if-1', target: 'true-step', sourceHandle: 'true' },
      { id: 'e2', source: 'if-1', target: 'false-step', sourceHandle: 'false' },
    ];

    const station: Station = {
      id: 'st-1', name: 'Station 1', steps, edges, position: { x: 0, y: 0 },
    };

    const workflow: Workflow = {
      id: 'w1', name: 'Test', status: 'active',
      definition: { stations: [station] },
      createdAt: '', updatedAt: '',
    };

    const result = await ExecutionEngine.execute(workflow, 'manual', {}, true);

    expect(result.status).toBe('completed');
    const stationResult = result.result!.stations[0];
    const trueStep = stationResult.steps.find(s => s.stepId === 'true-step');
    const falseStep = stationResult.steps.find(s => s.stepId === 'false-step');
    expect(trueStep?.status).toBe('completed');
    expect(falseStep?.status).toBe('skipped');
  });

  it('routes to false branch when condition is false', async () => {
    const { ExecutionEngine } = await import('../services/executionEngine');

    const steps: Step[] = [
      { id: 'if-1', name: 'Check', type: 'if-else', config: { condition: '1 === 2' }, position: { x: 0, y: 0 } },
      { id: 'true-step', name: 'True Path', type: 'set-variable', config: { variableName: 'result', variableValue: 'yes' }, position: { x: 0, y: 100 } },
      { id: 'false-step', name: 'False Path', type: 'set-variable', config: { variableName: 'result', variableValue: 'no' }, position: { x: 200, y: 100 } },
    ];

    const edges: StationEdge[] = [
      { id: 'e1', source: 'if-1', target: 'true-step', sourceHandle: 'true' },
      { id: 'e2', source: 'if-1', target: 'false-step', sourceHandle: 'false' },
    ];

    const station: Station = {
      id: 'st-1', name: 'Station 1', steps, edges, position: { x: 0, y: 0 },
    };

    const workflow: Workflow = {
      id: 'w1', name: 'Test', status: 'active',
      definition: { stations: [station] },
      createdAt: '', updatedAt: '',
    };

    const result = await ExecutionEngine.execute(workflow, 'manual', {}, true);

    expect(result.status).toBe('completed');
    const stationResult = result.result!.stations[0];
    const trueStep = stationResult.steps.find(s => s.stepId === 'true-step');
    const falseStep = stationResult.steps.find(s => s.stepId === 'false-step');
    expect(trueStep?.status).toBe('skipped');
    expect(falseStep?.status).toBe('completed');
  });

  it('falls back to linear execution when no edges', async () => {
    const { ExecutionEngine } = await import('../services/executionEngine');

    const steps: Step[] = [
      { id: 's1', name: 'Step 1', type: 'set-variable', config: { variableName: 'a', variableValue: '1' }, position: { x: 0, y: 0 } },
      { id: 's2', name: 'Step 2', type: 'set-variable', config: { variableName: 'b', variableValue: '2' }, position: { x: 0, y: 100 } },
    ];

    const station: Station = {
      id: 'st-1', name: 'Station 1', steps, position: { x: 0, y: 0 },
    };

    const workflow: Workflow = {
      id: 'w1', name: 'Test', status: 'active',
      definition: { stations: [station] },
      createdAt: '', updatedAt: '',
    };

    const result = await ExecutionEngine.execute(workflow, 'manual', {}, true);

    expect(result.status).toBe('completed');
    expect(result.result!.stations[0].steps).toHaveLength(2);
    expect(result.result!.stations[0].steps[0].status).toBe('completed');
    expect(result.result!.stations[0].steps[1].status).toBe('completed');
  });
});
