import { describe, it, expect, vi } from 'vitest';

// Use vi.hoisted so the mock instance is available when vi.mock's factory runs
const { mockLoggerInstance } = vi.hoisted(() => ({
  mockLoggerInstance: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock logger so every createLogger call returns the shared mock instance
vi.mock('../utils/logger', () => ({
  createLogger: vi.fn(() => mockLoggerInstance),
}));

import { safeJsonParse } from '../utils/safeJsonParse';

describe('safeJsonParse', () => {
  it('parses valid JSON and returns the result', () => {
    const result = safeJsonParse('{"name":"test","value":42}', {}, 'test');
    expect(result).toEqual({ name: 'test', value: 42 });
  });

  it('parses valid JSON arrays', () => {
    const result = safeJsonParse('[1,2,3]', [], 'test-array');
    expect(result).toEqual([1, 2, 3]);
  });

  it('returns fallback on invalid JSON', () => {
    const fallback = { default: true };
    const result = safeJsonParse('not valid json {{{', fallback, 'invalid-test');
    expect(result).toBe(fallback);
  });

  it('returns fallback for empty string', () => {
    const fallback = { empty: true };
    const result = safeJsonParse('', fallback, 'empty-string');
    expect(result).toBe(fallback);
  });

  it('logs an error when JSON parsing fails', () => {
    mockLoggerInstance.error.mockClear();
    const fallback = 'default';
    safeJsonParse('broken json', fallback, 'error-context');

    expect(mockLoggerInstance.error).toHaveBeenCalled();
    const callArgs = mockLoggerInstance.error.mock.calls[0];
    expect(callArgs[0]).toHaveProperty('context', 'error-context');
    expect(callArgs[1]).toContain('Failed to parse JSON');
  });
});
