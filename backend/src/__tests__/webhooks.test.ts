import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import webhooksRouter from '../routes/webhooks';
import { WorkflowModel } from '../models/workflow';
import { ExecutionEngine } from '../services/executionEngine';
import { Workflow } from '../types/workflow';

// Mock dependencies
vi.mock('../models/workflow', () => ({
  WorkflowModel: {
    getById: vi.fn(),
  },
}));

vi.mock('../services/executionEngine', () => ({
  ExecutionEngine: {
    execute: vi.fn().mockResolvedValue({ id: 'mock-exec-id' }),
  },
}));

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/api/webhooks', webhooksRouter);

describe('Webhooks Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockActiveWorkflow: Workflow = {
    id: 'workflow-123',
    name: 'Test Webhook',
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
              name: 'Trigger',
              type: 'trigger-webhook',
              position: { x: 0, y: 0 },
              config: { webhookMethod: 'POST' },
            },
          ],
        },
      ],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should return 404 if workflow is not found', async () => {
    (WorkflowModel.getById as any).mockReturnValue(null);

    const response = await request(app).post('/api/webhooks/unknown-id').send({});
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, error: 'Workflow not found' });
  });

  it('should return 403 if workflow is not active', async () => {
    (WorkflowModel.getById as any).mockReturnValue({ ...mockActiveWorkflow, status: 'paused' });

    const response = await request(app).post('/api/webhooks/workflow-123').send({});
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ success: false, error: 'Workflow is not active' });
  });

  it('should return 400 if workflow has no webhook trigger', async () => {
    const noWebhookWorkflow = {
      ...mockActiveWorkflow,
      definition: {
        stations: [
          {
            id: 'station-1',
            name: 'Start',
            position: { x: 0, y: 0 },
            steps: [{ id: 'step-1', name: 'Trigger', type: 'trigger-manual' as any, position: { x: 0, y: 0 }, config: {} }],
          },
        ],
      },
    };
    (WorkflowModel.getById as any).mockReturnValue(noWebhookWorkflow);

    const response = await request(app).post('/api/webhooks/workflow-123').send({});
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: 'Workflow does not have a webhook trigger' });
  });

  it('should return 405 if HTTP method does not match expected webhook method', async () => {
    (WorkflowModel.getById as any).mockReturnValue(mockActiveWorkflow); // Expects POST

    const response = await request(app).get('/api/webhooks/workflow-123'); // Send GET
    expect(response.status).toBe(405);
    expect(response.body).toEqual({ success: false, error: 'Method GET not allowed. Expected POST' });
  });

  it('should allow any method if webhookMethod is configured as "any"', async () => {
    const anyMethodWorkflow = {
      ...mockActiveWorkflow,
      definition: {
        stations: [
          {
            id: 's', name: 's', position: { x: 0, y: 0 },
            steps: [{ id: '1', name: '1', type: 'trigger-webhook' as any, position: { x: 0, y: 0 }, config: { webhookMethod: 'any' } }]
          }
        ]
      }
    };
    (WorkflowModel.getById as any).mockReturnValue(anyMethodWorkflow);

    const response = await request(app).patch('/api/webhooks/workflow-123').send({ data: 'hello' });
    expect(response.status).toBe(202);
    expect(ExecutionEngine.execute).toHaveBeenCalled();
  });

  it('should return 202 and trigger ExecutionEngine on success', async () => {
    (WorkflowModel.getById as any).mockReturnValue(mockActiveWorkflow); // Expects POST

    const payload = { event: 'user_signup', userId: 99 };
    const response = await request(app).post('/api/webhooks/workflow-123').send(payload);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      success: true,
      message: 'Webhook received and execution started',
      executionId: 'async',
    });

    // Check that ExecutionEngine was called with the correct inputData
    expect(ExecutionEngine.execute).toHaveBeenCalledWith(
      mockActiveWorkflow,
      'webhook',
      expect.objectContaining({
        body: payload,
        method: 'POST',
      })
    );
  });
});
