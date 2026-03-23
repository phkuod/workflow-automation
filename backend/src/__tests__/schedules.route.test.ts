import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import schedulesRouter from '../routes/schedules';
import { scheduler } from '../services/scheduler';

// Mock dependencies
vi.mock('../services/scheduler', () => ({
  scheduler: {
    getScheduledWorkflows: vi.fn(),
    getScheduledWorkflow: vi.fn(),
    pauseWorkflow: vi.fn(),
    resumeWorkflow: vi.fn(),
    unscheduleWorkflow: vi.fn(),
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
app.use('/api/schedules', schedulesRouter);

describe('Schedules Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSchedule = {
    workflowId: 'wf-001',
    workflowName: 'Scheduled Workflow',
    cronExpression: '0 9 * * *',
    isActive: true,
    nextRun: new Date().toISOString(),
  };

  const mockSchedules = [
    mockSchedule,
    {
      workflowId: 'wf-002',
      workflowName: 'Another Scheduled',
      cronExpression: '*/5 * * * *',
      isActive: false,
    },
  ];

  // ─── GET /api/schedules ─────────────────────────────────────────────

  describe('GET /api/schedules', () => {
    it('should return a list of scheduled workflows', async () => {
      (scheduler.getScheduledWorkflows as any).mockReturnValue(mockSchedules);

      const response = await request(app).get('/api/schedules');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].workflowId).toBe('wf-001');
      expect(response.body.data[1].workflowId).toBe('wf-002');
      expect(scheduler.getScheduledWorkflows).toHaveBeenCalled();
    });

    it('should return 500 on unexpected error', async () => {
      (scheduler.getScheduledWorkflows as any).mockImplementation(() => {
        throw new Error('Scheduler failure');
      });

      const response = await request(app).get('/api/schedules');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'Internal server error' });
    });
  });

  // ─── GET /api/schedules/:workflowId ─────────────────────────────────

  describe('GET /api/schedules/:workflowId', () => {
    it('should return a scheduled workflow when found', async () => {
      (scheduler.getScheduledWorkflow as any).mockReturnValue(mockSchedule);

      const response = await request(app).get('/api/schedules/wf-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.workflowId).toBe('wf-001');
      expect(response.body.data.cronExpression).toBe('0 9 * * *');
      expect(scheduler.getScheduledWorkflow).toHaveBeenCalledWith('wf-001');
    });

    it('should return 404 when workflow is not scheduled', async () => {
      (scheduler.getScheduledWorkflow as any).mockReturnValue(null);

      const response = await request(app).get('/api/schedules/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Workflow is not scheduled' });
    });

    it('should return 500 on unexpected error', async () => {
      (scheduler.getScheduledWorkflow as any).mockImplementation(() => {
        throw new Error('Scheduler failure');
      });

      const response = await request(app).get('/api/schedules/wf-001');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'Internal server error' });
    });
  });

  // ─── PUT /api/schedules/:workflowId/pause ───────────────────────────

  describe('PUT /api/schedules/:workflowId/pause', () => {
    it('should pause a scheduled workflow', async () => {
      (scheduler.pauseWorkflow as any).mockReturnValue(true);

      const response = await request(app).put('/api/schedules/wf-001/pause');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Schedule paused');
      expect(scheduler.pauseWorkflow).toHaveBeenCalledWith('wf-001');
    });

    it('should return 404 when workflow is not scheduled or already paused', async () => {
      (scheduler.pauseWorkflow as any).mockReturnValue(false);

      const response = await request(app).put('/api/schedules/nonexistent/pause');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Workflow is not scheduled or already paused',
      });
    });

    it('should return 500 on unexpected error', async () => {
      (scheduler.pauseWorkflow as any).mockImplementation(() => {
        throw new Error('Scheduler failure');
      });

      const response = await request(app).put('/api/schedules/wf-001/pause');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'Internal server error' });
    });
  });

  // ─── PUT /api/schedules/:workflowId/resume ──────────────────────────

  describe('PUT /api/schedules/:workflowId/resume', () => {
    it('should resume a paused workflow', async () => {
      (scheduler.resumeWorkflow as any).mockReturnValue(true);

      const response = await request(app).put('/api/schedules/wf-001/resume');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Schedule resumed');
      expect(scheduler.resumeWorkflow).toHaveBeenCalledWith('wf-001');
    });

    it('should return 404 when workflow is not scheduled', async () => {
      (scheduler.resumeWorkflow as any).mockReturnValue(false);

      const response = await request(app).put('/api/schedules/nonexistent/resume');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Workflow is not scheduled',
      });
    });

    it('should return 500 on unexpected error', async () => {
      (scheduler.resumeWorkflow as any).mockImplementation(() => {
        throw new Error('Scheduler failure');
      });

      const response = await request(app).put('/api/schedules/wf-001/resume');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'Internal server error' });
    });
  });

  // ─── DELETE /api/schedules/:workflowId ──────────────────────────────

  describe('DELETE /api/schedules/:workflowId', () => {
    it('should remove a workflow from schedule', async () => {
      (scheduler.unscheduleWorkflow as any).mockReturnValue(true);

      const response = await request(app).delete('/api/schedules/wf-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Schedule removed');
      expect(scheduler.unscheduleWorkflow).toHaveBeenCalledWith('wf-001');
    });

    it('should return 404 when workflow is not scheduled', async () => {
      (scheduler.unscheduleWorkflow as any).mockReturnValue(false);

      const response = await request(app).delete('/api/schedules/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Workflow is not scheduled',
      });
    });
  });
});
