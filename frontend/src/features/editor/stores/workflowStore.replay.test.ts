import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/api/workflowApi', () => ({
  workflowApi: {},
  executionApi: { getById: vi.fn() },
}));

import { useWorkflowStore } from './workflowStore';
import { executionApi } from '../../../shared/api/workflowApi';

const execution = {
  id: 'exec-1', workflowId: 'w1', workflowName: 'W', status: 'completed',
  triggeredBy: 'manual', startTime: 't', successRate: 100,
  result: { stations: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  useWorkflowStore.setState({ replayExecution: null, error: null });
});

describe('workflowStore replay', () => {
  it('enterReplay loads the execution into replayExecution', async () => {
    vi.mocked(executionApi.getById).mockResolvedValue(execution as never);
    await useWorkflowStore.getState().enterReplay('exec-1');
    expect(executionApi.getById).toHaveBeenCalledWith('exec-1');
    expect(useWorkflowStore.getState().replayExecution).toEqual(execution);
  });

  it('enterReplay records an error and leaves replayExecution null on failure', async () => {
    vi.mocked(executionApi.getById).mockRejectedValue(new Error('nope'));
    await useWorkflowStore.getState().enterReplay('bad');
    expect(useWorkflowStore.getState().replayExecution).toBeNull();
    expect(useWorkflowStore.getState().error).toBe('nope');
  });

  it('exitReplay clears replayExecution', async () => {
    useWorkflowStore.setState({ replayExecution: execution as never });
    useWorkflowStore.getState().exitReplay();
    expect(useWorkflowStore.getState().replayExecution).toBeNull();
  });
});
