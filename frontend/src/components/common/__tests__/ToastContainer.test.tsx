import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToastContainer from '../ToastContainer';
import { useToastStore } from '../../../stores/toastStore';

describe('ToastContainer', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('should not render when there are no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('should render toasts when present', () => {
    useToastStore.setState({
      toasts: [
        { id: '1', type: 'success', message: 'Success message', duration: 5000 },
      ],
    });

    render(<ToastContainer />);
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('should render multiple toasts', () => {
    useToastStore.setState({
      toasts: [
        { id: '1', type: 'success', message: 'Message 1', duration: 5000 },
        { id: '2', type: 'error', message: 'Message 2', duration: 5000 },
      ],
    });

    render(<ToastContainer />);
    expect(screen.getByText('Message 1')).toBeInTheDocument();
    expect(screen.getByText('Message 2')).toBeInTheDocument();
  });

  it('should remove toast when close button is clicked', async () => {
    const user = userEvent.setup();
    useToastStore.setState({
      toasts: [
        { id: 'test-1', type: 'info', message: 'Test toast', duration: 5000 },
      ],
    });

    render(<ToastContainer />);
    
    const closeButtons = screen.getAllByRole('button');
    await user.click(closeButtons[0]);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
