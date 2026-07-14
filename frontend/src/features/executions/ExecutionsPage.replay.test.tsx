import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExecutionsPage from './ExecutionsPage';
import { executionApi } from '../../shared/api/workflowApi';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../shared/api/workflowApi', () => ({
  executionApi: { getAll: vi.fn(), getLogs: vi.fn(), delete: vi.fn(), cancel: vi.fn() },
}));
vi.mock('../../shared/components/ConfirmDialog', () => ({
  useConfirm: () => ({ confirm: vi.fn() }),
}));

const run = {
  id: 'exec-1', workflowId: 'w1', workflowName: 'Orders', status: 'completed',
  triggeredBy: 'manual', startTime: '2026-07-14T06:00:00.000Z', successRate: 100,
  result: { stations: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(executionApi.getAll).mockResolvedValue([run] as never);
});

describe('ExecutionsPage replay entry', () => {
  it('navigates to the editor in replay mode for a run', async () => {
    render(<ExecutionsPage />);
    const btn = await screen.findByRole('button', { name: /replay on canvas/i });
    fireEvent.click(btn);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/editor/w1?replay=exec-1'));
  });

  it('does not render Replay on canvas for a running run', async () => {
    vi.mocked(executionApi.getAll).mockResolvedValue([
      { ...run, id: 'exec-2', status: 'running', endTime: undefined },
    ] as never);
    render(<ExecutionsPage />);
    await screen.findByText('Orders');
    expect(screen.queryByRole('button', { name: /replay on canvas/i })).not.toBeInTheDocument();
  });

  it('renders Replay on canvas for a completed run', async () => {
    render(<ExecutionsPage />);
    expect(await screen.findByRole('button', { name: /replay on canvas/i })).toBeInTheDocument();
  });
});
