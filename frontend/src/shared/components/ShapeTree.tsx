import type { ShapeNode } from '../types/shapes';

interface ShapeTreeProps {
  shape: ShapeNode;
  onSelectPath?: (path: string) => void;
}

const IDENTIFIER_SAFE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function childPath(parentPath: string, child: ShapeNode): string {
  if (child.name === '[0]') return `${parentPath}[0]`;
  if (IDENTIFIER_SAFE.test(child.name)) {
    return parentPath ? `${parentPath}.${child.name}` : child.name;
  }
  return `${parentPath}['${child.name.replace(/'/g, "\\'")}']`;
}

export function ShapeTree({ shape, onSelectPath }: ShapeTreeProps) {
  return (
    <div className="font-mono text-[11px] leading-relaxed">
      <ShapeTreeNode node={shape} path="" onSelectPath={onSelectPath} depth={0} />
    </div>
  );
}

interface NodeProps {
  node: ShapeNode;
  path: string;
  depth: number;
  onSelectPath?: (path: string) => void;
}

function ShapeTreeNode({ node, path, depth, onSelectPath }: NodeProps) {
  const isRoot = path === '';
  const label = node.name === '[0]' ? 'each item' : node.name;

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
      {!isRoot && (
        <div className="flex items-center gap-1.5 py-0.5">
          {onSelectPath ? (
            <button
              onClick={() => onSelectPath(path)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
              title={`Insert reference to ${path}`}
            >
              {label}
            </button>
          ) : (
            <span className="text-blue-600 dark:text-blue-400">{label}</span>
          )}
          <span className="text-[9px] px-1 rounded bg-tertiary text-muted uppercase">{node.type}</span>
          {node.sample !== undefined && (
            <span className="text-muted truncate max-w-[160px]" title={node.sample}>{node.sample}</span>
          )}
        </div>
      )}
      {node.children?.map((child) => (
        <ShapeTreeNode
          key={child.name}
          node={child}
          path={childPath(path, child)}
          depth={depth + 1}
          onSelectPath={onSelectPath}
        />
      ))}
      {node.truncated && node.omittedCount !== undefined && (
        <div className="text-muted italic py-0.5" style={{ paddingLeft: 14 }}>
          {node.omittedCount} more {node.omittedCount === 1 ? 'field' : 'fields'} omitted
        </div>
      )}
    </div>
  );
}
