import { useState } from 'react';
import { Database } from 'lucide-react';
import { VariablePicker } from '../VariablePicker';
import type { Workflow } from '../../../../shared/types/workflow';

interface VariableConfigFormProps {
  stepId: string;
  workflow: Workflow;
  variableName: string;
  variableValue: string;
  onVariableNameChange: (name: string) => void;
  onVariableValueChange: (value: string) => void;
}

export default function VariableConfigForm({
  stepId, workflow, variableName, variableValue,
  onVariableNameChange, onVariableValueChange,
}: VariableConfigFormProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <div className="form-group">
        <label className="form-label">Variable Name</label>
        <input
          type="text"
          className="form-input"
          value={variableName}
          onChange={(e) => onVariableNameChange(e.target.value)}
          placeholder="myVariable"
        />
      </div>
      <div className="form-group">
        <label className="form-label">Value</label>
        <div className="flex gap-2">
          <input
            type="text"
            className="form-input"
            value={variableValue}
            onChange={(e) => onVariableValueChange(e.target.value)}
            placeholder="${step1.output.result}"
          />
          <button
            className={`btn btn-icon btn-sm ${showPicker ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowPicker(!showPicker)}
            aria-label="Insert variable reference"
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
                onVariableValueChange(variableValue + v);
                setShowPicker(false);
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
