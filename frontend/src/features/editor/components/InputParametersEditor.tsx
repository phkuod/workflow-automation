import { useState } from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';
import type { InputParameter } from '../../../shared/types/workflow';

interface Props {
  parameters: InputParameter[];
  onChange: (params: InputParameter[]) => void;
}

export default function InputParametersEditor({ parameters, onChange }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const addParam = () => {
    onChange([...parameters, {
      name: `param${parameters.length + 1}`,
      type: 'string',
      required: false,
    }]);
  };

  const updateParam = (index: number, data: Partial<InputParameter>) => {
    const updated = parameters.map((p, i) => i === index ? { ...p, ...data } : p);
    onChange(updated);
  };

  const removeParam = (index: number) => {
    onChange(parameters.filter((_, i) => i !== index));
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <button
        className="btn btn-sm btn-secondary"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ width: '100%', justifyContent: 'flex-start', gap: '8px' }}
      >
        <Settings size={14} />
        Input Parameters ({parameters.length})
      </button>

      {isExpanded && (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}>
          {parameters.map((param, index) => (
            <div key={index} style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '8px',
              alignItems: 'flex-start',
            }}>
              <input
                className="form-input"
                value={param.name}
                onChange={(e) => updateParam(index, { name: e.target.value })}
                placeholder="Name"
                style={{ flex: 1, fontSize: '13px' }}
              />
              <select
                className="form-select"
                value={param.type}
                onChange={(e) => updateParam(index, { type: e.target.value as InputParameter['type'] })}
                style={{ width: '100px', fontSize: '13px' }}
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="json">JSON</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={!!param.required}
                  onChange={(e) => updateParam(index, { required: e.target.checked })}
                />
                Req
              </label>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => removeParam(index)}
              >
                <Trash2 size={14} style={{ color: 'var(--accent-error)' }} />
              </button>
            </div>
          ))}
          <button
            className="btn btn-sm btn-secondary"
            onClick={addParam}
            style={{ width: '100%' }}
          >
            <Plus size={14} />
            Add Parameter
          </button>
        </div>
      )}
    </div>
  );
}
