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

  it('a later enterReplay call wins even if an earlier one resolves after it', async () => {
    let resolveFirst!: (v: unknown) => void;
    let resolveSecond!: (v: unknown) => void;
    const first = new Promise((resolve) => { resolveFirst = resolve; });
    const second = new Promise((resolve) => { resolveSecond = resolve; });
    vi.mocked(executionApi.getById)
      .mockReturnValueOnce(first as never)
      .mockReturnValueOnce(second as never);

    const p1 = useWorkflowStore.getState().enterReplay('exec-1');
    const p2 = useWorkflowStore.getState().enterReplay('exec-2');

    const execTwo = { ...execution, id: 'exec-2' };
    // The newer request (exec-2) resolves first, the older (exec-1) resolves later —
    // the later-requested execution must still be the one left in state.
    resolveSecond(execTwo);
    await p2;
    resolveFirst(execution);
    await p1;

    expect(useWorkflowStore.getState().replayExecution).toEqual(execTwo);
  });

  it('exitReplay invalidates any in-flight enterReplay request', async () => {
    let resolve!: (v: unknown) => void;
    const pending = new Promise((r) => { resolve = r; });
    vi.mocked(executionApi.getById).mockReturnValue(pending as never);

    const p = useWorkflowStore.getState().enterReplay('exec-1');
    useWorkflowStore.getState().exitReplay();
    resolve(execution);
    await p;

    expect(useWorkflowStore.getState().replayExecution).toBeNull();
  });
});
