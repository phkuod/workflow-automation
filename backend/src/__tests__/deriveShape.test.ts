import { describe, it, expect } from 'vitest';
import { deriveShape, redactRecord } from '../utils/deriveShape';

describe('deriveShape', () => {
  it('derives primitive types with samples', () => {
    expect(deriveShape('hello', 'greeting')).toEqual({ name: 'greeting', type: 'string', sample: 'hello' });
    expect(deriveShape(42, 'count')).toEqual({ name: 'count', type: 'number', sample: '42' });
    expect(deriveShape(true, 'ok')).toEqual({ name: 'ok', type: 'boolean', sample: 'true' });
    expect(deriveShape(null, 'gone')).toEqual({ name: 'gone', type: 'null' });
    expect(deriveShape(undefined, 'missing')).toEqual({ name: 'missing', type: 'null' });
  });

  it('truncates string samples to 100 chars with ellipsis', () => {
    const shape = deriveShape('x'.repeat(150), 's');
    expect(shape.sample).toHaveLength(101); // 100 chars + '…'
    expect(shape.sample!.endsWith('…')).toBe(true);
  });

  it('derives object fields as children', () => {
    const shape = deriveShape({ orderId: 10023, customer: 'ACME' });
    expect(shape.type).toBe('object');
    expect(shape.children).toEqual([
      { name: 'orderId', type: 'number', sample: '10023' },
      { name: 'customer', type: 'string', sample: 'ACME' },
    ]);
  });

  it('derives array shape from the first element only, sample shows length', () => {
    const shape = deriveShape([{ id: 1 }, { id: 2 }, { id: 3 }], 'rows');
    expect(shape.type).toBe('array');
    expect(shape.sample).toBe('3 items');
    expect(shape.children).toHaveLength(1);
    expect(shape.children![0].name).toBe('[0]');
    expect(shape.children![0].children).toEqual([{ name: 'id', type: 'number', sample: '1' }]);
  });

  it('caps depth at 4', () => {
    const deep = { a: { b: { c: { d: { e: 'too deep' } } } } };
    const shape = deriveShape(deep);
    // depth 0=root, 1=a, 2=b, 3=c, 4=d — d's children are omitted
    const d = shape.children![0].children![0].children![0].children![0];
    expect(d.name).toBe('d');
    expect(d.truncated).toBe(true);
    expect(d.children).toBeUndefined();
  });

  it('caps fields at 30 per level and reports omitted count', () => {
    const wide: Record<string, number> = {};
    for (let i = 0; i < 35; i++) wide[`f${i}`] = i;
    const shape = deriveShape(wide);
    expect(shape.children).toHaveLength(30);
    expect(shape.truncated).toBe(true);
    expect(shape.omittedCount).toBe(5);
  });

  it('redacts samples for sensitive field names, keeping type', () => {
    const shape = deriveShape({ password: 'hunter2', apiKey: 'sk-123', api_key: 'sk-456', Authorization: 'Bearer x', count: 7 });
    const byName = Object.fromEntries(shape.children!.map(c => [c.name, c]));
    expect(byName.password.sample).toBe('***');
    expect(byName.apiKey.sample).toBe('***');
    expect(byName.api_key.sample).toBe('***');
    expect(byName.Authorization.sample).toBe('***');
    expect(byName.count.sample).toBe('7');
  });

  it('handles an empty object and empty array', () => {
    expect(deriveShape({})).toEqual({ name: '', type: 'object', children: [] });
    expect(deriveShape([], 'list')).toEqual({ name: 'list', type: 'array', sample: '0 items' });
  });
});

describe('redactRecord', () => {
  it('masks sensitive keys and passes others through', () => {
    expect(redactRecord({ url: 'https://x.test', headers: { a: 1 }, slackWebhookUrl: 'https://hooks', dbPassword: 'pw' }))
      .toEqual({ url: 'https://x.test', headers: { a: 1 }, slackWebhookUrl: 'https://hooks', dbPassword: '***' });
  });
});
