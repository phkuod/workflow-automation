import { EventEmitter } from 'events';

export interface ExecutionEvent {
  executionId: string;
  type: 'step:start' | 'step:complete' | 'step:failed'
      | 'station:start' | 'station:complete' | 'station:failed'
      | 'execution:complete' | 'execution:failed' | 'execution:cancelled';
  data: {
    stationId?: string;
    stationName?: string;
    stepId?: string;
    stepName?: string;
    status?: string;
    output?: Record<string, unknown>;
    error?: string;
    progress?: { completed: number; total: number };
    timestamp: string;
  };
}

class ExecutionEventBus extends EventEmitter {
  emitExecutionEvent(event: ExecutionEvent): void {
    this.emit(`execution:${event.executionId}`, event);
  }
}

export const executionEventBus = new ExecutionEventBus();
