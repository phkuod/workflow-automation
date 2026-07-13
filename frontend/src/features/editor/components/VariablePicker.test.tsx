import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariablePicker } from './VariablePicker';
import type { Workflow } from '../../../shared/types/workflow';

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

describe('VariablePicker plain language', () => {
  it('is framed as "Use result from"', () => {
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={vi.fn()} />);
    expect(screen.getByText('Use result from')).toBeInTheDocument();
  });

  it('inserts the identical interpolation string for the whole-result option', () => {
    const onSelect = vi.fn();
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'whole result (as text)' }));
    expect(onSelect).toHaveBeenCalledWith("${steps['Fetch data'].output}");
  });

  it('offers response body for http steps with the identical path', () => {
    const onSelect = vi.fn();
    render(<VariablePicker workflow={workflow} currentStepId="s2" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'response body' }));
    expect(onSelect).toHaveBeenCalledWith("steps['Fetch data'].output.data");
  });
});
