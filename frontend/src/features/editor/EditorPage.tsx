import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from './stores/workflowStore';
import { useInput } from '../../shared/components/InputDialog';
import { useConfirm } from '../../shared/components/ConfirmDialog';
import StageCanvas from './components/StageCanvas';
import StepCanvas from './components/StepCanvas';
import PlanView from './components/PlanView';
import EditorBreadcrumb from './components/EditorBreadcrumb';
import NodeLibrary from './components/NodeLibrary';
import NodeConfigPanel from './components/NodeConfigPanel';
import StationConfigPanel from './components/StationConfigPanel';
import SimulationPanel from './components/SimulationPanel';
import VersionHistoryPanel from './components/VersionHistoryPanel';
import ExecuteDialog from './components/ExecuteDialog';
import CoachMarks from './components/CoachMarks';
import { ReplayBar } from './components/ReplayBar';
import { ReplayInspector } from './components/ReplayInspector';
import { useReplay } from './hooks/useReplay';
import { buildReplaySequence, buildPartialExecution } from './utils/replaySnapshot';
import { toast } from '../../shared/stores/toastStore';
import type { StepType } from '../../shared/types/workflow';
import InputParametersEditor from './components/InputParametersEditor';
import {
  ArrowLeft,
  Save,
  Play,
  Plus,
  Layers,
  Clock,
  Settings
} from 'lucide-react';

// Editor view state
type EditorView = 
  | { type: 'stage-view' }
  | { type: 'step-view'; stageId: string };

function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const replayId = searchParams.get('replay');
  const isReplay = !!replayId;
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
    selectedStationId,
    selectStation,
    updateStation,
    deleteStation,
    connectSteps,
    simulateWorkflow,
    executeWorkflow,
    isSimulating,
    currentExecution,
    executionLogs,
    isLoading,
    isSaving,
    isDirty,
    error,
    updateWorkflow,
    createWorkflow,
    replayExecution,
    enterReplay,
    exitReplay,
  } = useWorkflowStore();

  // Input dialog hook
  const { prompt: showInputDialog } = useInput();
  const { confirm } = useConfirm();

  // View state
  const [editorView, setEditorView] = useState<EditorView>({ type: 'stage-view' });
  const [viewMode, setViewMode] = useState<'plan' | 'canvas'>(() =>
    (localStorage.getItem('editor.viewMode') as 'plan' | 'canvas' | null) ?? 'plan'
  );
  const switchViewMode = useCallback((mode: 'plan' | 'canvas') => {
    setViewMode(mode);
    localStorage.setItem('editor.viewMode', mode);
    if (mode === 'plan') {
      // Plan View has no drill-in concept: reset the canvas navigation so the
      // breadcrumb and step-view state don't go stale behind the plan.
      setEditorView({ type: 'stage-view' });
    }
  }, []);

  // Force canvas + stage-view while replaying
  useEffect(() => {
    if (isReplay) {
      setViewMode('canvas');
      setEditorView({ type: 'stage-view' });
    }
  }, [isReplay]);

  const [showLibrary, setShowLibrary] = useState(true);
  const [showSimulation, setShowSimulation] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showExecuteDialog, setShowExecuteDialog] = useState<'execute' | 'simulate' | null>(null);
  const [showInputParams, setShowInputParams] = useState(false);
  const [showCoachMarks, setShowCoachMarks] = useState(() => !localStorage.getItem('editor.coachMarksSeen'));

  const dismissCoachMarks = useCallback(() => {
    localStorage.setItem('editor.coachMarksSeen', '1');
    setShowCoachMarks(false);
  }, []);

  // Use store's isDirty for unsaved changes tracking
  const hasUnsavedChanges = isDirty;

  // Guard against StrictMode double-invocation when creating new workflows
  const creatingRef = useRef(false);

  // Load workflow or create new one
  useEffect(() => {
    if (id === 'new') {
      if (creatingRef.current) return;
      creatingRef.current = true;
      createWorkflow('Untitled Automation').then((workflow) => {
        navigate(`/editor/${workflow.id}`, { replace: true });
      }).catch(() => {
        creatingRef.current = false;
        toast.error('Failed to create automation');
        navigate('/dashboard');
      });
    } else if (id) {
      fetchWorkflow(id);
    } else {
      setCurrentWorkflow(null);
    }
  }, [id, fetchWorkflow, setCurrentWorkflow, createWorkflow, navigate]);

  // Replay lifecycle: enter on mount / when the param appears, exit on unmount / when it clears
  useEffect(() => {
    if (replayId) {
      enterReplay(replayId);
      return () => exitReplay();
    }
  }, [replayId, enterReplay, exitReplay]);

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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

  // Get selected station
  const selectedStation = useMemo(() => {
    if (!selectedStationId || !currentWorkflow) return null;
    return currentWorkflow.definition.stations.find(s => s.id === selectedStationId) || null;
  }, [selectedStationId, currentWorkflow]);

  // Breadcrumb items
  const breadcrumbItems = useMemo(() => {
    const items = [
      {
        id: 'workflow',
        label: currentWorkflow?.name || 'Automation',
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
    selectStation(null);
  }, [selectStep, selectStation]);

  // Navigate back with unsaved changes check
  const handleNavigateBack = useCallback(async () => {
    if (hasUnsavedChanges) {
      const shouldLeave = await confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
        confirmText: 'Leave',
        cancelText: 'Stay',
        type: 'warning',
      });
      if (!shouldLeave) return;
    }
    navigate('/dashboard');
  }, [hasUnsavedChanges, confirm, navigate]);

  const handleAddStation = useCallback(async () => {
    if (isReplay) return;
    const name = await showInputDialog({
      title: 'Add Stage',
      message: 'Enter a name for the new stage:',
      placeholder: 'Stage name...',
      confirmText: 'Create Stage',
    });
    if (name) {
      addStation(name);
    }
  }, [addStation, showInputDialog, isReplay]);

  const handleAddStep = useCallback(async (stationId: string, type: StepType) => {
    if (isReplay) return;
    const name = await showInputDialog({
      title: 'Add Action',
      message: `Enter a name for the new ${type.replace('-', ' ')} action:`,
      placeholder: 'Action name...',
      confirmText: 'Create Action',
    });
    if (name) {
      addStep(stationId, type, name);
    }
  }, [addStep, showInputDialog, isReplay]);

  const handleSave = useCallback(async () => {
    if (isReplay) return;
    try {
      await saveWorkflow();
      toast.success('Automation saved');
    } catch {
      toast.error('Failed to save automation');
    }
  }, [saveWorkflow, isReplay]);

  const handleSimulate = useCallback(async () => {
    const params = currentWorkflow?.definition.inputParameters;
    if (params && params.length > 0) {
      setShowExecuteDialog('simulate');
      return;
    }
    setShowSimulation(true);
    try {
      await simulateWorkflow();
    } catch {
      toast.error('Test run failed');
    }
  }, [simulateWorkflow, currentWorkflow]);

  const handleExecuteWithParams = useCallback(async (inputData: Record<string, unknown>) => {
    const mode = showExecuteDialog;
    setShowExecuteDialog(null);
    setShowSimulation(true);
    try {
      if (mode === 'simulate') {
        await simulateWorkflow(inputData);
      } else {
        await executeWorkflow(inputData);
      }
    } catch {
      toast.error('Run failed');
    }
  }, [showExecuteDialog, simulateWorkflow, executeWorkflow]);

  const handleStepClick = useCallback((stepId: string) => {
    selectStep(stepId);
  }, [selectStep]);

  const handleStationClick = useCallback((stationId: string) => {
    selectStation(stationId);
  }, [selectStation]);

  // Replay sequence, playback state, and current partial execution
  const replaySequence = useMemo(
    () => (replayExecution?.result ? buildReplaySequence(replayExecution.result, currentWorkflow?.definition) : []),
    [replayExecution, currentWorkflow],
  );
  const replay = useReplay(replaySequence.length);
  const currentReplayStep = replaySequence[replay.index] ?? null;
  const replayPartialExecution = useMemo(
    () => (replayExecution && replaySequence.length ? buildPartialExecution(replayExecution, replaySequence, replay.index) : null),
    [replayExecution, replaySequence, replay.index],
  );
  const exitReplayMode = useCallback(() => navigate(`/editor/${id}`), [navigate, id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isReplay) return;
        handleSave();
        return;
      }
      if (e.key === 'Escape') {
        if (selectedStepId) {
          selectStep(null);
        } else if (selectedStationId) {
          selectStation(null);
        } else if (editorView.type === 'step-view') {
          handleBackToStageView();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStepId, selectedStationId, editorView, selectStep, selectStation, handleBackToStageView, handleSave, isReplay]);

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
          <p className="text-muted">Automation not found</p>
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
          <button className="btn btn-ghost btn-icon" onClick={handleNavigateBack} aria-label="Back to dashboard">
            <ArrowLeft size={20} />
          </button>
          
          {/* Breadcrumb Navigation */}
          <EditorBreadcrumb items={breadcrumbItems} />
        </div>
        
        <div className="header-actions">
          {/* Plan / Canvas view toggle (hidden in replay — replay forces canvas) */}
          {!isReplay && (
            <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '2px' }}>
              <button
                className={`btn btn-sm ${viewMode === 'plan' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => switchViewMode('plan')}
              >
                Plan View
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'canvas' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => switchViewMode('canvas')}
              >
                Canvas View
              </button>
            </div>
          )}

          {!isReplay && viewMode === 'canvas' && (
            <>
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
                {editorView.type === 'stage-view' ? 'Stage View' : 'Action View'}
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
                  Add Action
                </button>
              )}
            </>
          )}

          {/* Workflow Status */}
          {!isReplay && currentWorkflow && (
            <select
              className="form-select"
              value={currentWorkflow.status}
              onChange={(e) => updateWorkflow(currentWorkflow.id, { status: e.target.value as 'draft' | 'active' | 'paused' })}
              style={{ 
                width: 'auto', 
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: currentWorkflow.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 
                            currentWorkflow.status === 'paused' ? 'rgba(234, 179, 8, 0.15)' : 'var(--bg-tertiary)',
                color: currentWorkflow.status === 'active' ? 'rgb(34, 197, 94)' : 
                       currentWorkflow.status === 'paused' ? 'rgb(234, 179, 8)' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)'
              }}
            >
              <option value="draft">📝 Draft</option>
              <option value="active">✅ Active</option>
              <option value="paused">⏸️ Paused</option>
            </select>
          )}

          {!isReplay && (
            <button
              className={`btn btn-secondary ${showInputParams ? 'btn-active' : ''}`}
              onClick={() => setShowInputParams(!showInputParams)}
              title="Input Parameters"
            >
              <Settings size={18} />
              Params
            </button>
          )}

          {!isReplay && (
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              title="Version History"
            >
              <Clock size={18} />
            </button>
          )}

          {!isReplay && (
            <button
              className={`btn ${hasUnsavedChanges ? 'btn-primary' : 'btn-secondary'}`}
              onClick={handleSave}
              disabled={isSaving}
              style={{
                position: 'relative',
              }}
            >
              {isSaving ? <span className="loading-spinner" /> : <Save size={18} />}
              {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save*' : 'Save'}
              {hasUnsavedChanges && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '10px',
                  height: '10px',
                  background: 'var(--accent-warning)',
                  borderRadius: '50%',
                  border: '2px solid var(--bg-secondary)',
                }} />
              )}
            </button>
          )}

          {!isReplay && (
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
              Test
            </button>
          )}
        </div>
      </header>

      {/* Main Editor Area */}
      <div className="flex" style={{ flex: 1, overflow: 'hidden' }}>
        {/* Node Library Panel (only in Step View) */}
        {!isReplay && viewMode === 'canvas' && showLibrary && editorView.type === 'step-view' && currentStage && (
          <NodeLibrary
            onAddStep={(type) => handleAddStep(currentStage.id, type)}
            stations={currentWorkflow?.definition.stations || []}
            onAddStepToStation={handleAddStep}
            onClose={() => setShowLibrary(false)}
          />
        )}

        {/* Canvas Area */}
        <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            {currentWorkflow && viewMode === 'plan' ? (
              <PlanView
                workflow={currentWorkflow}
                onEditStep={(stepId) => selectStep(stepId)}
                onEditStage={(stageId) => selectStation(stageId)}
                onAddStage={handleAddStation}
              />
            ) : (
              <>
                {currentWorkflow && editorView.type === 'stage-view' && (
                  <StageCanvas
                    workflow={currentWorkflow}
                    execution={isReplay ? replayPartialExecution : currentExecution}
                    isSimulating={isSimulating}
                    readOnly={isReplay}
                    onStageDoubleClick={isReplay ? undefined : handleStageDoubleClick}
                    onStageClick={handleStationClick}
                    onAddStation={handleAddStation}
                  />
                )}

                {currentWorkflow && editorView.type === 'step-view' && currentStage && (
                  <StepCanvas
                    station={currentStage}
                    execution={isReplay ? replayPartialExecution : currentExecution}
                    isSimulating={isSimulating}
                    readOnly={isReplay}
                    selectedStepId={selectedStepId}
                    onStepClick={handleStepClick}
                    onStepUpdate={updateStep}
                    onStepConnect={(sourceId, targetId, sourceHandle) =>
                      connectSteps(currentStage.id, sourceId, targetId, sourceHandle)
                    }
                  />
                )}
              </>
            )}
          </div>
          {isReplay && replaySequence.length > 0 && (
            <ReplayBar
              index={replay.index}
              total={replaySequence.length}
              isPlaying={replay.isPlaying}
              currentLabel={currentReplayStep ? `${currentReplayStep.stationName} · ${currentReplayStep.stepName}` : ''}
              onPrev={replay.prev}
              onNext={replay.next}
              onToggle={replay.toggle}
              onSeek={replay.seek}
              onExit={exitReplayMode}
            />
          )}
          {isReplay && replaySequence.length === 0 && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '8px 16px', borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
              }}
            >
              <span className="text-sm text-muted">
                {error || 'This run could not be loaded for replay.'}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={exitReplayMode}>
                Exit replay
              </button>
            </div>
          )}
        </div>

        {/* Config Panel (hidden when simulation results are showing) */}
        {selectedStep && currentWorkflow && !isReplay && !(showSimulation && currentExecution?.result) && (
          <NodeConfigPanel
            step={selectedStep}
            workflow={currentWorkflow}
            onUpdate={(data) => updateStep(selectedStep.id, data)}
            onDelete={() => deleteStep(selectedStep.id)}
            onClose={() => selectStep(null)}
          />
        )}

        {selectedStation && currentWorkflow && !isReplay && (editorView.type === 'stage-view' || viewMode === 'plan') && (
          <StationConfigPanel
            station={selectedStation}
            workflow={currentWorkflow}
            onUpdate={(data) => {
              updateStation(selectedStation.id, data);
              saveWorkflow();
            }}
            onDelete={() => deleteStation(selectedStation.id)}
            onClose={() => selectStation(null)}
          />
        )}

        {isReplay && (
          <ReplayInspector replayStep={currentReplayStep} workflowName={currentWorkflow?.name} onExit={exitReplayMode} />
        )}

        {/* Input Parameters Panel */}
        {showInputParams && currentWorkflow && (
          <div style={{
            width: '320px',
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-color)',
            padding: '16px',
            overflowY: 'auto',
          }}>
            <h3 style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Input Parameters</h3>
            <InputParametersEditor
              parameters={currentWorkflow.definition.inputParameters || []}
              onChange={(params) => {
                setCurrentWorkflow({
                  ...currentWorkflow,
                  definition: {
                    ...currentWorkflow.definition,
                    inputParameters: params,
                  },
                });
              }}
            />
          </div>
        )}

        {/* Simulation Panel */}
        {showSimulation && (
          <SimulationPanel
            execution={currentExecution}
            logs={executionLogs}
            isRunning={isSimulating}
            selectedStepId={selectedStepId}
            onStepDeselect={() => selectStep(null)}
            onClose={() => setShowSimulation(false)}
          />
        )}

        {/* Version History Panel */}
        {showVersionHistory && currentWorkflow && (
          <VersionHistoryPanel
            workflowId={currentWorkflow.id}
            onRestore={() => {
              if (id) fetchWorkflow(id);
              setShowVersionHistory(false);
            }}
            onClose={() => setShowVersionHistory(false)}
          />
        )}
      </div>

      {/* Execute Dialog (for workflows with input parameters) */}
      {showExecuteDialog && currentWorkflow?.definition.inputParameters && (
        <ExecuteDialog
          parameters={currentWorkflow.definition.inputParameters}
          mode={showExecuteDialog}
          onSubmit={handleExecuteWithParams}
          onCancel={() => setShowExecuteDialog(null)}
        />
      )}

      {/* First-visit coach marks (Plan View only) */}
      {showCoachMarks && currentWorkflow && viewMode === 'plan' && (
        <CoachMarks onDone={dismissCoachMarks} />
      )}
    </div>
  );
}

export default EditorPage;
