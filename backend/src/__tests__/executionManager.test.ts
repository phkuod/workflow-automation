import { describe, it, expect, beforeEach } from 'vitest';
import { executionManager } from '../services/executionManager';

describe('ExecutionManager', () => {
  beforeEach(() => {
    // Clear any leftover state by trying to unregister known IDs
    executionManager.unregister('test-1');
    executionManager.unregister('test-2');
  });

  it('registers an execution and returns an AbortSignal', () => {
    const signal = executionManager.register('test-1');
    expect(signal).toBeDefined();
    expect(signal.aborted).toBe(false);
    expect(executionManager.isRunning('test-1')).toBe(true);
    executionManager.unregister('test-1');
  });

  it('cancels a running execution', () => {
    const signal = executionManager.register('test-1');
    const cancelled = executionManager.cancel('test-1');
    expect(cancelled).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(executionManager.isRunning('test-1')).toBe(false);
  });

  it('returns false when cancelling a non-existent execution', () => {
    const cancelled = executionManager.cancel('non-existent');
    expect(cancelled).toBe(false);
  });

  it('unregisters an execution', () => {
    executionManager.register('test-1');
    executionManager.unregister('test-1');
    expect(executionManager.isRunning('test-1')).toBe(false);
  });

  it('handles multiple concurrent executions', () => {
    const signal1 = executionManager.register('test-1');
    const signal2 = executionManager.register('test-2');

    expect(executionManager.isRunning('test-1')).toBe(true);
    expect(executionManager.isRunning('test-2')).toBe(true);

    executionManager.cancel('test-1');
    expect(signal1.aborted).toBe(true);
    expect(signal2.aborted).toBe(false);
    expect(executionManager.isRunning('test-1')).toBe(false);
    expect(executionManager.isRunning('test-2')).toBe(true);

    executionManager.unregister('test-2');
  });
});
