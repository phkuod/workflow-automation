import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import EditorPage from './EditorPage';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'w1' }),
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams('replay=exec-1'), vi.fn()],
}));

// EditorPage calls these unconditionally on every render (see EditorPage.plan.test.tsx).
vi.mock('../../shared/components/InputDialog', () => ({
  useInput: () => ({ prompt: vi.fn() }),
}));
vi.mock('../../shared/components/ConfirmDialog', () => ({
  useConfirm: () => ({ confirm: vi.fn() }),
}));
vi.mock('../../shared/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const enterReplay = vi.fn();
const exitReplay = vi.fn();
const saveWorkflow = vi.fn();
const workflow = {
  id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
  definition: { stations: [
    { id: 'st1', name: 'Stage 1', position: { x: 0, y: 0 }, steps: [
      { id: 's1', name: 'Fetch', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
    ] },
  ] },
};
const replayExecution = {
  id: 'exec-1', workflowId: 'w1', workflowName: 'W', status: 'completed',
  triggeredBy: 'manual', startTime: 't', successRate: 100,
  result: { stations: [
    { stationId: 'st1', stationName: 'Stage 1', status: 'completed', steps: [
      { stepId: 's1', stepName: 'Fetch', stepType: 'http-request', status: 'completed', output: { orderId: 10023 } },
    ] },
  ] },
};

vi.mock('./stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    currentWorkflow: workflow,
    replayExecution,
    enterReplay,
    exitReplay,
    fetchWorkflow: vi.fn(),
    setCurrentWorkflow: vi.fn(),
    createWorkflow: vi.fn(),
    // editing actions/fields the component reads — stubbed
    saveWorkflow, addStation: vi.fn(), addStep: vi.fn(), updateStep: vi.fn(),
    deleteStep: vi.fn(), selectStep: vi.fn(), selectedStepId: null, selectedStationId: null,
    selectStation: vi.fn(), updateStation: vi.fn(), deleteStation: vi.fn(), connectSteps: vi.fn(),
    simulateWorkflow: vi.fn(), executeWorkflow: vi.fn(), isSimulating: false,
    currentExecution: null, executionLogs: [], isLoading: false, isSaving: false, isDirty: false,
    updateWorkflow: vi.fn(),
  }),
}));
vi.mock('../../shared/hooks/useAiEnabled', () => ({ useAiEnabled: () => false }));

beforeEach(() => vi.clearAllMocks());

describe('EditorPage replay mode', () => {
  it('enters replay for the ?replay= execution', async () => {
    render(<EditorPage />);
    await waitFor(() => expect(enterReplay).toHaveBeenCalledWith('exec-1'));
  });

  it('shows the replay bar and hides Save/Test', () => {
    render(<EditorPage />);
    expect(screen.getByRole('button', { name: /exit replay/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Test$/i })).not.toBeInTheDocument();
  });

  it('hides all editing chrome: Add Stage, Params, Version History, status select, Plan/Canvas toggle, Node Library', () => {
    render(<EditorPage />);
    expect(screen.queryByRole('button', { name: /add stage/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add action/i })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Input Parameters')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Version History')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Plan View$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Canvas View$/i })).not.toBeInTheDocument();
  });

  it('does not persist on Ctrl+S while in replay', () => {
    render(<EditorPage />);
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(saveWorkflow).not.toHaveBeenCalled();
  });

  it('shows the current action snapshot in the inspector', () => {
    render(<EditorPage />);
    expect(screen.getByText('10023')).toBeInTheDocument();
  });
});
