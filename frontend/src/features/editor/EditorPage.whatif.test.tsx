import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditorPage from './EditorPage';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'w1' }),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()], // no replay
}));

const workflow = {
  id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
  definition: { stations: [
    { id: 'st1', name: 'Stage 1', position: { x: 0, y: 0 }, steps: [
      { id: 's1', name: 'Fetch', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
    ] },
  ] },
};

vi.mock('./stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    currentWorkflow: workflow, fetchWorkflow: vi.fn(), setCurrentWorkflow: vi.fn(), createWorkflow: vi.fn(),
    saveWorkflow: vi.fn(), addStation: vi.fn(), addStep: vi.fn(), updateStep: vi.fn(), deleteStep: vi.fn(),
    selectStep: vi.fn(), selectedStepId: null, selectedStationId: null, selectStation: vi.fn(),
    updateStation: vi.fn(), deleteStation: vi.fn(), connectSteps: vi.fn(), simulateWorkflow: vi.fn(),
    executeWorkflow: vi.fn(), isSimulating: false, currentExecution: null, executionLogs: [],
    isLoading: false, isSaving: false, isDirty: false, updateWorkflow: vi.fn(),
    replayExecution: null, enterReplay: vi.fn(), exitReplay: vi.fn(), error: null,
    whatIfScenarios: [], whatIfResults: null, isRunningScenarios: false, setWhatIfScenarios: vi.fn(), runScenarios: vi.fn(),
  }),
}));
vi.mock('../../shared/hooks/useAiEnabled', () => ({ useAiEnabled: () => false }));

// EditorPage uses useInput()/useConfirm()/toast — mirror the mock set that
// EditorPage.replay.test.tsx already uses (read that file and copy its
// InputDialog/ConfirmDialog/toastStore vi.mock calls here) so the page renders.
vi.mock('../../shared/components/InputDialog', () => ({
  useInput: () => ({ prompt: vi.fn() }),
}));
vi.mock('../../shared/components/ConfirmDialog', () => ({
  useConfirm: () => ({ confirm: vi.fn() }),
}));
vi.mock('../../shared/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('EditorPage What-If toggle', () => {
  it('opens the What-If Lab from the toolbar', () => {
    render(<EditorPage />);
    expect(screen.queryByText('What-If Lab')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /what-if/i }));
    expect(screen.getByText('What-If Lab')).toBeInTheDocument();
  });
});
