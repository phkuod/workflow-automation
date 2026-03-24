import { describe, it, expect, vi } from 'vitest';
import { createLogger, log, requestLogger } from '../utils/logger';

describe('logger utilities', () => {
  describe('createLogger', () => {
    it('returns a pino child logger with the given module name', () => {
      const child = createLogger('test-module');
      // A pino child logger has standard logging methods
      expect(typeof child.info).toBe('function');
      expect(typeof child.error).toBe('function');
      expect(typeof child.warn).toBe('function');
      expect(typeof child.debug).toBe('function');
    });

    it('returns different child instances for different module names', () => {
      const child1 = createLogger('module-a');
      const child2 = createLogger('module-b');
      // They should be distinct objects
      expect(child1).not.toBe(child2);
    });
  });

  describe('convenience log functions', () => {
    it('exposes info, error, warn, debug methods', () => {
      expect(typeof log.info).toBe('function');
      expect(typeof log.error).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.debug).toBe('function');
    });
  });

  describe('requestLogger middleware', () => {
    it('calls next() to pass control to the next middleware', () => {
      const mockReq = {
        method: 'GET',
        url: '/api/test',
      };
      const mockRes = {
        statusCode: 200,
        on: vi.fn(),
      };
      const mockNext = vi.fn();

      requestLogger(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('registers a finish event listener on the response', () => {
      const mockReq = {
        method: 'POST',
        url: '/api/workflows',
      };
      const mockRes = {
        statusCode: 201,
        on: vi.fn(),
      };
      const mockNext = vi.fn();

      requestLogger(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });
});
