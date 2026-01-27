import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionEngine } from '../services/executionEngine';
import { Workflow } from '../types/workflow';
import { ScriptRunner } from '../services/scriptRunner';

// Mock ScriptRunner to simulate failures and delays
vi.mock('../services/scriptRunner', async () => {
  const actual = await vi.importActual('../services/scriptRunner') as any;
  return {
    ScriptRunner: {
      ...actual.ScriptRunner,
      executeHttpRequest: vi.fn(),
      executeJS: vi.fn(),
    }
  };
});

// Mock database models to avoid DB connection issues
vi.mock('../models/execution', () => ({
  ExecutionModel: {
    create: vi.fn((workflowId, workflowName, triggeredBy) => ({
      id: 'mock-exec-id',
      workflowId,
      workflowName,
      status: 'running',
      triggeredBy,
      startTime: new Date().toISOString(),
      successRate: 0
    })),
    update: vi.fn((id, data) => ({
      id,
      ...data
    })),
    getById: vi.fn((id) => ({
      id,
      status: 'completed'
    }))
  },
  LogModel: {
    createMany: vi.fn()
  }
}));

describe('ExecutionEngine Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Retry Policy', () => {
    it('should retry a failed step and eventually succeed', async () => {
      const workflow: Workflow = {
        id: 'test-retry',
        name: 'Retry Test',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        definition: {
          stations: [{
            id: 's1',
            name: 'Station 1',
            position: { x: 0, y: 0 },
            steps: [{
              id: 'step1',
              name: 'Failed Step',
              type: 'http-request',
              config: { url: 'http://fail.com' },
              position: { x: 0, y: 0 },
              retryPolicy: {
                maxAttempts: 3,
                initialInterval: 10,
                backoffCoefficient: 1
              }
            }]
          }]
        }
      };

      // Mock failure then success
      (ScriptRunner.executeHttpRequest as any)
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({ success: true, output: { ok: true }, logs: ['Success after retry'] });

      const execution = await ExecutionEngine.execute(workflow);

      expect(execution.status).toBe('completed');
      expect(ScriptRunner.executeHttpRequest).toHaveBeenCalledTimes(3);
    });

    it('should fail after maximum retry attempts', async () => {
      const workflow: Workflow = {
        id: 'test-retry-fail',
        name: 'Retry Fail Test',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        definition: {
          stations: [{
            id: 's1',
            name: 'Station 1',
            position: { x: 0, y: 0 },
            steps: [{
              id: 'step1',
              name: 'Always Failed',
              type: 'http-request',
              config: { url: 'http://fail.com' },
              position: { x: 0, y: 0 },
              retryPolicy: {
                maxAttempts: 2,
                initialInterval: 10,
                backoffCoefficient: 1
              }
            }]
          }]
        }
      };

      (ScriptRunner.executeHttpRequest as any).mockRejectedValue(new Error('Persistent Error'));

      const execution = await ExecutionEngine.execute(workflow);

      expect(execution.status).toBe('failed');
      expect(ScriptRunner.executeHttpRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('Wait Node', () => {
    it('should wait for the specified duration', async () => {
      const workflow: Workflow = {
        id: 'test-wait',
        name: 'Wait Test',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        definition: {
          stations: [{
            id: 's1',
            name: 'Station 1',
            position: { x: 0, y: 0 },
            steps: [{
              id: 'step1',
              name: 'Wait 100ms',
              type: 'wait',
              config: { duration: 100, unit: 'seconds' }, // Wait uses seconds by default in multiplier, but let's mock it short
              position: { x: 0, y: 0 }
            }]
          }]
        }
      };

      // Adjust wait multiplier for test if needed, but we'll just check execution completion
      // Actually, let's use a very small duration in the test
      workflow.definition.stations[0].steps[0].config.duration = 0.05; // 50ms

      const start = Date.now();
      const execution = await ExecutionEngine.execute(workflow);
      const end = Date.now();

      expect(execution.status).toBe('completed');
      expect(end - start).toBeGreaterThanOrEqual(50);
      expect(execution.result?.stations[0].steps[0].output).toEqual(expect.objectContaining({
        waited: true,
        duration: 0.05,
        unit: 'seconds'
      }));
    });
  });
});
