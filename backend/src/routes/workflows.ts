import { Router, Request, Response } from 'express';
import { WorkflowModel } from '../models/workflow';
import { ExecutionModel } from '../models/execution';
import { ExecutionEngine } from '../services/executionEngine';
import { scheduler } from '../services/scheduler'; // Import scheduler
import { 
  CreateWorkflowRequest, 
  UpdateWorkflowRequest, 
  ExecuteWorkflowRequest,
  ApiResponse,
  Workflow
} from '../types/workflow';

const router = Router();

// Helper to handle scheduling logic
const syncSchedule = async (workflow: Workflow) => {
  // Find cron trigger
  let cronExpression: string | undefined;
  for (const station of workflow.definition.stations) {
    for (const step of station.steps) {
      if (step.type === 'trigger-cron' && step.config.cronExpression) {
        cronExpression = step.config.cronExpression;
        break;
      }
    }
    if (cronExpression) break;
  }

  if (workflow.status === 'active' && cronExpression) {
    await scheduler.scheduleWorkflow(workflow, cronExpression);
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
    const workflows = WorkflowModel.getAll();
    res.json({ success: true, data: workflows } as ApiResponse<typeof workflows>);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/workflows/:id
 * Update a workflow
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data: UpdateWorkflowRequest = req.body;
    const workflow = WorkflowModel.update(req.params.id, data);
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    await syncSchedule(workflow); // Sync with scheduler

    res.json({ success: true, data: workflow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workflows/:id/simulate
 * Simulate workflow execution
 */
router.post('/:id/simulate', async (req: Request, res: Response) => {
  try {
    const workflow = WorkflowModel.getById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const { inputData = {} }: ExecuteWorkflowRequest = req.body;
    
    const execution = await ExecutionEngine.execute(workflow, 'manual', inputData);
    res.json({ success: true, data: execution });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workflows/:id/executions
 * Get execution history for a workflow
 */
router.get('/:id/executions', (req: Request, res: Response) => {
  try {
    const workflow = WorkflowModel.getById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const executions = ExecutionModel.getByWorkflowId(req.params.id, limit);
    res.json({ success: true, data: executions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
