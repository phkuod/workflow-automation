import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Workflow } from '../../shared/types/workflow';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'w1' }),
  useNavigate: () => mockNavigate,
}));

// Mock useInput
const mockPrompt = vi.fn();
vi.mock('../../shared/components/InputDialog', () => ({
  useInput: () => ({ prompt: mockPrompt }),
}));

// Mock useConfirm
const mockConfirm = vi.fn();
vi.mock('../../shared/components/ConfirmDialog', () => ({
  useConfirm: () => ({ confirm: mockConfirm }),
}));

// Mock toast
vi.mock('../../shared/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const workflow: Workflow = {
  id: 'w1', name: 'Daily Report', status: 'draft',
  createdAt: '', updatedAt: '',
  definition: {
    stations: [
      {
        id: 'st1', name: 'Collect data', position: { x: 0, y: 0 },
        steps: [
          { id: 's1', name: 'Every day', type: 'trigger-cron', config: { cronExpression: '0 9 * * *' }, position: { x: 0, y: 0 } },
          { id: 's2', name: 'Fetch', type: 'http-request', config: { url: 'https://api.example.com/data' }, position: { x: 0, y: 0 } },
        ],
      },
      {
        id: 'st2', name: 'Send report', position: { x: 0, y: 0 },
        steps: [
          { id: 's3', name: 'Email', type: 'action-email', config: { emailTo: 'team@co.com' }, position: { x: 0, y: 0 } },
        ],
      },
    ],
  },
};

// Mock the workflow store. selectStep/selectStation mutate the shared mock
// object; tests that need the UI to reflect a selection call `rerender`.
const mockStore = {
  currentWorkflow: workflow as Workflow | null,
  fetchWorkflow: vi.fn(),
  saveWorkflow: vi.fn(),
  setCurrentWorkflow: vi.fn(),
  addStation: vi.fn(),
  addStep: vi.fn(),
  updateStep: vi.fn(),
  deleteStep: vi.fn(),
  selectStep: vi.fn((stepId: string | null) => {
    mockStore.selectedStepId = stepId;
  }),
  selectedStepId: null as string | null,
  selectedStationId: null as string | null,
  selectStation: vi.fn((stationId: string | null) => {
    mockStore.selectedStationId = stationId;
  }),
  updateStation: vi.fn(),
  deleteStation: vi.fn(),
  connectSteps: vi.fn(),
  simulateWorkflow: vi.fn(),
  executeWorkflow: vi.fn(),
  isSimulating: false,
  currentExecution: null,
  executionLogs: [],
  isLoading: false,
  isSaving: false,
  isDirty: false,
  updateWorkflow: vi.fn(),
  createWorkflow: vi.fn(),
};
vi.mock('./stores/workflowStore', () => ({
  useWorkflowStore: () => mockStore,
}));

import EditorPage from './EditorPage';

describe('EditorPage view toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('editor.coachMarksSeen', '1');
    mockStore.currentWorkflow = workflow;
    mockStore.selectedStepId = null;
    mockStore.selectedStationId = null;
    mockStore.isSimulating = false;
    mockStore.isLoading = false;
    mockStore.isSaving = false;
    mockStore.isDirty = false;
  });

  it('defaults to Plan View when no preference is stored', () => {
    render(<EditorPage />);

    // PlanView content is visible
    expect(screen.getByText('When it starts:')).toBeInTheDocument();
    expect(screen.getByText('Stage 1 — Collect data')).toBeInTheDocument();

    // The React Flow canvas (StageCanvas) is not rendered — its stage node
    // uses a different label format ("Stage 1: Collect data") than the plan
    // row ("Stage 1 — Collect data"), and it renders inside a `.react-flow` root.
    expect(screen.queryByText('Stage 1: Collect data')).not.toBeInTheDocument();
    expect(document.querySelector('.react-flow')).not.toBeInTheDocument();
  });

  it('switches to Canvas View via the toolbar toggle and persists the choice', () => {
    render(<EditorPage />);

    fireEvent.click(screen.getByRole('button', { name: /canvas view/i }));

    // PlanView content is gone
    expect(screen.queryByText('When it starts:')).not.toBeInTheDocument();
    expect(screen.queryByText('Stage 1 — Collect data')).not.toBeInTheDocument();

    expect(window.localStorage.getItem('editor.viewMode')).toBe('canvas');
  });

  it('resets the canvas drill-in when switching to Plan View', () => {
    window.localStorage.setItem('editor.viewMode', 'canvas');
    render(<EditorPage />);

    // Drill into the first stage's step view via the stage node double-click
    fireEvent.doubleClick(screen.getByText('Stage 1: Collect data'));
    expect(screen.getByText('Action View')).toBeInTheDocument();
    // Breadcrumb now shows the stage crumb
    expect(screen.getByRole('button', { name: 'Collect data' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^plan view$/i }));

    // The stale stage crumb must be gone: breadcrumb shows only the automation name
    expect(screen.queryByRole('button', { name: 'Collect data' })).not.toBeInTheDocument();

    // Switching back to canvas lands on the stage overview, not the stale step view
    fireEvent.click(screen.getByRole('button', { name: /canvas view/i }));
    expect(screen.getByText('Stage View')).toBeInTheDocument();
    expect(screen.queryByText('Action View')).not.toBeInTheDocument();
  });

  it('opens the action config panel when a plan row edit button is clicked', () => {
    const { rerender } = render(<EditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Fetch: Call an external service (api.example.com)' }));
    expect(mockStore.selectStep).toHaveBeenCalledWith('s2');

    rerender(<EditorPage />);

    expect(screen.getByText('Action Name')).toBeInTheDocument();
  });
});
