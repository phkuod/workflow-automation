import { useState } from 'react';
import type { ReplayStep } from '../utils/replaySnapshot';
import StepDataInspector from './StepDataInspector';
import { useAiEnabled } from '../../../shared/hooks/useAiEnabled';
import { aiApi } from '../../../shared/api/workflowApi';

interface ReplayInspectorProps {
  replayStep: ReplayStep | null;
  workflowName?: string;
  onExit: () => void;
}

export function ReplayInspector({ replayStep, workflowName, onExit }: ReplayInspectorProps) {
  if (!replayStep) return null;

  return (
    <div
      style={{
        width: 340, borderLeft: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', minHeight: 0,
      }}
    >
      {!replayStep.existsInDefinition && (
        <div
          className="text-xs"
          style={{ padding: '8px 12px', background: 'rgba(234,179,8,0.12)', color: 'var(--text-secondary)' }}
        >
          This action is no longer in this automation.
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <StepDataInspector stepResult={replayStep.step} onClose={onExit} />
      </div>
      {replayStep.step.status === 'failed' && replayStep.step.error && (
        <ExplainFailure
          workflowName={workflowName}
          stationName={replayStep.stationName}
          stepName={replayStep.step.stepName}
          stepType={replayStep.step.stepType}
          errorMessage={replayStep.step.error.message}
        />
      )}
    </div>
  );
}

interface ExplainFailureProps {
  workflowName?: string;
  stationName: string;
  stepName: string;
  stepType: string;
  errorMessage: string;
}

function ExplainFailure({ workflowName, stationName, stepName, stepType, errorMessage }: ExplainFailureProps) {
  const aiEnabled = useAiEnabled();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!aiEnabled) return null;

  const explain = async () => {
    if (isExplaining) return;
    setIsExplaining(true);
    setFailed(false);
    try {
      setExplanation(await aiApi.explain({ workflowName: workflowName ?? '', stationName, stepName, stepType, errorMessage }));
    } catch {
      setFailed(true);
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-color)' }}>
      {!explanation && (
        <button className="btn btn-ghost btn-sm" onClick={explain} disabled={isExplaining}>
          {isExplaining ? 'Thinking…' : 'Explain this'}
        </button>
      )}
      {explanation && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{explanation}</div>}
      {failed && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Couldn't get an explanation right now.</div>}
    </div>
  );
}
