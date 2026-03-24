import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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

// Mock workflowApi
vi.mock('../../shared/api/workflowApi', () => ({
  workflowApi: { execute: vi.fn() },
}));

// Mock ExecuteDialog
vi.mock('../editor/components/ExecuteDialog', () => ({
  default: () => null,
}));

// Mock the workflow store
const mockStore = {
  workflows: [],
  fetchWorkflows: vi.fn(),
  createWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  isLoading: false,
  error: null,
};
vi.mock('../editor/stores/workflowStore', () => ({
  useWorkflowStore: () => mockStore,
}));

import DashboardPage from './DashboardPage';

const mockWorkflows = [
  {
    id: '1',
    name: 'Test Flow',
    status: 'active' as const,
    description: 'desc',
    definition: { stations: [{ id: 's1', name: 'S1', steps: [] }], inputParameters: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
  },
  {
    id: '2',
    name: 'Flow 2',
    status: 'paused' as const,
    description: '',
    definition: { stations: [], inputParameters: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
  },
  {
    id: '3',
    name: 'Flow 3',
    status: 'draft' as const,
    description: '',
    definition: { stations: [], inputParameters: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
  },
];

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.workflows = [];
    mockStore.isLoading = false;
    mockStore.error = null;
    mockStore.fetchWorkflows = vi.fn();
    mockStore.createWorkflow = vi.fn();
    mockStore.deleteWorkflow = vi.fn();
    mockStore.updateWorkflow = vi.fn();
  });

  it('calls fetchWorkflows on mount', () => {
    render(<DashboardPage />);
    expect(mockStore.fetchWorkflows).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    mockStore.isLoading = true;
    render(<DashboardPage />);
    expect(screen.getByText('Loading workflows...')).toBeInTheDocument();
  });

  it('shows empty state when no workflows', () => {
    mockStore.workflows = [];
    render(<DashboardPage />);
    expect(screen.getByText('No workflows yet')).toBeInTheDocument();
  });

  it('shows stats cards with correct counts', () => {
    mockStore.workflows = mockWorkflows as typeof mockStore.workflows;
    render(<DashboardPage />);

    // Total Workflows = 3
    const totalLabel = screen.getByText('Total Workflows');
    const totalCard = totalLabel.closest('.stat-card');
    expect(totalCard).not.toBeNull();
    expect(totalCard!.querySelector('.text-3xl')?.textContent).toBe('3');

    // Active = 1
    const activeLabel = screen.getByText('Active');
    const activeCard = activeLabel.closest('.stat-card');
    expect(activeCard).not.toBeNull();
    expect(activeCard!.querySelector('.text-3xl')?.textContent).toBe('1');

    // Paused = 1
    const pausedLabel = screen.getByText('Paused');
    const pausedCard = pausedLabel.closest('.stat-card');
    expect(pausedCard).not.toBeNull();
    expect(pausedCard!.querySelector('.text-3xl')?.textContent).toBe('1');

    // Draft = 1
    const draftLabel = screen.getByText('Draft');
    const draftCard = draftLabel.closest('.stat-card');
    expect(draftCard).not.toBeNull();
    expect(draftCard!.querySelector('.text-3xl')?.textContent).toBe('1');
  });

  it('shows workflow names in the table', () => {
    mockStore.workflows = mockWorkflows as typeof mockStore.workflows;
    render(<DashboardPage />);

    expect(screen.getByText('Test Flow')).toBeInTheDocument();
    expect(screen.getByText('Flow 2')).toBeInTheDocument();
    expect(screen.getByText('Flow 3')).toBeInTheDocument();
  });

  it('"New Workflow" button opens create modal', async () => {
    render(<DashboardPage />);

    expect(screen.queryByRole('dialog')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText('New Workflow'));
    });

    expect(screen.getByRole('dialog', { name: 'Create New Workflow' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., Daily Report Generator')).toBeInTheDocument();
  });

  it('navigates to editor on workflow row click', async () => {
    mockStore.workflows = mockWorkflows as typeof mockStore.workflows;
    render(<DashboardPage />);

    await act(async () => {
      fireEvent.click(screen.getByText('Test Flow'));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/editor/1');
  });

  it('shows error badge when error is set', () => {
    mockStore.error = 'Failed to load workflows';
    render(<DashboardPage />);

    expect(screen.getByText('Failed to load workflows')).toBeInTheDocument();
  });
});
