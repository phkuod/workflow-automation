import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import workflowsRouter from '../routes/workflows';
import { WorkflowModel } from '../models/workflow';
import { ExecutionModel } from '../models/execution';
import { VersionModel } from '../models/version';
import { ExecutionEngine } from '../services/executionEngine';
import { scheduler } from '../services/scheduler';
import { Workflow } from '../types/workflow';

// Mock dependencies
vi.mock('../models/workflow', () => ({
  WorkflowModel: {
    getAll: vi.fn(),
    count: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../models/execution', () => ({
  ExecutionModel: {
    getByWorkflowId: vi.fn(),
  },
}));

vi.mock('../models/version', () => ({
  VersionModel: {
    getLatestVersion: vi.fn(),
    create: vi.fn(),
    deleteOldVersions: vi.fn(),
    getByWorkflowId: vi.fn(),
    getByVersion: vi.fn(),
  },
}));

vi.mock('../services/executionEngine', () => ({
  ExecutionEngine: {
    execute: vi.fn(),
  },
}));

vi.mock('../services/scheduler', () => ({
  scheduler: {
    scheduleWorkflow: vi.fn(),
    unscheduleWorkflow: vi.fn(),
  },
}));

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/api/workflows', workflowsRouter);

describe('Workflows Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockWorkflow: Workflow = {
    id: 'wf-001',
    name: 'Test Workflow',
    description: 'A test workflow',
    status: 'draft',
    definition: {
      stations: [
        {
          id: 'station-1',
          name: 'Station One',
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
  };

  // ─── GET / ───────────────────────────────────────────────────────────

  describe('GET /api/workflows', () => {
    it('should return a list of workflows with total, limit, and offset', async () => {
      (WorkflowModel.getAll as any).mockReturnValue([mockWorkflow]);
      (WorkflowModel.count as any).mockReturnValue(1);

      const response = await request(app).get('/api/workflows');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('wf-001');
      expect(response.body.total).toBe(1);
      expect(response.body.limit).toBe(100);
      expect(response.body.offset).toBe(0);
      expect(WorkflowModel.getAll).toHaveBeenCalledWith(100, 0);
    });

    it('should respect limit and offset query params', async () => {
      (WorkflowModel.getAll as any).mockReturnValue([]);
      (WorkflowModel.count as any).mockReturnValue(0);

      const response = await request(app).get('/api/workflows?limit=10&offset=5');

      expect(response.status).toBe(200);
      expect(WorkflowModel.getAll).toHaveBeenCalledWith(10, 5);
      expect(response.body.limit).toBe(10);
      expect(response.body.offset).toBe(5);
    });
  });

  // ─── GET /:id ────────────────────────────────────────────────────────

  describe('GET /api/workflows/:id', () => {
    it('should return a workflow when found', async () => {
      (WorkflowModel.getById as any).mockReturnValue(mockWorkflow);

      const response = await request(app).get('/api/workflows/wf-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('wf-001');
      expect(response.body.data.name).toBe('Test Workflow');
      expect(WorkflowModel.getById).toHaveBeenCalledWith('wf-001');
    });

    it('should return 404 when workflow is not found', async () => {
      (WorkflowModel.getById as any).mockReturnValue(null);

      const response = await request(app).get('/api/workflows/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Workflow not found' });
    });
  });

  // ─── POST / ──────────────────────────────────────────────────────────

  describe('POST /api/workflows', () => {
    it('should create a workflow and return 201', async () => {
      const createData = {
        name: 'New Workflow',
        definition: { stations: [] },
      };
      (WorkflowModel.create as any).mockReturnValue({ ...mockWorkflow, ...createData, id: 'wf-new' });

      const response = await request(app).post('/api/workflows').send(createData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Workflow');
      expect(WorkflowModel.create).toHaveBeenCalledWith(createData);
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app).post('/api/workflows').send({
        definition: { stations: [] },
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ success: false, error: 'Name is required' });
      expect(WorkflowModel.create).not.toHaveBeenCalled();
    });

    it('should return 400 when definition is missing', async () => {
      const response = await request(app).post('/api/workflows').send({
        name: 'No Definition',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ success: false, error: 'Definition is required' });
      expect(WorkflowModel.create).not.toHaveBeenCalled();
    });
  });

  // ─── PUT /:id ────────────────────────────────────────────────────────

  describe('PUT /api/workflows/:id', () => {
    it('should update a workflow successfully', async () => {
      const updatedWorkflow = { ...mockWorkflow, name: 'Updated Name' };
      (WorkflowModel.update as any).mockReturnValue(updatedWorkflow);

      const response = await request(app)
        .put('/api/workflows/wf-001')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(WorkflowModel.update).toHaveBeenCalledWith('wf-001', { name: 'Updated Name' });
    });

    it('should return 404 when updating a non-existent workflow', async () => {
      (WorkflowModel.update as any).mockReturnValue(null);

      const response = await request(app)
        .put('/api/workflows/nonexistent')
        .send({ name: 'Does Not Matter' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Workflow not found' });
    });

    it('should auto-version when definition changes', async () => {
      const newDefinition = {
        stations: [
          {
            id: 'station-2',
            name: 'New Station',
            position: { x: 100, y: 100 },
            steps: [],
          },
        ],
      };

      // getById is called to save the current definition before updating
      (WorkflowModel.getById as any).mockReturnValue(mockWorkflow);
      (VersionModel.getLatestVersion as any).mockReturnValue(2);
      (VersionModel.create as any).mockReturnValue({});
      (VersionModel.deleteOldVersions as any).mockReturnValue(undefined);
      (WorkflowModel.update as any).mockReturnValue({ ...mockWorkflow, definition: newDefinition });

      const response = await request(app)
        .put('/api/workflows/wf-001')
        .send({ definition: newDefinition });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify auto-versioning happened
      expect(WorkflowModel.getById).toHaveBeenCalledWith('wf-001');
      expect(VersionModel.getLatestVersion).toHaveBeenCalledWith('wf-001');
      expect(VersionModel.create).toHaveBeenCalledWith('wf-001', 3, mockWorkflow.definition);
      expect(VersionModel.deleteOldVersions).toHaveBeenCalledWith('wf-001');
    });
  });

  // ─── DELETE /:id ─────────────────────────────────────────────────────

  describe('DELETE /api/workflows/:id', () => {
    it('should delete a workflow and unschedule it', async () => {
      (WorkflowModel.delete as any).mockReturnValue(true);

      const response = await request(app).delete('/api/workflows/wf-001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ deleted: true });
      expect(WorkflowModel.delete).toHaveBeenCalledWith('wf-001');
      expect(scheduler.unscheduleWorkflow).toHaveBeenCalledWith('wf-001');
    });

    it('should return 404 when deleting a non-existent workflow', async () => {
      (WorkflowModel.delete as any).mockReturnValue(false);

      const response = await request(app).delete('/api/workflows/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Workflow not found' });
      expect(scheduler.unscheduleWorkflow).not.toHaveBeenCalled();
    });
  });

  // ─── POST /:id/execute ──────────────────────────────────────────────

  describe('POST /api/workflows/:id/execute', () => {
    it('should execute a workflow successfully', async () => {
      const mockExecution = {
        id: 'exec-001',
        workflowId: 'wf-001',
        workflowName: 'Test Workflow',
        status: 'completed',
        triggeredBy: 'manual',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        successRate: 100,
      };
      (WorkflowModel.getById as any).mockReturnValue(mockWorkflow);
      (ExecutionEngine.execute as any).mockResolvedValue(mockExecution);

      const response = await request(app)
        .post('/api/workflows/wf-001/execute')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('exec-001');
      expect(ExecutionEngine.execute).toHaveBeenCalledWith(mockWorkflow, 'manual', {});
    });

    it('should return 404 when workflow is not found', async () => {
      (WorkflowModel.getById as any).mockReturnValue(null);

      const response = await request(app)
        .post('/api/workflows/nonexistent/execute')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Workflow not found' });
      expect(ExecutionEngine.execute).not.toHaveBeenCalled();
    });
  });

  // ─── POST /:id/simulate ─────────────────────────────────────────────

  describe('POST /api/workflows/:id/simulate', () => {
    it('should simulate a workflow successfully', async () => {
      const mockExecution = {
        id: 'exec-sim-001',
        workflowId: 'wf-001',
        workflowName: 'Test Workflow',
        status: 'completed',
        triggeredBy: 'manual',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        successRate: 100,
      };
      (WorkflowModel.getById as any).mockReturnValue(mockWorkflow);
      (ExecutionEngine.execute as any).mockResolvedValue(mockExecution);

      const response = await request(app)
        .post('/api/workflows/wf-001/simulate')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('exec-sim-001');
      // simulate passes true as the 4th argument (dryRun)
      expect(ExecutionEngine.execute).toHaveBeenCalledWith(mockWorkflow, 'manual', {}, true);
    });

    it('should return 404 when workflow is not found', async () => {
      (WorkflowModel.getById as any).mockReturnValue(null);

      const response = await request(app)
        .post('/api/workflows/nonexistent/simulate')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Workflow not found' });
      expect(ExecutionEngine.execute).not.toHaveBeenCalled();
    });
  });

  // ─── GET /:id/executions ────────────────────────────────────────────

  describe('GET /api/workflows/:id/executions', () => {
    it('should return executions for a workflow', async () => {
      const mockExecutions = [
        {
          id: 'exec-001',
          workflowId: 'wf-001',
          workflowName: 'Test Workflow',
          status: 'completed',
          triggeredBy: 'manual',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          successRate: 100,
        },
      ];
      (WorkflowModel.getById as any).mockReturnValue(mockWorkflow);
      (ExecutionModel.getByWorkflowId as any).mockReturnValue(mockExecutions);

      const response = await request(app).get('/api/workflows/wf-001/executions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('exec-001');
      expect(ExecutionModel.getByWorkflowId).toHaveBeenCalledWith('wf-001', 20);
    });

    it('should return 404 when workflow is not found', async () => {
      (WorkflowModel.getById as any).mockReturnValue(null);

      const response = await request(app).get('/api/workflows/nonexistent/executions');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Workflow not found' });
      expect(ExecutionModel.getByWorkflowId).not.toHaveBeenCalled();
    });
  });

  // ─── GET /:id/versions ──────────────────────────────────────────

  describe('GET /api/workflows/:id/versions', () => {
    it('should return versions for a workflow', async () => {
      const mockVersions = [
        { id: 'v3', workflowId: 'wf-001', version: 3, definition: { stations: [] }, createdAt: new Date().toISOString() },
        { id: 'v2', workflowId: 'wf-001', version: 2, definition: { stations: [] }, createdAt: new Date().toISOString() },
      ];
      (VersionModel.getByWorkflowId as any).mockReturnValue(mockVersions);

      const response = await request(app).get('/api/workflows/wf-001/versions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].version).toBe(3);
      expect(VersionModel.getByWorkflowId).toHaveBeenCalledWith('wf-001');
    });

    it('should return empty array when no versions exist', async () => {
      (VersionModel.getByWorkflowId as any).mockReturnValue([]);

      const response = await request(app).get('/api/workflows/wf-001/versions');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });

  // ─── GET /:id/versions/:version ─────────────────────────────────

  describe('GET /api/workflows/:id/versions/:version', () => {
    it('should return a specific version', async () => {
      const mockVersion = {
        id: 'v2',
        workflowId: 'wf-001',
        version: 2,
        definition: mockWorkflow.definition,
        changeSummary: 'Updated steps',
        createdAt: new Date().toISOString(),
      };
      (VersionModel.getByVersion as any).mockReturnValue(mockVersion);

      const response = await request(app).get('/api/workflows/wf-001/versions/2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.version).toBe(2);
      expect(response.body.data.changeSummary).toBe('Updated steps');
      expect(VersionModel.getByVersion).toHaveBeenCalledWith('wf-001', 2);
    });

    it('should return 404 for non-existent version', async () => {
      (VersionModel.getByVersion as any).mockReturnValue(null);

      const response = await request(app).get('/api/workflows/wf-001/versions/99');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Version not found' });
    });
  });

  // ─── POST /:id/versions/:version/restore ────────────────────────

  describe('POST /api/workflows/:id/versions/:version/restore', () => {
    it('should restore a version and auto-version current definition', async () => {
      const oldDefinition = { stations: [{ id: 'old', name: 'Old', position: { x: 0, y: 0 }, steps: [] }] };
      const mockVersion = {
        id: 'v1',
        workflowId: 'wf-001',
        version: 1,
        definition: oldDefinition,
        createdAt: new Date().toISOString(),
      };
      (VersionModel.getByVersion as any).mockReturnValue(mockVersion);
      (WorkflowModel.getById as any).mockReturnValue(mockWorkflow);
      (VersionModel.getLatestVersion as any).mockReturnValue(3);
      (VersionModel.create as any).mockReturnValue({});
      (WorkflowModel.update as any).mockReturnValue({ ...mockWorkflow, definition: oldDefinition });

      const response = await request(app).post('/api/workflows/wf-001/versions/1/restore');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Should save current definition as version 4 before restoring
      expect(VersionModel.getLatestVersion).toHaveBeenCalledWith('wf-001');
      expect(VersionModel.create).toHaveBeenCalledWith(
        'wf-001', 4, mockWorkflow.definition, 'Before restore to v1',
      );

      // Should update workflow with the restored definition
      expect(WorkflowModel.update).toHaveBeenCalledWith('wf-001', { definition: oldDefinition });
    });

    it('should return 404 when version not found', async () => {
      (VersionModel.getByVersion as any).mockReturnValue(null);

      const response = await request(app).post('/api/workflows/wf-001/versions/99/restore');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Version not found' });
      expect(WorkflowModel.update).not.toHaveBeenCalled();
    });

    it('should return 404 when workflow not found during update', async () => {
      const mockVersion = {
        id: 'v1', workflowId: 'wf-001', version: 1,
        definition: { stations: [] }, createdAt: new Date().toISOString(),
      };
      (VersionModel.getByVersion as any).mockReturnValue(mockVersion);
      (WorkflowModel.getById as any).mockReturnValue(null);
      (WorkflowModel.update as any).mockReturnValue(null);

      const response = await request(app).post('/api/workflows/wf-001/versions/1/restore');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, error: 'Workflow not found' });
    });
  });
});
