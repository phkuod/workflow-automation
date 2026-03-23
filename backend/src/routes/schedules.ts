import { Router } from 'express';
import { scheduler } from '../services/scheduler';
import { createLogger } from '../utils/logger';

const router = Router();
const log = createLogger('schedules');

/**
 * GET /api/schedules
 * List all scheduled workflows
 */
router.get('/', (req, res) => {
  try {
    const schedules = scheduler.getScheduledWorkflows();
    res.json({ success: true, data: schedules });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/schedules/:workflowId
 * Get schedule for a specific workflow
 */
router.get('/:workflowId', (req, res) => {
  try {
    const schedule = scheduler.getScheduledWorkflow(req.params.workflowId);
    if (!schedule) {
      return res.status(404).json({ 
        success: false, 
        error: 'Workflow is not scheduled' 
      });
    }
    res.json({ success: true, data: schedule });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /api/schedules/:workflowId/pause
 * Pause a scheduled workflow
 */
router.put('/:workflowId/pause', (req, res) => {
  try {
    const success = scheduler.pauseWorkflow(req.params.workflowId);
    if (!success) {
      return res.status(404).json({ 
        success: false, 
        error: 'Workflow is not scheduled or already paused' 
      });
    }
    res.json({ success: true, message: 'Schedule paused' });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /api/schedules/:workflowId/resume
 * Resume a paused workflow
 */
router.put('/:workflowId/resume', (req, res) => {
  try {
    const success = scheduler.resumeWorkflow(req.params.workflowId);
    if (!success) {
      return res.status(404).json({ 
        success: false, 
        error: 'Workflow is not scheduled' 
      });
    }
    res.json({ success: true, message: 'Schedule resumed' });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /api/schedules/:workflowId
 * Remove a workflow from schedule
 */
router.delete('/:workflowId', (req, res) => {
  try {
    const success = scheduler.unscheduleWorkflow(req.params.workflowId);
    if (!success) {
      return res.status(404).json({ 
        success: false, 
        error: 'Workflow is not scheduled' 
      });
    }
    res.json({ success: true, message: 'Schedule removed' });
  } catch (error: unknown) {
    log.error({ err: error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
