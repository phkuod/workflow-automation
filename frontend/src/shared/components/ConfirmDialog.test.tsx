import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfirmProvider, useConfirm } from './ConfirmDialog';

function TestComponent({ onResult }: { onResult: (v: boolean) => void }) {
  const { confirm } = useConfirm();

  const handleClick = async () => {
    const result = await confirm({
      title: 'Test Title',
      message: 'Test message body',
      confirmText: 'Yes',
      cancelText: 'No',
      type: 'danger',
    });
    onResult(result);
  };

  return <button onClick={handleClick}>Open</button>;
}

describe('ConfirmDialog', () => {
  it('shows dialog when confirm is called', async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <TestComponent onResult={onResult} />
      </ConfirmProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Open'));
    });

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message body')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('resolves true when confirm button clicked', async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <TestComponent onResult={onResult} />
      </ConfirmProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Open'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Yes'));
    });

    expect(onResult).toHaveBeenCalledWith(true);
  });

  it('resolves false when cancel button clicked', async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <TestComponent onResult={onResult} />
      </ConfirmProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Open'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('No'));
    });

    expect(onResult).toHaveBeenCalledWith(false);
  });

  it('resolves false when overlay clicked', async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <TestComponent onResult={onResult} />
      </ConfirmProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Open'));
    });

    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();

    await act(async () => {
      fireEvent.click(overlay!);
    });

    expect(onResult).toHaveBeenCalledWith(false);
  });

  it('throws when useConfirm is used outside ConfirmProvider', () => {
    function BadComponent() {
      useConfirm();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      'useConfirm must be used within a ConfirmProvider'
    );
  });
});
