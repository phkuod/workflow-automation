/**
 * Manages running executions and their AbortControllers.
 * Allows cancellation of in-progress workflow executions.
 */
class ExecutionManager {
  private running = new Map<string, AbortController>();

  register(executionId: string): AbortSignal {
    const controller = new AbortController();
    this.running.set(executionId, controller);
    return controller.signal;
  }

  cancel(executionId: string): boolean {
    const controller = this.running.get(executionId);
    if (!controller) return false;
    controller.abort();
    this.running.delete(executionId);
    return true;
  }

  unregister(executionId: string): void {
    this.running.delete(executionId);
  }

  isRunning(executionId: string): boolean {
    return this.running.has(executionId);
  }
}

export const executionManager = new ExecutionManager();
