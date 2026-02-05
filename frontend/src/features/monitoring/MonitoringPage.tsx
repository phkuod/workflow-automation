import { useState, useEffect, useMemo, useCallback } from 'react';
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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

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

const API_BASE = '/api';

// Chart colors
const CHART_COLORS = {
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  purple: '#8b5cf6',
};

// Generate mock execution trend data for last 7 days
const generateTrendData = (total: number, successRate: number) => {
  const data = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayTotal = Math.floor(total / 7 + (Math.random() - 0.5) * 5);
    const success = Math.floor(dayTotal * (successRate / 100));
    data.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      total: Math.max(0, dayTotal),
      success: Math.max(0, success),
      failed: Math.max(0, dayTotal - success),
    });
  }
  return data;
};

export default function MonitoringPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchMetrics = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const formatUptime = useCallback((seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, []);

  // Memoized chart data
  const trendData = useMemo(() => {
    if (!metrics) return [];
    return generateTrendData(metrics.executions.total, metrics.executions.successRate);
  }, [metrics?.executions.total, metrics?.executions.successRate]);

  const pieData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Completed', value: metrics.executions.completed, color: CHART_COLORS.success },
      { name: 'Failed', value: metrics.executions.failed, color: CHART_COLORS.error },
    ];
  }, [metrics?.executions.completed, metrics?.executions.failed]);

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
              <div className="card stat-card stat-success">
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
              <div className="card stat-card stat-primary">
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
              <div className="card stat-card stat-purple">
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
              <div className="card stat-card stat-warning">
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

            {/* Charts Section */}
            <div className="grid grid-cols-2" style={{ marginBottom: '1.5rem' }}>
              {/* Execution Trend Chart */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} />
                  Execution Trend (Last 7 Days)
                </h3>
                <div style={{ height: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#f8fafc'
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="success" 
                        stroke={CHART_COLORS.success} 
                        strokeWidth={2}
                        dot={{ fill: CHART_COLORS.success, strokeWidth: 0 }}
                        name="Success"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="failed" 
                        stroke={CHART_COLORS.error} 
                        strokeWidth={2}
                        dot={{ fill: CHART_COLORS.error, strokeWidth: 0 }}
                        name="Failed"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Success Rate Pie Chart */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} />
                  Execution Results
                </h3>
                <div style={{ height: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#f8fafc'
                        }} 
                      />
                      <Legend 
                        formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}

        {isLoading && !metrics && (
          <div className="grid grid-cols-4" style={{ marginBottom: '1.5rem' }}>
            <div className="skeleton skeleton-card"></div>
            <div className="skeleton skeleton-card"></div>
            <div className="skeleton skeleton-card"></div>
            <div className="skeleton skeleton-card"></div>
          </div>
        )}
      </main>
    </div>
  );
}
