import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NodeConfigPanel from './NodeConfigPanel';
import type { Step, Workflow } from '../../../shared/types/workflow';

const emailStep: Step = {
  id: 's1', name: 'Email', type: 'action-email',
  config: { emailTo: 'a@b.c', emailSubject: 'Hi', emailBody: 'Hello' },
  position: { x: 0, y: 0 },
};
const workflow = {
  id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
  definition: { stations: [{ id: 'st1', name: 'S', position: { x: 0, y: 0 }, steps: [emailStep] }] },
} as Workflow;

function renderPanel(step: Step) {
  render(
    <NodeConfigPanel
      step={step}
      workflow={workflow}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

describe('NodeConfigPanel two-tier layout', () => {
  it('renders basic email fields immediately', () => {
    renderPanel(emailStep);
    expect(screen.getByText('To')).toBeInTheDocument();
    expect(screen.getByText('Subject')).toBeInTheDocument();
  });

  it('collapses retry policy inside an Advanced section', () => {
    renderPanel(emailStep);
    const advanced = screen.getByText('Advanced').closest('details');
    expect(advanced).not.toBeNull();
    expect(advanced).not.toHaveAttribute('open');
    // retry fields live inside the collapsed details
    expect(advanced!.textContent).toMatch(/Retry/i);
  });
});
