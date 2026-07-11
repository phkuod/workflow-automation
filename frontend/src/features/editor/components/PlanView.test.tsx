import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import PlanView from './PlanView';
import type { Workflow } from '../../../shared/types/workflow';

const workflow: Workflow = {
  id: 'w1', name: 'Daily Report', status: 'draft',
  createdAt: '', updatedAt: '',
  definition: {
    stations: [
      {
        id: 'st1', name: 'Collect data', position: { x: 0, y: 0 },
        steps: [
          { id: 's1', name: 'Every day', type: 'trigger-cron', config: { cronExpression: '0 9 * * *' }, position: { x: 0, y: 0 } },
          { id: 's2', name: 'Fetch', type: 'http-request', config: { url: 'https://api.example.com/data' }, position: { x: 0, y: 0 } },
        ],
      },
      {
        id: 'st2', name: 'Send report', position: { x: 0, y: 0 },
        steps: [
          { id: 's3', name: 'Email', type: 'action-email', config: { emailTo: 'team@co.com' }, position: { x: 0, y: 0 } },
        ],
      },
    ],
  },
};

function renderView(overrides: Partial<ComponentProps<typeof PlanView>> = {}) {
  const props = {
    workflow,
    onEditStep: vi.fn(),
    onEditStage: vi.fn(),
    onAddStage: vi.fn(),
    ...overrides,
  };
  render(<PlanView {...props} />);
  return props;
}

describe('PlanView', () => {
  it('renders the trigger line from the first trigger step', () => {
    renderView();
    expect(screen.getByText('When it starts:')).toBeInTheDocument();
    expect(screen.getByText('On a schedule (0 9 * * *)')).toBeInTheDocument();
  });

  it('renders each stage with numbered heading and its non-trigger actions', () => {
    renderView();
    expect(screen.getByText('Stage 1 — Collect data')).toBeInTheDocument();
    expect(screen.getByText('Stage 2 — Send report')).toBeInTheDocument();
    expect(screen.getByText('Call an external service (api.example.com)')).toBeInTheDocument();
    expect(screen.getByText('Send an email (to team@co.com)')).toBeInTheDocument();
    // trigger step is shown in the header line, not repeated as an action row
    expect(screen.queryByText('On a schedule (0 9 * * *)', { selector: 'li *' })).not.toBeInTheDocument();
  });

  it('fires onEditStep with the action id when an action edit button is clicked', () => {
    const props = renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Call an external service (api.example.com)' }));
    expect(props.onEditStep).toHaveBeenCalledWith('s2');
  });

  it('fires onEditStep with the trigger id from the trigger line edit button', () => {
    const props = renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Edit when it starts' }));
    expect(props.onEditStep).toHaveBeenCalledWith('s1');
  });

  it('fires onEditStage when a stage heading edit button is clicked', () => {
    const props = renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Edit stage Collect data' }));
    expect(props.onEditStage).toHaveBeenCalledWith('st1');
  });

  it('fires onAddStage from the add-stage button', () => {
    const props = renderView();
    fireEvent.click(screen.getByRole('button', { name: '+ Add a stage' }));
    expect(props.onAddStage).toHaveBeenCalled();
  });

  it('shows a friendly hint when there is no trigger yet', () => {
    renderView({
      workflow: {
        ...workflow,
        definition: { stations: [{ id: 'st1', name: 'Only', position: { x: 0, y: 0 }, steps: [] }] },
      },
    });
    expect(screen.getByText(/No start condition yet/)).toBeInTheDocument();
  });
});
