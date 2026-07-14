import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReplayInspector } from './ReplayInspector';
import type { ReplayStep } from '../utils/replaySnapshot';
import { aiApi } from '../../../shared/api/workflowApi';
import { useAiEnabled } from '../../../shared/hooks/useAiEnabled';

vi.mock('../../../shared/api/workflowApi', () => ({ aiApi: { explain: vi.fn() } }));
vi.mock('../../../shared/hooks/useAiEnabled', () => ({ useAiEnabled: vi.fn().mockReturnValue(false) }));

function completedStep(): ReplayStep {
  return {
    stationId: 'st1', stationName: 'Stage 1', stepId: 's1', stepName: 'Fetch',
    stationIndex: 0, existsInDefinition: true,
    step: { stepId: 's1', stepName: 'Fetch', stepType: 'http-request', status: 'completed', output: { orderId: 10023 } },
  };
}
function failedStep(): ReplayStep {
  return {
    stationId: 'st2', stationName: 'Stage 2', stepId: 's3', stepName: 'Mail',
    stationIndex: 1, existsInDefinition: true,
    step: { stepId: 's3', stepName: 'Mail', stepType: 'action-email', status: 'failed', error: { message: 'SMTP down' } },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('ReplayInspector', () => {
  it('renders nothing when replayStep is null', () => {
    const { container } = render(<ReplayInspector replayStep={null} onExit={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the step name and its output snapshot', () => {
    render(<ReplayInspector replayStep={completedStep()} onExit={vi.fn()} />);
    expect(screen.getByText('Fetch')).toBeInTheDocument();
    expect(screen.getByText('10023')).toBeInTheDocument();
  });

  it('shows a stale note when the action is no longer in the automation', () => {
    render(<ReplayInspector replayStep={{ ...completedStep(), existsInDefinition: false }} onExit={vi.fn()} />);
    expect(screen.getByText(/no longer in this automation/i)).toBeInTheDocument();
  });

  it('offers Explain this for a failed step only when AI is enabled', () => {
    vi.mocked(useAiEnabled).mockReturnValue(true);
    render(<ReplayInspector replayStep={failedStep()} onExit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /explain this/i })).toBeInTheDocument();
  });

  it('does not offer Explain this when AI is disabled', () => {
    vi.mocked(useAiEnabled).mockReturnValue(false);
    render(<ReplayInspector replayStep={failedStep()} onExit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /explain this/i })).not.toBeInTheDocument();
  });

  it('Explain this calls aiApi.explain and renders the result', async () => {
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.explain).mockResolvedValue('The mail server rejected the message.');
    render(<ReplayInspector replayStep={failedStep()} workflowName="W" onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /explain this/i }));
    await waitFor(() => expect(screen.getByText('The mail server rejected the message.')).toBeInTheDocument());
    expect(aiApi.explain).toHaveBeenCalledWith({
      workflowName: 'W', stationName: 'Stage 2', stepName: 'Mail', stepType: 'action-email', errorMessage: 'SMTP down',
    });
  });

  it('X in the inspector header calls onExit', () => {
    const onExit = vi.fn();
    render(<ReplayInspector replayStep={completedStep()} onExit={onExit} />);
    // StepDataInspector renders a single header close button
    fireEvent.click(screen.getByRole('button', { name: '' }) ?? screen.getAllByRole('button')[0]);
    expect(onExit).toHaveBeenCalled();
  });
});
