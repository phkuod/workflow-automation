import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
});
