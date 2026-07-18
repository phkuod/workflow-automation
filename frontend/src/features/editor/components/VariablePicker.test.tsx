import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VariablePicker, clearAiShapeCacheForTests } from './VariablePicker';
import { workflowApi, aiApi } from '../../../shared/api/workflowApi';
import { useAiEnabled } from '../../../shared/hooks/useAiEnabled';
import type { Workflow } from '../../../shared/types/workflow';

vi.mock('../../../shared/api/workflowApi', () => ({
  workflowApi: { getDataShapes: vi.fn().mockResolvedValue({ source: { kind: 'none' }, steps: {} }) },
  aiApi: { inferShape: vi.fn() },
}));
vi.mock('../../../shared/hooks/useAiEnabled', () => ({
  useAiEnabled: vi.fn().mockReturnValue(false),
}));

const workflow = {
  id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
  definition: {
    stations: [{
      id: 'st1', name: 'S', position: { x: 0, y: 0 },
      steps: [
        { id: 's1', name: 'Fetch data', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
        { id: 's2', name: 'Email', type: 'action-email', config: {}, position: { x: 0, y: 0 } },
      ],
    }],
  },
} as Workflow;

// Each legacy test starts with `await screen.findByText('Use result from')` purely to flush
// the async useDataShapes mount fetch inside act() — all original assertions are unchanged.
describe('VariablePicker plain language', () => {
  it('is framed as "Use result from"', async () => {
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={vi.fn()} />);
    await screen.findByText('Use result from');
    expect(screen.getByText('Use result from')).toBeInTheDocument();
  });

  it('inserts the identical interpolation string for the whole-result option', async () => {
    const onSelect = vi.fn();
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={onSelect} />);
    await screen.findByText('Use result from');
    fireEvent.click(screen.getByRole('button', { name: 'whole result (as text)' }));
    expect(onSelect).toHaveBeenCalledWith("${steps['Fetch data'].output}");
  });

  it('offers response body for http steps with the identical path', async () => {
    const onSelect = vi.fn();
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={onSelect} />);
    await screen.findByText('Use result from');
    fireEvent.click(screen.getByRole('button', { name: 'response body' }));
    expect(onSelect).toHaveBeenCalledWith("steps['Fetch data'].output.data");
  });
});

const runShapes = {
  source: { kind: 'run', executionId: 'e1', time: '2026-07-13T06:00:00.000Z' },
  steps: {
    s1: {
      status: 'completed',
      shape: {
        name: '', type: 'object',
        children: [{
          name: 'data', type: 'object',
          children: [{ name: 'orderId', type: 'number', sample: '10023' }],
        }],
      },
    },
  },
};

describe('VariablePicker with data shapes', () => {
  beforeEach(() => {
    clearAiShapeCacheForTests();
    vi.mocked(aiApi.inferShape).mockClear();
  });

  it('renders the field tree from the latest run with a source badge', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue(runShapes as never);
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={vi.fn()} />);
    expect(await screen.findByText('orderId')).toBeInTheDocument();
    expect(screen.getByText(/From run at/)).toBeInTheDocument();
  });

  it('clicking a field inserts the full steps[…].output path', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue(runShapes as never);
    const onSelect = vi.fn();
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={onSelect} />);
    fireEvent.click(await screen.findByRole('button', { name: /orderId/ }));
    expect(onSelect).toHaveBeenCalledWith("steps['Fetch data'].output.data.orderId");
  });

  it('shows "No data from last run" for steps that did not complete', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue({
      source: { kind: 'run', executionId: 'e1', time: '2026-07-13T06:00:00.000Z' },
      steps: { s1: { status: 'failed' } },
    } as never);
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={vi.fn()} />);
    expect(await screen.findByText('No data from last run')).toBeInTheDocument();
  });

  it('offers Predict fields only when AI is enabled and no run shape exists', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue({ source: { kind: 'none' }, steps: {} } as never);
    vi.mocked(useAiEnabled).mockReturnValue(true);
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={vi.fn()} />);
    expect(await screen.findByRole('button', { name: /Predict fields/ })).toBeInTheDocument();
  });

  it('Predict fields fetches an AI guess and renders it with the guess badge', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue({ source: { kind: 'none' }, steps: {} } as never);
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.inferShape).mockResolvedValue({
      name: '', type: 'object',
      children: [{ name: 'status', type: 'number', sample: '200' }],
    } as never);
    const onSelect = vi.fn();
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={onSelect} />);
    fireEvent.click(await screen.findByRole('button', { name: /Predict fields/ }));
    await waitFor(() => expect(screen.getByText(/AI guess/)).toBeInTheDocument());
    // exact match: s1 is a http-request step, whose generic "status code" button
    // also matches a loose /status/ regex — pin the AI-guess tree's "status" node instead.
    fireEvent.click(screen.getByRole('button', { name: 'status' }));
    expect(onSelect).toHaveBeenCalledWith("steps['Fetch data'].output.status");
  });

  it('keeps the generic buttons rendered alongside the tree', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue(runShapes as never);
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'whole result (as text)' })).toBeInTheDocument();
  });

  it('joins a bracketed top-level field directly onto output with no dot', async () => {
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue({
      source: { kind: 'run', executionId: 'e1', time: '2026-07-13T06:00:00.000Z' },
      steps: {
        s1: {
          status: 'completed',
          shape: {
            name: '', type: 'object',
            children: [{ name: 'content-type', type: 'string', sample: 'application/json' }],
          },
        },
      },
    } as never);
    const onSelect = vi.fn();
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={onSelect} />);
    fireEvent.click(await screen.findByRole('button', { name: /content-type/ }));
    expect(onSelect).toHaveBeenCalledWith("steps['Fetch data'].output['content-type']");
  });

  it('dedupes AI predictions for steps with identical type and config via the module cache', async () => {
    const twinStepsWorkflow = {
      id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
      definition: {
        stations: [{
          id: 'st1', name: 'S', position: { x: 0, y: 0 },
          steps: [
            { id: 's1', name: 'Fetch A', type: 'http-request', config: { url: 'https://x' }, position: { x: 0, y: 0 } },
            { id: 's2', name: 'Fetch B', type: 'http-request', config: { url: 'https://x' }, position: { x: 0, y: 0 } },
            { id: 's3', name: 'Email', type: 'action-email', config: {}, position: { x: 0, y: 0 } },
          ],
        }],
      },
    } as Workflow;
    vi.mocked(workflowApi.getDataShapes).mockResolvedValue({ source: { kind: 'none' }, steps: {} } as never);
    vi.mocked(useAiEnabled).mockReturnValue(true);
    vi.mocked(aiApi.inferShape).mockResolvedValue({
      name: '', type: 'object',
      children: [{ name: 'guessId', type: 'number', sample: '7' }],
    } as never);
    render(<VariablePicker workflow={twinStepsWorkflow} currentStepId="s3" onSelect={vi.fn()} />);
    const predictButtons = await screen.findAllByRole('button', { name: /Predict fields/ });
    expect(predictButtons).toHaveLength(2);
    fireEvent.click(predictButtons[0]);
    await waitFor(() => expect(screen.getByText(/AI guess/)).toBeInTheDocument());
    // second step hits the module cache: guess renders without a second API call
    fireEvent.click(screen.getByRole('button', { name: /Predict fields/ }));
    await waitFor(() => expect(screen.getAllByText(/AI guess/)).toHaveLength(2));
    expect(screen.getAllByRole('button', { name: 'guessId' })).toHaveLength(2);
    expect(aiApi.inferShape).toHaveBeenCalledTimes(1);
  });
});
