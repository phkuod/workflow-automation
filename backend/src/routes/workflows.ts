import { Router, Request, Response } from 'express';
import { WorkflowModel } from '../models/workflow';
import { ExecutionModel } from '../models/execution';
import { VersionModel } from '../models/version';
import { ExecutionEngine } from '../services/executionEngine';
import { scheduler } from '../services/scheduler';
import { createLogger } from '../utils/logger';
import {
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  ExecuteWorkflowRequest,
  ApiResponse,
  Workflow
} from '../types/workflow';
import { findTriggerStep } from '../utils/workflowHelpers';

const router = Router();
const log = createLogger('workflows');

// Helper to handle scheduling logic
const syncSchedule = async (workflow: Workflow) => {
  const cronStep = findTriggerStep(workflow, 'trigger-cron');
  const cronExpression = cronStep?.config.cronExpression;

  if (workflow.status === 'active' && cronExpression) {
    scheduler.scheduleWorkflow(workflow, cronExpression);
  } else {
    scheduler.unscheduleWorkflow(workflow.id);
  }
};

/**
 * GET /api/workflows
 * Get all workflows
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit as string) || 100));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const workflows = WorkflowModel.getAll(limit, offset);
    const total = WorkflowModel.count();
    res.json({ success: true, data: workflows, total, limit, offset } as ApiResponse<typeof workflows>);
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/workflows/:id
 * Get a specific workflow
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const workflow = WorkflowModel.getById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({ success: true, data: workflow });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/workflows
 * Create a new workflow
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data: CreateWorkflowRequest = req.body;
    
    if (!data.name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    if (!data.definition) {
      return res.status(400).json({ success: false, error: 'Definition is required' });
    }

    const workflow = WorkflowModel.create(data);
    await syncSchedule(workflow); // Sync with scheduler
    
    res.status(201).json({ success: true, data: workflow });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /api/workflows/:id
 * Update a workflow
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data: UpdateWorkflowRequest = req.body;

    // Auto-version: save current definition before updating
    if (data.definition) {
      const current = WorkflowModel.getById(req.params.id);
      if (current) {
        const nextVersion = VersionModel.getLatestVersion(req.params.id) + 1;
        VersionModel.create(req.params.id, nextVersion, current.definition);
        VersionModel.deleteOldVersions(req.params.id);
      }
    }

    const workflow = WorkflowModel.update(req.params.id, data);

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    await syncSchedule(workflow);

    res.json({ success: true, data: workflow });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /api/workflows/:id
 * Delete a workflow
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = WorkflowModel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    scheduler.unscheduleWorkflow(req.params.id); // Remove from scheduler

    res.json({ success: true, data: { deleted: true } });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/workflows/:id/execute
 * Execute a workflow
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const workflow = WorkflowModel.getById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const { triggeredBy = 'manual', inputData = {} }: ExecuteWorkflowRequest = req.body;

    const execution = await ExecutionEngine.execute(workflow, triggeredBy, inputData);
    res.json({ success: true, data: execution });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('Missing required input parameter')) {
      res.status(400).json({ success: false, error: message });
    } else {
      log.error({ err: error }, 'Unexpected error');
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
});

/**
 * POST /api/workflows/:id/simulate
 */
router.post('/:id/simulate', async (req: Request, res: Response) => {
  try {
    const workflow = WorkflowModel.getById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const { inputData = {} }: ExecuteWorkflowRequest = req.body;

    const execution = await ExecutionEngine.execute(workflow, 'manual', inputData, true);
    res.json({ success: true, data: execution });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('Missing required input parameter')) {
      res.status(400).json({ success: false, error: message });
    } else {
      log.error({ err: error }, 'Unexpected error');
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
});

/**
 * GET /api/workflows/:id/executions
 */
router.get('/:id/executions', (req: Request, res: Response) => {
  try {
    const workflow = WorkflowModel.getById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit as string) || 20));
    const executions = ExecutionModel.getByWorkflowId(req.params.id, limit);
    res.json({ success: true, data: executions });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/workflows/:id/versions
 */
router.get('/:id/versions', (req: Request, res: Response) => {
  try {
    const versions = VersionModel.getByWorkflowId(req.params.id);
    res.json({ success: true, data: versions });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/workflows/:id/versions/:version
 */
router.get('/:id/versions/:version', (req: Request, res: Response) => {
  try {
    const version = VersionModel.getByVersion(req.params.id, parseInt(req.params.version));
    if (!version) {
      return res.status(404).json({ success: false, error: 'Version not found' });
    }
    res.json({ success: true, data: version });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/workflows/:id/versions/:version/restore
 */
router.post('/:id/versions/:version/restore', async (req: Request, res: Response) => {
  try {
    const version = VersionModel.getByVersion(req.params.id, parseInt(req.params.version));
    if (!version) {
      return res.status(404).json({ success: false, error: 'Version not found' });
    }
    // Save current as new version before restoring
    const current = WorkflowModel.getById(req.params.id);
    if (current) {
      const nextVer = VersionModel.getLatestVersion(req.params.id) + 1;
      VersionModel.create(req.params.id, nextVer, current.definition, `Before restore to v${version.version}`);
    }
    const updated = WorkflowModel.update(req.params.id, { definition: version.definition });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({ success: true, data: updated });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
