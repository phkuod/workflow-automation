import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import executionsRouter from '../routes/executions';
import { ExecutionModel, LogModel } from '../models/execution';
import { executionManager } from '../services/executionManager';
import { executionEventBus } from '../services/executionEventBus';
import { Execution, ExecutionLog } from '../types/workflow';

// Mock dependencies
vi.mock('../models/execution', () => ({
  ExecutionModel: {
    getAll: vi.fn(),
    getById: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
  LogModel: {
    getByExecutionId: vi.fn(),
  },
}));

vi.mock('../services/executionManager', () => ({
  executionManager: {
    cancel: vi.fn(),
  },
}));

vi.mock('../services/executionEventBus', () => ({
  executionEventBus: {
    on: vi.fn(),
    off: vi.fn(),
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
app.use('/api/executions', executionsRouter);

describe('Executions Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockExecution: Execution = {
    id: 'exec-001',
    workflowId: 'wf-001',
    workflowName: 'Test Workflow',
    status: 'completed',
    triggeredBy: 'manual',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    successRate: 100,
  };

  const mockRunningExecution: Execution = {
    id: 'exec-002',
    workflowId: 'wf-001',
    workflowName: 'Test Workflow',
    status: 'running',
    triggeredBy: 'manual',
    startTime: new Date().toISOString(),
    successRate: 0,
  };

  const mockLogs: ExecutionLog[] = [
    {
      id: 'log-001',
      executionId: 'exec-001',
      stationId: 'station-1',
      stepId: 'step-1',
      level: 'info',
      message: 'Step started',
      timestamp: new Date().toISOString(),
    },
  ];

  // ─── GET /api/executions ────────────────────────────────────────────

  describe('GET /api/executions', () => {
    it('should return executions with default limit 50', async () => {
      (ExecutionModel.getAll as any).mockReturnValue([mockExecution]);

      const response = await request(app).get('/api/executions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('exec-001');
      expect(ExecutionModel.getAll).toHaveBeenCalledWith(50);
    });

    it('should accept a custom limit query parameter', async () => {
      (ExecutionModel.getAll as any).mockReturnValue([]);

      const response = await request(app).get('/api/executions?limit=10');

      expect(response.status).toBe(200);
      expect(ExecutionModel.getAll).toHaveBeenCalledWith(10);
    });

    it('should clamp limit to range 1-200', async () => {
      (ExecutionModel.getAll as any).mockReturnValue([]);

      const response = await request(app).get('/api/executions?limit=500');

      expect(response.status).toBe(200);
      expect(ExecutionModel.getAll).toHaveBeenCalledWith(200);
    });

    it('should clamp limit minimum to 1', async () => {
      (ExecutionModel.getAll as any).mockReturnValue([]);

      const response = await request(app).get('/api/executions?limit=-5');

      expect(response.status).toBe(200);
      expect(ExecutionModel.getAll).toHaveBeenCalledWith(1);
    });

    it('should fallback to 50 when limit is NaN', async () => {
      (ExecutionModel.getAll as any).mockReturnValue([]);

      const response = await request(app).get('/api/executions?limit=abc');

      expect(response.status).toBe(200);
      expect(ExecutionModel.getAll).toHaveBeenCalledWith(50);
    });

    it('should return 500 on unexpected error', async () => {
      (ExecutionModel.getAll as any).mockImplementation(() => {
        throw new Error('DB failure');
      });

      const response = await request(app).get('/api/executions');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'Internal server error' });
    });
  });

  // ─── GET /api/executions/:id ────────────────────────────────────────

  describe('GET /api/executions/:id', () => {
    it('should return an execution when found', async () => {
      (ExecutionModel.getById as any).mockReturnValue(mockExecution);

      const response = await request(app).get('/api/executions/exec-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('exec-001');
      expect(response.body.data.workflowName).toBe('Test Workflow');
      expect(ExecutionModel.getById).toHaveBeenCalledWith('exec-001');
    });

    it('should return 404 when execution is not found', async () => {
      (ExecutionModel.getById as any).mockReturnValue(null);

      const response = await request(app).get('/api/executions/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Execution not found' });
    });

    it('should return 500 on unexpected error', async () => {
      (ExecutionModel.getById as any).mockImplementation(() => {
        throw new Error('DB failure');
      });

      const response = await request(app).get('/api/executions/exec-001');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'Internal server error' });
    });
  });

  // ─── GET /api/executions/:id/logs ───────────────────────────────────

  describe('GET /api/executions/:id/logs', () => {
    it('should return logs when execution is found', async () => {
      (ExecutionModel.getById as any).mockReturnValue(mockExecution);
      (LogModel.getByExecutionId as any).mockReturnValue(mockLogs);

      const response = await request(app).get('/api/executions/exec-001/logs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].message).toBe('Step started');
      expect(LogModel.getByExecutionId).toHaveBeenCalledWith('exec-001');
    });

    it('should return 404 when execution does not exist', async () => {
      (ExecutionModel.getById as any).mockReturnValue(null);

      const response = await request(app).get('/api/executions/nonexistent/logs');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Execution not found' });
      expect(LogModel.getByExecutionId).not.toHaveBeenCalled();
    });

    it('should return 500 on unexpected error', async () => {
      (ExecutionModel.getById as any).mockImplementation(() => {
        throw new Error('DB failure');
      });

      const response = await request(app).get('/api/executions/exec-001/logs');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'Internal server error' });
    });
  });

  // ─── DELETE /api/executions/:id ─────────────────────────────────────

  describe('DELETE /api/executions/:id', () => {
    it('should delete an execution successfully', async () => {
      (ExecutionModel.delete as any).mockReturnValue(true);

      const response = await request(app).delete('/api/executions/exec-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ deleted: true });
      expect(ExecutionModel.delete).toHaveBeenCalledWith('exec-001');
    });

    it('should return 404 when execution is not found', async () => {
      (ExecutionModel.delete as any).mockReturnValue(false);

      const response = await request(app).delete('/api/executions/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Execution not found' });
    });

    it('should return 500 on unexpected error', async () => {
      (ExecutionModel.delete as any).mockImplementation(() => {
        throw new Error('DB failure');
      });

      const response = await request(app).delete('/api/executions/exec-001');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'Internal server error' });
    });
  });

  // ─── POST /api/executions/:id/cancel ────────────────────────────────

  describe('POST /api/executions/:id/cancel', () => {
    it('should cancel a running execution', async () => {
      (ExecutionModel.getById as any).mockReturnValue(mockRunningExecution);
      (executionManager.cancel as any).mockReturnValue(true);
      (ExecutionModel.update as any).mockReturnValue(undefined);

      const response = await request(app).post('/api/executions/exec-002/cancel');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ cancelled: true });
      expect(executionManager.cancel).toHaveBeenCalledWith('exec-002');
      expect(ExecutionModel.update).toHaveBeenCalledWith('exec-002', {
        status: 'cancelled',
        endTime: expect.any(String),
      });
    });

    it('should return 404 when execution is not found', async () => {
      (ExecutionModel.getById as any).mockReturnValue(null);

      const response = await request(app).post('/api/executions/nonexistent/cancel');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Execution not found' });
      expect(executionManager.cancel).not.toHaveBeenCalled();
    });

    it('should return 409 when execution is not running', async () => {
      (ExecutionModel.getById as any).mockReturnValue(mockExecution); // status: 'completed'

      const response = await request(app).post('/api/executions/exec-001/cancel');

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        success: false,
        error: "Cannot cancel execution with status 'completed' - only running executions can be cancelled",
      });
      expect(executionManager.cancel).not.toHaveBeenCalled();
    });
  });

  // ─── GET /api/executions/:id/stream ─────────────────────────────────

  describe('GET /api/executions/:id/stream', () => {
    it('should send a connected event on SSE connection', (done) => {
      const req = request(app)
        .get('/api/executions/exec-001/stream')
        .set('Accept', 'text/event-stream');

      req.buffer(true)
        .parse((res: any, callback: any) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
            if (data.includes('"connected"')) {
              res.destroy();
            }
          });
          res.on('end', () => callback(null, data));
          res.on('error', () => callback(null, data));
          res.on('close', () => callback(null, data));
        })
        .end((err: any, res: any) => {
          expect(res.status).toBe(200);
          expect(String(res.body)).toContain('data: {"type":"connected"}');
          done();
        });
    });

    it('should register event handler on executionEventBus', (done) => {
      const req = request(app)
        .get('/api/executions/exec-123/stream')
        .set('Accept', 'text/event-stream');

      req.buffer(true)
        .parse((res: any, callback: any) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
            if (data.includes('"connected"')) {
              res.destroy();
            }
          });
          res.on('end', () => callback(null, data));
          res.on('error', () => callback(null, data));
          res.on('close', () => callback(null, data));
        })
        .end((err: any, res: any) => {
          expect(res.status).toBe(200);
          expect(executionEventBus.on).toHaveBeenCalledWith('execution:exec-123', expect.any(Function));
          done();
        });
    });

    it('should forward execution events and close on terminal event', (done) => {
      // Capture the handler registered on the event bus
      let capturedHandler: ((event: any) => void) | null = null;
      (executionEventBus.on as any).mockImplementation((_event: string, handler: (event: any) => void) => {
        capturedHandler = handler;
      });

      const req = request(app)
        .get('/api/executions/exec-001/stream')
        .set('Accept', 'text/event-stream');

      req.buffer(true)
        .parse((res: any, callback: any) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
            // After connected event, emit a terminal event via the captured handler
            if (capturedHandler && data.includes('"connected"') && !data.includes('execution:complete')) {
              capturedHandler({
                executionId: 'exec-001',
                type: 'execution:complete',
                data: { timestamp: new Date().toISOString() },
              });
            }
          });
          res.on('end', () => callback(null, data));
          res.on('error', () => callback(null, data));
          res.on('close', () => callback(null, data));
        })
        .end((err: any, res: any) => {
          expect(res.status).toBe(200);
          const body = String(res.body);
          expect(body).toContain('"type":"connected"');
          expect(body).toContain('"type":"execution:complete"');
          done();
        });
    });
  });
});
