import cron, { ScheduledTask } from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { WorkflowModel } from '../models/workflow';
import { ExecutionEngine } from './executionEngine';
import { createLogger } from '../utils/logger';
import { findTriggerStep } from '../utils/workflowHelpers';
import type { Workflow, Execution } from '../types/workflow';

const log = createLogger('scheduler');

const SCHEDULER_TIMEZONE = process.env.SCHEDULER_TIMEZONE || 'UTC';

interface ScheduledWorkflow {
  workflowId: string;
  workflowName: string;
  cronExpression: string;
  task: ScheduledTask;
  isActive: boolean;
  nextRun?: Date;
  lastRun?: Date;
  lastExecution?: Execution;
}

class SchedulerService {
  private scheduledWorkflows: Map<string, ScheduledWorkflow> = new Map();
  private isInitialized: boolean = false;

  /**
   * Initialize the scheduler and load all active scheduled workflows
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      log.info('Already initialized');
      return;
    }

    log.info('Initializing scheduler service...');

    try {
      const workflows = WorkflowModel.getAllUnlimited();
      let scheduledCount = 0;

      for (const workflow of workflows) {
        if (workflow.status !== 'active') continue;

        const cronStep = findTriggerStep(workflow, 'trigger-cron');
        if (cronStep && cronStep.config.cronExpression) {
          this.scheduleWorkflow(workflow, cronStep.config.cronExpression);
          scheduledCount++;
        }
      }

      this.isInitialized = true;
      log.info(`Initialized with ${scheduledCount} scheduled workflow(s)`);
    } catch (error) {
      log.error({ err: error }, 'Failed to initialize');
      throw error;
    }
  }

  /**
   * Schedule a workflow to run on a cron expression
   */
  scheduleWorkflow(workflow: Workflow, cronExpression: string): boolean {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      log.error(`Invalid cron expression: ${cronExpression}`);
      return false;
    }

    // Stop existing schedule if any
    this.unscheduleWorkflow(workflow.id);

    log.info(`Scheduling workflow "${workflow.name}" with cron: ${cronExpression}`);

    const task = cron.schedule(cronExpression, async () => {
      log.info(`Executing scheduled workflow: ${workflow.name}`);

      const scheduled = this.scheduledWorkflows.get(workflow.id);
      if (scheduled) {
        scheduled.lastRun = new Date();
      }

      try {
        // Re-fetch the workflow in case it was updated
        const latestWorkflow = WorkflowModel.getById(workflow.id);
        if (!latestWorkflow) {
          log.error(`Workflow ${workflow.id} not found`);
          return;
        }

        if (latestWorkflow.status !== 'active') {
          log.info(`Workflow ${workflow.name} is not active, skipping`);
          return;
        }

        const execution = await ExecutionEngine.execute(latestWorkflow, 'schedule');

        if (scheduled) {
          scheduled.lastExecution = execution;
        }

        log.info(`Workflow "${workflow.name}" completed with status: ${execution.status}`);
      } catch (error) {
        log.error({ err: error }, `Failed to execute workflow "${workflow.name}"`);
      }
    }, {
      timezone: SCHEDULER_TIMEZONE,
    });

    this.scheduledWorkflows.set(workflow.id, {
      workflowId: workflow.id,
      workflowName: workflow.name,
      cronExpression,
      task,
      isActive: true,
      nextRun: this.getNextRunDate(cronExpression),
    });

    return true;
  }

  /**
   * Unschedule a workflow
   */
  unscheduleWorkflow(workflowId: string): boolean {
    const scheduled = this.scheduledWorkflows.get(workflowId);
    if (!scheduled) {
      return false;
    }

    scheduled.task.stop();
    this.scheduledWorkflows.delete(workflowId);
    log.info(`Unscheduled workflow: ${scheduled.workflowName}`);
    return true;
  }

  /**
   * Pause a scheduled workflow
   */
  pauseWorkflow(workflowId: string): boolean {
    const scheduled = this.scheduledWorkflows.get(workflowId);
    if (!scheduled) {
      return false;
    }

    scheduled.task.stop();
    scheduled.isActive = false;
    log.info(`Paused workflow: ${scheduled.workflowName}`);
    return true;
  }

  /**
   * Resume a paused workflow
   */
  resumeWorkflow(workflowId: string): boolean {
    const scheduled = this.scheduledWorkflows.get(workflowId);
    if (!scheduled) {
      return false;
    }

    scheduled.task.start();
    scheduled.isActive = true;
    scheduled.nextRun = this.getNextRunDate(scheduled.cronExpression);
    log.info(`Resumed workflow: ${scheduled.workflowName}`);
    return true;
  }

  /**
   * Get all scheduled workflows
   */
  getScheduledWorkflows(): Array<Omit<ScheduledWorkflow, 'task'>> {
    return Array.from(this.scheduledWorkflows.values()).map(({ task, ...rest }) => rest);
  }

  /**
   * Get a specific scheduled workflow
   */
  getScheduledWorkflow(workflowId: string): Omit<ScheduledWorkflow, 'task'> | null {
    const scheduled = this.scheduledWorkflows.get(workflowId);
    if (!scheduled) return null;

    const { task, ...rest } = scheduled;
    return rest;
  }

  /**
   * Calculate the next run date for a cron expression
   */
  private getNextRunDate(cronExpression: string): Date | undefined {
    try {
      const interval = CronExpressionParser.parse(cronExpression, {
        tz: SCHEDULER_TIMEZONE
      });
      return interval.next().toDate();
    } catch {
      return undefined;
    }
  }

  /**
   * Shutdown the scheduler
   */
  async shutdown(): Promise<void> {
    log.info('Shutting down...');
    for (const [, scheduled] of this.scheduledWorkflows) {
      scheduled.task.stop();
    }
    this.scheduledWorkflows.clear();
    this.isInitialized = false;
    log.info('Shutdown complete');
  }
}

// Export singleton instance
export const scheduler = new SchedulerService();
