import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkflowStore } from '../editor/stores/workflowStore';
import ExecuteDialog from '../editor/components/ExecuteDialog';
import type { Workflow } from '../../shared/types/workflow';
import { workflowApi } from '../../shared/api/workflowApi';
import {
  Plus,
  Play,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  LayoutDashboard,
  Copy,
  Download,
  Upload
} from 'lucide-react';
import { useConfirm } from '../../shared/components/ConfirmDialog';
import { toast } from '../../shared/stores/toastStore';

function DashboardPage() {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const {
    workflows,
    fetchWorkflows,
    createWorkflow,
    deleteWorkflow,
    updateWorkflow,
    isLoading,
    error
  } = useWorkflowStore();

  const [executeTarget, setExecuteTarget] = useState<Workflow | null>(null);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Memoized stats calculation - single iteration for efficiency
  const stats = useMemo(() => {
    const counts = { active: 0, paused: 0, draft: 0 };
    for (const w of workflows) {
      if (w.status === 'active') counts.active++;
      else if (w.status === 'paused') counts.paused++;
      else if (w.status === 'draft') counts.draft++;
    }
    return { total: workflows.length, ...counts };
  }, [workflows]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const isConfirmed = await confirm({
      title: 'Delete Automation',
      message: 'Are you sure you want to delete this automation? This action cannot be undone.',
      confirmText: 'Delete',
      type: 'danger'
    });

    if (isConfirmed) {
      await deleteWorkflow(id);
    }
  }, [deleteWorkflow, confirm]);

  const handleToggleStatus = useCallback(async (workflow: Workflow, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = workflow.status === 'active' ? 'paused' : 'active';
    await updateWorkflow(workflow.id, { status: newStatus });
  }, [updateWorkflow]);

  const handleExecute = useCallback(async (workflow: Workflow, e: React.MouseEvent) => {
    e.stopPropagation();

    const isConfirmed = await confirm({
      title: 'Execute Automation',
      message: `Are you sure you want to execute "${workflow.name}"?`,
      confirmText: 'Execute',
      type: 'info'
    });
    if (!isConfirmed) return;

    const params = workflow.definition.inputParameters;
    if (params && params.length > 0) {
      setExecuteTarget(workflow);
      return;
    }
    try {
      await workflowApi.execute(workflow.id);
      toast.success(`Automation "${workflow.name}" run started`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Run failed: ${msg}`);
    }
  }, [confirm]);

  const handleExecuteWithParams = useCallback(async (inputData: Record<string, unknown>) => {
    if (!executeTarget) return;
    setExecuteTarget(null);
    try {
      await workflowApi.execute(executeTarget.id, inputData);
      toast.success(`Automation "${executeTarget.name}" run started`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Run failed: ${msg}`);
    }
  }, [executeTarget]);

  const handleCopy = useCallback(async (workflow: Workflow, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await createWorkflow(
        `${workflow.name} (Copy)`,
        workflow.description,
        workflow.definition
      );
    } catch {
      toast.error('Failed to copy automation');
    }
  }, [createWorkflow]);

  const handleExport = useCallback((workflow: Workflow, e: React.MouseEvent) => {
    e.stopPropagation();
    const exportData = {
      name: workflow.name,
      description: workflow.description,
      definition: workflow.definition,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.name || !data.definition) {
        toast.error('Invalid automation file: missing name or definition');
        return;
      }
      await createWorkflow(data.name, data.description, data.definition);
      toast.success('Automation imported successfully');
    } catch (err) {
      toast.error('Failed to import automation: Invalid JSON');
    }
    e.target.value = '';
  }, [createWorkflow]);

  const getStatusBadge = useCallback((status: Workflow['status']) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success"><CheckCircle size={12} /> Active</span>;
      case 'paused':
        return <span className="badge badge-warning"><Pause size={12} /> Paused</span>;
      default:
        return <span className="badge badge-neutral"><Clock size={12} /> Draft</span>;
    }
  }, []);

  // Stats already calculated above with useMemo

  return (
    <div className="layout">
      <header className="header">
        <h1>
          <LayoutDashboard size={24} />
          Workflow Automation
        </h1>
        <div className="header-actions">
          <label className="btn btn-secondary cursor-pointer">
            <Upload size={18} />
            Import
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImport} 
              style={{ display: 'none' }} 
            />
          </label>
          <button className="btn btn-primary" onClick={() => navigate('/new')}>
            <Plus size={18} />
            New Automation
          </button>
        </div>
      </header>

      <main className="main-content">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 mb-4">
          <div className="card stat-card stat-primary">
            <div className="text-muted text-sm">Total Automations</div>
            <div className="text-3xl font-semibold mt-2">{stats.total}</div>
          </div>
          <div className="card stat-card stat-success">
            <div className="text-muted text-sm">Active</div>
            <div className="text-3xl font-semibold mt-2 text-success">{stats.active}</div>
          </div>
          <div className="card stat-card stat-warning">
            <div className="text-muted text-sm">Paused</div>
            <div className="text-3xl font-semibold mt-2" style={{ color: 'var(--accent-warning)' }}>{stats.paused}</div>
          </div>
          <div className="card stat-card stat-purple">
            <div className="text-muted text-sm">Draft</div>
            <div className="text-3xl font-semibold mt-2 text-secondary">{stats.draft}</div>
          </div>
        </div>

        {/* Workflows List */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Automations</h2>
          </div>

          {error && (
            <div className="badge badge-error mb-4">
              <XCircle size={14} />
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <p className="mt-2">Loading automations...</p>
            </div>
          ) : workflows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3>No automations yet</h3>
              <p className="text-muted">Create your first automation to get started</p>
              <button
                className="btn btn-primary mt-4"
                onClick={() => navigate('/new')}
              >
                <Plus size={18} />
                Create Automation
              </button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Stages</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((workflow) => (
                  <tr 
                    key={workflow.id}
                    onClick={() => navigate(`/editor/${workflow.id}`)}
                    className="cursor-pointer"
                  >
                    <td>
                      <div className="font-medium">{workflow.name}</div>
                      {workflow.description && (
                        <div className="text-sm text-muted">{workflow.description}</div>
                      )}
                    </td>
                    <td>{getStatusBadge(workflow.status)}</td>
                    <td>{workflow.definition.stations.length} {workflow.definition.stations.length === 1 ? 'stage' : 'stages'}</td>
                    <td className="text-muted text-sm">
                      {new Date(workflow.updatedAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-sm btn-success btn-icon"
                          onClick={(e) => handleExecute(workflow, e)}
                          title="Execute"
                        >
                          <Play size={14} />
                        </button>
                        <button
                          className={`btn btn-sm btn-icon ${workflow.status === 'active' ? 'btn-warning' : 'btn-secondary'}`}
                          onClick={(e) => handleToggleStatus(workflow, e)}
                          title={workflow.status === 'active' ? 'Pause' : 'Activate'}
                        >
                          {workflow.status === 'active' ? <Pause size={14} /> : <CheckCircle size={14} />}
                        </button>
                        <button 
                          className="btn btn-sm btn-secondary btn-icon"
                          onClick={(e) => handleCopy(workflow, e)}
                          title="Duplicate"
                        >
                          <Copy size={14} />
                        </button>
                        <button 
                          className="btn btn-sm btn-secondary btn-icon"
                          onClick={(e) => handleExport(workflow, e)}
                          title="Export"
                        >
                          <Download size={14} />
                        </button>
                        <button 
                          className="btn btn-sm btn-secondary btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/editor/${workflow.id}`);
                          }}
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          className="btn btn-sm btn-danger btn-icon"
                          onClick={(e) => handleDelete(workflow.id, e)}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Execute Dialog */}
      {executeTarget && executeTarget.definition.inputParameters && (
        <ExecuteDialog
          parameters={executeTarget.definition.inputParameters}
          mode="execute"
          onSubmit={handleExecuteWithParams}
          onCancel={() => setExecuteTarget(null)}
        />
      )}
    </div>
  );
}

export default DashboardPage;
