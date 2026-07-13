import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotificationConfigForm from './NotificationConfigForm';
import type { Workflow } from '../../../../shared/types/workflow';

const workflow = {
  id: 'w1', name: 'W', status: 'draft', createdAt: '', updatedAt: '',
  definition: {
    stations: [{
      id: 'st1', name: 'S', position: { x: 0, y: 0 },
      steps: [
        { id: 's1', name: 'Send Email', type: 'action-email', config: {}, position: { x: 0, y: 0 } },
      ],
    }],
  },
} as Workflow;

describe('NotificationConfigForm EmailForm preview', () => {
  it('renders a live preview of the email', () => {
    render(
      <NotificationConfigForm
        type="action-email"
        stepId="s1"
        workflow={workflow}
        emailTo="team@co.com"
        emailSubject="Daily Report"
        emailBody="Numbers attached."
        onEmailToChange={vi.fn()}
        onEmailSubjectChange={vi.fn()}
        onEmailBodyChange={vi.fn()}
      />
    );

    expect(screen.getByText('Preview')).toBeInTheDocument();
    const previewHeading = screen.getByText('Preview');
    const previewRegion = previewHeading.parentElement as HTMLElement;
    expect(previewRegion).toHaveTextContent('team@co.com');
    expect(previewRegion).toHaveTextContent('Daily Report');
    expect(previewRegion).toHaveTextContent('Numbers attached.');
  });

  it('shows placeholder text in the preview when fields are empty', () => {
    render(
      <NotificationConfigForm
        type="action-email"
        stepId="s1"
        workflow={workflow}
        emailTo=""
        emailSubject=""
        emailBody=""
        onEmailToChange={vi.fn()}
        onEmailSubjectChange={vi.fn()}
        onEmailBodyChange={vi.fn()}
      />
    );

    expect(screen.getByText('(no recipient)', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('(no subject)')).toBeInTheDocument();
  });
});
