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

    expect(screen.getByText('Loading runs...')).toBeInTheDocument();
  });

  it('shows executions after loading', async () => {
    mockGetAll.mockResolvedValue(mockExecutions);

    render(<ExecutionsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Test Workflow')).toHaveLength(2);
    });
    // Filter bar also contains "completed"/"failed" button text, so use getAllByText
    expect(screen.getAllByText('completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('failed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('manual')).toBeInTheDocument();
    expect(screen.getByText('schedule')).toBeInTheDocument();
  });

  it('shows empty state when no executions', async () => {
    mockGetAll.mockResolvedValue([]);

    render(<ExecutionsPage />);

    await waitFor(() => {
      expect(screen.getByText('No runs yet')).toBeInTheDocument();
    });
  });

  it('shows "Run History" title', async () => {
    mockGetAll.mockResolvedValue([]);

    render(<ExecutionsPage />);

    expect(screen.getByText('Run History')).toBeInTheDocument();
  });

  it('Refresh button calls fetchExecutions again', async () => {
    mockGetAll.mockResolvedValue(mockExecutions);

    render(<ExecutionsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Test Workflow').length).toBeGreaterThan(0);
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
      expect(screen.getByText('2 runs')).toBeInTheDocument();
    });
  });

  it('keeps a row expanded when another row is expanded', async () => {
    const executions = [
      {
        id: 'e1',
        workflowId: 'w1',
        workflowName: 'Workflow One',
        status: 'completed',
        triggeredBy: 'manual',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T10:00:05Z',
        successRate: 100,
        result: { stations: [{ stationId: 's1', stationName: 'Station Alpha', status: 'completed', steps: [] }] },
      },
      {
        id: 'e2',
        workflowId: 'w2',
        workflowName: 'Workflow Two',
        status: 'completed',
        triggeredBy: 'manual',
        startTime: '2024-01-01T09:00:00Z',
        endTime: '2024-01-01T09:00:05Z',
        successRate: 100,
        result: { stations: [{ stationId: 's2', stationName: 'Station Beta', status: 'completed', steps: [] }] },
      },
    ];
    mockGetAll.mockResolvedValue(executions);

    render(<ExecutionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Workflow One')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Workflow One'));
    await waitFor(() => {
      expect(screen.getByText('Station Alpha')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Workflow Two'));
    await waitFor(() => {
      expect(screen.getByText('Station Beta')).toBeInTheDocument();
    });

    // The first row's expanded content must still be present.
    expect(screen.getByText('Station Alpha')).toBeInTheDocument();
  });

  it('paginates runs 10 per page', async () => {
    const executions = Array.from({ length: 25 }, (_, i) => ({
      id: 'e' + i,
      workflowId: 'w1',
      workflowName: 'WF ' + i,
      status: 'completed',
      triggeredBy: 'manual',
      startTime: new Date(2026, 0, 1, 0, i).toISOString(),
      endTime: new Date(2026, 0, 1, 0, i, 30).toISOString(),
      successRate: 100,
    }));
    mockGetAll.mockResolvedValue(executions);

    render(<ExecutionsPage />);

    await waitFor(() => {
      expect(screen.getByText('WF 0')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/^WF \d+$/)).toHaveLength(10);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.queryByText('WF 10')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('WF 10')).toBeInTheDocument();
    });
    expect(screen.queryByText('WF 0')).not.toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });
});
