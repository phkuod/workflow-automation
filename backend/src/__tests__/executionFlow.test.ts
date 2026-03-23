import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Workflow, Station, Step } from '../types/workflow';

// Mock nodemailer to avoid SMTP errors
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-id' }) }) }
}));

// ── Helpers to build workflow objects ───────────────────────────────────

function makeStep(overrides: Partial<Step> & { id: string; name: string; type: Step['type'] }): Step {
  return {
    config: {},
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeStation(overrides: Partial<Station> & { id: string; name: string; steps: Step[] }): Station {
  return {
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeWorkflow(stations: Station[], extra?: Partial<Workflow>): Workflow {
  return {
    id: 'wf-test-' + Date.now(),
    name: 'Test Workflow',
    status: 'active',
    definition: { stations },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

// ── Test suite ─────────────────────────────────────────────────────────

describe('ExecutionEngine — Flow Tests', () => {
  let tmpDb: string;

  beforeEach(async () => {
    tmpDb = path.join(os.tmpdir(), `exec-flow-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    process.env.DB_PATH = tmpDb;
    vi.resetModules();

    // Initialize database so tables exist
    const { initDatabase } = await import('../db/database');
    await initDatabase();
  });

  afterEach(() => {
    delete process.env.DB_PATH;
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    vi.resetModules();
  });

  // Helper: insert workflow into DB and return the freshly-imported ExecutionEngine
  async function setupAndExecute(
    workflow: Workflow,
    opts: { simulate?: boolean; inputData?: Record<string, unknown> } = {},
  ) {
    const { WorkflowModel } = await import('../models/workflow');
    const { ExecutionEngine } = await import('../services/executionEngine');

    // Insert workflow into DB so ExecutionModel.create (FK) succeeds
    WorkflowModel.create({
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      definition: workflow.definition,
    });

    // WorkflowModel.create generates its own id; retrieve it so IDs match
    const allWorkflows = WorkflowModel.getAll();
    const dbWorkflow = allWorkflows[0];

    const execution = await ExecutionEngine.execute(
      dbWorkflow,
      'manual',
      opts.inputData ?? {},
      opts.simulate ?? false,
    );

    return { execution, dbWorkflow, ExecutionEngine };
  }

  // ── Single station execution ───────────────────────────────────────

  describe('Single station execution', () => {
    it('executes a workflow with a set-variable step and completes', async () => {
      const step = makeStep({
        id: 's1',
        name: 'Set greeting',
        type: 'set-variable',
        config: { variableName: 'greeting', variableValue: 'hello world' },
      });
      const station = makeStation({ id: 'st1', name: 'Init', steps: [step] });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('completed');
      expect(execution.successRate).toBe(100);
    });

    it('result contains station and step results', async () => {
      const step = makeStep({
        id: 's1',
        name: 'Set foo',
        type: 'set-variable',
        config: { variableName: 'foo', variableValue: 'bar' },
      });
      const station = makeStation({ id: 'st1', name: 'Stage A', steps: [step] });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.result).toBeDefined();
      expect(execution.result!.stations).toHaveLength(1);
      expect(execution.result!.stations[0].stationName).toBe('Stage A');
      expect(execution.result!.stations[0].steps).toHaveLength(1);
      expect(execution.result!.stations[0].steps[0].stepName).toBe('Set foo');
      expect(execution.result!.stations[0].steps[0].status).toBe('completed');
    });

    it('execution status is completed in DB', async () => {
      const step = makeStep({
        id: 's1',
        name: 'Set val',
        type: 'set-variable',
        config: { variableName: 'x', variableValue: '1' },
      });
      const station = makeStation({ id: 'st1', name: 'Only Station', steps: [step] });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow);

      // Also verify by fetching from DB directly
      const { ExecutionModel } = await import('../models/execution');
      const fromDb = ExecutionModel.getById(execution.id);
      expect(fromDb).toBeDefined();
      expect(fromDb!.status).toBe('completed');
    });
  });

  // ── Multi-station execution ────────────────────────────────────────

  describe('Multi-station execution', () => {
    it('executes multiple stations sequentially', async () => {
      const stationA = makeStation({
        id: 'stA',
        name: 'Station A',
        steps: [
          makeStep({
            id: 'sA1',
            name: 'Set a',
            type: 'set-variable',
            config: { variableName: 'a', variableValue: '1' },
          }),
        ],
      });
      const stationB = makeStation({
        id: 'stB',
        name: 'Station B',
        steps: [
          makeStep({
            id: 'sB1',
            name: 'Set b',
            type: 'set-variable',
            config: { variableName: 'b', variableValue: '2' },
          }),
        ],
      });
      const workflow = makeWorkflow([stationA, stationB]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('completed');
      expect(execution.result!.stations).toHaveLength(2);
    });

    it('each station result has correct status', async () => {
      const stationA = makeStation({
        id: 'stA',
        name: 'Station A',
        steps: [
          makeStep({
            id: 'sA1',
            name: 'Set x',
            type: 'set-variable',
            config: { variableName: 'x', variableValue: 'hello' },
          }),
        ],
      });
      const stationB = makeStation({
        id: 'stB',
        name: 'Station B',
        steps: [
          makeStep({
            id: 'sB1',
            name: 'Set y',
            type: 'set-variable',
            config: { variableName: 'y', variableValue: 'world' },
          }),
        ],
      });
      const workflow = makeWorkflow([stationA, stationB]);

      const { execution } = await setupAndExecute(workflow);

      for (const stationResult of execution.result!.stations) {
        expect(stationResult.status).toBe('completed');
      }
      expect(execution.successRate).toBe(100);
    });
  });

  // ── Script execution ──────────────────────────────────────────────

  describe('Script execution', () => {
    it('executes script-js step and captures output', async () => {
      const step = makeStep({
        id: 'sjs1',
        name: 'Add numbers',
        type: 'script-js',
        config: { code: 'return 2 + 3;' },
      });
      const station = makeStation({ id: 'st1', name: 'Compute', steps: [step] });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('completed');
      const stepResult = execution.result!.stations[0].steps[0];
      expect(stepResult.status).toBe('completed');
      expect(stepResult.output).toBeDefined();
    });

    it('script-js step with error results in failed status', async () => {
      const step = makeStep({
        id: 'sjs-err',
        name: 'Bad script',
        type: 'script-js',
        config: { code: 'throw new Error("intentional failure");' },
      });
      const station = makeStation({ id: 'st1', name: 'Fail Station', steps: [step] });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('failed');
      const stepResult = execution.result!.stations[0].steps[0];
      expect(stepResult.status).toBe('failed');
      expect(stepResult.error).toBeDefined();
      expect(stepResult.error!.message).toContain('intentional failure');
    });
  });

  // ── If-else branching ─────────────────────────────────────────────

  describe('If-else branching', () => {
    function makeIfElseWorkflow(conditionExpr: string) {
      const ifStep = makeStep({
        id: 'if1',
        name: 'Check condition',
        type: 'if-else',
        config: { condition: conditionExpr },
      });
      const trueStep = makeStep({
        id: 'true-step',
        name: 'True branch',
        type: 'set-variable',
        config: { variableName: 'branch', variableValue: 'took-true' },
      });
      const falseStep = makeStep({
        id: 'false-step',
        name: 'False branch',
        type: 'set-variable',
        config: { variableName: 'branch', variableValue: 'took-false' },
      });

      const station = makeStation({
        id: 'st-branch',
        name: 'Branch Station',
        steps: [ifStep, trueStep, falseStep],
        edges: [
          { id: 'e1', source: 'if1', target: 'true-step', sourceHandle: 'true' },
          { id: 'e2', source: 'if1', target: 'false-step', sourceHandle: 'false' },
        ],
      });

      return makeWorkflow([station]);
    }

    it('follows true branch when condition is true', async () => {
      const workflow = makeIfElseWorkflow('true');
      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('completed');

      const stationSteps = execution.result!.stations[0].steps;
      const trueResult = stationSteps.find(s => s.stepName === 'True branch');
      const falseResult = stationSteps.find(s => s.stepName === 'False branch');

      expect(trueResult).toBeDefined();
      expect(trueResult!.status).toBe('completed');
      expect(falseResult).toBeDefined();
      expect(falseResult!.status).toBe('skipped');
    });

    it('follows false branch when condition is false', async () => {
      const workflow = makeIfElseWorkflow('false');
      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('completed');

      const stationSteps = execution.result!.stations[0].steps;
      const trueResult = stationSteps.find(s => s.stepName === 'True branch');
      const falseResult = stationSteps.find(s => s.stepName === 'False branch');

      expect(trueResult).toBeDefined();
      expect(trueResult!.status).toBe('skipped');
      expect(falseResult).toBeDefined();
      expect(falseResult!.status).toBe('completed');
    });
  });

  // ── Simulate mode ─────────────────────────────────────────────────

  describe('Simulate mode', () => {
    it('simulate mode completes without side effects', async () => {
      const step = makeStep({
        id: 'sv1',
        name: 'Set var',
        type: 'set-variable',
        config: { variableName: 'simVar', variableValue: 'simulated' },
      });
      const station = makeStation({ id: 'st-sim', name: 'Sim Station', steps: [step] });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow, { simulate: true });

      expect(execution.status).toBe('completed');
      expect(execution.result!.stations).toHaveLength(1);
      expect(execution.result!.stations[0].steps[0].status).toBe('completed');
    });

    it('simulate mode skips HTTP requests and email', async () => {
      const httpStep = makeStep({
        id: 'http1',
        name: 'POST request',
        type: 'http-request',
        config: { url: 'https://example.com/api', method: 'POST', body: '{}' },
      });
      const emailStep = makeStep({
        id: 'email1',
        name: 'Send email',
        type: 'action-email',
        config: { emailTo: 'test@example.com', emailSubject: 'Test', emailBody: 'Body' },
      });
      const station = makeStation({
        id: 'st-side-effects',
        name: 'Side Effect Station',
        steps: [httpStep, emailStep],
      });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow, { simulate: true });

      expect(execution.status).toBe('completed');

      const httpResult = execution.result!.stations[0].steps.find(s => s.stepName === 'POST request');
      expect(httpResult!.status).toBe('completed');
      expect(httpResult!.output?.simulated).toBe(true);

      const emailResult = execution.result!.stations[0].steps.find(s => s.stepName === 'Send email');
      expect(emailResult!.status).toBe('completed');
      expect(emailResult!.output?.simulated).toBe(true);
      expect(emailResult!.output?.sent).toBe(false);
    });
  });

  // ── Error handling ────────────────────────────────────────────────

  describe('Error handling', () => {
    it('missing required input parameter throws error', async () => {
      const step = makeStep({
        id: 's1',
        name: 'Noop',
        type: 'set-variable',
        config: { variableName: 'a', variableValue: 'b' },
      });
      const station = makeStation({ id: 'st1', name: 'St', steps: [step] });
      const workflow = makeWorkflow([station]);
      workflow.definition.inputParameters = [
        { name: 'requiredParam', type: 'string', required: true },
      ];

      // WorkflowModel.create + ExecutionEngine.execute via setupAndExecute
      // but we need to call it without providing the required input
      const { WorkflowModel } = await import('../models/workflow');
      const { ExecutionEngine } = await import('../services/executionEngine');

      const created = WorkflowModel.create({
        name: workflow.name,
        status: workflow.status,
        definition: workflow.definition,
      });
      const dbWorkflow = WorkflowModel.getById(created.id)!;

      await expect(
        ExecutionEngine.execute(dbWorkflow, 'manual', {}, false),
      ).rejects.toThrow('Missing required input parameter: requiredParam');
    });

    it('step failure marks execution as failed', async () => {
      const step = makeStep({
        id: 'bad-step',
        name: 'Crash',
        type: 'script-js',
        config: { code: 'throw new Error("boom");' },
      });
      const station = makeStation({ id: 'st1', name: 'Boom Station', steps: [step] });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('failed');
      expect(execution.result!.error).toBeDefined();
      expect(execution.result!.error!.code).toBe('STATION_FAILED');
    });
  });

  // ── Variable passing ──────────────────────────────────────────────

  describe('Variable passing', () => {
    it('variables set in earlier steps are available in later steps', async () => {
      const step1 = makeStep({
        id: 'set-step',
        name: 'Set name',
        type: 'set-variable',
        config: { variableName: 'userName', variableValue: 'Alice' },
      });
      const step2 = makeStep({
        id: 'use-step',
        name: 'Use name',
        type: 'script-js',
        config: { code: 'return variables.userName;' },
      });
      const station = makeStation({
        id: 'st1',
        name: 'Var Station',
        steps: [step1, step2],
      });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('completed');

      const useStepResult = execution.result!.stations[0].steps.find(
        s => s.stepName === 'Use name',
      );
      expect(useStepResult).toBeDefined();
      expect(useStepResult!.status).toBe('completed');
      // The script returns the variable value which becomes the step output
      expect(useStepResult!.output).toBe('Alice');
    });

    it('variables from first station are accessible in second station', async () => {
      const stationA = makeStation({
        id: 'stA',
        name: 'Station A',
        steps: [
          makeStep({
            id: 'setA',
            name: 'Set greeting',
            type: 'set-variable',
            config: { variableName: 'greeting', variableValue: 'hi there' },
          }),
        ],
      });
      const stationB = makeStation({
        id: 'stB',
        name: 'Station B',
        steps: [
          makeStep({
            id: 'readA',
            name: 'Read greeting',
            type: 'script-js',
            config: { code: 'return variables.greeting;' },
          }),
        ],
      });
      const workflow = makeWorkflow([stationA, stationB]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('completed');

      const readStep = execution.result!.stations[1].steps[0];
      expect(readStep.status).toBe('completed');
      expect(readStep.output).toBe('hi there');
    });
  });

  // ── Wait step ──────────────────────────────────────────────────

  describe('Wait step', () => {
    it('wait step in simulate mode skips the actual wait', async () => {
      const step = makeStep({
        id: 'wait1',
        name: 'Short wait',
        type: 'wait',
        config: { duration: 60, unit: 'seconds' },
      });
      const station = makeStation({ id: 'st1', name: 'Wait Station', steps: [step] });
      const workflow = makeWorkflow([station]);

      const start = Date.now();
      const { execution } = await setupAndExecute(workflow, { simulate: true });
      const elapsed = Date.now() - start;

      expect(execution.status).toBe('completed');
      const waitResult = execution.result!.stations[0].steps[0];
      expect(waitResult.status).toBe('completed');
      expect(waitResult.output?.simulated).toBe(true);
      expect(waitResult.output?.waited).toBe(false);
      expect(waitResult.output?.ms).toBe(60000);
      // Should not actually wait 60 seconds
      expect(elapsed).toBeLessThan(5000);
    });

    it('wait step computes duration correctly for different units', async () => {
      const step = makeStep({
        id: 'wait-min',
        name: 'Wait minutes',
        type: 'wait',
        config: { duration: 2, unit: 'minutes' },
      });
      const station = makeStation({ id: 'st1', name: 'Min Station', steps: [step] });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow, { simulate: true });

      expect(execution.status).toBe('completed');
      const waitResult = execution.result!.stations[0].steps[0];
      expect(waitResult.output?.ms).toBe(120000); // 2 minutes = 120000ms
      expect(waitResult.output?.unit).toBe('minutes');
    });
  });

  // ── Station failure cascading ──────────────────────────────────

  describe('Station failure cascading', () => {
    it('station failure stops subsequent stations', async () => {
      const stationA = makeStation({
        id: 'stA',
        name: 'Failing Station',
        steps: [
          makeStep({
            id: 'fail-step',
            name: 'Crash',
            type: 'script-js',
            config: { code: 'throw new Error("station A failed");' },
          }),
        ],
      });
      const stationB = makeStation({
        id: 'stB',
        name: 'Never Reached',
        steps: [
          makeStep({
            id: 'ok-step',
            name: 'Should not run',
            type: 'set-variable',
            config: { variableName: 'x', variableValue: 'y' },
          }),
        ],
      });
      const workflow = makeWorkflow([stationA, stationB]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('failed');
      expect(execution.result!.error).toBeDefined();
      expect(execution.result!.error!.code).toBe('STATION_FAILED');
      // Only station A should have results — station B was never executed
      expect(execution.result!.stations).toHaveLength(1);
      expect(execution.result!.stations[0].stationName).toBe('Failing Station');
    });

    it('success rate reflects partial completion', async () => {
      const stationA = makeStation({
        id: 'stA',
        name: 'Good Station',
        steps: [
          makeStep({ id: 's1', name: 'OK', type: 'set-variable', config: { variableName: 'a', variableValue: '1' } }),
        ],
      });
      const stationB = makeStation({
        id: 'stB',
        name: 'Bad Station',
        steps: [
          makeStep({ id: 's2', name: 'OK too', type: 'set-variable', config: { variableName: 'b', variableValue: '2' } }),
          makeStep({ id: 's3', name: 'Boom', type: 'script-js', config: { code: 'throw new Error("fail");' } }),
        ],
      });
      const workflow = makeWorkflow([stationA, stationB]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('failed');
      // 3 total steps, 2 completed (s1 in stationA, s2 in stationB), 1 failed
      expect(execution.successRate).toBeCloseTo(66.67, 0);
    });
  });

  // ── Trigger steps ──────────────────────────────────────────────

  describe('Trigger steps', () => {
    it('trigger-manual step completes with triggered output', async () => {
      const step = makeStep({
        id: 't1',
        name: 'Manual Trigger',
        type: 'trigger-manual',
        config: {},
      });
      const station = makeStation({ id: 'st1', name: 'Trigger Station', steps: [step] });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('completed');
      const triggerResult = execution.result!.stations[0].steps[0];
      expect(triggerResult.status).toBe('completed');
      expect(triggerResult.output?.triggered).toBe(true);
    });

    it('trigger-cron step completes with triggered output', async () => {
      const step = makeStep({
        id: 't1',
        name: 'Cron Trigger',
        type: 'trigger-cron',
        config: { cronExpression: '*/5 * * * *' },
      });
      const station = makeStation({ id: 'st1', name: 'Cron Station', steps: [step] });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('completed');
      const triggerResult = execution.result!.stations[0].steps[0];
      expect(triggerResult.status).toBe('completed');
      expect(triggerResult.output?.triggered).toBe(true);
    });
  });

  // ── Notification/action steps in simulate mode ─────────────────

  describe('Notification steps in simulate mode', () => {
    it('notification-slack is skipped in simulate mode', async () => {
      const step = makeStep({
        id: 'slack1',
        name: 'Slack Notify',
        type: 'notification-slack',
        config: { slackWebhookUrl: 'https://hooks.slack.com/test', slackMessage: 'Hello!' },
      });
      const station = makeStation({ id: 'st1', name: 'Notify Station', steps: [step] });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow, { simulate: true });

      expect(execution.status).toBe('completed');
      const slackResult = execution.result!.stations[0].steps[0];
      expect(slackResult.status).toBe('completed');
      expect(slackResult.output?.simulated).toBe(true);
      expect(slackResult.output?.sent).toBe(false);
      expect(slackResult.output?.message).toBe('Hello!');
    });

    it('action-email is skipped in simulate mode', async () => {
      const step = makeStep({
        id: 'email1',
        name: 'Send Email',
        type: 'action-email',
        config: { emailTo: 'user@example.com', emailSubject: 'Test', emailBody: 'Body text' },
      });
      const station = makeStation({ id: 'st1', name: 'Email Station', steps: [step] });
      const workflow = makeWorkflow([station]);

      const { execution } = await setupAndExecute(workflow, { simulate: true });

      expect(execution.status).toBe('completed');
      const emailResult = execution.result!.stations[0].steps[0];
      expect(emailResult.status).toBe('completed');
      expect(emailResult.output?.simulated).toBe(true);
      expect(emailResult.output?.sent).toBe(false);
      expect(emailResult.output?.to).toBe('user@example.com');
      expect(emailResult.output?.subject).toBe('Test');
    });
  });

  // ── Station condition ──────────────────────────────────────────

  describe('Station condition', () => {
    it('skips station when expression condition evaluates false', async () => {
      const stationA = makeStation({
        id: 'stA',
        name: 'Always Runs',
        steps: [
          makeStep({ id: 's1', name: 'Set val', type: 'set-variable', config: { variableName: 'skip', variableValue: 'true' } }),
        ],
      });
      const stationB: Station = {
        ...makeStation({
          id: 'stB',
          name: 'Conditional Station',
          steps: [
            makeStep({ id: 's2', name: 'Never runs', type: 'set-variable', config: { variableName: 'x', variableValue: '1' } }),
          ],
        }),
        condition: { type: 'expression', expression: 'false' },
      };
      const workflow = makeWorkflow([stationA, stationB]);

      const { execution } = await setupAndExecute(workflow);

      expect(execution.status).toBe('completed');
      expect(execution.result!.stations).toHaveLength(2);
      expect(execution.result!.stations[0].status).toBe('completed');
      expect(execution.result!.stations[1].status).toBe('skipped');
      // Steps within skipped station should also be skipped
      expect(execution.result!.stations[1].steps[0].status).toBe('skipped');
    });
  });
});
