import cron, { ScheduledTask } from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { WorkflowModel } from '../models/workflow';
import { ExecutionEngine } from './executionEngine';
import type { Workflow, Execution } from '../types/workflow';

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
      console.log('[Scheduler] Already initialized');
      return;
    }

    console.log('[Scheduler] Initializing scheduler service...');
    
    try {
      const workflows = await WorkflowModel.getAll();
      let scheduledCount = 0;

      for (const workflow of workflows) {
        if (workflow.status !== 'active') continue;

        const cronStep = this.findCronTrigger(workflow);
        if (cronStep && cronStep.config.cronExpression) {
          await this.scheduleWorkflow(workflow, cronStep.config.cronExpression);
          scheduledCount++;
        }
      }

      this.isInitialized = true;
      console.log(`[Scheduler] Initialized with ${scheduledCount} scheduled workflow(s)`);
    } catch (error) {
      console.error('[Scheduler] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Schedule a workflow to run on a cron expression
   */
  async scheduleWorkflow(workflow: Workflow, cronExpression: string): Promise<boolean> {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      console.error(`[Scheduler] Invalid cron expression: ${cronExpression}`);
      return false;
    }

    // Stop existing schedule if any
    this.unscheduleWorkflow(workflow.id);

    console.log(`[Scheduler] Scheduling workflow "${workflow.name}" with cron: ${cronExpression}`);

    const task = cron.schedule(cronExpression, async () => {
      console.log(`[Scheduler] Executing scheduled workflow: ${workflow.name}`);
      
      const scheduled = this.scheduledWorkflows.get(workflow.id);
      if (scheduled) {
        scheduled.lastRun = new Date();
      }

      try {
        // Re-fetch the workflow in case it was updated
        const latestWorkflow = await WorkflowModel.getById(workflow.id);
        if (!latestWorkflow) {
          console.error(`[Scheduler] Workflow ${workflow.id} not found`);
          return;
        }

        if (latestWorkflow.status !== 'active') {
          console.log(`[Scheduler] Workflow ${workflow.name} is not active, skipping`);
          return;
        }

        const execution = await ExecutionEngine.execute(latestWorkflow, 'schedule');
        
        if (scheduled) {
          scheduled.lastExecution = execution;
        }

        console.log(`[Scheduler] Workflow "${workflow.name}" completed with status: ${execution.status}`);
      } catch (error) {
        console.error(`[Scheduler] Failed to execute workflow "${workflow.name}":`, error);
      }
    }, {
      timezone: 'Asia/Taipei',
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
    console.log(`[Scheduler] Unscheduled workflow: ${scheduled.workflowName}`);
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
    console.log(`[Scheduler] Paused workflow: ${scheduled.workflowName}`);
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
    console.log(`[Scheduler] Resumed workflow: ${scheduled.workflowName}`);
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
   * Find the cron trigger step in a workflow
   */
  private findCronTrigger(workflow: Workflow): { config: { cronExpression?: string } } | null {
    for (const station of workflow.definition.stations) {
      for (const step of station.steps) {
        if (step.type === 'trigger-cron') {
          return step;
        }
      }
    }
    return null;
  }

  /**
   * Calculate the next run date for a cron expression
   */
  private getNextRunDate(cronExpression: string): Date | undefined {
    try {
      const interval = CronExpressionParser.parse(cronExpression, {
        tz: 'Asia/Taipei'
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
    console.log('[Scheduler] Shutting down...');
    for (const [id, scheduled] of this.scheduledWorkflows) {
      scheduled.task.stop();
    }
    this.scheduledWorkflows.clear();
    this.isInitialized = false;
    console.log('[Scheduler] Shutdown complete');
  }
}

// Export singleton instance
export const scheduler = new SchedulerService();
