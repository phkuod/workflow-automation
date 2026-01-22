import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock,
  Cpu,
  HardDrive,
  RefreshCw,
  TrendingUp,
  Calendar
} from 'lucide-react';

interface Metrics {
  timestamp: string;
  uptime: number;
  workflows: {
    total: number;
    active: number;
    paused: number;
    draft: number;
  };
  executions: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    successRate: number;
    last24Hours: number;
    last7Days: number;
  };
  scheduler: {
    scheduledWorkflows: number;
    activeSchedules: number;
    pausedSchedules: number;
  };
  system: {
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
    nodeVersion: string;
  };
}

const API_BASE = 'http://localhost:3001/api';

export default function MonitoringPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/metrics`);
      const data = await response.json();
      if (data.success) {
        setMetrics(data.data);
        setLastUpdate(new Date());
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch metrics');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="layout">
      {/* Header */}
      <header className="header">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>
              <Activity size={24} style={{ marginRight: '10px', color: 'var(--accent-primary)' }} />
              System Monitoring
            </h1>
            <p className="text-sm text-muted">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary" 
            onClick={fetchMetrics}
            disabled={isLoading}
          >
            <RefreshCw size={18} className={isLoading ? 'loading-spinner' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {error && (
          <div className="card" style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            borderColor: 'var(--accent-error)',
            marginBottom: '1.5rem' 
          }}>
            <p className="text-error">{error}</p>
          </div>
        )}

        {metrics && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-4" style={{ marginBottom: '1.5rem' }}>
              {/* Success Rate */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(34, 197, 94, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <TrendingUp size={20} style={{ color: 'var(--accent-success)' }} />
                  </div>
                  <div>
                    <p className="text-sm text-muted">Success Rate</p>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                      {metrics.executions.successRate}%
                    </h2>
                  </div>
                </div>
              </div>

              {/* Uptime */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Clock size={20} style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <div>
                    <p className="text-sm text-muted">Server Uptime</p>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                      {formatUptime(metrics.uptime)}
                    </h2>
                  </div>
                </div>
              </div>

              {/* Active Schedules */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Calendar size={20} style={{ color: 'var(--accent-secondary)' }} />
                  </div>
                  <div>
                    <p className="text-sm text-muted">Active Schedules</p>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                      {metrics.scheduler.activeSchedules}
                    </h2>
                  </div>
                </div>
              </div>

              {/* Memory Usage */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Cpu size={20} style={{ color: 'var(--accent-warning)' }} />
                  </div>
                  <div>
                    <p className="text-sm text-muted">Memory (Heap)</p>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                      {metrics.system.memoryUsage.heapUsed} MB
                    </h2>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-3" style={{ marginBottom: '1.5rem' }}>
              {/* Workflow Stats */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HardDrive size={18} />
                  Workflows
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Total</span>
                    <span className="font-semibold">{metrics.workflows.total}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Active</span>
                    <span className="font-semibold text-success">{metrics.workflows.active}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Paused</span>
                    <span className="font-semibold">{metrics.workflows.paused}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Draft</span>
                    <span className="font-semibold">{metrics.workflows.draft}</span>
                  </div>
                </div>
              </div>

              {/* Execution Stats */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} />
                  Executions
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Total</span>
                    <span className="font-semibold">{metrics.executions.total}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Completed</span>
                    <span className="font-semibold" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                      {metrics.executions.completed}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Failed</span>
                    <span className="font-semibold" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <XCircle size={14} style={{ color: 'var(--accent-error)' }} />
                      {metrics.executions.failed}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Last 24h</span>
                    <span className="font-semibold">{metrics.executions.last24Hours}</span>
                  </div>
                </div>
              </div>

              {/* System Stats */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={18} />
                  System
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Node.js</span>
                    <span className="font-semibold">{metrics.system.nodeVersion}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Heap Used</span>
                    <span className="font-semibold">{metrics.system.memoryUsage.heapUsed} MB</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Heap Total</span>
                    <span className="font-semibold">{metrics.system.memoryUsage.heapTotal} MB</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">RSS</span>
                    <span className="font-semibold">{metrics.system.memoryUsage.rss} MB</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {isLoading && !metrics && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="loading-spinner" style={{ marginBottom: '1rem' }}></div>
            <p className="text-muted">Loading metrics...</p>
          </div>
        )}
      </main>
    </div>
  );
}
