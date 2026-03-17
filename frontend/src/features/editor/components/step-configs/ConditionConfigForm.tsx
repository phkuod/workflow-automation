import { useState } from 'react';
import { Database } from 'lucide-react';
import { VariablePicker } from '../VariablePicker';
import type { Workflow } from '../../../../shared/types/workflow';

interface ConditionConfigFormProps {
  stepId: string;
  workflow: Workflow;
  condition: string;
  onConditionChange: (condition: string) => void;
}

export default function ConditionConfigForm({ stepId, workflow, condition, onConditionChange }: ConditionConfigFormProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="form-group">
      <label className="form-label">Condition Expression</label>
      <div className="flex gap-2">
        <input
          type="text"
          className="form-input"
          value={condition}
          onChange={(e) => onConditionChange(e.target.value)}
          placeholder="${step1.output.value} > 10"
        />
        <button
          className={`btn btn-icon btn-sm ${showPicker ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setShowPicker(!showPicker)}
          aria-label="Insert variable into condition"
        >
          <Database size={14} />
        </button>
      </div>
      {showPicker && (
        <div className="mt-2">
          <VariablePicker
            workflow={workflow}
            currentStepId={stepId}
            onSelect={(v) => {
              const cleanVar = v.replace(/[{}]/g, '');
              onConditionChange(condition + (condition ? ' && ' : '') + cleanVar);
              setShowPicker(false);
            }}
          />
        </div>
      )}
      <p className="text-xs text-muted mt-2">
        JavaScript expression that evaluates to true/false.
      </p>
    </div>
  );
}
