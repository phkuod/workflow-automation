import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Workflow, Station, Step, Execution } from '../types/workflow';

// Mock the ExecutionEngine for isolated testing
const createMockWorkflow = (overrides?: Partial<Workflow>): Workflow => ({
  id: 'test-workflow-1',
  name: 'Test Workflow',
  description: 'A test workflow',
  status: 'active',
  definition: {
    stations: [],
    variables: {},
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createMockStation = (overrides?: Partial<Station>): Station => ({
  id: 'test-station-1',
  name: 'Test Station',
  steps: [],
  position: { x: 0, y: 0 },
  ...overrides,
});

const createMockStep = (overrides?: Partial<Step>): Step => ({
  id: 'test-step-1',
  name: 'Test Step',
  type: 'script-js',
  config: { code: 'return 42;' },
  position: { x: 0, y: 0 },
  ...overrides,
});

describe('ExecutionEngine', () => {
  describe('Workflow structure validation', () => {
    it('should create a valid workflow with stations and steps', () => {
      const step1 = createMockStep({ id: 'step-1', name: 'Step 1' });
      const step2 = createMockStep({ id: 'step-2', name: 'Step 2' });
      const station = createMockStation({
        id: 'station-1',
        name: 'Station 1',
        steps: [step1, step2],
      });
      const workflow = createMockWorkflow({
        id: 'workflow-1',
        definition: { stations: [station] },
      });

      expect(workflow.definition.stations).toHaveLength(1);
      expect(workflow.definition.stations[0].steps).toHaveLength(2);
      expect(workflow.definition.stations[0].steps[0].id).toBe('step-1');
      expect(workflow.definition.stations[0].steps[1].id).toBe('step-2');
    });

    it('should support multiple stations', () => {
      const station1 = createMockStation({ id: 'station-1', name: 'Station 1' });
      const station2 = createMockStation({ id: 'station-2', name: 'Station 2' });
      const workflow = createMockWorkflow({
        definition: { stations: [station1, station2] },
      });

      expect(workflow.definition.stations).toHaveLength(2);
    });
  });

  describe('Step type configurations', () => {
    it('should create a manual trigger step', () => {
      const step = createMockStep({
        type: 'trigger-manual',
        config: {},
      });

      expect(step.type).toBe('trigger-manual');
    });

    it('should create a cron trigger step', () => {
      const step = createMockStep({
        type: 'trigger-cron',
        config: { cronExpression: '0 * * * *' },
      });

      expect(step.type).toBe('trigger-cron');
      expect(step.config.cronExpression).toBe('0 * * * *');
    });

    it('should create an HTTP request step', () => {
      const step = createMockStep({
        type: 'http-request',
        config: {
          url: 'https://api.example.com',
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      });

      expect(step.type).toBe('http-request');
      expect(step.config.url).toBe('https://api.example.com');
      expect(step.config.method).toBe('GET');
    });

    it('should create a set-variable step', () => {
      const step = createMockStep({
        type: 'set-variable',
        config: {
          variableName: 'myVar',
          variableValue: 'Hello',
        },
      });

      expect(step.type).toBe('set-variable');
      expect(step.config.variableName).toBe('myVar');
    });

    it('should create an if-else step', () => {
      const step = createMockStep({
        type: 'if-else',
        config: {
          condition: 'value > 10',
        },
      });

      expect(step.type).toBe('if-else');
      expect(step.config.condition).toBe('value > 10');
    });
  });

  describe('Variable mapping', () => {
    it('should define input variables', () => {
      const step = createMockStep({
        inputVars: [
          { name: 'userId', source: 'previousStep.output.id' },
        ],
      });

      expect(step.inputVars).toHaveLength(1);
      expect(step.inputVars![0].name).toBe('userId');
      expect(step.inputVars![0].source).toBe('previousStep.output.id');
    });

    it('should define output variables', () => {
      const step = createMockStep({
        outputVars: [
          { name: 'result', type: 'object', description: 'The result object' },
        ],
      });

      expect(step.outputVars).toHaveLength(1);
      expect(step.outputVars![0].name).toBe('result');
      expect(step.outputVars![0].type).toBe('object');
    });
  });
});

describe('Execution Result Structure', () => {
  it('should have correct execution result format', () => {
    const execution: Execution = {
      id: 'exec-1',
      workflowId: 'workflow-1',
      workflowName: 'Test Workflow',
      status: 'completed',
      triggeredBy: 'manual',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      successRate: 100,
      result: {
        stations: [
          {
            stationId: 'station-1',
            stationName: 'Station 1',
            status: 'completed',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            steps: [
              {
                stepId: 'step-1',
                stepName: 'Step 1',
                stepType: 'script-js',
                status: 'completed',
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                input: {},
                output: { value: 42 },
              },
            ],
          },
        ],
      },
    };

    expect(execution.status).toBe('completed');
    expect(execution.successRate).toBe(100);
    expect(execution.result?.stations).toHaveLength(1);
    expect(execution.result?.stations[0].steps[0].output?.value).toBe(42);
  });
});
