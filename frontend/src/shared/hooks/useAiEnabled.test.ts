import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../api/workflowApi', () => ({
  aiApi: { getStatus: vi.fn() },
}));

import { aiApi } from '../api/workflowApi';

describe('useAiEnabled', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns false initially and true after status resolves enabled', async () => {
    vi.mocked(aiApi.getStatus).mockResolvedValue({ enabled: true });
    const { useAiEnabled } = await import('./useAiEnabled');
    const { result } = renderHook(() => useAiEnabled());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays false when the status call fails', async () => {
    vi.mocked(aiApi.getStatus).mockRejectedValue(new Error('network'));
    const { useAiEnabled } = await import('./useAiEnabled');
    const { result } = renderHook(() => useAiEnabled());
    await waitFor(() => expect(aiApi.getStatus).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('fetches status only once across multiple mounts', async () => {
    vi.mocked(aiApi.getStatus).mockResolvedValue({ enabled: true });
    const { useAiEnabled } = await import('./useAiEnabled');
    const a = renderHook(() => useAiEnabled());
    const b = renderHook(() => useAiEnabled());
    await waitFor(() => expect(a.result.current).toBe(true));
    await waitFor(() => expect(b.result.current).toBe(true));
    expect(aiApi.getStatus).toHaveBeenCalledTimes(1);
  });
});
