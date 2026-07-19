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

/**
 * Union two shape trees derived from separate values of the same step (e.g. one
 * StepResult per iterator loop item, all sharing a stepId). Object fields are merged
 * by name, and array nodes merge their element shape (children share the '[0]' name,
 * so the same by-name union applies); on a type conflict for the same field, the
 * first-seen (`a`) entry's type wins rather than attempting a lossy cross-type merge. Both inputs are assumed to
 * already respect deriveShape's MAX_DEPTH/MAX_FIELDS_PER_LEVEL caps, so recursion
 * naturally stops wherever the source trees stop growing children; the merged
 * children list is re-capped at MAX_FIELDS_PER_LEVEL in case the union of two
 * already-capped field sets exceeds it.
 */
export function mergeShapes(a: ShapeNode, b: ShapeNode): ShapeNode {
  const mergeable = a.type === 'object' || a.type === 'array';
  if (a.type !== b.type || !mergeable || !a.children || !b.children) {
    return a;
  }

  const byName = new Map<string, ShapeNode>();
  for (const child of a.children) byName.set(child.name, child);
  for (const child of b.children) {
    const existing = byName.get(child.name);
    byName.set(child.name, existing ? mergeShapes(existing, child) : child);
  }

  let children = Array.from(byName.values());
  let omittedCount = (a.omittedCount || 0) + (b.omittedCount || 0);
  if (children.length > MAX_FIELDS_PER_LEVEL) {
    omittedCount += children.length - MAX_FIELDS_PER_LEVEL;
    children = children.slice(0, MAX_FIELDS_PER_LEVEL);
  }

  const node: ShapeNode = { ...a, children };
  if (omittedCount > 0 || a.truncated || b.truncated) {
    node.truncated = true;
    node.omittedCount = omittedCount;
  }
  return node;
}

/** Mask values of sensitive keys (recursive) — used before sending configs to the AI provider. */
export function redactRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    out[key] = SENSITIVE_FIELD_PATTERN.test(key) ? '***' : redactValue(val);
  }
  return out;
}

// Matches `?key=value` / `&key=value` query-string segments; only the VALUE is
// replaced when the parameter NAME matches SENSITIVE_FIELD_PATTERN — this is
// deliberately scoped to query-param names, not general secret sniffing.
const QUERY_PARAM_PATTERN = /([?&])([A-Za-z0-9_-]+)=([^&#\s]*)/g;

function redactQueryParamValues(value: string): string {
  return value.replace(QUERY_PARAM_PATTERN, (match, sep, key) =>
    SENSITIVE_FIELD_PATTERN.test(key) ? `${sep}${key}=***` : match
  );
}

function redactValue(val: unknown): unknown {
  if (Array.isArray(val)) {
    return val.map(item => redactValue(item));
  }
  if (isPlainObject(val)) {
    return redactRecord(val);
  }
  if (typeof val === 'string') {
    return redactQueryParamValues(val);
  }
  return val;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
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
        // Array itself is at the cap: its single derivable element type is omitted.
        node.truncated = true;
        node.omittedCount = 1;
      }
    }
    return node;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const node: ShapeNode = { name, type: 'object' };
  if (depth >= MAX_DEPTH) {
    // Only report truncation when fields were actually omitted — an empty
    // object at the cap has nothing to report, so leave truncated/omittedCount unset.
    if (entries.length > 0) {
      node.truncated = true;
      node.omittedCount = entries.length;
    }
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
