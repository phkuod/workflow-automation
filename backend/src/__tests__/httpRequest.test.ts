import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScriptRunner } from '../services/scriptRunner';

describe('HTTP Request Step', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('makes a GET request and returns response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(JSON.stringify({ data: 'hello' })),
    });

    const result = await ScriptRunner.executeHttpRequest(
      { url: 'https://api.example.com/data', method: 'GET' },
      {}
    );

    expect(result.success).toBe(true);
    expect(result.output.status).toBe(200);
    expect(result.output.data).toEqual({ data: 'hello' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('makes a POST request with body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      statusText: 'Created',
      text: () => Promise.resolve(JSON.stringify({ id: 1 })),
    });

    const result = await ScriptRunner.executeHttpRequest(
      { url: 'https://api.example.com/items', method: 'POST', body: '{"name":"test"}' },
      {}
    );

    expect(result.success).toBe(true);
    expect(result.output.status).toBe(201);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com/items',
      expect.objectContaining({ method: 'POST', body: '{"name":"test"}' })
    );
  });

  it('handles non-ok response as failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('Not found'),
    });

    const result = await ScriptRunner.executeHttpRequest(
      { url: 'https://api.example.com/missing', method: 'GET' },
      {}
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('404');
  });

  it('handles network errors', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    const result = await ScriptRunner.executeHttpRequest(
      { url: 'https://api.example.com/down', method: 'GET' },
      {}
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network failure');
  });

  it('interpolates variables in URL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('{}'),
    });

    await ScriptRunner.executeHttpRequest(
      { url: 'https://api.example.com/users/${userId}', method: 'GET' },
      { userId: '123' }
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com/users/123',
      expect.any(Object)
    );
  });

  it('passes custom headers', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('{}'),
    });

    await ScriptRunner.executeHttpRequest(
      { url: 'https://api.example.com', method: 'GET', headers: { Authorization: 'Bearer token123' } },
      {}
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token123' }),
      })
    );
  });

  it('handles non-JSON response text', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('plain text response'),
    });

    const result = await ScriptRunner.executeHttpRequest(
      { url: 'https://api.example.com', method: 'GET' },
      {}
    );

    expect(result.success).toBe(true);
    expect(result.output.data).toBe('plain text response');
  });
});
