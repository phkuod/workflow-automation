import type { StepResult } from '../../../shared/types/workflow';
import { STEP_TYPE_INFO } from '../../../shared/types/workflow';
import JsonTreeView from '../../../shared/components/JsonTreeView';
import { X, CheckCircle, XCircle, Clock, Loader } from 'lucide-react';

interface StepDataInspectorProps {
  stepResult: StepResult;
  onClose: () => void;
}

function StepDataInspector({ stepResult, onClose }: StepDataInspectorProps) {
  const typeInfo = (STEP_TYPE_INFO as any)[stepResult.stepType] || {
    label: stepResult.stepType,
    icon: '📦',
    color: '#64748b',
  };

  const getStatusBadge = () => {
    switch (stepResult.status) {
      case 'completed':
        return (
          <span className="badge badge-success">
            <CheckCircle size={12} />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="badge badge-error">
            <XCircle size={12} />
            Failed
          </span>
        );
      case 'running':
        return (
          <span className="badge badge-info">
            <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
            Running
          </span>
        );
      case 'skipped':
        return (
          <span className="badge badge-neutral">
            <Clock size={12} />
            Skipped
          </span>
        );
      default:
        return (
          <span className="badge badge-neutral">{stepResult.status}</span>
        );
    }
  };

  const duration =
    stepResult.startTime && stepResult.endTime
      ? (
          (new Date(stepResult.endTime).getTime() -
            new Date(stepResult.startTime).getTime()) /
          1000
        ).toFixed(3)
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontSize: '16px' }}>{typeInfo.icon}</span>
          <span
            style={{
              fontWeight: 600,
              fontSize: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {stepResult.stepName}
          </span>
          {getStatusBadge()}
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      {/* Duration */}
      {duration && (
        <div
          style={{
            padding: '6px 16px',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          Duration: {duration}s
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {/* Input Section */}
        <div style={{ marginBottom: '16px' }}>
          <div
            className="text-xs font-semibold"
            style={{
              marginBottom: '8px',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Input Data
          </div>
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '6px',
              padding: '10px',
              border: '1px solid var(--border-color)',
            }}
          >
            {stepResult.input && Object.keys(stepResult.input).length > 0 ? (
              <JsonTreeView data={stepResult.input} />
            ) : (
              <span className="text-muted text-xs" style={{ fontStyle: 'italic' }}>
                No input data
              </span>
            )}
          </div>
        </div>

        {/* Output Section */}
        <div style={{ marginBottom: '16px' }}>
          <div
            className="text-xs font-semibold"
            style={{
              marginBottom: '8px',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Output Data
          </div>
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '6px',
              padding: '10px',
              border: '1px solid var(--border-color)',
            }}
          >
            {stepResult.output && Object.keys(stepResult.output).length > 0 ? (
              <JsonTreeView data={stepResult.output} />
            ) : (
              <span className="text-muted text-xs" style={{ fontStyle: 'italic' }}>
                No output data
              </span>
            )}
          </div>
        </div>

        {/* Error Section */}
        {stepResult.error && (
          <div>
            <div
              className="text-xs font-semibold"
              style={{
                marginBottom: '8px',
                color: 'var(--accent-error)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Error
            </div>
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '6px',
                padding: '10px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                {stepResult.error.message}
              </div>
              {stepResult.error.stack && (
                <pre
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                    marginTop: '6px',
                  }}
                >
                  {stepResult.error.stack}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StepDataInspector;
