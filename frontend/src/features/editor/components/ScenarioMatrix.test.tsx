import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenarioMatrix } from './ScenarioMatrix';
import type { Station } from '../../../shared/types/workflow';
import type { ScenarioResult } from '../types/scenario';

const stations: Station[] = [
  { id: 'st1', name: 'Fetch stage', position: { x: 0, y: 0 }, steps: [] },
  { id: 'st2', name: 'Notify stage', position: { x: 0, y: 0 }, steps: [] },
];

const results: ScenarioResult[] = [
  {
    name: 'Happy path',
    result: { stations: [
      { stationId: 'st1', stationName: 'Fetch stage', status: 'completed', steps: [
        { stepId: 's1', stepName: 'Fetch', stepType: 'http-request', status: 'completed', output: { orderId: 42 } },
      ] },
      { stationId: 'st2', stationName: 'Notify stage', status: 'completed', steps: [] },
    ] },
  },
  {
    name: 'API fails',
    result: { stations: [
      { stationId: 'st1', stationName: 'Fetch stage', status: 'failed', steps: [
        { stepId: 's1', stepName: 'Fetch', stepType: 'http-request', status: 'failed', error: { message: 'API down' } },
      ] },
      // st2 never ran
    ] },
  },
];

describe('ScenarioMatrix', () => {
  it('renders a row per scenario and a column per stage', () => {
    render(<ScenarioMatrix results={results} stations={stations} />);
    expect(screen.getByText('Happy path')).toBeInTheDocument();
    expect(screen.getByText('API fails')).toBeInTheDocument();
    expect(screen.getByText('Fetch stage')).toBeInTheDocument();
    expect(screen.getByText('Notify stage')).toBeInTheDocument();
  });

  it('marks the failed cell and shows step output when a completed cell is clicked', () => {
    render(<ScenarioMatrix results={results} stations={stations} />);
    // clicking Happy path × Fetch stage reveals the step output
    fireEvent.click(screen.getByRole('button', { name: /Happy path.*Fetch stage/i }));
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows the error message when a failed cell is opened', () => {
    render(<ScenarioMatrix results={results} stations={stations} />);
    fireEvent.click(screen.getByRole('button', { name: /API fails.*Fetch stage/i }));
    expect(screen.getByText(/API down/)).toBeInTheDocument();
  });
});
