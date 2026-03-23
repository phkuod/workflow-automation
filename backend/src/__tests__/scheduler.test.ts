import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Workflow } from '../types/workflow';

// Mock dependencies
vi.mock('node-cron', () => ({
  default: {
    validate: vi.fn().mockReturnValue(true),
    schedule: vi.fn().mockReturnValue({ stop: vi.fn(), start: vi.fn() }),
  },
}));

vi.mock('cron-parser', () => ({
  CronExpressionParser: {
    parse: vi.fn().mockReturnValue({
      next: () => ({ toDate: () => new Date('2026-01-01T00:00:00Z') }),
    }),
  },
}));

vi.mock('../models/workflow', () => ({
  WorkflowModel: {
    getAll: vi.fn().mockReturnValue([]),
    getById: vi.fn(),
  },
}));

vi.mock('../services/executionEngine', () => ({
  ExecutionEngine: {
    execute: vi.fn().mockResolvedValue({
      id: 'exec-1',
      status: 'completed',
      workflowId: 'wf-1',
      workflowName: 'Test',
      triggeredBy: 'schedule',
      startTime: new Date().toISOString(),
      successRate: 100,
    }),
  },
}));

import cron from 'node-cron';
import { WorkflowModel } from '../models/workflow';
import { ExecutionEngine } from '../services/executionEngine';
import { scheduler } from '../services/scheduler';

// Helper: build a mock Workflow with a cron trigger
function makeCronWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 'wf-1',
    name: 'Scheduled Workflow',
    status: 'active',
    definition: {
      stations: [
        {
          id: 'station-1',
          name: 'Start',
          position: { x: 0, y: 0 },
          steps: [
            {
              id: 'step-1',
              name: 'Cron Trigger',
              type: 'trigger-cron',
              position: { x: 0, y: 0 },
              config: { cronExpression: '*/5 * * * *' },
            },
          ],
        },
      ],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper: build a mock Workflow without a cron trigger
function makeManualWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 'wf-manual',
    name: 'Manual Workflow',
    status: 'active',
    definition: {
      stations: [
        {
          id: 'station-1',
          name: 'Start',
          position: { x: 0, y: 0 },
          steps: [
            {
              id: 'step-1',
              name: 'Manual Trigger',
              type: 'trigger-manual',
              position: { x: 0, y: 0 },
              config: {},
            },
          ],
        },
      ],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('SchedulerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default mock return values after clearAllMocks resets them
    (cron.validate as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (cron.schedule as ReturnType<typeof vi.fn>).mockReturnValue({
      stop: vi.fn(),
      start: vi.fn(),
    });
  });

  afterEach(async () => {
    // Reset the singleton state between tests
    await scheduler.shutdown();
  });

  describe('initialize', () => {
    it('schedules active workflows with cron triggers', async () => {
      const workflow = makeCronWorkflow();
      (WorkflowModel.getAll as ReturnType<typeof vi.fn>).mockReturnValue([workflow]);

      await scheduler.initialize();

      expect(WorkflowModel.getAll).toHaveBeenCalledOnce();
      expect(cron.validate).toHaveBeenCalledWith('*/5 * * * *');
      expect(cron.schedule).toHaveBeenCalledWith(
        '*/5 * * * *',
        expect.any(Function),
        expect.objectContaining({ timezone: 'UTC' }),
      );

      const scheduled = scheduler.getScheduledWorkflows();
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].workflowId).toBe('wf-1');
      expect(scheduled[0].cronExpression).toBe('*/5 * * * *');
      expect(scheduled[0].isActive).toBe(true);
    });

    it('skips non-active workflows', async () => {
      const draftWorkflow = makeCronWorkflow({ id: 'wf-draft', status: 'draft' });
      const pausedWorkflow = makeCronWorkflow({ id: 'wf-paused', status: 'paused' });
      (WorkflowModel.getAll as ReturnType<typeof vi.fn>).mockReturnValue([
        draftWorkflow,
        pausedWorkflow,
      ]);

      await scheduler.initialize();

      expect(cron.schedule).not.toHaveBeenCalled();
      expect(scheduler.getScheduledWorkflows()).toHaveLength(0);
    });

    it('skips workflows without cron trigger', async () => {
      const manualWorkflow = makeManualWorkflow();
      (WorkflowModel.getAll as ReturnType<typeof vi.fn>).mockReturnValue([manualWorkflow]);

      await scheduler.initialize();

      expect(cron.schedule).not.toHaveBeenCalled();
      expect(scheduler.getScheduledWorkflows()).toHaveLength(0);
    });

    it('does not re-initialize if already initialized', async () => {
      (WorkflowModel.getAll as ReturnType<typeof vi.fn>).mockReturnValue([]);

      await scheduler.initialize();
      await scheduler.initialize();

      // getAll should only be called once because the second call exits early
      expect(WorkflowModel.getAll).toHaveBeenCalledOnce();
    });
  });

  describe('scheduleWorkflow', () => {
    it('validates cron expression and returns false for invalid', () => {
      (cron.validate as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const workflow = makeCronWorkflow();
      const result = scheduler.scheduleWorkflow(workflow, 'bad-cron');

      expect(cron.validate).toHaveBeenCalledWith('bad-cron');
      expect(result).toBe(false);
      expect(cron.schedule).not.toHaveBeenCalled();
      expect(scheduler.getScheduledWorkflows()).toHaveLength(0);
    });

    it('creates scheduled task for valid expression', () => {
      const workflow = makeCronWorkflow();
      const result = scheduler.scheduleWorkflow(workflow, '0 * * * *');

      expect(result).toBe(true);
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 * * * *',
        expect.any(Function),
        expect.objectContaining({ timezone: 'UTC' }),
      );

      const scheduled = scheduler.getScheduledWorkflows();
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].workflowId).toBe('wf-1');
      expect(scheduled[0].workflowName).toBe('Scheduled Workflow');
      expect(scheduled[0].cronExpression).toBe('0 * * * *');
      expect(scheduled[0].isActive).toBe(true);
      expect(scheduled[0].nextRun).toEqual(new Date('2026-01-01T00:00:00Z'));
    });

    it('replaces existing schedule for same workflow', () => {
      const stopFn = vi.fn();
      (cron.schedule as ReturnType<typeof vi.fn>).mockReturnValue({
        stop: stopFn,
        start: vi.fn(),
      });

      const workflow = makeCronWorkflow();

      // Schedule the first time
      scheduler.scheduleWorkflow(workflow, '0 * * * *');
      expect(scheduler.getScheduledWorkflows()).toHaveLength(1);

      // Schedule again with a different expression
      scheduler.scheduleWorkflow(workflow, '*/10 * * * *');

      // The previous task should have been stopped
      expect(stopFn).toHaveBeenCalled();
      // Still only one entry in the map
      expect(scheduler.getScheduledWorkflows()).toHaveLength(1);
      expect(scheduler.getScheduledWorkflows()[0].cronExpression).toBe('*/10 * * * *');
    });
  });

  describe('unscheduleWorkflow', () => {
    it('stops and removes scheduled workflow', () => {
      const stopFn = vi.fn();
      (cron.schedule as ReturnType<typeof vi.fn>).mockReturnValue({
        stop: stopFn,
        start: vi.fn(),
      });

      const workflow = makeCronWorkflow();
      scheduler.scheduleWorkflow(workflow, '0 * * * *');

      const result = scheduler.unscheduleWorkflow('wf-1');

      expect(result).toBe(true);
      expect(stopFn).toHaveBeenCalled();
      expect(scheduler.getScheduledWorkflows()).toHaveLength(0);
    });

    it('returns false for non-existent workflow', () => {
      const result = scheduler.unscheduleWorkflow('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('pauseWorkflow', () => {
    it('pauses an active scheduled workflow', () => {
      const stopFn = vi.fn();
      (cron.schedule as ReturnType<typeof vi.fn>).mockReturnValue({
        stop: stopFn,
        start: vi.fn(),
      });

      const workflow = makeCronWorkflow();
      scheduler.scheduleWorkflow(workflow, '0 * * * *');

      const result = scheduler.pauseWorkflow('wf-1');

      expect(result).toBe(true);
      expect(stopFn).toHaveBeenCalled();

      const scheduled = scheduler.getScheduledWorkflows();
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].isActive).toBe(false);
    });

    it('returns false for non-existent workflow', () => {
      const result = scheduler.pauseWorkflow('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('resumeWorkflow', () => {
    it('resumes a paused scheduled workflow', () => {
      const stopFn = vi.fn();
      const startFn = vi.fn();
      (cron.schedule as ReturnType<typeof vi.fn>).mockReturnValue({
        stop: stopFn,
        start: startFn,
      });

      const workflow = makeCronWorkflow();
      scheduler.scheduleWorkflow(workflow, '0 * * * *');
      scheduler.pauseWorkflow('wf-1');

      const result = scheduler.resumeWorkflow('wf-1');

      expect(result).toBe(true);
      expect(startFn).toHaveBeenCalled();

      const scheduled = scheduler.getScheduledWorkflows();
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].isActive).toBe(true);
      expect(scheduled[0].nextRun).toEqual(new Date('2026-01-01T00:00:00Z'));
    });

    it('returns false for non-existent workflow', () => {
      const result = scheduler.resumeWorkflow('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getScheduledWorkflows', () => {
    it('returns all scheduled workflows without task property', () => {
      const wf1 = makeCronWorkflow({ id: 'wf-1', name: 'First' });
      const wf2 = makeCronWorkflow({ id: 'wf-2', name: 'Second' });

      scheduler.scheduleWorkflow(wf1, '0 * * * *');
      scheduler.scheduleWorkflow(wf2, '*/30 * * * *');

      const scheduled = scheduler.getScheduledWorkflows();

      expect(scheduled).toHaveLength(2);
      // Ensure the task property is not leaked
      for (const entry of scheduled) {
        expect(entry).not.toHaveProperty('task');
        expect(entry).toHaveProperty('workflowId');
        expect(entry).toHaveProperty('workflowName');
        expect(entry).toHaveProperty('cronExpression');
        expect(entry).toHaveProperty('isActive');
      }
    });

    it('returns empty array when none scheduled', () => {
      const scheduled = scheduler.getScheduledWorkflows();

      expect(scheduled).toEqual([]);
    });
  });

  describe('shutdown', () => {
    it('stops all tasks and clears map', async () => {
      const stopFn = vi.fn();
      (cron.schedule as ReturnType<typeof vi.fn>).mockReturnValue({
        stop: stopFn,
        start: vi.fn(),
      });

      const wf1 = makeCronWorkflow({ id: 'wf-1' });
      const wf2 = makeCronWorkflow({ id: 'wf-2' });

      scheduler.scheduleWorkflow(wf1, '0 * * * *');
      scheduler.scheduleWorkflow(wf2, '*/15 * * * *');

      expect(scheduler.getScheduledWorkflows()).toHaveLength(2);

      await scheduler.shutdown();

      // stop() should have been called for each task
      expect(stopFn).toHaveBeenCalledTimes(2);
      expect(scheduler.getScheduledWorkflows()).toHaveLength(0);
    });
  });

  describe('cron callback behavior', () => {
    // Helper to capture the cron callback from the mock
    function getCronCallback(): () => Promise<void> {
      const scheduleCall = (cron.schedule as ReturnType<typeof vi.fn>).mock.calls;
      // The callback is the second argument to cron.schedule
      return scheduleCall[scheduleCall.length - 1][1];
    }

    it('re-fetches workflow from DB and executes it', async () => {
      const workflow = makeCronWorkflow();
      (WorkflowModel.getById as ReturnType<typeof vi.fn>).mockReturnValue(workflow);

      scheduler.scheduleWorkflow(workflow, '0 * * * *');
      const callback = getCronCallback();

      await callback();

      expect(WorkflowModel.getById).toHaveBeenCalledWith('wf-1');
      expect(ExecutionEngine.execute).toHaveBeenCalledWith(workflow, 'schedule');
    });

    it('skips execution when workflow is no longer found', async () => {
      const workflow = makeCronWorkflow();
      scheduler.scheduleWorkflow(workflow, '0 * * * *');
      const callback = getCronCallback();

      (WorkflowModel.getById as ReturnType<typeof vi.fn>).mockReturnValue(null);

      await callback();

      expect(WorkflowModel.getById).toHaveBeenCalledWith('wf-1');
      expect(ExecutionEngine.execute).not.toHaveBeenCalled();
    });

    it('skips execution when workflow status is no longer active', async () => {
      const workflow = makeCronWorkflow();
      scheduler.scheduleWorkflow(workflow, '0 * * * *');
      const callback = getCronCallback();

      // Workflow was updated to paused since scheduling
      (WorkflowModel.getById as ReturnType<typeof vi.fn>).mockReturnValue(
        makeCronWorkflow({ status: 'paused' }),
      );

      await callback();

      expect(WorkflowModel.getById).toHaveBeenCalledWith('wf-1');
      expect(ExecutionEngine.execute).not.toHaveBeenCalled();
    });

    it('handles execution failure gracefully without crashing', async () => {
      const workflow = makeCronWorkflow();
      (WorkflowModel.getById as ReturnType<typeof vi.fn>).mockReturnValue(workflow);
      (ExecutionEngine.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('DB connection lost'),
      );

      scheduler.scheduleWorkflow(workflow, '0 * * * *');
      const callback = getCronCallback();

      // Should not throw — error is caught internally
      await expect(callback()).resolves.toBeUndefined();
    });
  });
});
