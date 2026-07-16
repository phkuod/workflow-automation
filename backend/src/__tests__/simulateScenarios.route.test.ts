import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../models/workflow', () => ({ WorkflowModel: { getById: vi.fn() } }));
vi.mock('../services/executionEngine', () => ({
  ExecutionEngine: { execute: vi.fn(), simulateScenarios: vi.fn() },
}));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import workflowsRouter from '../routes/workflows';
import { WorkflowModel } from '../models/workflow';
import { ExecutionEngine } from '../services/executionEngine';

const app = express();
app.use(express.json());
app.use('/api/workflows', workflowsRouter);

const wf = {
  id: 'w1', name: 'W', status: 'active', createdAt: '', updatedAt: '',
  definition: { stations: [{ id: 'st1', name: 'S', position: { x: 0, y: 0 }, steps: [
    { id: 's1', name: 'Fetch', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
  ] }] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(WorkflowModel.getById).mockReturnValue(wf as never);
});

describe('POST /api/workflows/:id/simulate with scenarios', () => {
  it('returns one result per scenario in order', async () => {
    vi.mocked(ExecutionEngine.simulateScenarios).mockResolvedValue([
      { name: 'a', result: { stations: [] } }, { name: 'b', result: { stations: [] } },
    ] as never);
    const res = await request(app).post('/api/workflows/w1/simulate').send({
      scenarios: [
        { name: 'a', stepOverrides: [{ stepId: 's1', mockOutput: { ok: true } }] },
        { name: 'b', stepOverrides: [{ stepId: 's1', mockError: 'x' }] },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.results.map((r: { name: string }) => r.name)).toEqual(['a', 'b']);
  });

  it('400 when more than 10 scenarios', async () => {
    const scenarios = Array.from({ length: 11 }, (_, i) => ({ name: `s${i}` }));
    const res = await request(app).post('/api/workflows/w1/simulate').send({ scenarios });
    expect(res.status).toBe(400);
    expect(ExecutionEngine.simulateScenarios).not.toHaveBeenCalled();
  });

  it('400 when an override targets an unknown step id', async () => {
    const res = await request(app).post('/api/workflows/w1/simulate').send({
      scenarios: [{ name: 'a', stepOverrides: [{ stepId: 'ghost', mockOutput: {} }] }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown step/i);
  });

  it('400 when an override has neither or both of mockOutput/mockError', async () => {
    const neither = await request(app).post('/api/workflows/w1/simulate').send({
      scenarios: [{ name: 'a', stepOverrides: [{ stepId: 's1' }] }],
    });
    expect(neither.status).toBe(400);
    const both = await request(app).post('/api/workflows/w1/simulate').send({
      scenarios: [{ name: 'a', stepOverrides: [{ stepId: 's1', mockOutput: {}, mockError: 'x' }] }],
    });
    expect(both.status).toBe(400);
  });

  it('400 when a scenario element is not an object', async () => {
    const res = await request(app).post('/api/workflows/w1/simulate').send({ scenarios: [null] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be an object/i);
    expect(ExecutionEngine.simulateScenarios).not.toHaveBeenCalled();
  });

  it('400 when stepOverrides is not an array', async () => {
    const res = await request(app).post('/api/workflows/w1/simulate').send({
      scenarios: [{ name: 'a', stepOverrides: {} }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be an array/i);
    expect(ExecutionEngine.simulateScenarios).not.toHaveBeenCalled();
  });

  it('404 when the workflow does not exist', async () => {
    vi.mocked(WorkflowModel.getById).mockReturnValue(null as never);
    const res = await request(app).post('/api/workflows/nope/simulate').send({ scenarios: [{ name: 'a' }] });
    expect(res.status).toBe(404);
  });

  it('without scenarios, falls through to the existing single simulate', async () => {
    vi.mocked(ExecutionEngine.execute).mockResolvedValue({ id: 'e1' } as never);
    const res = await request(app).post('/api/workflows/w1/simulate').send({ inputData: {} });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 'e1' });
    expect(ExecutionEngine.simulateScenarios).not.toHaveBeenCalled();
  });
});
