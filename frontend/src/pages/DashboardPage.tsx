import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkflowStore } from '../stores/workflowStore';
import type { Workflow } from '../types/workflow';
import { 
  Plus, 
  Play, 
  Edit, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Pause,
  LayoutDashboard 
} from 'lucide-react';

function DashboardPage() {
  const navigate = useNavigate();
  const { 
    workflows, 
    fetchWorkflows, 
    createWorkflow, 
    deleteWorkflow,
    updateWorkflow,
    isLoading,
    error 
  } = useWorkflowStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDesc, setNewWorkflowDesc] = useState('');

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleCreate = async () => {
    if (!newWorkflowName.trim()) return;
    
    try {
      const workflow = await createWorkflow(newWorkflowName, newWorkflowDesc);
      setShowCreateModal(false);
      setNewWorkflowName('');
      setNewWorkflowDesc('');
      navigate(`/editor/${workflow.id}`);
    } catch (err) {
      console.error('Failed to create workflow:', err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this workflow?')) {
      await deleteWorkflow(id);
    }
  };

  const handleToggleStatus = async (workflow: Workflow, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = workflow.status === 'active' ? 'paused' : 'active';
    await updateWorkflow(workflow.id, { status: newStatus });
  };

  const getStatusBadge = (status: Workflow['status']) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success"><CheckCircle size={12} /> Active</span>;
      case 'paused':
        return <span className="badge badge-warning"><Pause size={12} /> Paused</span>;
      default:
        return <span className="badge badge-neutral"><Clock size={12} /> Draft</span>;
    }
  };

  const stats = {
    total: workflows.length,
    active: workflows.filter(w => w.status === 'active').length,
    paused: workflows.filter(w => w.status === 'paused').length,
    draft: workflows.filter(w => w.status === 'draft').length,
  };

  return (
    <div className="layout">
      <header className="header">
        <h1>
          <LayoutDashboard size={24} />
          Workflow Automation
        </h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            New Workflow
          </button>
        </div>
      </header>

      <main className="main-content">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 mb-4">
          <div className="card">
            <div className="text-muted text-sm">Total Workflows</div>
            <div className="text-3xl font-semibold mt-2">{stats.total}</div>
          </div>
          <div className="card">
            <div className="text-muted text-sm">Active</div>
            <div className="text-3xl font-semibold mt-2 text-success">{stats.active}</div>
          </div>
          <div className="card">
            <div className="text-muted text-sm">Paused</div>
            <div className="text-3xl font-semibold mt-2" style={{ color: 'var(--accent-warning)' }}>{stats.paused}</div>
          </div>
          <div className="card">
            <div className="text-muted text-sm">Draft</div>
            <div className="text-3xl font-semibold mt-2 text-secondary">{stats.draft}</div>
          </div>
        </div>

        {/* Workflows List */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Workflows</h2>
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
              <p className="mt-2">Loading workflows...</p>
            </div>
          ) : workflows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3>No workflows yet</h3>
              <p className="text-muted">Create your first workflow to get started</p>
              <button 
                className="btn btn-primary mt-4"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={18} />
                Create Workflow
              </button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Stations</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((workflow) => (
                  <tr 
                    key={workflow.id}
                    onClick={() => navigate(`/editor/${workflow.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className="font-medium">{workflow.name}</div>
                      {workflow.description && (
                        <div className="text-sm text-muted">{workflow.description}</div>
                      )}
                    </td>
                    <td>{getStatusBadge(workflow.status)}</td>
                    <td>{workflow.definition.stations.length} stations</td>
                    <td className="text-muted text-sm">
                      {new Date(workflow.updatedAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          className={`btn btn-sm btn-icon ${workflow.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                          onClick={(e) => handleToggleStatus(workflow, e)}
                          title={workflow.status === 'active' ? 'Pause' : 'Activate'}
                        >
                          {workflow.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Workflow</h3>
              <button 
                className="btn btn-ghost btn-icon"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Workflow Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Daily Report Generator"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="What does this workflow do?"
                  value={newWorkflowDesc}
                  onChange={(e) => setNewWorkflowDesc(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!newWorkflowName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
