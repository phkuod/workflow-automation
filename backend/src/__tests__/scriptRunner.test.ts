import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ScriptRunner } from '../services/scriptRunner';
import { spawn } from 'child_process';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Helper: create a mock child process for Python tests
function createMockProcess(exitCode: number, stdout = '', stderr = '') {
  const proc = new EventEmitter() as any;
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();

  process.nextTick(() => {
    if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
    if (stderr) proc.stderr.emit('data', Buffer.from(stderr));
    proc.emit('close', exitCode);
  });

  return proc;
}

describe('ScriptRunner', () => {
  describe('executeJS', () => {
    it('should execute simple JavaScript code', async () => {
      const result = await ScriptRunner.executeJS(
        'return 1 + 2;',
        {},
        5000
      );
      
      expect(result.success).toBe(true);
      expect(result.output).toBe(3);
    });

    it('should access inputData in JavaScript code', async () => {
      const result = await ScriptRunner.executeJS(
        'return inputData.value * 2;',
        { inputData: { value: 5 } },
        5000
      );
      
      expect(result.success).toBe(true);
      expect(result.output).toBe(10);
    });

    it('should capture console.log output', async () => {
      const result = await ScriptRunner.executeJS(
        'console.log("Hello"); return "world";',
        {},
        5000
      );
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('world');
      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs[0]).toContain('Hello');
    });

    it('should handle errors gracefully', async () => {
      const result = await ScriptRunner.executeJS(
        'throw new Error("Test error");',
        {},
        5000
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });

    it('should timeout long-running code', async () => {
      const result = await ScriptRunner.executeJS(
        'while(true) {}',
        {},
        100 // Very short timeout
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate true condition', () => {
      const result = ScriptRunner.evaluateCondition('1 === 1', {});
      expect(result).toBe(true);
    });

    it('should evaluate false condition', () => {
      const result = ScriptRunner.evaluateCondition('1 === 2', {});
      expect(result).toBe(false);
    });

    it('should evaluate condition with context variables', () => {
      const result = ScriptRunner.evaluateCondition('value > 5', { value: 10 });
      expect(result).toBe(true);
    });

    it('should return false for invalid condition', () => {
      const result = ScriptRunner.evaluateCondition('invalid syntax !!!', {});
      expect(result).toBe(false);
    });
  });

  describe('interpolateVariables', () => {
    it('should replace simple variable', () => {
      const result = ScriptRunner.interpolateVariables(
        'Hello ${name}!',
        { name: 'World' }
      );
      expect(result).toBe('Hello World!');
    });

    it('should replace nested variable', () => {
      const result = ScriptRunner.interpolateVariables(
        'Value: ${data.value}',
        { data: { value: 42 } }
      );
      expect(result).toBe('Value: 42');
    });

    it('should handle missing variable by returning empty string', () => {
      const result = ScriptRunner.interpolateVariables(
        'Hello ${missing}!',
        {}
      );
      expect(result).toBe('Hello !');
    });

    it('should stringify object values', () => {
      const result = ScriptRunner.interpolateVariables(
        'Data: ${obj}',
        { obj: { a: 1, b: 2 } }
      );
      expect(result).toBe('Data: {"a":1,"b":2}');
    });

    it('should handle double curly brace syntax {{var}}', () => {
      const result = ScriptRunner.interpolateVariables(
        'Hello {{name}}!',
        { name: 'World' }
      );
      expect(result).toBe('Hello World!');
    });
  });

  describe('getValueByPath', () => {
    it('should get root level value', () => {
      const result = ScriptRunner.getValueByPath({ name: 'test' }, 'name');
      expect(result).toBe('test');
    });

    it('should get nested value', () => {
      const result = ScriptRunner.getValueByPath(
        { user: { profile: { name: 'John' } } },
        'user.profile.name'
      );
      expect(result).toBe('John');
    });

    it('should return undefined for missing path', () => {
      const result = ScriptRunner.getValueByPath({ a: 1 }, 'b.c.d');
      expect(result).toBeUndefined();
    });
  });

  // ─── executeHttpRequest — SSRF protection ────────────────────────

  describe('executeHttpRequest — SSRF protection', () => {
    it('blocks localhost', async () => {
      const result = await ScriptRunner.executeHttpRequest(
        { url: 'http://localhost/admin', method: 'GET' }, {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked request to restricted host');
    });

    it('blocks 127.0.0.1', async () => {
      const result = await ScriptRunner.executeHttpRequest(
        { url: 'http://127.0.0.1:8080/secret', method: 'GET' }, {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked request to restricted host');
    });

    it('blocks cloud metadata endpoint (169.254.169.254)', async () => {
      const result = await ScriptRunner.executeHttpRequest(
        { url: 'http://169.254.169.254/latest/meta-data', method: 'GET' }, {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked request to restricted host');
    });

    it('blocks private IP 10.x.x.x', async () => {
      const result = await ScriptRunner.executeHttpRequest(
        { url: 'http://10.0.0.1/internal', method: 'GET' }, {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked request to private/internal IP');
    });

    it('blocks private IP 192.168.x.x', async () => {
      const result = await ScriptRunner.executeHttpRequest(
        { url: 'http://192.168.1.1/router', method: 'GET' }, {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked request to private/internal IP');
    });

    it('blocks private IP 172.16.x.x', async () => {
      const result = await ScriptRunner.executeHttpRequest(
        { url: 'http://172.16.0.1/internal', method: 'GET' }, {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked request to private/internal IP');
    });

    it('blocks non-HTTP protocols (ftp)', async () => {
      const result = await ScriptRunner.executeHttpRequest(
        { url: 'ftp://example.com/file', method: 'GET' }, {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked protocol');
    });

    it('rejects invalid URLs', async () => {
      const result = await ScriptRunner.executeHttpRequest(
        { url: 'not-a-url', method: 'GET' }, {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('interpolates variables in URL before validation', async () => {
      const result = await ScriptRunner.executeHttpRequest(
        { url: 'http://${host}/path', method: 'GET' },
        { host: 'localhost' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked request to restricted host');
    });

    it('blocks 0.0.0.0', async () => {
      const result = await ScriptRunner.executeHttpRequest(
        { url: 'http://0.0.0.0/api', method: 'GET' }, {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked request to restricted host');
    });
  });

  // ─── executePython ───────────────────────────────────────────────

  describe('executePython', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns parsed JSON output on success', async () => {
      const mockProc = createMockProcess(0, '{"result": 42}\n');
      (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);

      const result = await ScriptRunner.executePython(
        'import json; print(json.dumps({"result": 42}))',
        { variables: {}, inputData: {}, steps: {} },
        5000,
      );

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ result: 42 });
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        ['-c', expect.any(String)],
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('returns plain string when output is not JSON', async () => {
      const mockProc = createMockProcess(0, 'hello world\n');
      (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);

      const result = await ScriptRunner.executePython(
        'print("hello world")',
        { variables: {}, inputData: {}, steps: {} },
        5000,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe('hello world');
    });

    it('returns error when Python exits with non-zero code', async () => {
      const mockProc = createMockProcess(1, '', 'NameError: name x is not defined\n');
      (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);

      const result = await ScriptRunner.executePython(
        'print(x)',
        { variables: {}, inputData: {}, steps: {} },
        5000,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('NameError');
    });

    it('returns error when spawn fails (Python not found)', async () => {
      const proc = new EventEmitter() as any;
      proc.stdin = { write: vi.fn(), end: vi.fn() };
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      process.nextTick(() => proc.emit('error', new Error('spawn python ENOENT')));
      (spawn as ReturnType<typeof vi.fn>).mockReturnValue(proc);

      const result = await ScriptRunner.executePython(
        'print("hello")',
        { variables: {}, inputData: {}, steps: {} },
        5000,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to start Python');
    });

    it('passes code and data via stdin as JSON', async () => {
      const mockProc = createMockProcess(0, '"ok"\n');
      (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);

      await ScriptRunner.executePython(
        'x = 1',
        { variables: { a: 1 }, inputData: { b: 2 }, steps: {} },
        5000,
      );

      // Verify stdin received JSON payload with code and data
      expect(mockProc.stdin.write).toHaveBeenCalledOnce();
      const payload = JSON.parse(mockProc.stdin.write.mock.calls[0][0]);
      expect(payload.code).toBe('x = 1');
      expect(payload.input_data).toEqual({ b: 2 });
      expect(payload.steps).toEqual({});
      expect(mockProc.stdin.end).toHaveBeenCalledOnce();
    });
  });
});
