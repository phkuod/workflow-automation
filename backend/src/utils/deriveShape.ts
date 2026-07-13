export interface ShapeNode {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  sample?: string;
  children?: ShapeNode[];
  truncated?: boolean;
  omittedCount?: number;
}

export const SENSITIVE_FIELD_PATTERN = /password|token|secret|api[_-]?key|authorization/i;

const MAX_SAMPLE_LENGTH = 100;
const MAX_DEPTH = 4;
const MAX_FIELDS_PER_LEVEL = 30;

/** Convert an arbitrary JSON value into a bounded, redacted shape tree. */
export function deriveShape(value: unknown, name = ''): ShapeNode {
  return derive(value, name, 0, false);
}

/** Mask values of sensitive keys (shallow) — used before sending configs to the AI provider. */
export function redactRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    out[key] = SENSITIVE_FIELD_PATTERN.test(key) ? '***' : val;
  }
  return out;
}

function derive(value: unknown, name: string, depth: number, inheritedRedacted: boolean): ShapeNode {
  const redacted = inheritedRedacted || SENSITIVE_FIELD_PATTERN.test(name);

  if (value === null || value === undefined) {
    return { name, type: 'null' };
  }
  if (typeof value === 'string') {
    return { name, type: 'string', sample: redacted ? '***' : truncateSample(value) };
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { name, type: typeof value === 'number' ? 'number' : 'boolean', sample: redacted ? '***' : String(value) };
  }
  if (Array.isArray(value)) {
    const node: ShapeNode = { name, type: 'array', sample: `${value.length} items` };
    if (value.length > 0) {
      if (depth < MAX_DEPTH) {
        node.children = [derive(value[0], '[0]', depth + 1, redacted)];
      } else {
        node.truncated = true;
      }
    }
    return node;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const node: ShapeNode = { name, type: 'object' };
  if (depth >= MAX_DEPTH) {
    node.truncated = true;
    node.omittedCount = entries.length;
    return node;
  }
  node.children = entries.slice(0, MAX_FIELDS_PER_LEVEL).map(([key, val]) => derive(val, key, depth + 1, redacted));
  if (entries.length > MAX_FIELDS_PER_LEVEL) {
    node.truncated = true;
    node.omittedCount = entries.length - MAX_FIELDS_PER_LEVEL;
  }
  return node;
}

function truncateSample(s: string): string {
  return s.length > MAX_SAMPLE_LENGTH ? `${s.slice(0, MAX_SAMPLE_LENGTH)}…` : s;
}
