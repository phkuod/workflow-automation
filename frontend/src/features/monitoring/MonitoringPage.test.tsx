import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock recharts - jsdom can't render SVG charts
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
}));

// Mock metricsApi
const mockGetExecutionHistory = vi.fn().mockResolvedValue([]);
vi.mock('../../shared/api/workflowApi', () => ({
  metricsApi: {
    getExecutionHistory: (...args: unknown[]) => mockGetExecutionHistory(...args),
  },
}));

import MonitoringPage from './MonitoringPage';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const mockMetrics = {
  success: true,
  data: {
    timestamp: '2024-01-01T00:00:00Z',
    uptime: 90061, // 1d 1h 1m
    workflows: { total: 5, active: 3, paused: 1, draft: 1 },
    executions: {
      total: 100,
      completed: 85,
      failed: 15,
      running: 0,
      successRate: 85,
      last24Hours: 10,
      last7Days: 50,
    },
    scheduler: { scheduledWorkflows: 2, activeSchedules: 2, pausedSchedules: 0 },
    system: {
      memoryUsage: { heapUsed: 42, heapTotal: 64, rss: 80 },
      nodeVersion: 'v18.0.0',
    },
  },
};

// ---------------------------------------------------------------------------
// Helper: build a fetch spy that resolves to the given body
// ---------------------------------------------------------------------------

function mockFetchSuccess(body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

function mockFetchFailure(message = 'Network error') {
  return vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(message));
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MonitoringPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    mockGetExecutionHistory.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Test 1: page title
  // -------------------------------------------------------------------------
  it('shows "System Monitoring" title', async () => {
    mockFetchSuccess(mockMetrics);

    render(<MonitoringPage />);

    expect(screen.getByText('System Monitoring')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Test 2: skeleton loading state
  // -------------------------------------------------------------------------
  it('shows loading skeletons initially before data resolves', () => {
    // Keep fetch perpetually pending so the loading state stays visible
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

    render(<MonitoringPage />);

    // The component renders 4 skeleton cards while isLoading && !metrics
    const skeletons = document.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Test 3: displays metrics data after fetch resolves
  // -------------------------------------------------------------------------
  it('shows metrics data after fetch resolves', async () => {
    mockFetchSuccess(mockMetrics);

    render(<MonitoringPage />);

    // Wait for the async fetch to complete and state to update
    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    // Stat cards
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('Server Uptime')).toBeInTheDocument();
    expect(screen.getByText('1d 1h 1m')).toBeInTheDocument();
    expect(screen.getByText('Active Schedules')).toBeInTheDocument();
    expect(screen.getByText('Memory (Heap)')).toBeInTheDocument();
    expect(screen.getAllByText('42 MB').length).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // Test 4: error message when fetch fails
  // -------------------------------------------------------------------------
  it('shows error message when fetch fails', async () => {
    mockFetchFailure('Failed to connect to server');

    render(<MonitoringPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to connect to server')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Test 5: Refresh button is present
  // -------------------------------------------------------------------------
  it('has a Refresh button', async () => {
    mockFetchSuccess(mockMetrics);

    render(<MonitoringPage />);

    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});
