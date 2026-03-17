import { useState } from 'react';
import { Database } from 'lucide-react';
import { VariablePicker } from '../VariablePicker';
import type { Workflow } from '../../../../shared/types/workflow';

interface HttpRequestConfigFormProps {
  stepId: string;
  workflow: Workflow;
  url: string;
  method: string;
  body: string;
  headers: { key: string; value: string }[];
  timeout: number;
  onUrlChange: (url: string) => void;
  onMethodChange: (method: string) => void;
  onBodyChange: (body: string) => void;
  onHeadersChange: (headers: { key: string; value: string }[]) => void;
  onTimeoutChange: (timeout: number) => void;
}

export default function HttpRequestConfigForm({
  stepId, workflow, url, method, body, headers, timeout,
  onUrlChange, onMethodChange, onBodyChange, onHeadersChange, onTimeoutChange,
}: HttpRequestConfigFormProps) {
  const [activePicker, setActivePicker] = useState<string | null>(null);

  return (
    <>
      <div className="form-group">
        <div className="flex gap-2">
          <input
            type="text"
            className="form-input"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://api.example.com/data"
          />
          <button
            className={`btn btn-icon btn-sm ${activePicker === 'url' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActivePicker(activePicker === 'url' ? null : 'url')}
            aria-label="Insert variable into URL"
          >
            <Database size={14} />
          </button>
        </div>
        {activePicker === 'url' && (
          <div className="mt-2">
            <VariablePicker
              workflow={workflow}
              currentStepId={stepId}
              onSelect={(v) => { onUrlChange(url + v); setActivePicker(null); }}
            />
          </div>
        )}
        <p className="text-xs text-muted mt-2">
          Use <code>{'${variable}'}</code> for dynamic values or click the database icon to pick upstream outputs.
        </p>
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs border border-gray-200 dark:border-gray-700">
          <p className="font-semibold mb-1">Output Structure:</p>
          <div className="font-mono text-muted">
            {'{'}<br/>
            &nbsp;&nbsp;status: number,<br/>
            &nbsp;&nbsp;statusText: string,<br/>
            &nbsp;&nbsp;headers: object,<br/>
            &nbsp;&nbsp;data: any // Response body<br/>
            {'}'}
          </div>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Method</label>
        <select
          className="form-select"
          value={method}
          onChange={(e) => onMethodChange(e.target.value)}
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
          <div className="flex justify-between items-center mb-1">
            <label className="form-label">Request Body (JSON)</label>
            <button
              className="btn btn-ghost btn-xs flex gap-1 items-center"
              onClick={() => setActivePicker(activePicker === 'body' ? null : 'body')}
            >
              <Database size={10} /> Insert Variable
            </button>
          </div>
          <textarea
            className="form-textarea"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder='{"key": "value"}'
            style={{ fontFamily: 'monospace' }}
          />
          {activePicker === 'body' && (
            <div className="mt-2">
              <VariablePicker
                workflow={workflow}
                currentStepId={stepId}
                onSelect={(v) => { onBodyChange(body + v); setActivePicker(null); }}
              />
            </div>
          )}
        </div>
      )}
      <div className="form-group">
        <div className="flex justify-between items-center mb-2">
          <label className="form-label">Request Headers</label>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => onHeadersChange([...headers, { key: '', value: '' }])}
          >
            + Add Header
          </button>
        </div>
        {headers.length === 0 ? (
          <p className="text-xs text-muted italic">No custom headers configured.</p>
        ) : (
          <div className="space-y-2">
            {headers.map((header, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Header Name"
                  value={header.key}
                  onChange={(e) => {
                    const newHeaders = [...headers];
                    newHeaders[idx].key = e.target.value;
                    onHeadersChange(newHeaders);
                  }}
                  style={{ flex: 1 }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => {
                    const newHeaders = [...headers];
                    newHeaders[idx].value = e.target.value;
                    onHeadersChange(newHeaders);
                  }}
                  style={{ flex: 2 }}
                />
                <button
                  className="btn btn-ghost btn-icon btn-xs text-red-500"
                  onClick={() => onHeadersChange(headers.filter((_, i) => i !== idx))}
                  aria-label="Remove header"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="mt-4">
        <summary className="text-xs font-semibold cursor-pointer text-muted hover:text-primary">
          Advanced Settings
        </summary>
        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <div className="form-group">
            <label className="form-label">Timeout (seconds)</label>
            <input
              type="number"
              className="form-input"
              value={timeout}
              onChange={(e) => onTimeoutChange(Number(e.target.value))}
              min={1}
              max={300}
            />
            <p className="text-xs text-muted mt-1">Request will fail if it takes longer than this.</p>
          </div>
        </div>
      </details>
    </>
  );
}
