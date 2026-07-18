import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WhatIfLab } from './WhatIfLab';
import type { Workflow } from '../../../shared/types/workflow';

const setWhatIfScenarios = vi.fn();
const runScenarios = vi.fn();
let storeState: Record<string, unknown>;

vi.mock('../stores/workflowStore', () => ({
  useWorkflowStore: () => storeState,
}));

const workflow: Workflow = {
  id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
  definition: { stations: [
    { id: 'st1', name: 'Stage 1', position: { x: 0, y: 0 }, steps: [
      { id: 's1', name: 'Fetch', type: 'http-request', config: {}, position: { x: 0, y: 0 } },
    ] },
  ] },
};

beforeEach(() => {
  vi.clearAllMocks();
  storeState = {
    whatIfScenarios: [], whatIfResults: null, isRunningScenarios: false,
    setWhatIfScenarios, runScenarios,
  };
});

describe('WhatIfLab', () => {
  it('adds a scenario when Add scenario is clicked', () => {
    render(<WhatIfLab workflow={workflow} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add scenario/i }));
    expect(setWhatIfScenarios).toHaveBeenCalled();
    const next = setWhatIfScenarios.mock.calls[0][0];
    expect(next).toHaveLength(1);
    expect(next[0]).toHaveProperty('name');
  });

  it('runs scenarios when Run all is clicked', () => {
    storeState.whatIfScenarios = [{ name: 'Scenario 1' }];
    render(<WhatIfLab workflow={workflow} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /run all scenarios/i }));
    expect(runScenarios).toHaveBeenCalled();
  });

  it('disables Run all when there are no scenarios', () => {
    render(<WhatIfLab workflow={workflow} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /run all scenarios/i })).toBeDisabled();
  });

  it('renders the matrix when results exist', () => {
    storeState.whatIfScenarios = [{ name: 'S1' }];
    storeState.whatIfResults = [{ name: 'S1', result: { stations: [
      { stationId: 'st1', stationName: 'Stage 1', status: 'completed', steps: [] },
    ] } }];
    render(<WhatIfLab workflow={workflow} onClose={vi.fn()} />);
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('Stage 1')).toBeInTheDocument();
  });

  it('does not leak a removed scenario input text into the next scenario', () => {
    storeState.whatIfScenarios = [
      { id: 'a', name: 'S1', inputData: { leak: true } },
      { id: 'b', name: 'S2' },
      { id: 'c', name: 'S3' },
    ];
    const { rerender } = render(<WhatIfLab workflow={workflow} onClose={vi.fn()} />);
    // Sanity: first editor shows S1's input data
    expect((screen.getAllByLabelText('Input data')[0] as HTMLTextAreaElement).value).toContain('leak');

    // Remove the first scenario; drive the store round-trip like the app does
    fireEvent.click(screen.getAllByRole('button', { name: /remove scenario/i })[0]);
    const next = setWhatIfScenarios.mock.calls[0][0];
    expect(next.map((s: { name: string }) => s.name)).toEqual(['S2', 'S3']);
    storeState.whatIfScenarios = next;
    rerender(<WhatIfLab workflow={workflow} onClose={vi.fn()} />);

    // The editor now bound to old-S2 must NOT display old-S1's input text
    const inputs = screen.getAllByLabelText('Input data') as HTMLTextAreaElement[];
    expect(inputs[0].value).toBe('');
  });

  it('shows Invalid JSON for a bad mock-output and never commits the raw string', () => {
    storeState.whatIfScenarios = [
      { id: 'a', name: 'S1', stepOverrides: [{ id: 'o1', stepId: 's1', mockOutput: {} }] },
    ];
    render(<WhatIfLab workflow={workflow} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Mock output JSON'), { target: { value: '{ nope' } });
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
    expect(setWhatIfScenarios).not.toHaveBeenCalled();
  });

  it('commits parsed JSON from the mock-output textarea', () => {
    storeState.whatIfScenarios = [
      { id: 'a', name: 'S1', stepOverrides: [{ id: 'o1', stepId: 's1', mockOutput: {} }] },
    ];
    render(<WhatIfLab workflow={workflow} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Mock output JSON'), { target: { value: '{"a":1}' } });
    const calls = setWhatIfScenarios.mock.calls;
    const next = calls[calls.length - 1][0];
    expect(next[0].stepOverrides[0].mockOutput).toEqual({ a: 1 });
  });
});
