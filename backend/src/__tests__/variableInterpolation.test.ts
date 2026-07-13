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

    it('resolves a picker-inserted steps[...] bracket reference inside a template', () => {
      const context = { steps: { 'My Step': { output: { data: { orderId: 'ORD-42' } } } } };
      const result = ScriptRunner.interpolateVariables("Order: ${steps['My Step'].output.data.orderId}", context);
      expect(result).toBe('Order: ORD-42');
    });

    it('resolves a picker-inserted array index reference inside a template', () => {
      const context = { steps: { X: { output: { rows: [{ id: 'r1' }] } } } };
      const result = ScriptRunner.interpolateVariables("Row: ${steps['X'].output.rows[0].id}", context);
      expect(result).toBe('Row: r1');
    });

    it('resolves a picker-inserted bracket key with a dash inside a template', () => {
      const context = { steps: { X: { output: { 'content-type': 'application/json' } } } };
      const result = ScriptRunner.interpolateVariables("Type: ${steps['X'].output['content-type']}", context);
      expect(result).toBe('Type: application/json');
    });

    it('resolves to empty string when the referenced step is unknown', () => {
      const context = { steps: { X: { output: { data: {} } } } };
      const result = ScriptRunner.interpolateVariables("Missing: ${steps['Unknown'].output.data.orderId}", context);
      expect(result).toBe('Missing: ');
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

    it('resolves picker-style quoted bracket path: steps[\'My Step\'].output.data.orderId', () => {
      const obj = { steps: { 'My Step': { output: { data: { orderId: 'ORD-1' } } } } };
      expect(ScriptRunner.getValueByPath(obj, "steps['My Step'].output.data.orderId")).toBe('ORD-1');
    });

    it('resolves numeric array index path: steps[\'X\'].output.rows[0].id', () => {
      const obj = { steps: { X: { output: { rows: [{ id: 7 }, { id: 8 }] } } } };
      expect(ScriptRunner.getValueByPath(obj, "steps['X'].output.rows[0].id")).toBe(7);
    });

    it('resolves quoted bracket key with non-identifier characters: [\'content-type\']', () => {
      const obj = { steps: { X: { output: { 'content-type': 'application/json' } } } };
      expect(ScriptRunner.getValueByPath(obj, "steps['X'].output['content-type']")).toBe('application/json');
    });

    it('resolves an escaped quote inside a bracket key', () => {
      const obj = { "it's": 'value' };
      expect(ScriptRunner.getValueByPath(obj, "['it\\'s']")).toBe('value');
    });

    it('returns undefined (not a crash) for unknown step/field in bracket paths', () => {
      const obj = { steps: { X: { output: { data: {} } } } };
      expect(ScriptRunner.getValueByPath(obj, "steps['Unknown Step'].output.data.orderId")).toBeUndefined();
      expect(ScriptRunner.getValueByPath(obj, "steps['X'].output.data.missingField")).toBeUndefined();
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
