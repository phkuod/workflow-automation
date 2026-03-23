import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExecutionStream } from './useExecutionStream';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  (globalThis as any).EventSource = MockEventSource;
});

describe('useExecutionStream', () => {
  it('returns empty state when executionId is null (no EventSource created)', () => {
    const { result } = renderHook(() => useExecutionStream(null));

    expect(result.current.events).toEqual([]);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isComplete).toBe(false);
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('creates EventSource with correct URL when executionId provided', () => {
    renderHook(() => useExecutionStream('exec-123'));

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('/api/executions/exec-123/stream');
  });

  it('accumulates events from onmessage', () => {
    const { result } = renderHook(() => useExecutionStream('exec-456'));
    const instance = MockEventSource.instances[0];

    act(() => {
      instance.onopen?.();
    });

    act(() => {
      instance.onmessage?.({ data: JSON.stringify({ type: 'step:started', stepId: 'step-1' }) });
      instance.onmessage?.({ data: JSON.stringify({ type: 'step:completed', stepId: 'step-1' }) });
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[0]).toEqual({ type: 'step:started', stepId: 'step-1' });
    expect(result.current.events[1]).toEqual({ type: 'step:completed', stepId: 'step-1' });
  });

  it('sets isComplete=true on terminal event execution:complete', () => {
    const { result } = renderHook(() => useExecutionStream('exec-789'));
    const instance = MockEventSource.instances[0];

    act(() => {
      instance.onopen?.();
    });

    act(() => {
      instance.onmessage?.({ data: JSON.stringify({ type: 'execution:complete' }) });
    });

    expect(result.current.isComplete).toBe(true);
    expect(instance.close).toHaveBeenCalled();
  });

  it('cleans up (calls source.close) on unmount', () => {
    const { unmount } = renderHook(() => useExecutionStream('exec-999'));
    const instance = MockEventSource.instances[0];

    unmount();

    expect(instance.close).toHaveBeenCalled();
  });
});
