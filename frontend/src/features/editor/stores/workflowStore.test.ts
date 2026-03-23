import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWorkflowStore } from './workflowStore';
import { workflowApi } from '../../../shared/api/workflowApi';

const mockedWorkflowApi = vi.mocked(workflowApi);

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
    execute: vi.fn().mockResolvedValue({
      id: 'exec-2', workflowId: '1', workflowName: 'Test', status: 'running',
      triggeredBy: 'manual', startTime: '', successRate: 0,
    }),
    getExecutions: vi.fn().mockResolvedValue([
      { id: 'exec-1', workflowId: '1', workflowName: 'Test', status: 'completed',
        triggeredBy: 'manual', startTime: '', successRate: 100 },
    ]),
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
      isSaving: false,
      isDirty: false,
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

  describe('fetchWorkflow', () => {
    it('sets currentWorkflow on success', async () => {
      await useWorkflowStore.getState().fetchWorkflow('1');

      const state = useWorkflowStore.getState();
      expect(state.currentWorkflow).not.toBeNull();
      expect(state.currentWorkflow!.id).toBe('1');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      mockedWorkflowApi.getById.mockRejectedValueOnce(new Error('Not found'));

      await useWorkflowStore.getState().fetchWorkflow('bad-id');

      const state = useWorkflowStore.getState();
      expect(state.error).toBe('Not found');
      expect(state.isLoading).toBe(false);
      expect(state.currentWorkflow).toBeNull();
    });
  });

  describe('updateWorkflow', () => {
    it('updates workflow in list and currentWorkflow on success', async () => {
      useWorkflowStore.setState({
        workflows: [
          { id: '1', name: 'Test', status: 'draft', definition: { stations: [] }, createdAt: '', updatedAt: '' },
        ],
        currentWorkflow: {
          id: '1', name: 'Test', status: 'draft', definition: { stations: [] }, createdAt: '', updatedAt: '',
        },
      });

      await useWorkflowStore.getState().updateWorkflow('1', { name: 'Updated' });

      const state = useWorkflowStore.getState();
      expect(state.workflows[0].name).toBe('Updated');
      expect(state.currentWorkflow!.name).toBe('Updated');
    });

    it('sets error on failure', async () => {
      mockedWorkflowApi.update.mockRejectedValueOnce(new Error('Update failed'));

      await useWorkflowStore.getState().updateWorkflow('1', { name: 'Fail' });

      expect(useWorkflowStore.getState().error).toBe('Update failed');
    });
  });

  describe('deleteWorkflow', () => {
    it('removes workflow from list', async () => {
      useWorkflowStore.setState({
        workflows: [
          { id: '1', name: 'Test', status: 'draft', definition: { stations: [] }, createdAt: '', updatedAt: '' },
          { id: '2', name: 'Other', status: 'draft', definition: { stations: [] }, createdAt: '', updatedAt: '' },
        ],
      });

      await useWorkflowStore.getState().deleteWorkflow('1');

      const state = useWorkflowStore.getState();
      expect(state.workflows).toHaveLength(1);
      expect(state.workflows[0].id).toBe('2');
    });

    it('clears currentWorkflow if it was the deleted one', async () => {
      useWorkflowStore.setState({
        workflows: [
          { id: '1', name: 'Test', status: 'draft', definition: { stations: [] }, createdAt: '', updatedAt: '' },
        ],
        currentWorkflow: {
          id: '1', name: 'Test', status: 'draft', definition: { stations: [] }, createdAt: '', updatedAt: '',
        },
      });

      await useWorkflowStore.getState().deleteWorkflow('1');

      expect(useWorkflowStore.getState().currentWorkflow).toBeNull();
    });
  });

  describe('saveWorkflow', () => {
    it('calls API update and sets isDirty to false', async () => {
      useWorkflowStore.setState({
        currentWorkflow: {
          id: '1', name: 'Test', status: 'draft', definition: { stations: [] }, createdAt: '', updatedAt: '',
        },
        isDirty: true,
        isSaving: false,
      });

      await useWorkflowStore.getState().saveWorkflow();

      const state = useWorkflowStore.getState();
      expect(state.isDirty).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(mockedWorkflowApi.update).toHaveBeenCalledWith('1', expect.objectContaining({ name: 'Test' }));
    });

    it('skips save if no currentWorkflow', async () => {
      mockedWorkflowApi.update.mockClear();
      useWorkflowStore.setState({ currentWorkflow: null });

      await useWorkflowStore.getState().saveWorkflow();

      expect(mockedWorkflowApi.update).not.toHaveBeenCalled();
    });

    it('skips save if already saving', async () => {
      mockedWorkflowApi.update.mockClear();
      useWorkflowStore.setState({
        currentWorkflow: {
          id: '1', name: 'Test', status: 'draft', definition: { stations: [] }, createdAt: '', updatedAt: '',
        },
        isSaving: true,
      });

      await useWorkflowStore.getState().saveWorkflow();

      expect(mockedWorkflowApi.update).not.toHaveBeenCalled();
    });
  });

  describe('updateStep', () => {
    it('finds step across stations and updates it', () => {
      useWorkflowStore.setState({
        currentWorkflow: {
          id: '1', name: 'Test', status: 'draft',
          definition: {
            stations: [
              {
                id: 's1', name: 'Stage 1', position: { x: 0, y: 0 },
                steps: [
                  { id: 'step-1', name: 'Old Name', type: 'script-js', config: {}, position: { x: 0, y: 0 }, inputVars: [], outputVars: [] },
                ],
              },
              {
                id: 's2', name: 'Stage 2', position: { x: 300, y: 0 },
                steps: [
                  { id: 'step-2', name: 'Keep', type: 'http-request', config: {}, position: { x: 0, y: 0 }, inputVars: [], outputVars: [] },
                ],
              },
            ],
          },
          createdAt: '', updatedAt: '',
        },
      });

      useWorkflowStore.getState().updateStep('step-1', { name: 'New Name' });

      const stations = useWorkflowStore.getState().currentWorkflow!.definition.stations;
      expect(stations[0].steps[0].name).toBe('New Name');
      expect(stations[1].steps[0].name).toBe('Keep');
      expect(useWorkflowStore.getState().isDirty).toBe(true);
    });
  });

  describe('deleteStep', () => {
    it('removes step and clears selectedStepId if it matches', () => {
      useWorkflowStore.setState({
        currentWorkflow: {
          id: '1', name: 'Test', status: 'draft',
          definition: {
            stations: [
              {
                id: 's1', name: 'Stage 1', position: { x: 0, y: 0 },
                steps: [
                  { id: 'step-1', name: 'To Delete', type: 'script-js', config: {}, position: { x: 0, y: 0 }, inputVars: [], outputVars: [] },
                  { id: 'step-2', name: 'Keep', type: 'http-request', config: {}, position: { x: 0, y: 100 }, inputVars: [], outputVars: [] },
                ],
                edges: [
                  { id: 'edge-1', source: 'step-1', target: 'step-2' },
                ],
              },
            ],
          },
          createdAt: '', updatedAt: '',
        },
        selectedStepId: 'step-1',
      });

      useWorkflowStore.getState().deleteStep('step-1');

      const state = useWorkflowStore.getState();
      const station = state.currentWorkflow!.definition.stations[0];
      expect(station.steps).toHaveLength(1);
      expect(station.steps[0].id).toBe('step-2');
      expect(station.edges).toHaveLength(0);
      expect(state.selectedStepId).toBeNull();
      expect(state.isDirty).toBe(true);
    });
  });

  describe('connectSteps', () => {
    it('adds edge to station edges', () => {
      useWorkflowStore.setState({
        currentWorkflow: {
          id: '1', name: 'Test', status: 'draft',
          definition: {
            stations: [
              {
                id: 's1', name: 'Stage 1', position: { x: 0, y: 0 },
                steps: [
                  { id: 'step-1', name: 'A', type: 'script-js', config: {}, position: { x: 0, y: 0 }, inputVars: [], outputVars: [] },
                  { id: 'step-2', name: 'B', type: 'script-js', config: {}, position: { x: 0, y: 100 }, inputVars: [], outputVars: [] },
                ],
              },
            ],
          },
          createdAt: '', updatedAt: '',
        },
      });

      useWorkflowStore.getState().connectSteps('s1', 'step-1', 'step-2', 'true');

      const station = useWorkflowStore.getState().currentWorkflow!.definition.stations[0];
      expect(station.edges).toHaveLength(1);
      expect(station.edges![0].source).toBe('step-1');
      expect(station.edges![0].target).toBe('step-2');
      expect(station.edges![0].sourceHandle).toBe('true');
      expect(useWorkflowStore.getState().isDirty).toBe(true);
    });
  });

  describe('updateStation', () => {
    it('updates station data and sets isDirty', () => {
      useWorkflowStore.setState({
        currentWorkflow: {
          id: '1', name: 'Test', status: 'draft',
          definition: {
            stations: [
              { id: 's1', name: 'Old Name', steps: [], position: { x: 0, y: 0 } },
            ],
          },
          createdAt: '', updatedAt: '',
        },
      });

      useWorkflowStore.getState().updateStation('s1', { name: 'Renamed Station' });

      const state = useWorkflowStore.getState();
      expect(state.currentWorkflow!.definition.stations[0].name).toBe('Renamed Station');
      expect(state.isDirty).toBe(true);
    });
  });

  describe('executeWorkflow', () => {
    it('calls API and sets currentExecution', async () => {
      useWorkflowStore.setState({
        currentWorkflow: {
          id: '1', name: 'Test', status: 'active', definition: { stations: [] }, createdAt: '', updatedAt: '',
        },
      });

      const execution = await useWorkflowStore.getState().executeWorkflow();

      const state = useWorkflowStore.getState();
      expect(state.currentExecution).not.toBeNull();
      expect(state.currentExecution!.id).toBe('exec-2');
      expect(execution.id).toBe('exec-2');
      expect(state.isSimulating).toBe(false);
    });
  });

  describe('simulateWorkflow', () => {
    it('sets isSimulating and returns execution', async () => {
      useWorkflowStore.setState({
        currentWorkflow: {
          id: '1', name: 'Test', status: 'draft', definition: { stations: [] }, createdAt: '', updatedAt: '',
        },
      });

      const execution = await useWorkflowStore.getState().simulateWorkflow();

      const state = useWorkflowStore.getState();
      expect(execution.id).toBe('exec-1');
      expect(state.currentExecution).not.toBeNull();
      expect(state.isSimulating).toBe(false);
    });
  });

  describe('clearError', () => {
    it('resets error to null', () => {
      useWorkflowStore.setState({ error: 'Some error' });

      useWorkflowStore.getState().clearError();

      expect(useWorkflowStore.getState().error).toBeNull();
    });
  });
});
