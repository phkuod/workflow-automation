import { Router } from 'express';
import { ExecutionModel } from '../models/execution';
import { WorkflowModel } from '../models/workflow';
import { scheduler } from '../services/scheduler';
import { createLogger } from '../utils/logger';

const router = Router();
const log = createLogger('metrics');

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
router.get('/', (req, res) => {
  try {
    // Fetch data
    const workflows = WorkflowModel.getAllUnlimited();
    const executions = ExecutionModel.getAll();
    const schedules = scheduler.getScheduledWorkflows();

    // Calculate workflow stats (single pass)
    const wCounts = { active: 0, paused: 0, draft: 0 };
    for (const w of workflows) {
      if (w.status in wCounts) wCounts[w.status as keyof typeof wCounts]++;
    }
    const workflowStats = { total: workflows.length, ...wCounts };

    // Calculate execution stats (single pass)
    const now = new Date();
    const last24HoursMs = now.getTime() - 24 * 60 * 60 * 1000;
    const last7DaysMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    let completed = 0, failed = 0, running = 0, last24h = 0, last7d = 0;
    for (const e of executions) {
      if (e.status === 'completed') completed++;
      else if (e.status === 'failed') failed++;
      else if (e.status === 'running') running++;
      const startMs = new Date(e.startTime).getTime();
      if (startMs >= last24HoursMs) last24h++;
      if (startMs >= last7DaysMs) last7d++;
    }

    const totalFinished = completed + failed;
    const executionStats = {
      total: executions.length,
      completed,
      failed,
      running,
      successRate: totalFinished > 0 ? Math.round((completed / totalFinished) * 100) : 0,
      last24Hours: last24h,
      last7Days: last7d,
    };

    // Calculate scheduler stats (single pass)
    let activeSchedules = 0;
    for (const s of schedules) {
      if (s.isActive) activeSchedules++;
    }
    const schedulerStats = {
      scheduledWorkflows: schedules.length,
      activeSchedules,
      pausedSchedules: schedules.length - activeSchedules,
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
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/metrics/executions/history
 * Get execution history over time
 */
router.get('/executions/history', (req, res) => {
  try {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days as string) || 7));
    const executions = ExecutionModel.getAll();
    
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
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
