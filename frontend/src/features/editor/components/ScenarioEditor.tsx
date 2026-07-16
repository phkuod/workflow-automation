import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import type { Step } from '../../../shared/types/workflow';
import type { ScenarioInput, ScenarioOverrideInput } from '../types/scenario';

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
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px', borderLeft: '2px solid var(--border-color)', paddingLeft: '8px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <select
              className="form-select"
              aria-label="Action"
              value={o.stepId}
              onChange={(e) => setOverrides(overrides.map((x, j) => j === i ? { ...x, stepId: e.target.value } : x))}
              style={{ flex: 1, fontSize: '12px' }}
            >
              <option value="">Pick an action…</option>
              {steps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="btn btn-ghost btn-icon btn-sm" aria-label="Remove override" onClick={() => setOverrides(overrides.filter((_, j) => j !== i))}>
              <Trash2 size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
            <label><input type="radio" checked={o.mockError === undefined} onChange={() => setOverrides(overrides.map((x, j) => j === i ? { stepId: x.stepId, mockOutput: {} } : x))} /> Succeeds and returns</label>
            <label><input type="radio" checked={o.mockError !== undefined} onChange={() => setOverrides(overrides.map((x, j) => j === i ? { stepId: x.stepId, mockError: '' } : x))} /> Fails with</label>
          </div>
          {o.mockError === undefined ? (
            <textarea
              className="form-input" aria-label="Mock output JSON" rows={2}
              value={typeof o.mockOutput === 'string' ? o.mockOutput : JSON.stringify(o.mockOutput ?? {}, null, 2)}
              onChange={(e) => {
                let parsed: unknown = e.target.value;
                try { parsed = JSON.parse(e.target.value); } catch { /* keep raw string; validated on run */ }
                setOverrides(overrides.map((x, j) => j === i ? { stepId: x.stepId, mockOutput: parsed } : x));
              }}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px' }}
            />
          ) : (
            <input
              className="form-input" aria-label="Mock error message"
              value={o.mockError}
              onChange={(e) => setOverrides(overrides.map((x, j) => j === i ? { stepId: x.stepId, mockError: e.target.value } : x))}
              style={{ fontSize: '12px' }}
            />
          )}
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => setOverrides([...overrides, { stepId: '', mockOutput: {} }])}>
        <Plus size={12} /> Add override
      </button>
    </div>
  );
}
