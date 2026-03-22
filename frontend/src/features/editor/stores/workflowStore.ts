import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type {
  Workflow,
  WorkflowDefinition,
  Station,
  Step,
  StepType,
  Execution,
  ExecutionLog
} from '../../../shared/types/workflow';
import { workflowApi, executionApi } from '../../../shared/api/workflowApi';

// Generate UUID function (simple version for browser)
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface WorkflowState {
  // Data
  workflows: Workflow[];
  currentWorkflow: Workflow | null;
  executions: Execution[];
  currentExecution: Execution | null;
  executionLogs: ExecutionLog[];
  
  // UI State
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  error: string | null;
  selectedStepId: string | null;
  selectedStationId: string | null;
  isSimulating: boolean;
  
  // Actions
  fetchWorkflows: () => Promise<void>;
  fetchWorkflow: (id: string) => Promise<void>;
  createWorkflow: (name: string, description?: string, definition?: WorkflowDefinition) => Promise<Workflow>;
  updateWorkflow: (id: string, data: Partial<Workflow>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  saveWorkflow: () => Promise<void>;
  
  // Editor actions
  setCurrentWorkflow: (workflow: Workflow | null) => void;
  addStation: (name: string) => void;
  updateStation: (stationId: string, data: Partial<Station>) => void;
  deleteStation: (stationId: string) => void;
  addStep: (stationId: string, type: StepType, name: string) => void;
  updateStep: (stepId: string, data: Partial<Step>) => void;
  deleteStep: (stepId: string) => void;
  connectSteps: (stationId: string, sourceId: string, targetId: string, sourceHandle?: string) => void;
  selectStep: (stepId: string | null) => void;
  selectStation: (stationId: string | null) => void;
  
  // Execution actions
  executeWorkflow: (inputData?: Record<string, unknown>) => Promise<Execution>;
  simulateWorkflow: (inputData?: Record<string, unknown>) => Promise<Execution>;
  fetchExecutions: (workflowId: string) => Promise<void>;
  fetchExecutionLogs: (executionId: string) => Promise<void>;
  
  // Utils
  clearError: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // Initial state
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

  // Fetch all workflows
  fetchWorkflows: async () => {
    set({ isLoading: true, error: null });
    try {
      const workflows = await workflowApi.getAll();
      set({ workflows, isLoading: false });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
    }
  },

  // Fetch single workflow
  fetchWorkflow: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const workflow = await workflowApi.getById(id);
      set({ currentWorkflow: workflow, isLoading: false });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
    }
  },

  // Create new workflow
  createWorkflow: async (name: string, description?: string, existingDefinition?: WorkflowDefinition) => {
    set({ isLoading: true, error: null });
    try {
      const definition: WorkflowDefinition = existingDefinition || {
        stations: [],
        variables: {},
      };
      const workflow = await workflowApi.create({ name, description, definition });
      set((state) => ({
        workflows: [workflow, ...state.workflows],
        currentWorkflow: workflow,
        isLoading: false,
      }));
      return workflow;
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      throw error;
    }
  },

  // Update workflow
  updateWorkflow: async (id: string, data: Partial<Workflow>) => {
    try {
      const workflow = await workflowApi.update(id, data);
      set((state) => ({
        workflows: state.workflows.map((w) => (w.id === id ? workflow : w)),
        currentWorkflow: state.currentWorkflow?.id === id ? workflow : state.currentWorkflow,
      }));
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  // Delete workflow
  deleteWorkflow: async (id: string) => {
    try {
      await workflowApi.delete(id);
      set((state) => ({
        workflows: state.workflows.filter((w) => w.id !== id),
        currentWorkflow: state.currentWorkflow?.id === id ? null : state.currentWorkflow,
      }));
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  // Save current workflow
  saveWorkflow: async () => {
    const { currentWorkflow, isSaving } = get();
    if (!currentWorkflow || isSaving) return;

    // Snapshot workflow state before async operation
    const snapshot = {
      id: currentWorkflow.id,
      name: currentWorkflow.name,
      description: currentWorkflow.description,
      definition: currentWorkflow.definition,
    };

    set({ isSaving: true });
    try {
      await workflowApi.update(snapshot.id, {
        name: snapshot.name,
        description: snapshot.description,
        definition: snapshot.definition,
      });
      set({ isSaving: false, isDirty: false });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error), isSaving: false });
    }
  },

  // Set current workflow
  setCurrentWorkflow: (workflow) => {
    set({ currentWorkflow: workflow, selectedStepId: null, selectedStationId: null, isDirty: false });
  },

  // Add a new station
  addStation: (name: string) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;

    const newStation: Station = {
      id: generateId(),
      name,
      steps: [],
      position: { x: currentWorkflow.definition.stations.length * 300, y: 100 },
    };

    set({
      currentWorkflow: {
        ...currentWorkflow,
        definition: {
          ...currentWorkflow.definition,
          stations: [...currentWorkflow.definition.stations, newStation],
        },
      },
      isDirty: true,
    });
  },

  // Update station
  updateStation: (stationId: string, data: Partial<Station>) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;

    set({
      currentWorkflow: {
        ...currentWorkflow,
        definition: {
          ...currentWorkflow.definition,
          stations: currentWorkflow.definition.stations.map((s) =>
            s.id === stationId ? { ...s, ...data } : s
          ),
        },
      },
      isDirty: true,
    });
  },

  // Delete station
  deleteStation: (stationId: string) => {
    const { currentWorkflow, selectedStationId, selectedStepId } = get();
    if (!currentWorkflow) return;

    const deletedStation = currentWorkflow.definition.stations.find((s) => s.id === stationId);
    const stepIds = deletedStation ? deletedStation.steps.map((s) => s.id) : [];
    const clearStation = selectedStationId === stationId;
    const clearStep = selectedStepId !== null && stepIds.includes(selectedStepId);

    set({
      currentWorkflow: {
        ...currentWorkflow,
        definition: {
          ...currentWorkflow.definition,
          stations: currentWorkflow.definition.stations.filter((s) => s.id !== stationId),
        },
      },
      isDirty: true,
      selectedStationId: clearStation ? null : selectedStationId,
      selectedStepId: clearStep ? null : selectedStepId,
    });
  },

  // Add a new step to a station
  addStep: (stationId: string, type: StepType, name: string) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;

    const station = currentWorkflow.definition.stations.find((s) => s.id === stationId);
    if (!station) return;

    const newStep: Step = {
      id: generateId(),
      name,
      type,
      config: {},
      position: { x: 0, y: station.steps.length * 100 },
      inputVars: [],
      outputVars: [],
    };

    set({
      currentWorkflow: {
        ...currentWorkflow,
        definition: {
          ...currentWorkflow.definition,
          stations: currentWorkflow.definition.stations.map((s) =>
            s.id === stationId ? { ...s, steps: [...s.steps, newStep] } : s
          ),
        },
      },
      isDirty: true,
    });
  },

  // Update step
  updateStep: (stepId: string, data: Partial<Step>) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;

    set({
      currentWorkflow: {
        ...currentWorkflow,
        definition: {
          ...currentWorkflow.definition,
          stations: currentWorkflow.definition.stations.map((station) => ({
            ...station,
            steps: station.steps.map((step) =>
              step.id === stepId ? { ...step, ...data } : step
            ),
          })),
        },
      },
      isDirty: true,
    });
  },

  // Delete step (also cleans up related edges)
  deleteStep: (stepId: string) => {
    const { currentWorkflow, selectedStepId } = get();
    if (!currentWorkflow) return;

    set({
      currentWorkflow: {
        ...currentWorkflow,
        definition: {
          ...currentWorkflow.definition,
          stations: currentWorkflow.definition.stations.map((station) => ({
            ...station,
            steps: station.steps.filter((step) => step.id !== stepId),
            edges: station.edges?.filter((edge) => edge.source !== stepId && edge.target !== stepId),
          })),
        },
      },
      selectedStepId: selectedStepId === stepId ? null : selectedStepId,
      isDirty: true,
    });
  },

  // Connect steps (persist edge to station)
  connectSteps: (stationId: string, sourceId: string, targetId: string, sourceHandle?: string) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;

    const newEdge = {
      id: `edge-${sourceId}-${sourceHandle || 'default'}-${targetId}`,
      source: sourceId,
      target: targetId,
      sourceHandle,
    };

    set({
      currentWorkflow: {
        ...currentWorkflow,
        definition: {
          ...currentWorkflow.definition,
          stations: currentWorkflow.definition.stations.map((station) => {
            if (station.id !== stationId) return station;
            const existing = station.edges || [];
            return { ...station, edges: [...existing, newEdge] };
          }),
        },
      },
      isDirty: true,
    });
  },

  // Select step
  selectStep: (stepId) => {
    set({ selectedStepId: stepId, selectedStationId: null });
  },
  
  // Select station
  selectStation: (stationId) => {
    set({ selectedStationId: stationId, selectedStepId: null });
  },

  // Execute workflow
  executeWorkflow: async (inputData) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) throw new Error('No workflow selected');

    set({ isSimulating: true, error: null });
    try {
      const execution = await workflowApi.execute(currentWorkflow.id, inputData);
      set({ currentExecution: execution, isSimulating: false });
      return execution;
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error), isSimulating: false });
      throw error;
    }
  },

  // Simulate workflow
  simulateWorkflow: async (inputData) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) throw new Error('No workflow selected');

    set({ isSimulating: true, error: null });
    try {
      const execution = await workflowApi.simulate(currentWorkflow.id, inputData);
      set({ currentExecution: execution, isSimulating: false });
      
      // Fetch logs
      const logs = await executionApi.getLogs(execution.id);
      set({ executionLogs: logs });
      
      return execution;
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error), isSimulating: false });
      throw error;
    }
  },

  // Fetch executions
  fetchExecutions: async (workflowId: string) => {
    try {
      const executions = await workflowApi.getExecutions(workflowId);
      set({ executions });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  // Fetch execution logs
  fetchExecutionLogs: async (executionId: string) => {
    try {
      const logs = await executionApi.getLogs(executionId);
      set({ executionLogs: logs });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));

// Memoized selectors — use these instead of destructuring the whole store
export const useCurrentWorkflow = () => useWorkflowStore(s => s.currentWorkflow);
export const useSelectedStepId = () => useWorkflowStore(s => s.selectedStepId);
export const useSelectedStationId = () => useWorkflowStore(s => s.selectedStationId);
export const useWorkflowUIState = () =>
  useWorkflowStore(useShallow(s => ({
    isLoading: s.isLoading,
    isSaving: s.isSaving,
    isDirty: s.isDirty,
    error: s.error,
    isSimulating: s.isSimulating,
  })));
export const useEditorActions = () =>
  useWorkflowStore(useShallow(s => ({
    addStation: s.addStation,
    updateStation: s.updateStation,
    deleteStation: s.deleteStation,
    addStep: s.addStep,
    updateStep: s.updateStep,
    deleteStep: s.deleteStep,
    connectSteps: s.connectSteps,
    selectStep: s.selectStep,
    selectStation: s.selectStation,
    saveWorkflow: s.saveWorkflow,
    setCurrentWorkflow: s.setCurrentWorkflow,
  })));
