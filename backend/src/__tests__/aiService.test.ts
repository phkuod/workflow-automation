import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiService } from '../services/aiService';
import * as http from 'http';
import { EventEmitter } from 'events';

// Mock http.request
vi.mock('http', async () => {
  const actual = await vi.importActual<typeof http>('http');
  return {
    ...actual,
    request: vi.fn()
  };
});

vi.mock('https', async () => {
  const actual = await vi.importActual<typeof import('https')>('https');
  return {
    ...actual,
    request: vi.fn()
  };
});

function createMockResponse(statusCode: number, body: string) {
  const response = new EventEmitter() as EventEmitter & { statusCode: number; statusMessage: string };
  response.statusCode = statusCode;
  response.statusMessage = 'OK';
  return { response, body };
}

function setupHttpMock(statusCode: number, responseBody: unknown) {
  const body = JSON.stringify(responseBody);
  const mockReq = new EventEmitter() as EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
  mockReq.write = vi.fn();
  mockReq.end = vi.fn();
  mockReq.destroy = vi.fn();

  (http.request as ReturnType<typeof vi.fn>).mockImplementation((_options: unknown, callback: (res: unknown) => void) => {
    const res = new EventEmitter() as EventEmitter & { statusCode: number; statusMessage: string };
    res.statusCode = statusCode;
    res.statusMessage = 'OK';

    process.nextTick(() => {
      callback(res);
      res.emit('data', body);
      res.emit('end');
    });

    return mockReq;
  });

  return mockReq;
}

const interpolate = (template: string, ctx: Record<string, unknown>): string => {
  return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
    const parts = path.trim().split('.');
    let value: unknown = ctx;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return match;
      }
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  });
};

describe('AiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executeChat', () => {
    it('should return simulated response in simulate mode', async () => {
      const result = await AiService.executeChat(
        { aiModel: 'test-model' },
        {},
        interpolate,
        true
      );

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        simulated: true,
        response: '[Simulated AI response]',
        model: 'test-model'
      });
    });

    it('should make a chat completion request', async () => {
      setupHttpMock(200, {
        id: 'chatcmpl-123',
        choices: [{
          message: { role: 'assistant', content: 'Hello from AI' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const result = await AiService.executeChat(
        {
          aiBaseUrl: 'http://localhost:8000/v1',
          aiModel: 'test-model',
          aiSystemPrompt: 'You are helpful',
          aiUserPrompt: 'Say hello'
        },
        {},
        interpolate,
        false
      );

      expect(result.success).toBe(true);
      expect((result.output as Record<string, unknown>).response).toBe('Hello from AI');
      expect((result.output as Record<string, unknown>).model).toBe('test-model');
    });

    it('should interpolate variables in prompts', async () => {
      let capturedBody = '';
      const mockReq = new EventEmitter() as EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
      mockReq.write = vi.fn((data: string) => { capturedBody = data; });
      mockReq.end = vi.fn();
      mockReq.destroy = vi.fn();

      (http.request as ReturnType<typeof vi.fn>).mockImplementation((_options: unknown, callback: (res: unknown) => void) => {
        const res = new EventEmitter() as EventEmitter & { statusCode: number; statusMessage: string };
        res.statusCode = 200;
        res.statusMessage = 'OK';
        process.nextTick(() => {
          callback(res);
          res.emit('data', JSON.stringify({
            id: 'chatcmpl-123',
            choices: [{ message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
          }));
          res.emit('end');
        });
        return mockReq;
      });

      await AiService.executeChat(
        {
          aiBaseUrl: 'http://localhost:8000/v1',
          aiModel: 'test-model',
          aiUserPrompt: 'Process ${data.value}'
        },
        { data: { value: 'test-input' } },
        interpolate,
        false
      );

      const parsed = JSON.parse(capturedBody);
      expect(parsed.messages[0].content).toBe('Process test-input');
    });

    it('should handle LLM API errors', async () => {
      setupHttpMock(200, {
        error: { message: 'Model not found' }
      });

      const result = await AiService.executeChat(
        {
          aiBaseUrl: 'http://localhost:8000/v1',
          aiModel: 'nonexistent-model',
          aiUserPrompt: 'Hello'
        },
        {},
        interpolate,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Model not found');
    });

    it('should parse JSON response when format is json', async () => {
      setupHttpMock(200, {
        id: 'chatcmpl-123',
        choices: [{
          message: { role: 'assistant', content: '{"key": "value"}' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const result = await AiService.executeChat(
        {
          aiBaseUrl: 'http://localhost:8000/v1',
          aiModel: 'test-model',
          aiUserPrompt: 'Give me JSON',
          aiResponseFormat: 'json'
        },
        {},
        interpolate,
        false
      );

      expect(result.success).toBe(true);
      expect((result.output as Record<string, unknown>).response).toEqual({ key: 'value' });
    });
  });

  describe('executeAgent', () => {
    it('should return simulated response in simulate mode', async () => {
      const result = await AiService.executeAgent(
        { aiModel: 'test-model' },
        {},
        interpolate,
        true
      );

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        simulated: true,
        response: '[Simulated AI agent response]',
        iterations: 0,
        toolCalls: []
      });
    });

    it('should complete immediately when no tool calls', async () => {
      setupHttpMock(200, {
        id: 'chatcmpl-123',
        choices: [{
          message: { role: 'assistant', content: 'Direct answer' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const result = await AiService.executeAgent(
        {
          aiBaseUrl: 'http://localhost:8000/v1',
          aiModel: 'test-model',
          aiUserPrompt: 'Answer directly',
          aiTools: []
        },
        {},
        interpolate,
        false
      );

      expect(result.success).toBe(true);
      const output = result.output as Record<string, unknown>;
      expect(output.response).toBe('Direct answer');
      expect(output.iterations).toBe(1);
      expect(output.toolCalls).toEqual([]);
    });

    it('should execute tool calls and iterate', async () => {
      let callCount = 0;
      const mockReq = new EventEmitter() as EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
      mockReq.write = vi.fn();
      mockReq.end = vi.fn();
      mockReq.destroy = vi.fn();

      (http.request as ReturnType<typeof vi.fn>).mockImplementation((_options: unknown, callback: (res: unknown) => void) => {
        const res = new EventEmitter() as EventEmitter & { statusCode: number; statusMessage: string };
        res.statusCode = 200;
        res.statusMessage = 'OK';

        callCount++;
        const responseBody = callCount === 1
          ? {
              id: 'chatcmpl-1',
              choices: [{
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [{
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'get_data', arguments: '{"query": "test"}' }
                  }]
                },
                finish_reason: 'tool_calls'
              }],
              usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
            }
          : callCount === 2
          // Tool execution HTTP call (the tool itself is type http)
          ? 'tool result data'
          : {
              id: 'chatcmpl-2',
              choices: [{
                message: { role: 'assistant', content: 'Final answer based on tool results' },
                finish_reason: 'stop'
              }],
              usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
            };

        process.nextTick(() => {
          callback(res);
          res.emit('data', typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody));
          res.emit('end');
        });

        return mockReq;
      });

      const result = await AiService.executeAgent(
        {
          aiBaseUrl: 'http://localhost:8000/v1',
          aiModel: 'test-model',
          aiUserPrompt: 'Use tools',
          aiTools: [{
            name: 'get_data',
            description: 'Get data',
            parameters: { query: { type: 'string', description: 'Query', required: true } },
            type: 'http',
            toolUrl: 'http://localhost:9000/api/data',
            toolMethod: 'POST'
          }]
        },
        {},
        interpolate,
        false
      );

      expect(result.success).toBe(true);
      const output = result.output as Record<string, unknown>;
      expect(output.response).toBe('Final answer based on tool results');
      expect(output.iterations).toBe(2);
      expect((output.toolCalls as unknown[]).length).toBe(1);
    });

    it('should respect max iterations', async () => {
      // Always return tool calls to trigger max iterations
      const mockReq = new EventEmitter() as EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
      mockReq.write = vi.fn();
      mockReq.end = vi.fn();
      mockReq.destroy = vi.fn();

      (http.request as ReturnType<typeof vi.fn>).mockImplementation((_options: unknown, callback: (res: unknown) => void) => {
        const res = new EventEmitter() as EventEmitter & { statusCode: number; statusMessage: string };
        res.statusCode = 200;
        res.statusMessage = 'OK';

        const responseBody = {
          id: 'chatcmpl-loop',
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'call_loop',
                type: 'function',
                function: { name: 'get_data', arguments: '{}' }
              }]
            },
            finish_reason: 'tool_calls'
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        };

        process.nextTick(() => {
          callback(res);
          res.emit('data', JSON.stringify(responseBody));
          res.emit('end');
        });

        return mockReq;
      });

      const result = await AiService.executeAgent(
        {
          aiBaseUrl: 'http://localhost:8000/v1',
          aiModel: 'test-model',
          aiUserPrompt: 'Loop forever',
          aiMaxIterations: 2,
          aiTools: [{
            name: 'get_data',
            description: 'Get data',
            parameters: {},
            type: 'javascript',
            toolCode: 'return "data";'
          }]
        },
        {},
        interpolate,
        false
      );

      expect(result.success).toBe(true);
      const output = result.output as Record<string, unknown>;
      expect(output.iterations).toBe(2);
      expect(output.maxIterationsReached).toBe(true);
    });

    it('should handle cancellation via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort(); // Abort immediately

      const result = await AiService.executeAgent(
        {
          aiBaseUrl: 'http://localhost:8000/v1',
          aiModel: 'test-model',
          aiUserPrompt: 'Should be cancelled'
        },
        {},
        interpolate,
        false,
        controller.signal
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });
});
