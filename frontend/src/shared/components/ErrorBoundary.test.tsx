import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const ThrowingComponent = ({ message }: { message?: string }) => {
  throw new Error(message ?? 'Test error');
};

const NormalComponent = () => <div>Normal content</div>;

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('catches errors and shows fallback UI', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();

    spy.mockRestore();
  });

  it('displays the error message from the thrown error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent message="Something specific broke" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something specific broke')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('shows "An unexpected error occurred" when error has no message', () => {
    const EmptyMessageThrower = () => {
      throw new Error('');
    };

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <EmptyMessageThrower />
      </ErrorBoundary>
    );

    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('resets error state and shows children again when "Try Again" is clicked', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let shouldThrow = true;
    const ConditionalThrower = () => {
      if (shouldThrow) throw new Error('Test error');
      return <div>Recovered content</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    rerender(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    expect(screen.getByText('Recovered content')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();

    spy.mockRestore();
  });

  it('has role="alert" on the error fallback container', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    spy.mockRestore();
  });
});
