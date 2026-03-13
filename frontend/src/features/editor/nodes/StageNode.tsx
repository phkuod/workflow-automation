import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Station } from '../../../shared/types/workflow';
import { STEP_TYPE_INFO } from '../../../shared/types/workflow';
import { Layers, ChevronRight, CheckCircle, XCircle, Clock, Loader } from 'lucide-react';

interface StageNodeData extends Record<string, unknown> {
  station: Station;
  stationIndex: number;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  isSelected?: boolean;
  onDoubleClick?: (stationId: string) => void;
  onEditClick?: (stationId: string) => void;
}

// Using a more generic props type for compatibility with Xyflow v12
const StageNode = memo(({ data, selected }: { data: StageNodeData; selected?: boolean }) => {
  const { station, stationIndex, status, isSelected, onDoubleClick, onEditClick } = data;
  const activeSelected = isSelected || selected;

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(station.id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick?.(station.id);
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-success" />;
      case 'failed':
        return <XCircle size={16} className="text-error" />;
      case 'running':
        return <Loader size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />;
      case 'skipped':
        return <Clock size={16} className="text-muted" />;
      default:
        return null;
    }
  };

  const getStatusBorder = () => {
    switch (status) {
      case 'completed':
        return 'var(--accent-success)';
      case 'failed':
        return 'var(--accent-error)';
      case 'running':
        return 'var(--accent-primary)';
      default:
        return activeSelected ? 'var(--accent-secondary)' : 'var(--border-color)';
    }
  };

  // Steps preview (max 4 visible)
  const stepsPreview = useMemo(() => {
    const maxVisible = 4;
    const visibleSteps = station.steps.slice(0, maxVisible);
    const remainingCount = station.steps.length - maxVisible;
    return { visibleSteps, remainingCount };
  }, [station.steps]);

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        background: 'var(--bg-secondary)',
        border: `2px solid ${getStatusBorder()}`,
        borderRadius: '16px',
        padding: '16px',
        minWidth: '260px',
        maxWidth: '280px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: activeSelected ? '0 0 20px rgba(139, 92, 246, 0.3)' : 'var(--shadow)',
      }}
    >
      {/* Left Handle - Input */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: '14px',
          height: '14px',
          background: 'var(--accent-secondary)',
          border: '3px solid var(--bg-secondary)',
          left: '-8px',
        }}
      />

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        marginBottom: '12px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'rgba(139, 92, 246, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Layers size={18} style={{ color: 'var(--accent-secondary)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Stage {stationIndex + 1}: {station.name}
          </div>
          <div style={{ 
            fontSize: '11px', 
            color: 'var(--text-muted)',
          }}>
            {station.steps.length} step{station.steps.length !== 1 ? 's' : ''}
          </div>
        </div>
        {getStatusIcon()}
      </div>

      {/* Steps Preview */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '6px',
        marginBottom: '12px',
      }}>
        {stepsPreview.visibleSteps.map((step) => {
          const typeInfo = (STEP_TYPE_INFO as any)[step.type] || { label: step.type, icon: '📦', color: '#64748b' };
          return (
            <div 
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: 'var(--bg-tertiary)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            >
              <span style={{ fontSize: '14px' }}>{typeInfo.icon}</span>
              <span style={{ 
                flex: 1, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                color: 'var(--text-secondary)',
              }}>
                {step.name}
              </span>
            </div>
          );
        })}
        {stepsPreview.remainingCount > 0 && (
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '4px',
          }}>
            +{stepsPreview.remainingCount} more step{stepsPreview.remainingCount !== 1 ? 's' : ''}
          </div>
        )}
        {station.steps.length === 0 && (
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px',
            border: '1px dashed var(--border-color)',
          }}>
            No steps yet
          </div>
        )}
      </div>

      {/* Edit Button */}
      <button
        onClick={handleEditClick}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '8px 12px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          color: 'var(--text-primary)',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'var(--accent-secondary)';
          e.currentTarget.style.borderColor = 'var(--accent-secondary)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'var(--bg-tertiary)';
          e.currentTarget.style.borderColor = 'var(--border-color)';
        }}
      >
        Edit Steps
        <ChevronRight size={14} />
      </button>

      {/* Right Handle - Output */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: '14px',
          height: '14px',
          background: 'var(--accent-secondary)',
          border: '3px solid var(--bg-secondary)',
          right: '-8px',
        }}
      />
    </div>
  );
});

StageNode.displayName = 'StageNode';

export default StageNode;
