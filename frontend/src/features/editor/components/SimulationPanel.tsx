import { useRef, useEffect, useMemo } from 'react';
import type { Execution, ExecutionLog, ExecutionEvent, StepResult } from '../../../shared/types/workflow';
import { useExecutionStream } from '../../../shared/hooks/useExecutionStream';
import StepDataInspector from './StepDataInspector';
import X from 'lucide-react/dist/esm/icons/x';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import Clock from 'lucide-react/dist/esm/icons/clock';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Info from 'lucide-react/dist/esm/icons/info';
import Bug from 'lucide-react/dist/esm/icons/bug';

interface SimulationPanelProps {
  execution: Execution | null;
  logs: ExecutionLog[];
  isRunning: boolean;
  selectedStepId?: string | null;
  onStepDeselect?: () => void;
  onClose: () => void;
}

function SimulationPanel({ execution, logs, isRunning, selectedStepId, onStepDeselect, onClose }: SimulationPanelProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);

  // SSE real-time updates
  const { events } = useExecutionStream(isRunning && execution?.id ? execution.id : null);

  // Convert SSE events to log-like entries for display
  const streamLogs = useMemo(() => {
    return events.map((event: ExecutionEvent, idx: number) => ({
      id: `sse-${idx}`,
      executionId: event.executionId,
      level: event.type.includes('failed') ? 'error' as const : 'info' as const,
      message: formatEventMessage(event),
      timestamp: event.data?.timestamp || new Date().toISOString(),
      stationId: event.data?.stationId,
      stepId: event.data?.stepId,
    }));
  }, [events]);

  // Merge persisted logs with SSE stream logs (SSE takes precedence while running)
  const displayLogs = isRunning && streamLogs.length > 0 ? streamLogs : logs;

  // Find selected step result from execution data
  const selectedStepResult: StepResult | undefined = useMemo(() => {
    if (!selectedStepId || !execution?.result?.stations) return undefined;
    for (const station of execution.result.stations) {
      const step = station.steps.find(s => s.stepId === selectedStepId);
      if (step) return step;
    }
    return undefined;
  }, [selectedStepId, execution]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [displayLogs]);

  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <span className="badge badge-info">
          <Clock size={12} style={{ animation: 'spin 1s linear infinite' }} />
          Running
        </span>
      );
    }
    if (!execution) return null;

    switch (execution.status) {
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
      default:
        return (
          <span className="badge badge-neutral">
            {execution.status}
          </span>
        );
    }
  };

  const getLevelIcon = (level: ExecutionLog['level']) => {
    switch (level) {
      case 'error':
        return <XCircle size={12} color="var(--accent-error)" />;
      case 'warn':
        return <AlertCircle size={12} color="var(--accent-warning)" />;
      case 'debug':
        return <Bug size={12} color="var(--text-muted)" />;
      default:
        return <Info size={12} color="var(--accent-primary)" />;
    }
  };

  const getLevelColor = (level: ExecutionLog['level']) => {
    switch (level) {
      case 'error':
        return 'var(--accent-error)';
      case 'warn':
        return 'var(--accent-warning)';
      case 'debug':
        return 'var(--text-muted)';
      default:
        return 'var(--text-primary)';
    }
  };

  return (
    <div
      style={{
        width: '450px',
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ fontWeight: 600, fontSize: '14px' }}>Simulation</h3>
          {getStatusBadge()}
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Stats */}
      {execution && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            gap: '24px',
          }}
        >
          <div>
            <div className="text-xs text-muted">Success Rate</div>
            <div className="font-semibold" style={{ 
              color: execution.successRate === 100 
                ? 'var(--accent-success)' 
                : execution.successRate > 0 
                  ? 'var(--accent-warning)' 
                  : 'var(--accent-error)' 
            }}>
              {execution.successRate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Duration</div>
            <div className="font-semibold">
              {execution.endTime 
                ? `${((new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime()) / 1000).toFixed(2)}s`
                : '-'
              }
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">Stations</div>
            <div className="font-semibold">
              {execution.result?.stations.filter(s => s.status === 'completed').length || 0}/
              {execution.result?.stations.length || 0}
            </div>
          </div>
        </div>
      )}

      {/* Station Results */}
      {execution?.result?.stations && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div className="text-xs text-muted mb-2">Station Progress</div>
          {execution.result.stations.map((station) => (
            <div
              key={station.stationId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              {station.status === 'completed' ? (
                <CheckCircle size={14} color="var(--accent-success)" />
              ) : station.status === 'failed' ? (
                <XCircle size={14} color="var(--accent-error)" />
              ) : station.status === 'running' ? (
                <Clock size={14} color="var(--accent-primary)" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
              ) : (
                <Clock size={14} color="var(--text-muted)" />
              )}
              <span className="text-sm">{station.stationName}</span>
              <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
                {station.steps.filter(s => s.status === 'completed').length}/{station.steps.length} steps
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Content area: Step Inspector or Logs */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selectedStepResult ? (
          <StepDataInspector
            stepResult={selectedStepResult}
            onClose={() => onStepDeselect?.()}
          />
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <div className="text-xs text-muted">Execution Log ({displayLogs.length} entries)</div>
            </div>
            <div
              ref={logContainerRef}
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: '12px',
                background: 'var(--bg-primary)',
              }}
            >
              {displayLogs.length === 0 ? (
                <div className="text-muted text-center p-4">
                  {isRunning ? 'Waiting for logs...' : 'No logs available'}
                </div>
              ) : (
                displayLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '6px',
                      color: getLevelColor(log.level),
                    }}
                  >
                    <span className="text-muted" style={{ flexShrink: 0 }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {getLevelIcon(log.level)}
                    <span style={{ flex: 1, wordBreak: 'break-word' }}>{log.message}</span>
                  </div>
                ))
              )}

              {isRunning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                  <span className="loading-spinner" style={{ width: '12px', height: '12px' }} />
                  <span>Running...</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Error Details */}
      {execution?.result?.error && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(239, 68, 68, 0.1)',
          }}
        >
          <div className="text-xs font-semibold text-error mb-1">Error</div>
          <div className="text-sm">{execution.result.error.message}</div>
        </div>
      )}
    </div>
  );
}

function formatEventMessage(event: ExecutionEvent): string {
  const { type, data } = event;
  switch (type) {
    case 'step:start':
      return `Step started: ${data.stepName}`;
    case 'step:complete':
      return `Step completed: ${data.stepName}`;
    case 'step:failed':
      return `Step failed: ${data.stepName} — ${data.error || 'unknown error'}`;
    case 'station:start':
      return `Station started: ${data.stationName}`;
    case 'station:complete':
      return `Station completed: ${data.stationName}`;
    case 'station:failed':
      return `Station failed: ${data.stationName} — ${data.error || 'unknown error'}`;
    case 'execution:complete':
      return `Execution completed (${data.progress?.completed}/${data.progress?.total} steps)`;
    case 'execution:failed':
      return `Execution failed`;
    case 'execution:cancelled':
      return `Execution cancelled`;
    default:
      return type;
  }
}

export default SimulationPanel;
