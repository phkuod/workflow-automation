import { Router } from 'express';
import { isAiEnabled, draftAutomation, explainRunError } from '../services/aiAssistant';
import { WorkflowModel } from '../models/workflow';
import { createLogger } from '../utils/logger';

const router = Router();
const log = createLogger('ai');

const MAX_DESCRIPTION_LENGTH = 2000;

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
  try {
    const explanation = await explainRunError({
      workflowName: String(workflowName ?? ''),
      stationName: String(stationName ?? ''),
      stepName: String(stepName ?? ''),
      stepType: String(stepType ?? ''),
      errorMessage,
    });
    res.json({ success: true, data: { explanation } });
  } catch (error: unknown) {
    log.error({ err: error }, 'AI explain failed');
    res.status(502).json({ success: false, error: 'Could not generate an explanation' });
  }
});

export default router;
