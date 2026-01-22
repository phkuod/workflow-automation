import { useEffect, useCallback, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '../stores/workflowStore';
import StageCanvas from '../components/Editor/StageCanvas';
import StepCanvas from '../components/Editor/StepCanvas';
import EditorBreadcrumb from '../components/Editor/EditorBreadcrumb';
import NodeLibrary from '../components/Editor/NodeLibrary';
import NodeConfigPanel from '../components/Editor/NodeConfigPanel';
import SimulationPanel from '../components/Editor/SimulationPanel';
import type { StepType } from '../types/workflow';
import { 
  ArrowLeft, 
  Save, 
  Play, 
  Plus,
  Layers
} from 'lucide-react';

// Editor view state
type EditorView = 
  | { type: 'stage-view' }
  | { type: 'step-view'; stageId: string };

function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentWorkflow,
    fetchWorkflow,
    saveWorkflow,
    setCurrentWorkflow,
    addStation,
    addStep,
    updateStep,
    deleteStep,
    selectStep,
    selectedStepId,
    simulateWorkflow,
    isSimulating,
    currentExecution,
    executionLogs,
    isLoading,
    error,
  } = useWorkflowStore();

  // View state
  const [editorView, setEditorView] = useState<EditorView>({ type: 'stage-view' });
  const [showLibrary, setShowLibrary] = useState(true);
  const [showSimulation, setShowSimulation] = useState(false);

  // Load workflow
  useEffect(() => {
    if (id) {
      fetchWorkflow(id);
    } else {
      setCurrentWorkflow(null);
    }
  }, [id, fetchWorkflow, setCurrentWorkflow]);

  // Reset view when workflow changes
  useEffect(() => {
    setEditorView({ type: 'stage-view' });
    selectStep(null);
  }, [id]);

  // Get current stage for Step View
  const currentStage = useMemo(() => {
    if (editorView.type !== 'step-view') return null;
    return currentWorkflow?.definition.stations.find(s => s.id === editorView.stageId) || null;
  }, [editorView, currentWorkflow]);

  // Get selected step
  const selectedStep = useMemo(() => {
    if (!selectedStepId || !currentWorkflow) return null;
    return currentWorkflow.definition.stations
      .flatMap(s => s.steps)
      .find(s => s.id === selectedStepId) || null;
  }, [selectedStepId, currentWorkflow]);

  // Breadcrumb items
  const breadcrumbItems = useMemo(() => {
    const items = [
      {
        id: 'workflow',
        label: currentWorkflow?.name || 'Workflow',
        onClick: editorView.type === 'step-view' 
          ? () => {
              setEditorView({ type: 'stage-view' });
              selectStep(null);
            }
          : undefined,
      },
    ];

    if (editorView.type === 'step-view' && currentStage) {
      items.push({
        id: 'stage',
        label: currentStage.name,
        onClick: undefined,
      });
    }

    return items;
  }, [currentWorkflow, editorView, currentStage]);

  // Handlers
  const handleStageDoubleClick = useCallback((stageId: string) => {
    setEditorView({ type: 'step-view', stageId });
    selectStep(null);
  }, [selectStep]);

  const handleBackToStageView = useCallback(() => {
    setEditorView({ type: 'stage-view' });
    selectStep(null);
  }, [selectStep]);

  const handleAddStation = useCallback(() => {
    const name = prompt('Enter stage name:');
    if (name) {
      addStation(name);
    }
  }, [addStation]);

  const handleAddStep = useCallback((stationId: string, type: StepType) => {
    const name = prompt('Enter step name:');
    if (name) {
      addStep(stationId, type, name);
    }
  }, [addStep]);

  const handleSave = useCallback(async () => {
    await saveWorkflow();
  }, [saveWorkflow]);

  const handleSimulate = useCallback(async () => {
    setShowSimulation(true);
    try {
      await simulateWorkflow();
    } catch (err) {
      console.error('Simulation failed:', err);
    }
  }, [simulateWorkflow]);

  const handleStepClick = useCallback((stepId: string) => {
    selectStep(stepId);
  }, [selectStep]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedStepId) {
          selectStep(null);
        } else if (editorView.type === 'step-view') {
          handleBackToStageView();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStepId, editorView, selectStep, handleBackToStageView]);

  // Loading state
  if (isLoading && !currentWorkflow) {
    return (
      <div className="layout">
        <div className="flex items-center justify-center" style={{ height: '100vh' }}>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!currentWorkflow && id) {
    return (
      <div className="layout">
        <div className="flex flex-col items-center justify-center" style={{ height: '100vh' }}>
          <p className="text-muted">Workflow not found</p>
          <button className="btn btn-primary mt-4" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="layout" style={{ height: '100vh' }}>
      {/* Header */}
      <header className="header">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={20} />
          </button>
          
          {/* Breadcrumb Navigation */}
          <EditorBreadcrumb items={breadcrumbItems} />
        </div>
        
        <div className="header-actions">
          {/* View indicator */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '6px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}>
            <Layers size={14} />
            {editorView.type === 'stage-view' ? 'Stage View' : 'Step View'}
          </div>

          {editorView.type === 'step-view' && (
            <button 
              className="btn btn-secondary"
              onClick={handleBackToStageView}
            >
              <ArrowLeft size={18} />
              Back to Stages
            </button>
          )}

          {editorView.type === 'stage-view' ? (
            <button 
              className="btn btn-secondary"
              onClick={handleAddStation}
            >
              <Plus size={18} />
              Add Stage
            </button>
          ) : (
            <button 
              className="btn btn-secondary"
              onClick={() => setShowLibrary(!showLibrary)}
            >
              <Plus size={18} />
              Add Step
            </button>
          )}

          <button 
            className="btn btn-secondary"
            onClick={handleSave}
            disabled={isLoading}
          >
            <Save size={18} />
            Save
          </button>
          
          <button 
            className="btn btn-success"
            onClick={handleSimulate}
            disabled={isSimulating || !currentWorkflow?.definition.stations.length}
          >
            {isSimulating ? (
              <span className="loading-spinner" />
            ) : (
              <Play size={18} />
            )}
            Simulate
          </button>
        </div>
      </header>

      {/* Main Editor Area */}
      <div className="flex" style={{ flex: 1, overflow: 'hidden' }}>
        {/* Node Library Panel (only in Step View) */}
        {showLibrary && editorView.type === 'step-view' && currentStage && (
          <NodeLibrary 
            onAddStep={(type) => handleAddStep(currentStage.id, type)}
            stations={currentWorkflow?.definition.stations || []}
            onAddStepToStation={handleAddStep}
            onClose={() => setShowLibrary(false)}
          />
        )}

        {/* Canvas Area */}
        <div style={{ flex: 1, height: '100%' }}>
          {currentWorkflow && editorView.type === 'stage-view' && (
            <StageCanvas
              workflow={currentWorkflow}
              execution={currentExecution}
              isSimulating={isSimulating}
              onStageDoubleClick={handleStageDoubleClick}
              onAddStation={handleAddStation}
            />
          )}

          {currentWorkflow && editorView.type === 'step-view' && currentStage && (
            <StepCanvas
              station={currentStage}
              execution={currentExecution}
              isSimulating={isSimulating}
              selectedStepId={selectedStepId}
              onStepClick={handleStepClick}
              onStepUpdate={updateStep}
            />
          )}
        </div>

        {/* Config Panel */}
        {selectedStep && (
          <NodeConfigPanel 
            step={selectedStep}
            onUpdate={(data) => updateStep(selectedStep.id, data)}
            onDelete={() => deleteStep(selectedStep.id)}
            onClose={() => selectStep(null)}
          />
        )}

        {/* Simulation Panel */}
        {showSimulation && (
          <SimulationPanel 
            execution={currentExecution}
            logs={executionLogs}
            isRunning={isSimulating}
            onClose={() => setShowSimulation(false)}
          />
        )}
      </div>
    </div>
  );
}

export default EditorPage;
