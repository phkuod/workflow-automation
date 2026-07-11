import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RunTimeline from './RunTimeline';
import type { ExecutionResult } from '../../../shared/types/workflow';

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
