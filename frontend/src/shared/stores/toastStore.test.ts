import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useToastStore, toast } from './toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  it('adds a toast', () => {
    toast.success('Test message');
    const state = useToastStore.getState();
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].type).toBe('success');
    expect(state.toasts[0].message).toBe('Test message');
  });

  it('adds multiple toast types', () => {
    toast.success('Success');
    toast.error('Error');
    toast.warning('Warning');
    toast.info('Info');
    expect(useToastStore.getState().toasts).toHaveLength(4);
  });

  it('removes a toast by id', () => {
    toast.success('Test');
    const id = useToastStore.getState().toasts[0].id;
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('auto-removes toast after duration', () => {
    toast.success('Auto remove', 3000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('clears all toasts', () => {
    toast.success('A');
    toast.error('B');
    useToastStore.getState().clearAll();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
