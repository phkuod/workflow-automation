import { Router, Request, Response } from 'express';
import { WorkflowModel } from '../models/workflow';
import { ExecutionModel } from '../models/execution';
import { ExecutionEngine } from '../services/executionEngine';
import { createLogger } from '../utils/logger';

const router = Router();

/**
 * ALL /api/webhooks/:workflowId
 * Handle incoming webhooks for a specific workflow
 * Supports any method, but validates against configured method if available
 */
router.all('/:id', async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.id;
    const workflow = WorkflowModel.getById(workflowId);

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    if (workflow.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Workflow is not active' });
    }

    // Find webhook trigger node and validate method
    let webhookTrigger;
    for (const station of workflow.definition.stations) {
      for (const step of station.steps) {
        if (step.type === 'trigger-webhook') {
          webhookTrigger = step;
          break;
        }
      }
      if (webhookTrigger) break;
    }

    if (!webhookTrigger) {
      return res.status(400).json({ success: false, error: 'Workflow does not have a webhook trigger' });
    }

    const expectedMethod = webhookTrigger.config.webhookMethod || 'POST';
    if (req.method !== expectedMethod && expectedMethod !== 'any') {
      // Allowing any as a fallback if desired, though spec said POST/GET/PUT
      return res.status(405).json({ 
        success: false, 
        error: `Method ${req.method} not allowed. Expected ${expectedMethod}` 
      });
    }

    // Prepare input data from request
    const inputData = {
      body: req.body,
      query: req.query,
      headers: req.headers,
      method: req.method,
      url: req.url
    };

    // Create execution record synchronously to get the ID before responding
    const execution = ExecutionModel.create(workflow.id, workflow.name, 'webhook');

    // Fire-and-forget: run the execution asynchronously, passing the pre-created execution ID
    ExecutionEngine.executeWithId(execution.id, workflow, 'webhook', inputData)
      .catch(err => createLogger('webhooks').error({ err }, `Webhook execution failed for ${workflowId}`));

    res.status(202).json({
      success: true,
      message: 'Webhook received and execution started',
      executionId: execution.id
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
