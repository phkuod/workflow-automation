import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import metricsRouter from '../routes/metrics';
import { WorkflowModel } from '../models/workflow';
import { ExecutionModel } from '../models/execution';
import { scheduler } from '../services/scheduler';
import { Workflow, Execution } from '../types/workflow';

// Mock dependencies
vi.mock('../models/workflow', () => ({
  WorkflowModel: {
    getAll: vi.fn(),
    getAllUnlimited: vi.fn(),
  },
}));

vi.mock('../models/execution', () => ({
  ExecutionModel: {
    getAll: vi.fn(),
  },
}));

vi.mock('../services/scheduler', () => ({
  scheduler: {
    getScheduledWorkflows: vi.fn(),
  },
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/api/metrics', metricsRouter);

describe('Metrics Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const now = new Date();

  const mockWorkflows: Partial<Workflow>[] = [
    { id: 'wf-1', name: 'Active 1', status: 'active' },
    { id: 'wf-2', name: 'Active 2', status: 'active' },
    { id: 'wf-3', name: 'Paused', status: 'paused' },
    { id: 'wf-4', name: 'Draft', status: 'draft' },
  ];

  const mockExecutions: Partial<Execution>[] = [
    { id: 'e1', status: 'completed', startTime: now.toISOString() },
    { id: 'e2', status: 'completed', startTime: now.toISOString() },
    { id: 'e3', status: 'failed', startTime: now.toISOString() },
    { id: 'e4', status: 'running', startTime: now.toISOString() },
  ];

  const mockSchedules = [
    { workflowId: 'wf-1', isActive: true },
    { workflowId: 'wf-2', isActive: false },
    { workflowId: 'wf-3', isActive: true },
  ];

  // ─── GET /api/metrics ───────────────────────────────────────────────

  describe('GET /api/metrics', () => {
    it('should return metrics with correct top-level structure', async () => {
      (WorkflowModel.getAllUnlimited as any).mockReturnValue(mockWorkflows);
      (ExecutionModel.getAll as any).mockReturnValue(mockExecutions);
      (scheduler.getScheduledWorkflows as any).mockReturnValue(mockSchedules);

      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const data = response.body.data;
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('workflows');
      expect(data).toHaveProperty('executions');
      expect(data).toHaveProperty('scheduler');
      expect(data).toHaveProperty('system');
    });

    it('should return correct workflow counts', async () => {
      (WorkflowModel.getAllUnlimited as any).mockReturnValue(mockWorkflows);
      (ExecutionModel.getAll as any).mockReturnValue([]);
      (scheduler.getScheduledWorkflows as any).mockReturnValue([]);

      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(200);
      const wf = response.body.data.workflows;
      expect(wf.total).toBe(4);
      expect(wf.active).toBe(2);
      expect(wf.paused).toBe(1);
      expect(wf.draft).toBe(1);
    });

    it('should return correct execution statistics', async () => {
      (WorkflowModel.getAllUnlimited as any).mockReturnValue([]);
      (ExecutionModel.getAll as any).mockReturnValue(mockExecutions);
      (scheduler.getScheduledWorkflows as any).mockReturnValue([]);

      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(200);
      const exec = response.body.data.executions;
      expect(exec.total).toBe(4);
      expect(exec.completed).toBe(2);
      expect(exec.failed).toBe(1);
      expect(exec.running).toBe(1);
      // successRate = round(2 / (2+1) * 100) = 67
      expect(exec.successRate).toBe(67);
      // All executions have startTime of now, so they are within last 24 hours and 7 days
      expect(exec.last24Hours).toBe(4);
      expect(exec.last7Days).toBe(4);
    });

    it('should return successRate 0 when no finished executions exist', async () => {
      const runningOnly: Partial<Execution>[] = [
        { id: 'e1', status: 'running', startTime: now.toISOString() },
      ];
      (WorkflowModel.getAllUnlimited as any).mockReturnValue([]);
      (ExecutionModel.getAll as any).mockReturnValue(runningOnly);
      (scheduler.getScheduledWorkflows as any).mockReturnValue([]);

      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.executions.successRate).toBe(0);
    });

    it('should return correct scheduler statistics', async () => {
      (WorkflowModel.getAllUnlimited as any).mockReturnValue([]);
      (ExecutionModel.getAll as any).mockReturnValue([]);
      (scheduler.getScheduledWorkflows as any).mockReturnValue(mockSchedules);

      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(200);
      const sched = response.body.data.scheduler;
      expect(sched.scheduledWorkflows).toBe(3);
      expect(sched.activeSchedules).toBe(2);
      expect(sched.pausedSchedules).toBe(1);
    });

    it('should include system info with memory and node version', async () => {
      (WorkflowModel.getAllUnlimited as any).mockReturnValue([]);
      (ExecutionModel.getAll as any).mockReturnValue([]);
      (scheduler.getScheduledWorkflows as any).mockReturnValue([]);

      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(200);
      const sys = response.body.data.system;
      expect(sys).toHaveProperty('memoryUsage');
      expect(sys.memoryUsage).toHaveProperty('heapUsed');
      expect(sys.memoryUsage).toHaveProperty('heapTotal');
      expect(sys.memoryUsage).toHaveProperty('external');
      expect(sys.memoryUsage).toHaveProperty('rss');
      expect(sys).toHaveProperty('nodeVersion');
      expect(sys.nodeVersion).toBe(process.version);
    });

    it('should return 500 on unexpected error', async () => {
      (WorkflowModel.getAllUnlimited as any).mockImplementation(() => {
        throw new Error('DB failure');
      });

      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'Internal server error' });
    });
  });

  // ─── GET /api/metrics/executions/history ────────────────────────────

  describe('GET /api/metrics/executions/history', () => {
    it('should return history with default 7 days', async () => {
      (ExecutionModel.getAll as any).mockReturnValue([]);

      const response = await request(app).get('/api/metrics/executions/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(7);
      // Each entry should have date, completed, failed, total
      for (const entry of response.body.data) {
        expect(entry).toHaveProperty('date');
        expect(entry).toHaveProperty('completed');
        expect(entry).toHaveProperty('failed');
        expect(entry).toHaveProperty('total');
      }
    });

    it('should accept custom days parameter', async () => {
      (ExecutionModel.getAll as any).mockReturnValue([]);

      const response = await request(app).get('/api/metrics/executions/history?days=14');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(14);
    });

    it('should clamp days minimum to 1', async () => {
      (ExecutionModel.getAll as any).mockReturnValue([]);

      // parseInt('-5') returns -5 (truthy), then Math.max(1, ...) clamps to 1
      const response = await request(app).get('/api/metrics/executions/history?days=-5');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should aggregate executions by date', async () => {
      const today = new Date().toISOString().split('T')[0];
      const todayExecutions: Partial<Execution>[] = [
        { id: 'e1', status: 'completed', startTime: `${today}T10:00:00.000Z` },
        { id: 'e2', status: 'failed', startTime: `${today}T11:00:00.000Z` },
        { id: 'e3', status: 'completed', startTime: `${today}T12:00:00.000Z` },
      ];
      (ExecutionModel.getAll as any).mockReturnValue(todayExecutions);

      const response = await request(app).get('/api/metrics/executions/history?days=7');

      expect(response.status).toBe(200);
      const todayEntry = response.body.data.find((d: any) => d.date === today);
      expect(todayEntry).toBeDefined();
      expect(todayEntry.total).toBe(3);
      expect(todayEntry.completed).toBe(2);
      expect(todayEntry.failed).toBe(1);
    });

    it('should return 500 on unexpected error', async () => {
      (ExecutionModel.getAll as any).mockImplementation(() => {
        throw new Error('DB failure');
      });

      const response = await request(app).get('/api/metrics/executions/history');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'Internal server error' });
    });
  });
});
