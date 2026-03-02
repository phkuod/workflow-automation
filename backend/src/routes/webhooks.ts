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

    // Create execution record explicitly first or await the engine to start it.
    // However, our ExecutionEngine.execute creates the execution record internally.
    // Instead of waiting for full execution or changing the ExecutionEngine extensively right now,
    // we let it run async, but we can't get the ID unless we modify ExecutionEngine.
    // Let's modify the engine call slightly to create it first, or just return async.
    // For now, let's keep it async but return 202. If they need an ID, we'd have to 
    // separate creating the execution from running it.
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
