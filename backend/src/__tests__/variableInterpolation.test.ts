import { describe, it, expect } from 'vitest';
import { ScriptRunner } from '../services/scriptRunner';

describe('Variable Interpolation', () => {
  describe('interpolateVariables', () => {
    it('replaces ${var} with context value', () => {
      const result = ScriptRunner.interpolateVariables('Hello ${name}', { name: 'World' });
      expect(result).toBe('Hello World');
    });

    it('replaces {{var}} double-brace syntax', () => {
      const result = ScriptRunner.interpolateVariables('Hello {{name}}', { name: 'World' });
      expect(result).toBe('Hello World');
    });

    it('resolves nested dot-notation paths', () => {
      const context = { step1: { output: { data: { value: 42 } } } };
      const result = ScriptRunner.interpolateVariables('Result: ${step1.output.data.value}', context);
      expect(result).toBe('Result: 42');
    });

    it('returns empty string for undefined values', () => {
      const result = ScriptRunner.interpolateVariables('${nonexistent}', {});
      expect(result).toBe('');
    });

    it('serializes object values as JSON', () => {
      const context = { data: { items: [1, 2, 3] } };
      const result = ScriptRunner.interpolateVariables('${data}', context);
      expect(result).toBe(JSON.stringify({ items: [1, 2, 3] }));
    });

    it('handles multiple variables in one template', () => {
      const context = { first: 'Hello', second: 'World' };
      const result = ScriptRunner.interpolateVariables('${first} ${second}!', context);
      expect(result).toBe('Hello World!');
    });

    it('returns original template when no variables', () => {
      const result = ScriptRunner.interpolateVariables('No vars here', {});
      expect(result).toBe('No vars here');
    });

    it('handles null values (typeof null is object, gets JSON.stringify)', () => {
      const result = ScriptRunner.interpolateVariables('${val}', { val: null });
      // null is typeof 'object', so it goes through JSON.stringify path
      expect(result).toBe('null');
    });

    it('handles undefined values as empty string', () => {
      const result = ScriptRunner.interpolateVariables('${val}', { val: undefined });
      expect(result).toBe('');
    });

    it('handles numeric values', () => {
      const result = ScriptRunner.interpolateVariables('Count: ${count}', { count: 5 });
      expect(result).toBe('Count: 5');
    });

    it('handles boolean values', () => {
      const result = ScriptRunner.interpolateVariables('Active: ${active}', { active: true });
      expect(result).toBe('Active: true');
    });
  });

  describe('getValueByPath', () => {
    it('resolves simple path', () => {
      expect(ScriptRunner.getValueByPath({ a: 1 }, 'a')).toBe(1);
    });

    it('resolves deep nested path', () => {
      const obj = { a: { b: { c: 'deep' } } };
      expect(ScriptRunner.getValueByPath(obj, 'a.b.c')).toBe('deep');
    });

    it('returns undefined for missing path', () => {
      expect(ScriptRunner.getValueByPath({}, 'a.b.c')).toBeUndefined();
    });
  });

  describe('evaluateCondition', () => {
    it('evaluates simple comparison', () => {
      expect(ScriptRunner.evaluateCondition('1 > 0', {})).toBe(true);
      expect(ScriptRunner.evaluateCondition('1 < 0', {})).toBe(false);
    });

    it('evaluates with context variables', () => {
      expect(ScriptRunner.evaluateCondition('value > 10', { value: 20 })).toBe(true);
      expect(ScriptRunner.evaluateCondition('value > 10', { value: 5 })).toBe(false);
    });

    it('returns false for invalid expressions', () => {
      expect(ScriptRunner.evaluateCondition('invalid syntax !!!', {})).toBe(false);
    });
  });
});
