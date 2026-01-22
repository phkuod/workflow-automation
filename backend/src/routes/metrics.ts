import { Router } from 'express';
import { ExecutionModel } from '../models/execution';
import { WorkflowModel } from '../models/workflow';
import { scheduler } from '../services/scheduler';

const router = Router();

interface Metrics {
  timestamp: string;
  uptime: number;
  workflows: {
    total: number;
    active: number;
    paused: number;
    draft: number;
  };
  executions: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    successRate: number;
    last24Hours: number;
    last7Days: number;
  };
  scheduler: {
    scheduledWorkflows: number;
    activeSchedules: number;
    pausedSchedules: number;
  };
  system: {
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
    nodeVersion: string;
  };
}

/**
 * GET /api/metrics
 * Get system metrics and statistics
 */
router.get('/', async (req, res) => {
  try {
    // Fetch data
    const workflows = await WorkflowModel.getAll();
    const executions = await ExecutionModel.getAll();
    const schedules = scheduler.getScheduledWorkflows();

    // Calculate workflow stats
    const workflowStats = {
      total: workflows.length,
      active: workflows.filter(w => w.status === 'active').length,
      paused: workflows.filter(w => w.status === 'paused').length,
      draft: workflows.filter(w => w.status === 'draft').length,
    };

    // Calculate execution stats
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const completedExecutions = executions.filter(e => e.status === 'completed');
    const failedExecutions = executions.filter(e => e.status === 'failed');
    const runningExecutions = executions.filter(e => e.status === 'running');
    
    const executionsLast24h = executions.filter(e => 
      new Date(e.startTime) >= last24Hours
    ).length;
    
    const executionsLast7d = executions.filter(e => 
      new Date(e.startTime) >= last7Days
    ).length;

    const totalFinished = completedExecutions.length + failedExecutions.length;
    const successRate = totalFinished > 0 
      ? Math.round((completedExecutions.length / totalFinished) * 100) 
      : 0;

    const executionStats = {
      total: executions.length,
      completed: completedExecutions.length,
      failed: failedExecutions.length,
      running: runningExecutions.length,
      successRate,
      last24Hours: executionsLast24h,
      last7Days: executionsLast7d,
    };

    // Calculate scheduler stats
    const schedulerStats = {
      scheduledWorkflows: schedules.length,
      activeSchedules: schedules.filter(s => s.isActive).length,
      pausedSchedules: schedules.filter(s => !s.isActive).length,
    };

    // System metrics
    const memoryUsage = process.memoryUsage();
    const systemStats = {
      memoryUsage: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      nodeVersion: process.version,
    };

    const metrics: Metrics = {
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      workflows: workflowStats,
      executions: executionStats,
      scheduler: schedulerStats,
      system: systemStats,
    };

    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/metrics/executions/history
 * Get execution history over time
 */
router.get('/executions/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const executions = await ExecutionModel.getAll();
    
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // Group by day
    const history: Record<string, { completed: number; failed: number; total: number }> = {};
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = date.toISOString().split('T')[0];
      history[key] = { completed: 0, failed: 0, total: 0 };
    }

    executions
      .filter(e => new Date(e.startTime) >= startDate)
      .forEach(e => {
        const key = e.startTime.split('T')[0];
        if (history[key]) {
          history[key].total++;
          if (e.status === 'completed') history[key].completed++;
          if (e.status === 'failed') history[key].failed++;
        }
      });

    const data = Object.entries(history)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
