import { Router } from 'express';
import { scheduler } from '../services/scheduler';

const router = Router();

/**
 * GET /api/schedules
 * List all scheduled workflows
 */
router.get('/', (req, res) => {
  try {
    const schedules = scheduler.getScheduledWorkflows();
    res.json({ success: true, data: schedules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
