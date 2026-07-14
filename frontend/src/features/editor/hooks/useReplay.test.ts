import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReplay } from './useReplay';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useReplay', () => {
  it('starts paused at index 0', () => {
    const { result } = renderHook(() => useReplay(3));
    expect(result.current.index).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });

  it('advances one step per tick while playing and auto-pauses at the end', () => {
    const { result } = renderHook(() => useReplay(3, 1000));
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.index).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.index).toBe(2);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.index).toBe(2);          // clamped at last
    expect(result.current.isPlaying).toBe(false);  // auto-paused
  });

  it('next/prev pause and clamp', () => {
    const { result } = renderHook(() => useReplay(2));
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    act(() => result.current.next());
    expect(result.current.index).toBe(1);          // clamp high
    act(() => { result.current.prev(); result.current.prev(); });
    expect(result.current.index).toBe(0);          // clamp low
    expect(result.current.isPlaying).toBe(false);
  });

  it('seek clamps and pauses', () => {
    const { result } = renderHook(() => useReplay(5));
    act(() => result.current.seek(99));
    expect(result.current.index).toBe(4);
    act(() => result.current.seek(-3));
    expect(result.current.index).toBe(0);
  });

  it('play from the end restarts at 0', () => {
    const { result } = renderHook(() => useReplay(3));
    act(() => result.current.seek(2));
    act(() => result.current.play());
    expect(result.current.index).toBe(0);
    expect(result.current.isPlaying).toBe(true);
  });

  it('total of 0 keeps index at 0 and controls are inert', () => {
    const { result } = renderHook(() => useReplay(0));
    act(() => result.current.play());
    act(() => result.current.next());
    expect(result.current.index).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });
});
