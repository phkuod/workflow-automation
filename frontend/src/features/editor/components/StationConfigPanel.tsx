import { useState, useEffect } from 'react';
import type { Station, Workflow } from '../../../shared/types/workflow';
import X from 'lucide-react/dist/esm/icons/x';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Save from 'lucide-react/dist/esm/icons/save';
import Repeat from 'lucide-react/dist/esm/icons/repeat';
import { VariablePicker } from './VariablePicker';

interface StationConfigPanelProps {
  station: Station;
  workflow: Workflow;
  onUpdate: (data: Partial<Station>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function StationConfigPanel({ station, workflow, onUpdate, onDelete, onClose }: StationConfigPanelProps) {
  const [name, setName] = useState(station.name);
  const [description, setDescription] = useState(station.description || '');
  const [iteratorEnabled, setIteratorEnabled] = useState(station.iterator?.enabled || false);
  const [sourceVariable, setSourceVariable] = useState(station.iterator?.sourceVariable || '');
  const [itemVariableName, setItemVariableName] = useState(station.iterator?.itemVariableName || 'item');
  const [conditionType, setConditionType] = useState<'none' | 'expression' | 'previousSuccess'>(station.condition?.type === 'expression' ? 'expression' : station.condition?.type === 'previousSuccess' ? 'previousSuccess' : 'none');
  const [conditionExpression, setConditionExpression] = useState(station.condition?.expression || '');
  const [activePicker, setActivePicker] = useState<string | boolean>(false);

  useEffect(() => {
    setName(station.name);
    setDescription(station.description || '');
    setIteratorEnabled(station.iterator?.enabled || false);
    setSourceVariable(station.iterator?.sourceVariable || '');
    setItemVariableName(station.iterator?.itemVariableName || 'item');
    setConditionType(station.condition?.type === 'expression' ? 'expression' : station.condition?.type === 'previousSuccess' ? 'previousSuccess' : 'none');
    setConditionExpression(station.condition?.expression || '');
  }, [station]);

  const handleSave = () => {
    let condition: Station['condition'] = undefined;
    if (conditionType === 'expression' && conditionExpression) {
      condition = { type: 'expression', expression: conditionExpression };
    } else if (conditionType === 'previousSuccess') {
      condition = { type: 'previousSuccess' };
    }
    
    onUpdate({
      name,
      description: description || undefined,
      iterator: {
        enabled: iteratorEnabled,
        sourceVariable,
        itemVariableName
      },
      condition
    });
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
              background: 'rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Repeat size={18} style={{ color: 'var(--accent-secondary)' }} />
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Configure Stage</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Set stage options and loops</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <div className="form-group">
          <label className="form-label">Stage Name</label>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <textarea
            className="form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this stage does..."
            rows={2}
          />
        </div>

        <div className="mt-8 pt-6 border-t border-color">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
               Execution Condition
            </h4>
          </div>

          <div className="form-group">
            <label className="form-label">Condition Type</label>
            <select
              className="form-select"
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value as 'none' | 'expression' | 'previousSuccess')}
            >
              <option value="none">Always Run</option>
              <option value="expression">Custom Expression</option>
              <option value="previousSuccess">Previous Stage Succeeded</option>
            </select>
          </div>

          {conditionType === 'previousSuccess' && (
            <p className="text-xs text-muted mb-4 italic">
              This stage will only run if the previous stage completed successfully.
            </p>
          )}

          {conditionType === 'expression' && (
            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label">Condition (JavaScript)</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    className="form-input"
                    value={conditionExpression}
                    onChange={(e) => setConditionExpression(e.target.value)}
                    placeholder="steps['Prev'].output.success === true"
                  />
                  <button 
                    className={`btn btn-icon btn-sm ${activePicker === 'condition' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActivePicker(activePicker === 'condition' ? false : 'condition')}
                  >
                    {/* Database Icon */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                  </button>
                </div>
                {activePicker === 'condition' && (
                  <div className="mt-2">
                    <VariablePicker 
                      workflow={workflow} 
                      currentStepId={station.steps[0]?.id || ''} 
                      onSelect={(v) => {
                        const cleanVar = v.replace(/[{}]/g, '');
                        setConditionExpression(conditionExpression ? conditionExpression + ' && ' + cleanVar : cleanVar);
                        setActivePicker(false);
                      }} 
                    />
                  </div>
                )}
                <p className="text-[10px] text-muted mt-1">
                  Example: <code>steps['Step Name'].output.value &gt; 10</code>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-color">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Repeat size={16} /> Loop / Iterator
            </h4>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={iteratorEnabled}
                onChange={(e) => setIteratorEnabled(e.target.checked)}
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <p className="text-xs text-muted mb-4 italic">
            Execute all steps in this stage repeatedly for each item in an array.
          </p>

          {iteratorEnabled && (
            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label">Input Array (Source)</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    className="form-input"
                    value={sourceVariable}
                    onChange={(e) => setSourceVariable(e.target.value)}
                    placeholder="{{steps.api.output.items}}"
                  />
                  <button 
                    className={`btn btn-icon btn-sm ${activePicker ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActivePicker(!activePicker)}
                  >
                    <Repeat size={14} />
                  </button>
                </div>
                {activePicker && (
                  <div className="mt-2">
                    <VariablePicker 
                      workflow={workflow} 
                      currentStepId={station.steps[0]?.id || ''} 
                      onSelect={(v) => {
                        setSourceVariable(v);
                        setActivePicker(false);
                      }} 
                    />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Item Variable Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={itemVariableName}
                  onChange={(e) => setItemVariableName(e.target.value)}
                  placeholder="item"
                />
                <p className="text-[10px] text-muted mt-1">
                  Access each item using <code>{`\${${itemVariableName}}`}</code> inside this stage.
                </p>
              </div>
            </div>
          )}
        </div>
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
