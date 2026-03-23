import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockConfirm = vi.fn();
vi.mock('../../shared/components/ConfirmDialog', () => ({
  useConfirm: () => ({ confirm: mockConfirm }),
}));

const mockGetAll = vi.fn();
const mockGetLogs = vi.fn();
const mockDelete = vi.fn();
const mockCancel = vi.fn();
vi.mock('../../shared/api/workflowApi', () => ({
  executionApi: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    getLogs: (...args: unknown[]) => mockGetLogs(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    cancel: (...args: unknown[]) => mockCancel(...args),
  },
}));

vi.mock('../../shared/constants/colors', () => ({
  EDGE_COLORS: {
    success: '#22c55e',
    error: '#ef4444',
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    warning: '#f59e0b',
    muted: '#64748b',
  },
}));

import ExecutionsPage from './ExecutionsPage';

const mockExecutions = [
  {
    id: 'e1',
    workflowId: 'w1',
    workflowName: 'Test Workflow',
    status: 'completed',
    triggeredBy: 'manual',
    startTime: '2024-01-01T10:00:00Z',
    endTime: '2024-01-01T10:00:05Z',
    successRate: 100,
    result: { stations: [] },
  },
  {
    id: 'e2',
    workflowId: 'w1',
    workflowName: 'Test Workflow',
    status: 'failed',
    triggeredBy: 'schedule',
    startTime: '2024-01-01T09:00:00Z',
    endTime: '2024-01-01T09:00:10Z',
    successRate: 50,
    result: { stations: [] },
  },
];

describe('ExecutionsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetLogs.mockResolvedValue([]);
    mockConfirm.mockResolvedValue(false);
  });

  it('shows loading state initially', async () => {
    // Return a promise that never resolves so we stay in loading state
    mockGetAll.mockReturnValue(new Promise(() => {}));

    render(<ExecutionsPage />);

    expect(screen.getByText('Loading executions...')).toBeInTheDocument();
  });

  it('shows executions after loading', async () => {
    mockGetAll.mockResolvedValue(mockExecutions);

    render(<ExecutionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Test Workflow')).toHaveLength(2);
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('manual')).toBeInTheDocument();
    expect(screen.getByText('schedule')).toBeInTheDocument();
  });

  it('shows empty state when no executions', async () => {
    mockGetAll.mockResolvedValue([]);

    render(<ExecutionsPage />);

    await waitFor(() => {
      expect(screen.getByText('No Executions Yet')).toBeInTheDocument();
    });
  });

  it('shows "Execution History" title', async () => {
    mockGetAll.mockResolvedValue([]);

    render(<ExecutionsPage />);

    expect(screen.getByText('Execution History')).toBeInTheDocument();
  });

  it('Refresh button calls fetchExecutions again', async () => {
    mockGetAll.mockResolvedValue(mockExecutions);

    render(<ExecutionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });

    expect(mockGetAll).toHaveBeenCalledTimes(1);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledTimes(2);
    });
  });

  it('shows execution count text', async () => {
    mockGetAll.mockResolvedValue(mockExecutions);

    render(<ExecutionsPage />);

    await waitFor(() => {
      expect(screen.getByText('2 executions')).toBeInTheDocument();
    });
  });
});
