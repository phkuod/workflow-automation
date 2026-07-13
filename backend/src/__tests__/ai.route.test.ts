import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../services/aiAssistant', () => ({
  isAiEnabled: vi.fn(),
  draftAutomation: vi.fn(),
  explainRunError: vi.fn(),
  inferStepShape: vi.fn(),
}));
vi.mock('../models/workflow', () => ({
  WorkflowModel: { create: vi.fn() },
}));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import aiRouter from '../routes/ai';
import { isAiEnabled, draftAutomation, explainRunError, inferStepShape } from '../services/aiAssistant';
import { WorkflowModel } from '../models/workflow';

const app = express();
app.use(express.json());
app.use('/api/ai', aiRouter);

const DRAFT = {
  name: 'Weather mail',
  description: 'desc',
  definition: { stations: [{ id: 's1', name: 'S', steps: [], position: { x: 0, y: 0 } }] },
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/ai/status', () => {
  it('reports enabled', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    const res = await request(app).get('/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { enabled: true } });
  });

  it('reports disabled', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(false);
    const res = await request(app).get('/api/ai/status');
    expect(res.body).toEqual({ success: true, data: { enabled: false } });
  });
});

describe('POST /api/ai/draft', () => {
  it('503 when AI is disabled', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(false);
    const res = await request(app).post('/api/ai/draft').send({ description: 'x' });
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });

  it('400 when description is missing or blank', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    const res = await request(app).post('/api/ai/draft').send({ description: '   ' });
    expect(res.status).toBe(400);
  });

  it('400 when description exceeds 2000 chars', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    const res = await request(app).post('/api/ai/draft').send({ description: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it('creates a draft workflow and returns 201', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(draftAutomation).mockResolvedValue(DRAFT);
    const created = { id: 'wf-1', name: 'Weather mail', status: 'draft' };
    vi.mocked(WorkflowModel.create).mockReturnValue(created as never);

    const res = await request(app).post('/api/ai/draft').send({ description: 'weather email' });

    expect(draftAutomation).toHaveBeenCalledWith('weather email');
    expect(WorkflowModel.create).toHaveBeenCalledWith({
      name: DRAFT.name,
      description: DRAFT.description,
      definition: DRAFT.definition,
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: created });
  });

  it('502 with the graceful message when the service throws', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(draftAutomation).mockRejectedValue(new Error('provider exploded'));
    const res = await request(app).post('/api/ai/draft').send({ description: 'x' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ success: false, error: 'AI draft failed — try a template instead' });
  });
});

describe('POST /api/ai/explain', () => {
  const CTX = {
    workflowName: 'W', stationName: 'S', stepName: 'A',
    stepType: 'action-email', errorMessage: 'boom',
  };

  it('503 when AI is disabled', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(false);
    const res = await request(app).post('/api/ai/explain').send(CTX);
    expect(res.status).toBe(503);
  });

  it('400 when errorMessage is missing', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    const res = await request(app).post('/api/ai/explain').send({ ...CTX, errorMessage: '' });
    expect(res.status).toBe(400);
  });

  it('400 when errorMessage exceeds 4000 chars', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    const res = await request(app).post('/api/ai/explain').send({ ...CTX, errorMessage: 'a'.repeat(4001) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'errorMessage must be at most 4000 characters' });
  });

  it('truncates long name/type fields to 200 chars', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(explainRunError).mockResolvedValue('ok');
    const longField = 'x'.repeat(250);
    const res = await request(app).post('/api/ai/explain').send({
      workflowName: longField, stationName: longField, stepName: longField,
      stepType: longField, errorMessage: 'boom',
    });
    expect(res.status).toBe(200);
    expect(explainRunError).toHaveBeenCalledWith({
      workflowName: 'x'.repeat(200),
      stationName: 'x'.repeat(200),
      stepName: 'x'.repeat(200),
      stepType: 'x'.repeat(200),
      errorMessage: 'boom',
    });
  });

  it('returns the explanation', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(explainRunError).mockResolvedValue('The mail server said no.');
    const res = await request(app).post('/api/ai/explain').send(CTX);
    expect(explainRunError).toHaveBeenCalledWith(CTX);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { explanation: 'The mail server said no.' } });
  });

  it('502 when the service throws', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(explainRunError).mockRejectedValue(new Error('nope'));
    const res = await request(app).post('/api/ai/explain').send(CTX);
    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/ai/infer-shape', () => {
  it('503 when AI is disabled', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(false);
    const res = await request(app).post('/api/ai/infer-shape').send({ step: { name: 'S', type: 'http-request', config: {} } });
    expect(res.status).toBe(503);
  });

  it('400 when step or step.type is missing', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    expect((await request(app).post('/api/ai/infer-shape').send({})).status).toBe(400);
    expect((await request(app).post('/api/ai/infer-shape').send({ step: { name: 'S' } })).status).toBe(400);
  });

  it('200 with shape and ai-inferred source', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(inferStepShape).mockResolvedValue({ name: '', type: 'object', children: [] });
    const res = await request(app).post('/api/ai/infer-shape').send({ step: { name: 'S', type: 'script-js', config: {} } });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ shape: { name: '', type: 'object', children: [] }, source: { kind: 'ai-inferred' } });
  });

  it('502 when inference fails', async () => {
    vi.mocked(isAiEnabled).mockReturnValue(true);
    vi.mocked(inferStepShape).mockRejectedValue(new Error('boom'));
    const res = await request(app).post('/api/ai/infer-shape').send({ step: { name: 'S', type: 'script-js', config: {} } });
    expect(res.status).toBe(502);
  });
});
