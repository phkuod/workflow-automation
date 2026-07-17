import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import type { Step } from '../../../shared/types/workflow';
import type { ScenarioInput, ScenarioOverrideInput } from '../types/scenario';

interface OverrideRowProps {
  override: ScenarioOverrideInput;
  steps: Step[];
  onChange: (next: ScenarioOverrideInput) => void;
  onRemove: () => void;
}

function OverrideRow({ override, steps, onChange, onRemove }: OverrideRowProps) {
  const [outputText, setOutputText] = useState(() =>
    typeof override.mockOutput === 'string' ? override.mockOutput : JSON.stringify(override.mockOutput ?? {}, null, 2));
  const [outputError, setOutputError] = useState<string | null>(null);

  const commitOutput = (text: string) => {
    setOutputText(text);
    try {
      const parsed = JSON.parse(text);
      setOutputError(null);
      onChange({ id: override.id, stepId: override.stepId, mockOutput: parsed });
    } catch {
      setOutputError('Invalid JSON');
    }
  };

  const switchToSucceeds = () => {
    setOutputText('{}');
    setOutputError(null);
    onChange({ id: override.id, stepId: override.stepId, mockOutput: {} });
  };
  const switchToFails = () => {
    setOutputError(null);
    onChange({ id: override.id, stepId: override.stepId, mockError: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px', borderLeft: '2px solid var(--border-color)', paddingLeft: '8px' }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        <select
          className="form-select"
          aria-label="Action"
          value={override.stepId}
          onChange={(e) => onChange({ ...override, stepId: e.target.value })}
          style={{ flex: 1, fontSize: '12px' }}
        >
          <option value="">Pick an action…</option>
          {steps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label="Remove override" onClick={onRemove}>
          <Trash2 size={12} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
        <label><input type="radio" checked={override.mockError === undefined} onChange={switchToSucceeds} /> Succeeds and returns</label>
        <label><input type="radio" checked={override.mockError !== undefined} onChange={switchToFails} /> Fails with</label>
      </div>
      {override.mockError === undefined ? (
        <>
          <textarea
            className="form-input" aria-label="Mock output JSON" rows={2}
            value={outputText}
            onChange={(e) => commitOutput(e.target.value)}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px' }}
          />
          {outputError && <div className="text-xs" style={{ color: 'var(--accent-error)' }}>{outputError}</div>}
        </>
      ) : (
        <input
          className="form-input" aria-label="Mock error message"
          value={override.mockError}
          onChange={(e) => onChange({ id: override.id, stepId: override.stepId, mockError: e.target.value })}
          style={{ fontSize: '12px' }}
        />
      )}
    </div>
  );
}

interface ScenarioEditorProps {
  scenario: ScenarioInput;
  steps: Step[];
  onChange: (next: ScenarioInput) => void;
  onRemove: () => void;
}

export function ScenarioEditor({ scenario, steps, onChange, onRemove }: ScenarioEditorProps) {
  const [inputText, setInputText] = useState(scenario.inputData ? JSON.stringify(scenario.inputData, null, 2) : '');
  const [inputError, setInputError] = useState<string | null>(null);

  const commitInput = (text: string) => {
    setInputText(text);
    if (!text.trim()) { setInputError(null); onChange({ ...scenario, inputData: undefined }); return; }
    try {
      const parsed = JSON.parse(text);
      setInputError(null);
      onChange({ ...scenario, inputData: parsed });
    } catch {
      setInputError('Invalid JSON');
    }
  };

  const overrides = scenario.stepOverrides || [];
  const setOverrides = (next: ScenarioOverrideInput[]) => onChange({ ...scenario, stepOverrides: next });

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
        <input
          className="form-input"
          aria-label="Scenario name"
          value={scenario.name}
          onChange={(e) => onChange({ ...scenario, name: e.target.value })}
          style={{ flex: 1, fontSize: '13px' }}
        />
        <button className="btn btn-ghost btn-icon btn-sm" aria-label="Remove scenario" onClick={onRemove}>
          <Trash2 size={14} />
        </button>
      </div>

      <label className="text-xs text-muted">Input data (JSON, optional)</label>
      <textarea
        className="form-input"
        aria-label="Input data"
        value={inputText}
        onChange={(e) => commitInput(e.target.value)}
        rows={2}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px' }}
      />
      {inputError && <div className="text-xs" style={{ color: 'var(--accent-error)' }}>{inputError}</div>}

      <div className="text-xs text-muted" style={{ margin: '8px 0 4px' }}>Force action outcomes</div>
      {overrides.map((o, i) => (
        <OverrideRow
          key={o.id ?? i}
          override={o}
          steps={steps}
          onChange={(next) => setOverrides(overrides.map((x, j) => (j === i ? next : x)))}
          onRemove={() => setOverrides(overrides.filter((_, j) => j !== i))}
        />
      ))}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOverrides([...overrides, { id: crypto.randomUUID(), stepId: '', mockOutput: {} }])}
      >
        <Plus size={12} /> Add override
      </button>
    </div>
  );
}
