import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  List,
  CheckCircle,
  XCircle,
  Clock,
  Loader,
  Trash2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { executionApi } from '../../shared/api/workflowApi';
import { EDGE_COLORS } from '../../shared/constants/colors';
import { useConfirm } from '../../shared/components/ConfirmDialog';
import type { Execution, ExecutionLog } from '../../shared/types/workflow';
import RunTimeline from './components/RunTimeline';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    completed: { bg: 'rgba(34,197,94,0.15)', color: EDGE_COLORS.success, icon: <CheckCircle size={14} /> },
    failed: { bg: 'rgba(239,68,68,0.15)', color: EDGE_COLORS.error, icon: <XCircle size={14} /> },
    running: { bg: 'rgba(59,130,246,0.15)', color: EDGE_COLORS.primary, icon: <Loader size={14} /> },
    cancelled: { bg: 'rgba(100,116,139,0.15)', color: EDGE_COLORS.muted, icon: <XCircle size={14} /> },
  };
  const s = styles[status] || styles.cancelled;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '6px',
      background: s.bg, color: s.color, fontSize: '12px', fontWeight: 600,
    }}>
      {s.icon} {status}
    </span>
  );
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const colors: Record<string, string> = {
    manual: EDGE_COLORS.secondary, schedule: EDGE_COLORS.warning, webhook: EDGE_COLORS.primary, api: EDGE_COLORS.muted,
  };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
      background: `${colors[trigger] || EDGE_COLORS.muted}20`, color: colors[trigger] || EDGE_COLORS.muted,
    }}>
      {trigger}
    </span>
  );
}

function formatDuration(start: string, end?: string): string {
  if (!end) return 'Running...';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

const PAGE_SIZE = 10;

export default function ExecutionsPage() {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<Record<string, ExecutionLog[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const fetchExecutions = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await executionApi.getAll(50);
      setExecutions(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch runs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const toggleExpand = async (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    if (!expandedIds.has(id) && !logs[id]) {
      try {
        const logData = await executionApi.getLogs(id);
        setLogs(prev => ({ ...prev, [id]: logData }));
      } catch {
        // silently fail for logs
      }
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Delete run record',
      message: 'Are you sure you want to delete this run record? This action cannot be undone.',
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!isConfirmed) return;

    try {
      await executionApi.delete(id);
      setExecutions(prev => prev.filter(e => e.id !== id));
      setExpandedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete run');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await executionApi.cancel(id);
      await fetchExecutions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel run');
    }
  };

  const filteredExecutions = executions.filter((exec) => {
    if (statusFilter !== 'all' && exec.status !== statusFilter) return false;
    if (searchQuery && !exec.workflowName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredExecutions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedExecutions = filteredExecutions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="layout">
      <header className="header">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>
              <List size={24} style={{ marginRight: '10px', color: 'var(--accent-primary)' }} />
              Run History
            </h1>
            <p className="text-sm text-muted">
              {filteredExecutions.length === executions.length
                ? `${executions.length} runs`
                : `${filteredExecutions.length} of ${executions.length} runs`}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={fetchExecutions} disabled={isLoading}>
            <RefreshCw size={18} className={isLoading ? 'loading-spinner' : ''} />
            Refresh
          </button>
        </div>
      </header>

      <main className="main-content">
        {/* Filter Bar */}
        {executions.length > 0 && (
          <div style={{
            display: 'flex', gap: '12px', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap',
          }}>
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '320px' }}>
              <Search size={16} style={{
                position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', pointerEvents: 'none',
              }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search by automation name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '34px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} style={{ color: 'var(--text-muted)' }} />
              {['all', 'completed', 'failed', 'running', 'cancelled'].map((status) => (
                <button
                  key={status}
                  className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStatusFilter(status)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && (
          <div className="card" style={{
            background: 'rgba(239,68,68,0.1)', borderColor: 'var(--accent-error)', marginBottom: '1.5rem',
          }}>
            <p className="text-error">{error}</p>
          </div>
        )}

        {isLoading && executions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Loader size={32} className="loading-spinner" style={{ margin: '0 auto 1rem', color: 'var(--accent-primary)' }} />
            <p className="text-muted">Loading runs...</p>
          </div>
        ) : executions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Clock size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-muted)' }} />
            <h3>No runs yet</h3>
            <p className="text-muted">Run an automation to see its history here.</p>
          </div>
        ) : filteredExecutions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Search size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-muted)' }} />
            <h3>No matching runs</h3>
            <p className="text-muted">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={thStyle}></th>
                    <th style={thStyle}>Automation</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Trigger</th>
                    <th style={thStyle}>Started</th>
                    <th style={thStyle}>Duration</th>
                    <th style={thStyle}>Success</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedExecutions.map((exec) => (
                    <ExecutionRow
                      key={exec.id}
                      execution={exec}
                      isExpanded={expandedIds.has(exec.id)}
                      logs={logs[exec.id]}
                      onToggle={() => toggleExpand(exec.id)}
                      onDelete={() => handleDelete(exec.id)}
                      onCancel={() => handleCancel(exec.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                <button className="btn btn-sm btn-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  Previous
                </button>
                <span className="text-sm text-muted">Page {currentPage} of {totalPages}</span>
                <button className="btn btn-sm btn-secondary" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '12px 16px', fontSize: '12px',
  fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px', fontSize: '14px',
};

function ExecutionRow({
  execution, isExpanded, logs, onToggle, onDelete, onCancel,
}: {
  execution: Execution;
  isExpanded: boolean;
  logs?: ExecutionLog[];
  onToggle: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderBottom: '1px solid var(--border-color)',
          cursor: 'pointer',
          background: isExpanded ? 'var(--bg-tertiary)' : undefined,
        }}
      >
        <td style={tdStyle}>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </td>
        <td style={{ ...tdStyle, fontWeight: 500 }}>{execution.workflowName}</td>
        <td style={tdStyle}><StatusBadge status={execution.status} /></td>
        <td style={tdStyle}><TriggerBadge trigger={execution.triggeredBy} /></td>
        <td style={{ ...tdStyle, fontSize: '13px', color: 'var(--text-muted)' }}>
          {new Date(execution.startTime).toLocaleString()}
        </td>
        <td style={{ ...tdStyle, fontSize: '13px' }}>
          {formatDuration(execution.startTime, execution.endTime)}
        </td>
        <td style={tdStyle}>
          <span style={{ fontWeight: 600, color: execution.successRate >= 100 ? EDGE_COLORS.success : execution.successRate > 0 ? EDGE_COLORS.warning : EDGE_COLORS.error }}>
            {execution.successRate.toFixed(0)}%
          </span>
        </td>
        <td style={tdStyle}>
          {execution.status === 'running' ? (
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
              title="Cancel run"
            >
              <XCircle size={14} style={{ color: 'var(--accent-warning)' }} />
            </button>
          ) : (
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Delete run record"
            >
              <Trash2 size={14} style={{ color: 'var(--accent-error)' }} />
            </button>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} style={{ padding: '0 16px 16px 40px', background: 'var(--bg-tertiary)' }}>
            {/* Run Timeline */}
            {execution.result?.stations && execution.result.stations.length > 0 && (
              <RunTimeline result={execution.result} />
            )}

            {/* Logs */}
            {logs && logs.length > 0 && (
              <details style={{ marginTop: '12px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Technical details ({logs.length > 200 ? `last 200 of ${logs.length} log entries` : `${logs.length} log ${logs.length === 1 ? 'entry' : 'entries'}`})
                </summary>
                <div style={{
                  maxHeight: '250px', overflowY: 'auto',
                  background: 'var(--bg-primary)', borderRadius: '8px',
                  border: '1px solid var(--border-color)', padding: '8px',
                  fontFamily: 'monospace', fontSize: '11px', marginTop: '8px',
                }}>
                  {logs.slice(-200).map((log) => (
                    <div key={log.id} style={{
                      padding: '3px 6px', borderRadius: '4px',
                      color: log.level === 'error' ? EDGE_COLORS.error : log.level === 'warn' ? EDGE_COLORS.warning : 'var(--text-secondary)',
                      background: log.level === 'error' ? 'rgba(239,68,68,0.05)' : undefined,
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      {' '}
                      <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>[{log.level}]</span>
                      {' '}
                      {log.message}
                    </div>
                  ))}
                </div>
              </details>
            )}
            {logs && logs.length === 0 && (
              <p className="text-muted text-sm" style={{ marginTop: '8px' }}>No logs available.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
