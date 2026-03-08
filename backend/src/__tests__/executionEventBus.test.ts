import { describe, it, expect, vi } from 'vitest';
import { executionEventBus, type ExecutionEvent } from '../services/executionEventBus';

describe('ExecutionEventBus', () => {
  it('emits events scoped to execution ID', () => {
    const handler = vi.fn();
    executionEventBus.on('execution:exec-1', handler);

    const event: ExecutionEvent = {
      executionId: 'exec-1',
      type: 'step:start',
      data: { stepId: 's1', stepName: 'Step 1', timestamp: new Date().toISOString() },
    };

    executionEventBus.emitExecutionEvent(event);
    expect(handler).toHaveBeenCalledWith(event);

    executionEventBus.off('execution:exec-1', handler);
  });

  it('does not emit to unrelated execution listeners', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    executionEventBus.on('execution:exec-1', handler1);
    executionEventBus.on('execution:exec-2', handler2);

    executionEventBus.emitExecutionEvent({
      executionId: 'exec-1',
      type: 'execution:complete',
      data: { timestamp: new Date().toISOString() },
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();

    executionEventBus.off('execution:exec-1', handler1);
    executionEventBus.off('execution:exec-2', handler2);
  });

  it('supports multiple listeners for same execution', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    executionEventBus.on('execution:exec-1', handler1);
    executionEventBus.on('execution:exec-1', handler2);

    executionEventBus.emitExecutionEvent({
      executionId: 'exec-1',
      type: 'station:start',
      data: { stationId: 'st1', timestamp: new Date().toISOString() },
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    executionEventBus.off('execution:exec-1', handler1);
    executionEventBus.off('execution:exec-1', handler2);
  });
});
