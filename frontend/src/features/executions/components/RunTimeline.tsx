import { useState } from 'react';
import { CheckCircle, XCircle, MinusCircle, Loader } from 'lucide-react';
import type { ExecutionResult, StationResult, StepResult } from '../../../shared/types/workflow';
import { STEP_TYPE_INFO } from '../../../shared/types/workflow';
import { summarizeStep } from '../../../shared/utils/runSummary';
import { translateError } from '../../../shared/utils/errorTranslation';
import { EDGE_COLORS } from '../../../shared/constants/colors';
import { useAiEnabled } from '../../../shared/hooks/useAiEnabled';
import { aiApi } from '../../../shared/api/workflowApi';

function StatusIcon({ status }: { status: StationResult['status'] | StepResult['status'] }) {
  switch (status) {
    case 'completed': return <CheckCircle size={16} style={{ color: EDGE_COLORS.success }} />;
    case 'failed': return <XCircle size={16} style={{ color: EDGE_COLORS.error }} />;
    case 'running': return <Loader size={16} className="loading-spinner" style={{ color: EDGE_COLORS.primary }} />;
    default: return <MinusCircle size={16} style={{ color: EDGE_COLORS.muted }} />;
  }
}

function StepLine({ step, stationName, workflowName }: {
  step: StepResult; stationName: string; workflowName?: string;
}) {
  const info = STEP_TYPE_INFO[step.stepType] ?? { icon: '📦' };
  const failed = step.status === 'failed';
  const translated = failed && step.error ? translateError(step.error.message) : null;
  const aiEnabled = useAiEnabled();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainFailed, setExplainFailed] = useState(false);

  const explain = async () => {
    if (isExplaining || !step.error) return;
    setIsExplaining(true);
    setExplainFailed(false);
    try {
      setExplanation(await aiApi.explain({
        workflowName: workflowName ?? '',
        stationName,
        stepName: step.stepName,
        stepType: step.stepType,
        errorMessage: step.error.message,
      }));
    } catch {
      setExplainFailed(true);
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <StatusIcon status={step.status} />
        <span aria-hidden>{info.icon}</span>
        <span style={{ color: failed ? EDGE_COLORS.error : 'var(--text-primary)' }}>
          {summarizeStep(step)}
        </span>
      </div>
      {translated && (
        <div style={{
          marginTop: '6px', marginLeft: '24px', padding: '8px 12px',
          borderRadius: '8px', background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)', fontSize: '12px',
        }}>
          <div style={{ fontWeight: 600, color: EDGE_COLORS.error }}>{translated.title}</div>
          {translated.suggestion && (
            <div style={{ marginTop: '2px', color: 'var(--text-secondary)' }}>{translated.suggestion}</div>
          )}
          {aiEnabled && !explanation && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: '6px' }} onClick={explain} disabled={isExplaining}>
              {isExplaining ? 'Thinking…' : 'Explain this'}
            </button>
          )}
          {explanation && (
            <div style={{ marginTop: '6px', color: 'var(--text-secondary)' }}>{explanation}</div>
          )}
          {explainFailed && (
            <div style={{ marginTop: '6px', color: 'var(--text-secondary)' }}>Couldn't get an explanation right now.</div>
          )}
          {translated.matched && (
            <details style={{ marginTop: '4px' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>Technical details</summary>
              <code style={{ fontSize: '11px', wordBreak: 'break-all' }}>{translated.raw}</code>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default function RunTimeline({ result, workflowName }: { result: ExecutionResult; workflowName?: string }) {
  return (
    <div style={{ marginTop: '12px' }}>
      {result.stations.map((station, i) => (
        <div key={station.stationId} style={{ display: 'flex', gap: '12px' }}>
          {/* Timeline rail */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20px' }}>
            <StatusIcon status={station.status} />
            {i < result.stations.length - 1 && (
              <div style={{ flex: 1, width: '2px', background: 'var(--border-color)', marginTop: '4px' }} />
            )}
          </div>
          {/* Stage content */}
          <div style={{ flex: 1, paddingBottom: '16px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>
              {station.stationName}
            </div>
            {station.steps.map((step) => (
              <StepLine key={step.stepId} step={step} stationName={station.stationName} workflowName={workflowName} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
