import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InputProvider, useInput } from './InputDialog';

function TestComponent({ onResult }: { onResult: (v: string | null) => void }) {
  const { prompt } = useInput();

  const handleClick = async () => {
    const result = await prompt({
      title: 'Test Title',
      message: 'Test message',
      placeholder: 'Enter value...',
      confirmText: 'OK',
      cancelText: 'Cancel',
    });
    onResult(result);
  };

  return <button onClick={handleClick}>Open</button>;
}

describe('InputDialog', () => {
  it('throws when useInput is used outside InputProvider', () => {
    function BadComponent() {
      useInput();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      'useInput must be used within an InputProvider'
    );
  });

  it('shows dialog with title and message when prompt is called', async () => {
    const onResult = vi.fn();
    render(
      <InputProvider>
        <TestComponent onResult={onResult} />
      </InputProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Open'));
    });

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter value...')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('confirm button resolves with trimmed input value', async () => {
    const onResult = vi.fn();
    render(
      <InputProvider>
        <TestComponent onResult={onResult} />
      </InputProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Open'));
    });

    const input = screen.getByPlaceholderText('Enter value...');

    await act(async () => {
      fireEvent.change(input, { target: { value: '  hello world  ' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('OK'));
    });

    expect(onResult).toHaveBeenCalledWith('hello world');
  });

  it('cancel button resolves null', async () => {
    const onResult = vi.fn();
    render(
      <InputProvider>
        <TestComponent onResult={onResult} />
      </InputProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Open'));
    });

    const input = screen.getByPlaceholderText('Enter value...');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'some text' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'));
    });

    expect(onResult).toHaveBeenCalledWith(null);
  });

  it('overlay click resolves null', async () => {
    const onResult = vi.fn();
    render(
      <InputProvider>
        <TestComponent onResult={onResult} />
      </InputProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Open'));
    });

    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();

    await act(async () => {
      fireEvent.click(overlay!);
    });

    expect(onResult).toHaveBeenCalledWith(null);
  });

  it('confirm button is disabled when input is empty', async () => {
    const onResult = vi.fn();
    render(
      <InputProvider>
        <TestComponent onResult={onResult} />
      </InputProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Open'));
    });

    const confirmButton = screen.getByText('OK');
    expect(confirmButton).toBeDisabled();

    const input = screen.getByPlaceholderText('Enter value...');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'text' } });
    });

    expect(confirmButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.change(input, { target: { value: '' } });
    });

    expect(confirmButton).toBeDisabled();
  });

  it('Enter key confirms with non-empty input, Escape key cancels', async () => {
    const onResult = vi.fn();
    render(
      <InputProvider>
        <TestComponent onResult={onResult} />
      </InputProvider>
    );

    // Test Escape cancels
    await act(async () => {
      fireEvent.click(screen.getByText('Open'));
    });

    const input = screen.getByPlaceholderText('Enter value...');

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });

    expect(onResult).toHaveBeenCalledWith(null);
    onResult.mockClear();

    // Test Enter confirms
    await act(async () => {
      fireEvent.click(screen.getByText('Open'));
    });

    const input2 = screen.getByPlaceholderText('Enter value...');

    await act(async () => {
      fireEvent.change(input2, { target: { value: 'my value' } });
    });

    await act(async () => {
      fireEvent.keyDown(input2, { key: 'Enter' });
    });

    expect(onResult).toHaveBeenCalledWith('my value');
  });
});
