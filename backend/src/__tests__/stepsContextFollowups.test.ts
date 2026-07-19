import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionEngine } from '../services/executionEngine';
import { Workflow } from '../types/workflow';

// Mock database models to avoid DB connection issues (same style as features.test.ts)
vi.mock('../models/execution', () => ({
  ExecutionModel: {
    create: vi.fn((workflowId, workflowName, triggeredBy) => ({
      id: 'mock-exec-id',
      workflowId,
      workflowName,
      status: 'running',
      triggeredBy,
      startTime: new Date().toISOString(),
      successRate: 0,
    })),
    update: vi.fn((id, data) => ({ id, ...data })),
    getById: vi.fn((id) => ({ id, status: 'completed' })),
  },
  LogModel: {
    createMany: vi.fn(),
  },
}));

describe('steps context follow-ups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveInputVariables — steps context', () => {
    it('resolves an inputVars mapping using ${steps[\'X\'].output.field}', async () => {
      const workflow: Workflow = {
        id: 'wf-inputvars',
        name: 'InputVars Test',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        definition: {
          stations: [{
            id: 's1',
            name: 'Station 1',
            position: { x: 0, y: 0 },
            steps: [
              {
                id: 'step1',
                name: 'Fetch Step',
                type: 'script-js',
                config: { code: 'return { field: "hello" };' },
                position: { x: 0, y: 0 },
              },
              {
                id: 'step2',
                name: 'Consume Step',
                type: 'script-js',
                config: { code: 'return inputData.x;' },
                position: { x: 0, y: 0 },
                inputVars: [
                  { name: 'x', source: "${steps['Fetch Step'].output.field}" },
                ],
              },
            ],
          }],
        },
      };

      const execution = await ExecutionEngine.execute(workflow);

      expect(execution.status).toBe('completed');
      const station = execution.result!.stations[0];
      const step2 = station.steps.find(s => s.stepId === 'step2')!;
      expect(step2.input).toEqual({ x: 'hello' });
      expect(step2.output).toBe('hello');
    });
  });

  describe('iterator sourceVariable — steps context and bare-path form', () => {
    function buildWorkflow(sourceVariable: string): Workflow {
      return {
        id: 'wf-iterator',
        name: 'Iterator Test',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        definition: {
          stations: [
            {
              id: 'fetch-station',
              name: 'Fetch Station',
              position: { x: 0, y: 0 },
              steps: [{
                id: 'fetch-step',
                name: 'Fetch',
                type: 'script-js',
                config: { code: 'return { rows: [1, 2, 3] };' },
                position: { x: 0, y: 0 },
              }],
            },
            {
              id: 'iter-station',
              name: 'Iterator Station',
              position: { x: 0, y: 0 },
              iterator: { enabled: true, sourceVariable, itemVariableName: 'item' },
              steps: [{
                id: 'iter-step',
                name: 'Iter Step',
                type: 'script-js',
                config: { code: 'return { doubled: variables.item * 2 };' },
                position: { x: 0, y: 0 },
              }],
            },
          ],
        },
      };
    }

    it('iterates over a bare-path sourceVariable (no ${})', async () => {
      const workflow = buildWorkflow("steps['Fetch'].output.rows");
      const execution = await ExecutionEngine.execute(workflow);

      expect(execution.status).toBe('completed');
      const iterStation = execution.result!.stations[1];
      expect(iterStation.status).toBe('completed');
      // 3 items iterated, one step executed per item
      expect(iterStation.steps).toHaveLength(3);
    });

    it('iterates over a ${...}-wrapped sourceVariable (existing interpolation form)', async () => {
      const workflow = buildWorkflow("${steps['Fetch'].output.rows}");
      const execution = await ExecutionEngine.execute(workflow);

      expect(execution.status).toBe('completed');
      const iterStation = execution.result!.stations[1];
      expect(iterStation.status).toBe('completed');
      expect(iterStation.steps).toHaveLength(3);
    });

    it('fails loudly when the bare path does not resolve to an array', async () => {
      const workflow = buildWorkflow("steps['Unknown Step'].output.rows");
      const execution = await ExecutionEngine.execute(workflow);

      expect(execution.status).toBe('failed');
      const iterStation = execution.result!.stations[1];
      expect(iterStation.status).toBe('failed');
    });

    it('iterates over a {{...}}-wrapped sourceVariable (handlebars form, still the UI placeholder)', async () => {
      const workflow = buildWorkflow("{{steps['Fetch'].output.rows}}");
      const execution = await ExecutionEngine.execute(workflow);

      expect(execution.status).toBe('completed');
      const iterStation = execution.result!.stations[1];
      expect(iterStation.status).toBe('completed');
      expect(iterStation.steps).toHaveLength(3);
    });

    it('iterates over a literal JSON array typed directly as the sourceVariable', async () => {
      const workflow = buildWorkflow('[1,2,3]');
      const execution = await ExecutionEngine.execute(workflow);

      expect(execution.status).toBe('completed');
      const iterStation = execution.result!.stations[1];
      expect(iterStation.status).toBe('completed');
      expect(iterStation.steps).toHaveLength(3);
    });
  });
});
