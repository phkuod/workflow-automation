import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWorkflowStore } from './workflowStore';

// Mock API
vi.mock('../../../shared/api/workflowApi', () => ({
  workflowApi: {
    getAll: vi.fn().mockResolvedValue([
      { id: '1', name: 'Test', status: 'draft', definition: { stations: [] }, createdAt: '', updatedAt: '' },
    ]),
    getById: vi.fn().mockResolvedValue({
      id: '1', name: 'Test', status: 'draft', definition: { stations: [] }, createdAt: '', updatedAt: '',
    }),
    create: vi.fn().mockResolvedValue({
      id: '2', name: 'New', status: 'draft', definition: { stations: [] }, createdAt: '', updatedAt: '',
    }),
    update: vi.fn().mockImplementation((_id, data) => Promise.resolve({
      id: '1', name: data.name || 'Test', status: data.status || 'draft',
      definition: data.definition || { stations: [] }, createdAt: '', updatedAt: '',
    })),
    delete: vi.fn().mockResolvedValue(undefined),
    simulate: vi.fn().mockResolvedValue({
      id: 'exec-1', workflowId: '1', workflowName: 'Test', status: 'completed',
      triggeredBy: 'manual', startTime: '', successRate: 100, result: { stations: [] },
    }),
  },
  executionApi: {
    getLogs: vi.fn().mockResolvedValue([]),
  },
}));

describe('workflowStore', () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflows: [],
      currentWorkflow: null,
      executions: [],
      currentExecution: null,
      executionLogs: [],
      isLoading: false,
      error: null,
      selectedStepId: null,
      selectedStationId: null,
      isSimulating: false,
    });
  });

  it('fetches workflows', async () => {
    await useWorkflowStore.getState().fetchWorkflows();
    expect(useWorkflowStore.getState().workflows).toHaveLength(1);
    expect(useWorkflowStore.getState().isLoading).toBe(false);
  });

  it('creates a workflow', async () => {
    const workflow = await useWorkflowStore.getState().createWorkflow('New');
    expect(workflow.name).toBe('New');
    expect(useWorkflowStore.getState().workflows).toHaveLength(1);
  });

  it('adds a station', () => {
    useWorkflowStore.setState({
      currentWorkflow: {
        id: '1', name: 'Test', status: 'draft',
        definition: { stations: [] }, createdAt: '', updatedAt: '',
      },
    });
    useWorkflowStore.getState().addStation('Stage 1');
    const stations = useWorkflowStore.getState().currentWorkflow!.definition.stations;
    expect(stations).toHaveLength(1);
    expect(stations[0].name).toBe('Stage 1');
  });

  it('adds a step to a station', () => {
    const stationId = 'station-1';
    useWorkflowStore.setState({
      currentWorkflow: {
        id: '1', name: 'Test', status: 'draft',
        definition: {
          stations: [{ id: stationId, name: 'Stage', steps: [], position: { x: 0, y: 0 } }],
        },
        createdAt: '', updatedAt: '',
      },
    });
    useWorkflowStore.getState().addStep(stationId, 'script-js', 'My Script');
    const steps = useWorkflowStore.getState().currentWorkflow!.definition.stations[0].steps;
    expect(steps).toHaveLength(1);
    expect(steps[0].name).toBe('My Script');
    expect(steps[0].type).toBe('script-js');
  });

  it('deletes a station', () => {
    useWorkflowStore.setState({
      currentWorkflow: {
        id: '1', name: 'Test', status: 'draft',
        definition: {
          stations: [{ id: 's1', name: 'S1', steps: [], position: { x: 0, y: 0 } }],
        },
        createdAt: '', updatedAt: '',
      },
    });
    useWorkflowStore.getState().deleteStation('s1');
    expect(useWorkflowStore.getState().currentWorkflow!.definition.stations).toHaveLength(0);
  });

  it('selects and deselects step', () => {
    useWorkflowStore.getState().selectStep('step-1');
    expect(useWorkflowStore.getState().selectedStepId).toBe('step-1');
    expect(useWorkflowStore.getState().selectedStationId).toBeNull();

    useWorkflowStore.getState().selectStep(null);
    expect(useWorkflowStore.getState().selectedStepId).toBeNull();
  });

  it('selects station deselects step', () => {
    useWorkflowStore.getState().selectStep('step-1');
    useWorkflowStore.getState().selectStation('station-1');
    expect(useWorkflowStore.getState().selectedStationId).toBe('station-1');
    expect(useWorkflowStore.getState().selectedStepId).toBeNull();
  });
});
