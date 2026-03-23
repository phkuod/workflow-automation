import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToastContainer from './ToastContainer';
import { useToastStore } from '../stores/toastStore';

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe('ToastContainer', () => {
  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders toast messages', () => {
    useToastStore.setState({
      toasts: [
        { id: '1', type: 'success', message: 'Saved successfully' },
        { id: '2', type: 'error', message: 'Something went wrong' },
      ],
    });

    render(<ToastContainer />);

    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('dismiss button removes a toast', () => {
    useToastStore.setState({
      toasts: [{ id: '42', type: 'info', message: 'Hello world' }],
    });

    render(<ToastContainer />);

    expect(screen.getByText('Hello world')).toBeInTheDocument();

    const dismissButton = screen.getByRole('button', { name: 'Dismiss notification' });
    fireEvent.click(dismissButton);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('has correct aria attributes on the notification region', () => {
    useToastStore.setState({
      toasts: [{ id: '99', type: 'warning', message: 'Watch out' }],
    });

    render(<ToastContainer />);

    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-label', 'Notifications');
  });
});
