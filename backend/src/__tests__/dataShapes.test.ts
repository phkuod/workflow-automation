import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Execution } from '../types/workflow';

vi.mock('../models/execution', () => ({
  ExecutionModel: { getLatestFinishedByWorkflowId: vi.fn() },
}));
vi.mock('../models/workflow', () => ({
  WorkflowModel: { getById: vi.fn() },
}));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { getWorkflowDataShapes } from '../services/dataShapes';
import { ExecutionModel } from '../models/execution';
import { WorkflowModel } from '../models/workflow';
import workflowsRouter from '../routes/workflows';

const app = express();
app.use(express.json());
app.use('/api/workflows', workflowsRouter);

function finishedExecution(): Execution {
  return {
    id: 'exec-1', workflowId: 'w1', workflowName: 'W', status: 'failed',
    triggeredBy: 'manual', startTime: '2026-07-13T06:00:00.000Z', successRate: 50,
    result: {
      stations: [{
        stationId: 'st1', stationName: 'Stage 1', status: 'failed',
        steps: [
          { stepId: 's1', stepName: 'Fetch', stepType: 'http-request', status: 'completed',
            output: { status: 200, data: { orderId: 10023 } } },
          { stepId: 's2', stepName: 'Mail', stepType: 'action-email', status: 'failed',
            error: { message: 'SMTP down' } },
        ],
      }],
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('getWorkflowDataShapes', () => {
  it('returns kind none when there is no finished run', () => {
    vi.mocked(ExecutionModel.getLatestFinishedByWorkflowId).mockReturnValue(null);
    expect(getWorkflowDataShapes('w1')).toEqual({ source: { kind: 'none' }, steps: {} });
  });

  it('derives shapes for completed steps; failed steps get status but no shape', () => {
    vi.mocked(ExecutionModel.getLatestFinishedByWorkflowId).mockReturnValue(finishedExecution());
    const shapes = getWorkflowDataShapes('w1');
    expect(shapes.source).toEqual({ kind: 'run', executionId: 'exec-1', time: '2026-07-13T06:00:00.000Z' });
    expect(shapes.steps.s1.status).toBe('completed');
    expect(shapes.steps.s1.shape!.type).toBe('object');
    expect(shapes.steps.s1.shape!.children!.map(c => c.name)).toEqual(['status', 'data']);
    expect(shapes.steps.s2).toEqual({ status: 'failed', shape: undefined });
  });

  it('returns kind none when the latest run has no stored result', () => {
    vi.mocked(ExecutionModel.getLatestFinishedByWorkflowId).mockReturnValue({
      ...finishedExecution(), result: undefined,
    });
    expect(getWorkflowDataShapes('w1')).toEqual({ source: { kind: 'none' }, steps: {} });
  });

  it('merges shapes across repeated stepIds instead of last-write-wins (iterator stations reuse one stepId per item)', () => {
    const iteratorExecution: Execution = {
      id: 'exec-2', workflowId: 'w1', workflowName: 'W', status: 'completed',
      triggeredBy: 'manual', startTime: '2026-07-13T06:00:00.000Z', successRate: 100,
      result: {
        stations: [{
          stationId: 'st1', stationName: 'Iterate', status: 'completed',
          steps: [
            { stepId: 'iter-step', stepName: 'Iter', stepType: 'script-js', status: 'completed', output: { a: 1 } },
            { stepId: 'iter-step', stepName: 'Iter', stepType: 'script-js', status: 'completed', output: { b: 'x' } },
          ],
        }],
      },
    };
    vi.mocked(ExecutionModel.getLatestFinishedByWorkflowId).mockReturnValue(iteratorExecution);
    const shapes = getWorkflowDataShapes('w1');
    expect(shapes.steps['iter-step'].shape!.type).toBe('object');
    expect(shapes.steps['iter-step'].shape!.children!.map(c => c.name)).toEqual(['a', 'b']);
  });

  it('merges element shapes across repeated stepIds when the step output is an array', () => {
    const iteratorExecution: Execution = {
      id: 'exec-3', workflowId: 'w1', workflowName: 'W', status: 'completed',
      triggeredBy: 'manual', startTime: '2026-07-13T06:00:00.000Z', successRate: 100,
      result: {
        stations: [{
          stationId: 'st1', stationName: 'Iterate', status: 'completed',
          steps: [
            { stepId: 'iter-step', stepName: 'Iter', stepType: 'script-js', status: 'completed', output: [{ a: 1 }] },
            { stepId: 'iter-step', stepName: 'Iter', stepType: 'script-js', status: 'completed', output: [{ b: 'x' }] },
          ],
        }],
      },
    };
    vi.mocked(ExecutionModel.getLatestFinishedByWorkflowId).mockReturnValue(iteratorExecution);
    const shapes = getWorkflowDataShapes('w1');
    const shape = shapes.steps['iter-step'].shape!;
    expect(shape.type).toBe('array');
    const element = shape.children![0];
    expect(element.name).toBe('[0]');
    expect(element.children!.map(c => c.name)).toEqual(['a', 'b']);
  });
});

describe('GET /api/workflows/:id/data-shapes', () => {
  it('404 when the workflow does not exist', async () => {
    vi.mocked(WorkflowModel.getById).mockReturnValue(null);
    const res = await request(app).get('/api/workflows/nope/data-shapes');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('200 with shapes for an existing workflow', async () => {
    vi.mocked(WorkflowModel.getById).mockReturnValue({ id: 'w1' } as never);
    vi.mocked(ExecutionModel.getLatestFinishedByWorkflowId).mockReturnValue(finishedExecution());
    const res = await request(app).get('/api/workflows/w1/data-shapes');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.source.kind).toBe('run');
    expect(res.body.data.steps.s1.shape.type).toBe('object');
  });

  it('200 with kind none when the workflow exists but never ran', async () => {
    vi.mocked(WorkflowModel.getById).mockReturnValue({ id: 'w1' } as never);
    vi.mocked(ExecutionModel.getLatestFinishedByWorkflowId).mockReturnValue(null);
    const res = await request(app).get('/api/workflows/w1/data-shapes');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ source: { kind: 'none' }, steps: {} });
  });
});
