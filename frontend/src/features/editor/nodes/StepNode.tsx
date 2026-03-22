import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Step } from '../../../shared/types/workflow';
import { STEP_TYPE_INFO } from '../../../shared/types/workflow';
import { EDGE_COLORS } from '../../../shared/constants/colors';
import { CheckCircle, XCircle, Clock, Loader } from 'lucide-react';

interface StepNodeData extends Record<string, unknown> {
  step: Step;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  isSelected?: boolean;
  hasInspectableData?: boolean;
}

const handleStyle = {
  width: '12px',
  height: '12px',
  background: 'var(--accent-primary)',
  border: '2px solid var(--bg-secondary)',
};

const targetHandleStyle = { ...handleStyle, top: '-6px' };
const sourceHandleStyle = { ...handleStyle, bottom: '-6px' };

const STATUS_BORDER: Record<string, React.CSSProperties> = {
  completed: { borderColor: 'var(--accent-success)' },
  failed: { borderColor: 'var(--accent-error)' },
  running: { borderColor: 'var(--accent-primary)', boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' },
};

// Using a more generic props type for compatibility with Xyflow v12
const StepNode = memo(({ data, selected }: { data: StepNodeData; selected?: boolean }) => {
  const { step, status, isSelected, hasInspectableData } = data;
  const activeSelected = isSelected || selected;
  const typeInfo = STEP_TYPE_INFO[step.type] || { label: step.type, icon: '📦', color: '#64748b' };

  const containerStyle = useMemo(() => ({
    background: 'var(--bg-secondary)',
    border: `2px solid ${activeSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
    borderRadius: '10px',
    padding: '12px 16px',
    minWidth: '200px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ...(status ? STATUS_BORDER[status] : undefined),
  }), [activeSelected, status]);

  const iconBgStyle = useMemo(() => ({
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: `${typeInfo.color}20`,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    fontSize: '16px',
  }), [typeInfo.color]);

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={14} className="text-success" />;
      case 'failed':
        return <XCircle size={14} className="text-error" />;
      case 'running':
        return <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />;
      case 'skipped':
        return <Clock size={14} className="text-muted" />;
      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      <Handle type="target" position={Position.Top} style={targetHandleStyle} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={iconBgStyle}>
          {typeInfo.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {step.name}
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <span style={{ color: typeInfo.color }}>{typeInfo.label}</span>
          </div>
        </div>

        {(status || hasInspectableData) && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {hasInspectableData && (
              <span
                title="Click to inspect data"
                style={{
                  fontSize: '10px',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  borderRadius: '3px',
                  padding: '1px 4px',
                  fontWeight: 600,
                  lineHeight: '1.4',
                }}
              >
                DATA
              </span>
            )}
            {status && getStatusIcon()}
          </div>
        )}
      </div>

      {step.type === 'if-else' ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            style={{
              ...sourceHandleStyle,
              background: EDGE_COLORS.success,
              left: '35%',
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '-20px',
            left: '35%',
            transform: 'translateX(-50%)',
            fontSize: '10px',
            fontWeight: 700,
            color: EDGE_COLORS.success,
          }}>T</div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            style={{
              ...sourceHandleStyle,
              background: EDGE_COLORS.error,
              left: '65%',
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '-20px',
            left: '65%',
            transform: 'translateX(-50%)',
            fontSize: '10px',
            fontWeight: 700,
            color: EDGE_COLORS.error,
          }}>F</div>
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} style={sourceHandleStyle} />
      )}
    </div>
  );
});

StepNode.displayName = 'StepNode';

export default StepNode;
