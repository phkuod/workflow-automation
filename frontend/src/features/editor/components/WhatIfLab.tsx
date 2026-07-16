import { X, Play, Plus } from 'lucide-react';
import type { Workflow, Step } from '../../../shared/types/workflow';
import { useWorkflowStore } from '../stores/workflowStore';
import { ScenarioEditor } from './ScenarioEditor';
import { ScenarioMatrix } from './ScenarioMatrix';
import type { ScenarioInput } from '../types/scenario';

interface WhatIfLabProps {
  workflow: Workflow;
  onClose: () => void;
}

export function WhatIfLab({ workflow, onClose }: WhatIfLabProps) {
  const { whatIfScenarios, whatIfResults, isRunningScenarios, setWhatIfScenarios, runScenarios } = useWorkflowStore();

  const allSteps: Step[] = workflow.definition.stations.flatMap((st) => st.steps);

  const addScenario = () => {
    const next: ScenarioInput = { name: `Scenario ${whatIfScenarios.length + 1}` };
    setWhatIfScenarios([...whatIfScenarios, next]);
  };
  const updateScenario = (i: number, next: ScenarioInput) =>
    setWhatIfScenarios(whatIfScenarios.map((s, j) => (j === i ? next : s)));
  const removeScenario = (i: number) =>
    setWhatIfScenarios(whatIfScenarios.filter((_, j) => j !== i));

  return (
    <div style={{ width: '380px', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontWeight: 600, fontSize: '14px' }}>What-If Lab</h3>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label="Close What-If Lab" onClick={onClose}><X size={14} /></button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        <p className="text-xs text-muted" style={{ marginBottom: '10px' }}>
          Try "what if" situations without side effects. Force any action to succeed with a value or fail with a message, then run every scenario at once.
        </p>

        {whatIfScenarios.map((scenario, i) => (
          <ScenarioEditor
            key={i}
            scenario={scenario}
            steps={allSteps}
            onChange={(next) => updateScenario(i, next)}
            onRemove={() => removeScenario(i)}
          />
        ))}

        <button className="btn btn-secondary btn-sm" onClick={addScenario} style={{ marginBottom: '12px' }}>
          <Plus size={14} /> Add scenario
        </button>

        <button
          className="btn btn-primary"
          onClick={() => runScenarios()}
          disabled={isRunningScenarios || whatIfScenarios.length === 0}
          style={{ width: '100%', marginBottom: '12px' }}
        >
          {isRunningScenarios ? <span className="loading-spinner" /> : <Play size={16} />}
          Run all scenarios
        </button>

        {whatIfResults && whatIfResults.length > 0 && (
          <ScenarioMatrix results={whatIfResults} stations={workflow.definition.stations} />
        )}
      </div>
    </div>
  );
}
