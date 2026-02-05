import { Router, Request, Response } from 'express';
import { WorkflowModel } from '../models/workflow';
import { ExecutionEngine } from '../services/executionEngine';

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

    // Execute workflow asynchronously (fire and forget for webhooks usually)
    // or we can wait if desired. Spec says return 200 or 202.
    // Let's run it asynchronously to not block the webhook caller
    ExecutionEngine.execute(workflow, 'webhook', inputData)
      .catch(err => console.error(`Webhook execution failed for ${workflowId}:`, err));

    res.status(202).json({ 
      success: true, 
      message: 'Webhook received and execution started',
      executionId: 'async' // We don't have the ID immediately if we don't await
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
