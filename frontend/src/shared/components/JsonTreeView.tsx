import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface JsonTreeViewProps {
  data: unknown;
  defaultExpanded?: boolean;
}

function JsonTreeView({ data, defaultExpanded = true }: JsonTreeViewProps) {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6' }}>
      <JsonNode value={data} depth={0} defaultExpanded={defaultExpanded} />
    </div>
  );
}

interface JsonNodeProps {
  label?: string;
  value: unknown;
  depth: number;
  defaultExpanded: boolean;
}

function JsonNode({ label, value, depth, defaultExpanded }: JsonNodeProps) {
  const isExpandable = value !== null && typeof value === 'object';
  const [expanded, setExpanded] = useState(depth === 0 ? true : defaultExpanded && depth < 2);

  const toggle = useCallback(() => setExpanded(prev => !prev), []);

  if (!isExpandable) {
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        {label !== undefined && (
          <span style={{ color: 'var(--text-secondary)' }}>
            {label}:{' '}
          </span>
        )}
        <PrimitiveValue value={value} />
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const summary = isArray ? `[${entries.length} items]` : `{${entries.length} keys}`;

  return (
    <div>
      <div
        style={{
          paddingLeft: depth * 16,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          borderRadius: '3px',
        }}
        onClick={toggle}
      >
        {expanded ? (
          <ChevronDown size={12} color="var(--text-muted)" />
        ) : (
          <ChevronRight size={12} color="var(--text-muted)" />
        )}
        {label !== undefined && (
          <span style={{ color: 'var(--text-secondary)' }}>
            {label}:{' '}
          </span>
        )}
        {!expanded && (
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {summary}
          </span>
        )}
        {expanded && (
          <span style={{ color: 'var(--text-muted)' }}>
            {isArray ? '[' : '{'}
          </span>
        )}
      </div>
      {expanded && (
        <>
          {entries.map(([key, val]) => (
            <JsonNode
              key={key}
              label={key}
              value={val}
              depth={depth + 1}
              defaultExpanded={defaultExpanded}
            />
          ))}
          <div style={{ paddingLeft: depth * 16, color: 'var(--text-muted)' }}>
            {isArray ? ']' : '}'}
          </div>
        </>
      )}
    </div>
  );
}

function PrimitiveValue({ value }: { value: unknown }) {
  if (value === null) {
    return <span style={{ color: '#6b7280', fontStyle: 'italic' }}>null</span>;
  }
  if (value === undefined) {
    return <span style={{ color: '#6b7280', fontStyle: 'italic' }}>undefined</span>;
  }
  if (typeof value === 'string') {
    return <span style={{ color: '#22c55e' }}>"{value}"</span>;
  }
  if (typeof value === 'number') {
    return <span style={{ color: '#3b82f6' }}>{value}</span>;
  }
  if (typeof value === 'boolean') {
    return <span style={{ color: '#a855f7' }}>{String(value)}</span>;
  }
  return <span>{String(value)}</span>;
}

export default JsonTreeView;
