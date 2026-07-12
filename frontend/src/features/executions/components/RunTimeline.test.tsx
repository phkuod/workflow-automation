import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RunTimeline from './RunTimeline';
import type { ExecutionResult } from '../../../shared/types/workflow';

vi.mock('../../../shared/hooks/useAiEnabled', () => ({ useAiEnabled: vi.fn() }));
vi.mock('../../../shared/api/workflowApi', () => ({ aiApi: { explain: vi.fn() } }));
import { useAiEnabled } from '../../../shared/hooks/useAiEnabled';
import { aiApi } from '../../../shared/api/workflowApi';

const result: ExecutionResult = {
  stations: [
    {
      stationId: 'st1',
      stationName: 'Collect data',
      status: 'completed',
      steps: [
        {
          stepId: 's1', stepName: 'Fetch', stepType: 'http-request',
          status: 'completed', input: { url: 'https://api.example.com/data' },
        },
      ],
    },
    {
      stationId: 'st2',
      stationName: 'Send report',
      status: 'failed',
      steps: [
        {
          stepId: 's2', stepName: 'Email', stepType: 'action-email',
          status: 'failed', input: { emailTo: 'team@company.com' },
          error: { message: 'connect ETIMEDOUT 1.2.3.4:587' },
        },
      ],
    },
  ],
};

describe('RunTimeline', () => {
  beforeEach(() => {
    vi.mocked(useAiEnabled).mockReturnValue(false);
  });

  it('renders one node per stage', () => {
    render(<RunTimeline result={result} />);
    expect(screen.getByText('Collect data')).toBeInTheDocument();
    expect(screen.getByText('Send report')).toBeInTheDocument();
  });

  it('renders plain-language summaries per action', () => {
    render(<RunTimeline result={result} />);
    expect(screen.getByText('Called https://api.example.com/data')).toBeInTheDocument();
  });

  it('renders translated errors for failed actions', () => {
    render(<RunTimeline result={result} />);
    expect(screen.getByText('The service took too long to respond')).toBeInTheDocument();
    // raw error available in collapsed details
    expect(screen.getByText(/connect ETIMEDOUT/)).toBeInTheDocument();
  });
});

describe('Explain this', () => {
  it('is hidden when AI is disabled', () => {
    vi.mocked(useAiEnabled).mockReturnValue(false);
    render(<RunTimeline result={result} workflowName="My flow" />);
    expect(screen.queryByRole('button', { name: 'Explain this' })).not.toBeInTheDocument();
  });

  it('fetches and shows the explanation for a failed action', async () => {
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.explain).mockResolvedValue('The mail server took too long. Try again later.');
    render(<RunTimeline result={result} workflowName="My flow" />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain this' }));
    await waitFor(() => {
      expect(aiApi.explain).toHaveBeenCalledWith({
        workflowName: 'My flow',
        stationName: 'Send report',
        stepName: 'Email',
        stepType: 'action-email',
        errorMessage: 'connect ETIMEDOUT 1.2.3.4:587',
      });
      expect(screen.getByText('The mail server took too long. Try again later.')).toBeInTheDocument();
    });
  });

  it('shows a gentle inline message when the explanation fails', async () => {
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.explain).mockRejectedValue(new Error('nope'));
    render(<RunTimeline result={result} workflowName="My flow" />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain this' }));
    await waitFor(() => {
      expect(screen.getByText("Couldn't get an explanation right now.")).toBeInTheDocument();
    });
  });
});
