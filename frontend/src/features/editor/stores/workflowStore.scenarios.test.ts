import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/api/workflowApi', () => ({
  workflowApi: { simulateScenarios: vi.fn() },
  executionApi: {},
}));

import { useWorkflowStore } from './workflowStore';
import { workflowApi } from '../../../shared/api/workflowApi';

const wf = { id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '', definition: { stations: [] } };

beforeEach(() => {
  vi.clearAllMocks();
  useWorkflowStore.setState({ currentWorkflow: wf as never, whatIfScenarios: [], whatIfResults: null, isRunningScenarios: false, error: null });
});

describe('workflowStore What-If', () => {
  it('setWhatIfScenarios stores scenarios', () => {
    useWorkflowStore.getState().setWhatIfScenarios([{ name: 'a' }]);
    expect(useWorkflowStore.getState().whatIfScenarios).toEqual([{ name: 'a' }]);
  });

  it('runScenarios calls the API with current scenarios and stores results', async () => {
    const results = [{ name: 'a', result: { stations: [] } }];
    vi.mocked(workflowApi.simulateScenarios).mockResolvedValue(results as never);
    useWorkflowStore.getState().setWhatIfScenarios([{ name: 'a' }]);
    await useWorkflowStore.getState().runScenarios();
    expect(workflowApi.simulateScenarios).toHaveBeenCalledWith('w1', [{ name: 'a' }]);
    expect(useWorkflowStore.getState().whatIfResults).toEqual(results);
    expect(useWorkflowStore.getState().isRunningScenarios).toBe(false);
  });

  it('runScenarios records an error and clears the running flag on failure', async () => {
    vi.mocked(workflowApi.simulateScenarios).mockRejectedValue(new Error('boom'));
    useWorkflowStore.getState().setWhatIfScenarios([{ name: 'a' }]);
    await useWorkflowStore.getState().runScenarios();
    expect(useWorkflowStore.getState().error).toBe('boom');
    expect(useWorkflowStore.getState().isRunningScenarios).toBe(false);
  });
});
