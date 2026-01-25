import { describe, it, expect } from 'vitest';
import type { Workflow, Station, Step, StepType } from '../../types/workflow';
import { STEP_TYPE_INFO } from '../../types/workflow';

describe('Workflow Types', () => {
  describe('StepType', () => {
    it('should have all required step types defined', () => {
      const requiredTypes: StepType[] = [
        'trigger-manual',
        'trigger-cron',
        'http-request',
        'script-js',
        'script-python',
        'set-variable',
        'if-else',
      ];

      requiredTypes.forEach((type) => {
        expect(STEP_TYPE_INFO[type]).toBeDefined();
        expect(STEP_TYPE_INFO[type].label).toBeDefined();
        expect(STEP_TYPE_INFO[type].icon).toBeDefined();
        expect(STEP_TYPE_INFO[type].color).toBeDefined();
      });
    });

    it('should have proper properties for each step type', () => {
      Object.values(STEP_TYPE_INFO).forEach((info) => {
        expect(typeof info.icon).toBe('string');
        expect(typeof info.label).toBe('string');
        expect(typeof info.color).toBe('string');
        expect(info.label.length).toBeGreaterThan(0);
        expect(info.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });

  describe('Workflow structure', () => {
    it('should create a valid workflow object', () => {
      const workflow: Workflow = {
        id: 'test-1',
        name: 'Test Workflow',
        description: 'A test workflow',
        status: 'active',
        definition: {
          stations: [],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(workflow.id).toBe('test-1');
      expect(workflow.status).toBe('active');
      expect(workflow.definition.stations).toHaveLength(0);
    });

    it('should create workflow with stations and steps', () => {
      const step: Step = {
        id: 'step-1',
        name: 'Test Step',
        type: 'script-js',
        config: { code: 'return 42;' },
        position: { x: 0, y: 0 },
      };

      const station: Station = {
        id: 'station-1',
        name: 'Test Station',
        steps: [step],
        position: { x: 0, y: 0 },
      };

      const workflow: Workflow = {
        id: 'test-2',
        name: 'Test Workflow',
        description: '',
        status: 'draft',
        definition: {
          stations: [station],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(workflow.definition.stations).toHaveLength(1);
      expect(workflow.definition.stations[0].steps).toHaveLength(1);
      expect(workflow.definition.stations[0].steps[0].type).toBe('script-js');
    });
  });

  describe('Step input/output variables', () => {
    it('should support input variables', () => {
      const step: Step = {
        id: 'step-1',
        name: 'Test Step',
        type: 'http-request',
        config: { url: 'https://api.example.com' },
        position: { x: 0, y: 0 },
        inputVars: [
          { name: 'userId', source: 'previousStep.output.id' },
        ],
      };

      expect(step.inputVars).toHaveLength(1);
      expect(step.inputVars![0].name).toBe('userId');
    });

    it('should support output variables', () => {
      const step: Step = {
        id: 'step-1',
        name: 'Test Step',
        type: 'script-js',
        config: { code: 'return data;' },
        position: { x: 0, y: 0 },
        outputVars: [
          { name: 'result', type: 'object', description: 'Result data' },
        ],
      };

      expect(step.outputVars).toHaveLength(1);
      expect(step.outputVars![0].type).toBe('object');
    });
  });
});
