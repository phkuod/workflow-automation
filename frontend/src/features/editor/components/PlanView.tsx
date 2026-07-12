import { Pencil, Plus } from 'lucide-react';
import type { Workflow, Step } from '../../../shared/types/workflow';
import { STEP_TYPE_INFO } from '../../../shared/types/workflow';
import { describeTrigger, describeAction } from '../utils/planSummary';

interface PlanViewProps {
  workflow: Workflow;
  onEditStep: (stepId: string) => void;
  onEditStage: (stageId: string) => void;
  onAddStage: () => void;
}

const isTrigger = (step: Step) => step.type.startsWith('trigger-');

export default function PlanView({ workflow, onEditStep, onEditStage, onAddStage }: PlanViewProps) {
  const trigger = workflow.definition.stations
    .flatMap(st => st.steps)
    .find(isTrigger);

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1.5rem', overflowY: 'auto', height: '100%' }}>
      {/* Trigger line */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', padding: '14px 18px' }}>
        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>When it starts:</span>
        {trigger ? (
          <>
            <span aria-hidden>{STEP_TYPE_INFO[trigger.type]?.icon}</span>
            <span style={{ flex: 1 }}>{describeTrigger(trigger)}</span>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Edit when it starts"
              onClick={() => onEditStep(trigger.id)}
            >
              <Pencil size={14} />
            </button>
          </>
        ) : (
          <span className="text-muted">No start condition yet — add a trigger action to a stage.</span>
        )}
      </div>

      {/* Stages */}
      {workflow.definition.stations.map((station, i) => (
        <section key={station.id} className="card" style={{ marginBottom: '1rem', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '15px', flex: 1 }}>{`Stage ${i + 1} — ${station.name}`}</h3>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={`Edit stage ${station.name}`}
              onClick={() => onEditStage(station.id)}
            >
              <Pencil size={14} />
            </button>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {station.steps.filter(s => !isTrigger(s)).map(step => {
              const line = describeAction(step);
              return (
                <li
                  key={step.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'var(--bg-tertiary)', fontSize: '14px',
                  }}
                >
                  <span aria-hidden>{STEP_TYPE_INFO[step.type]?.icon ?? '📦'}</span>
                  <span style={{ flex: 1 }}>{line}</span>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    aria-label={`Edit ${step.name}: ${line}`}
                    onClick={() => onEditStep(step.id)}
                  >
                    <Pencil size={14} />
                  </button>
                </li>
              );
            })}
            {station.steps.filter(s => !isTrigger(s)).length === 0 && (
              <li className="text-muted text-sm" style={{ padding: '4px 12px' }}>No actions in this stage yet.</li>
            )}
          </ul>
        </section>
      ))}

      <button className="btn btn-secondary" onClick={onAddStage} aria-label="+ Add a stage" style={{ width: '100%' }}>
        <Plus size={16} /> Add a stage
      </button>
    </div>
  );
}
