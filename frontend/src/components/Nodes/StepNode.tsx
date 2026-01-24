import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Step } from '../../types/workflow';
import { STEP_TYPE_INFO } from '../../types/workflow';
import { CheckCircle, XCircle, Clock, Loader } from 'lucide-react';

interface StepNodeData extends Record<string, unknown> {
  step: Step;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  isSelected?: boolean;
}

// Using a more generic props type for compatibility with Xyflow v12
const StepNode = memo(({ data, selected }: { data: StepNodeData; selected?: boolean }) => {
  const { step, status, isSelected } = data;
  const activeSelected = isSelected || selected;
  const typeInfo = (STEP_TYPE_INFO as any)[step.type] || { label: step.type, icon: '📦', color: '#64748b' };

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

  const getStatusStyle = () => {
    switch (status) {
      case 'completed':
        return { borderColor: 'var(--accent-success)' };
      case 'failed':
        return { borderColor: 'var(--accent-error)' };
      case 'running':
        return { borderColor: 'var(--accent-primary)', boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' };
      default:
        return {};
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: `2px solid ${activeSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
        borderRadius: '10px',
        padding: '12px 16px',
        minWidth: '200px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ...getStatusStyle(),
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: '12px',
          height: '12px',
          background: 'var(--accent-primary)',
          border: '2px solid var(--bg-secondary)',
          top: '-6px',
        }}
      />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: `${typeInfo.color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}
        >
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

        {status && (
          <div style={{ marginLeft: 'auto' }}>
            {getStatusIcon()}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: '12px',
          height: '12px',
          background: 'var(--accent-primary)',
          border: '2px solid var(--bg-secondary)',
          bottom: '-6px',
        }}
      />
    </div>
  );
});

StepNode.displayName = 'StepNode';

export default StepNode;
