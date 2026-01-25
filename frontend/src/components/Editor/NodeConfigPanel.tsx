import { useState, useEffect } from 'react';
import type { Step } from '../../types/workflow';
import { STEP_TYPE_INFO } from '../../types/workflow';
import { X, Trash2, Save } from 'lucide-react';

interface NodeConfigPanelProps {
  step: Step;
  onUpdate: (data: Partial<Step>) => void;
  onDelete: () => void;
  onClose: () => void;
}

function NodeConfigPanel({ step, onUpdate, onDelete, onClose }: NodeConfigPanelProps) {
  const [name, setName] = useState(step.name);
  const [code, setCode] = useState(step.config.code || '');
  const [url, setUrl] = useState(step.config.url || '');
  const [method, setMethod] = useState(step.config.method || 'GET');
  const [body, setBody] = useState(step.config.body || '');
  const [condition, setCondition] = useState(step.config.condition || '');
  const [variableName, setVariableName] = useState(step.config.variableName || '');
  const [variableValue, setVariableValue] = useState(step.config.variableValue || '');
  const [cronExpression, setCronExpression] = useState(step.config.cronExpression || '');

  useEffect(() => {
    setName(step.name);
    setCode(step.config.code || '');
    setUrl(step.config.url || '');
    setMethod(step.config.method || 'GET');
    setBody(step.config.body || '');
    setCondition(step.config.condition || '');
    setVariableName(step.config.variableName || '');
    setVariableValue(step.config.variableValue || '');
    setCronExpression(step.config.cronExpression || '');
  }, [step]);

  const handleSave = () => {
    const config = { ...step.config };

    switch (step.type) {
      case 'script-js':
      case 'script-python':
        config.code = code;
        break;
      case 'http-request':
        config.url = url;
        config.method = method as any;
        config.body = body;
        break;
      case 'if-else':
        config.condition = condition;
        break;
      case 'set-variable':
        config.variableName = variableName;
        config.variableValue = variableValue;
        break;
      case 'trigger-cron':
        config.cronExpression = cronExpression;
        break;
    }

    onUpdate({ name, config });
  };

  const typeInfo = STEP_TYPE_INFO[step.type] || { label: step.type, icon: '📦', color: '#64748b' };

  const renderConfigFields = () => {
    switch (step.type) {
      case 'script-js':
        return (
          <div className="form-group">
            <label className="form-label">JavaScript Code</label>
            <textarea
              className="form-textarea"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={`// Access input data via inputData object
// Return value will be the step output

const result = inputData.value * 2;
return { result };`}
              style={{ minHeight: '200px', fontFamily: 'monospace' }}
            />
            <p className="text-xs text-muted mt-2">
              Access previous step outputs via <code>inputData</code>. Return an object for the step output.
            </p>
          </div>
        );

      case 'script-python':
        return (
          <div className="form-group">
            <label className="form-label">Python Code</label>
            <textarea
              className="form-textarea"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={`# Access input data via input_data dict
# Print JSON for output

result = input_data.get('value', 0) * 2
print(json.dumps({'result': result}))`}
              style={{ minHeight: '200px', fontFamily: 'monospace' }}
            />
            <p className="text-xs text-muted mt-2">
              Access input via <code>input_data</code> dict. Print JSON for output.
            </p>
          </div>
        );

      case 'http-request':
        return (
          <>
            <div className="form-group">
              <label className="form-label">URL</label>
              <input
                type="text"
                className="form-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/data"
              />
              <p className="text-xs text-muted mt-2">
                Use <code>{'${variable}'}</code> for dynamic values
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Method</label>
              <select
                className="form-select"
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
            {method !== 'GET' && (
              <div className="form-group">
                <label className="form-label">Request Body (JSON)</label>
                <textarea
                  className="form-textarea"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder='{"key": "value"}'
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
            )}
          </>
        );

      case 'if-else':
        return (
          <div className="form-group">
            <label className="form-label">Condition Expression</label>
            <input
              type="text"
              className="form-input"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="${step1.output.value} > 10"
            />
            <p className="text-xs text-muted mt-2">
              JavaScript expression that evaluates to true/false
            </p>
          </div>
        );

      case 'set-variable':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Variable Name</label>
              <input
                type="text"
                className="form-input"
                value={variableName}
                onChange={(e) => setVariableName(e.target.value)}
                placeholder="myVariable"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Value</label>
              <input
                type="text"
                className="form-input"
                value={variableValue}
                onChange={(e) => setVariableValue(e.target.value)}
                placeholder="${step1.output.result}"
              />
            </div>
          </>
        );

      case 'trigger-cron':
        return (
          <div className="form-group">
            <label className="form-label">Cron Expression</label>
            <input
              type="text"
              className="form-input"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              placeholder="0 * * * *"
            />
            <p className="text-xs text-muted mt-2">
              Examples: <code>0 * * * *</code> (hourly), <code>0 9 * * *</code> (daily at 9am)
            </p>
          </div>
        );

      case 'trigger-manual':
        return (
          <div className="text-muted text-sm">
            This trigger is activated manually when you run the workflow.
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        width: '360px',
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: `${typeInfo.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
            }}
          >
            {typeInfo.icon}
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Configure Step</div>
            <div style={{ fontSize: '12px', color: typeInfo.color }}>{typeInfo.label}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <div className="form-group">
          <label className="form-label">Step Name</label>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {renderConfigFields()}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
        }}
      >
        <button className="btn btn-danger btn-sm" onClick={onDelete}>
          <Trash2 size={14} />
          Delete
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          style={{ marginLeft: 'auto' }}
        >
          <Save size={14} />
          Save
        </button>
      </div>
    </div>
  );
}

export default NodeConfigPanel;
