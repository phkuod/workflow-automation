import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScriptRunner } from '../services/scriptRunner';

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
});
