import { Router, Request, Response } from 'express';
import { ExecutionModel, LogModel } from '../models/execution';

const router = Router();

/**
 * GET /api/executions
 * Get all executions
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const executions = ExecutionModel.getAll(limit);
    res.json({ success: true, data: executions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/executions/:id
 * Get a specific execution
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const execution = ExecutionModel.getById(req.params.id);
    if (!execution) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }
    res.json({ success: true, data: execution });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/executions/:id/logs
 * Get logs for a specific execution
 */
router.get('/:id/logs', (req: Request, res: Response) => {
  try {
    const execution = ExecutionModel.getById(req.params.id);
    if (!execution) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }

    const logs = LogModel.getByExecutionId(req.params.id);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/executions/:id
 * Delete an execution
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = ExecutionModel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
