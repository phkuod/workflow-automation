import { Router } from 'express';
import { isAiEnabled, draftAutomation, explainRunError, inferStepShape } from '../services/aiAssistant';
import { WorkflowModel } from '../models/workflow';
import { createLogger } from '../utils/logger';

const router = Router();
const log = createLogger('ai');

const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_ERROR_MESSAGE_LENGTH = 4000;
const MAX_CONTEXT_FIELD_LENGTH = 200;

function truncateField(value: unknown): string {
  return String(value ?? '').slice(0, MAX_CONTEXT_FIELD_LENGTH);
}

router.get('/status', (req, res) => {
  res.json({ success: true, data: { enabled: isAiEnabled() } });
});

router.post('/draft', async (req, res) => {
  if (!isAiEnabled()) {
    return res.status(503).json({ success: false, error: 'AI assist is not configured' });
  }
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (!description) {
    return res.status(400).json({ success: false, error: 'description is required' });
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return res.status(400).json({ success: false, error: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters` });
  }
  try {
    const draft = await draftAutomation(description);
    const workflow = WorkflowModel.create({
      name: draft.name,
      description: draft.description,
      definition: draft.definition,
    });
    res.status(201).json({ success: true, data: workflow });
  } catch (error: unknown) {
    log.error({ err: error }, 'AI draft failed');
    res.status(502).json({ success: false, error: 'AI draft failed — try a template instead' });
  }
});

router.post('/explain', async (req, res) => {
  if (!isAiEnabled()) {
    return res.status(503).json({ success: false, error: 'AI assist is not configured' });
  }
  const { workflowName, stationName, stepName, stepType, errorMessage } = req.body ?? {};
  if (typeof errorMessage !== 'string' || !errorMessage.trim()) {
    return res.status(400).json({ success: false, error: 'errorMessage is required' });
  }
  if (errorMessage.length > MAX_ERROR_MESSAGE_LENGTH) {
    return res.status(400).json({ success: false, error: `errorMessage must be at most ${MAX_ERROR_MESSAGE_LENGTH} characters` });
  }
  try {
    const explanation = await explainRunError({
      workflowName: truncateField(workflowName),
      stationName: truncateField(stationName),
      stepName: truncateField(stepName),
      stepType: truncateField(stepType),
      errorMessage,
    });
    res.json({ success: true, data: { explanation } });
  } catch (error: unknown) {
    log.error({ err: error }, 'AI explain failed');
    res.status(502).json({ success: false, error: 'Could not generate an explanation' });
  }
});

router.post('/infer-shape', async (req, res) => {
  if (!isAiEnabled()) {
    return res.status(503).json({ success: false, error: 'AI assist is not configured' });
  }
  const step = req.body?.step;
  if (!step || typeof step !== 'object' || typeof step.type !== 'string' || !step.type.trim()) {
    return res.status(400).json({ success: false, error: 'step with a type is required' });
  }
  try {
    const shape = await inferStepShape({
      name: truncateField(step.name),
      type: truncateField(step.type),
      config: step.config && typeof step.config === 'object' && !Array.isArray(step.config)
        ? (step.config as Record<string, unknown>)
        : {},
    });
    res.json({ success: true, data: { shape, source: { kind: 'ai-inferred' } } });
  } catch (error: unknown) {
    log.error({ err: error }, 'AI shape inference failed');
    res.status(502).json({ success: false, error: 'Could not predict fields' });
  }
});

export default router;
