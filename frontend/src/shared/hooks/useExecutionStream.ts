import { useState, useEffect, useCallback } from 'react';
import type { ExecutionEvent } from '../types/workflow';

export function useExecutionStream(executionId: string | null) {
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!executionId) {
      setEvents([]);
      setIsConnected(false);
      setIsComplete(false);
      return;
    }

    const source = new EventSource(`/api/executions/${executionId}/stream`);

    source.onopen = () => setIsConnected(true);

    source.onmessage = (e) => {
      try {
        const event: ExecutionEvent = JSON.parse(e.data);
        if (event.type) {
          setEvents(prev => [...prev, event]);
          if (['execution:complete', 'execution:failed', 'execution:cancelled'].includes(event.type)) {
            setIsComplete(true);
            source.close();
          }
        }
      } catch {
        // ignore parse errors for heartbeat messages
      }
    };

    source.onerror = () => {
      source.close();
      setIsConnected(false);
    };

    return () => {
      source.close();
      setIsConnected(false);
    };
  }, [executionId]);

  const reset = useCallback(() => {
    setEvents([]);
    setIsComplete(false);
  }, []);

  return { events, isConnected, isComplete, reset };
}
