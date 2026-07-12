import { useEffect, useState } from 'react';
import { aiApi } from '../api/workflowApi';

let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;

function fetchEnabled(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached);
  if (!pending) {
    pending = aiApi
      .getStatus()
      .then(s => {
        cached = s.enabled;
        return cached;
      })
      .catch(() => {
        cached = false;
        return false;
      });
  }
  return pending;
}

/** Whether AI assist is configured on the server. False until known; cached for the session. */
export function useAiEnabled(): boolean {
  const [enabled, setEnabled] = useState(cached ?? false);

  useEffect(() => {
    let mounted = true;
    fetchEnabled().then(value => {
      if (mounted) setEnabled(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return enabled;
}
