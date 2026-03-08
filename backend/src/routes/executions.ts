import { Router, Request, Response } from 'express';
import { ExecutionModel, LogModel } from '../models/execution';
import { executionManager } from '../services/executionManager';
import { executionEventBus, type ExecutionEvent } from '../services/executionEventBus';

const router = Router();

/**
 * GET /api/executions/:id/stream
 * SSE stream for real-time execution updates
 */
router.get('/:id/stream', (req: Request, res: Response) => {
  const { id } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write('data: {"type":"connected"}\n\n');

  const handler = (event: ExecutionEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (['execution:complete', 'execution:failed', 'execution:cancelled'].includes(event.type)) {
      res.end();
    }
  };

  executionEventBus.on(`execution:${id}`, handler);
  req.on('close', () => {
    executionEventBus.off(`execution:${id}`, handler);
  });
});

/**
 * POST /api/executions/:id/cancel
 * Cancel a running execution
 */
router.post('/:id/cancel', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cancelled = executionManager.cancel(id);
    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found or already completed'
      });
    }
    ExecutionModel.update(id, {
      status: 'cancelled',
      endTime: new Date().toISOString()
    });
    res.json({ success: true, data: { cancelled: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
