import type { StepConfig } from '../../../../shared/types/workflow';

interface ScriptConfigFormProps {
  type: 'script-js' | 'script-python';
  code: string;
  onCodeChange: (code: string) => void;
}

export default function ScriptConfigForm({ type, code, onCodeChange }: ScriptConfigFormProps) {
  const isJs = type === 'script-js';
  return (
    <div className="form-group">
      <label className="form-label">{isJs ? 'JavaScript' : 'Python'} Code</label>
      <textarea
        className="form-textarea"
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        placeholder={isJs
          ? `// Access input data via inputData object\n// Return value will be the step output\n\nconst result = inputData.value * 2;\nreturn { result };`
          : `# Access input data via input_data dict\n# Print JSON for output\n\nresult = input_data.get('value', 0) * 2\nprint(json.dumps({'result': result}))`
        }
        style={{ minHeight: '200px', fontFamily: 'monospace' }}
      />
      <p className="text-xs text-muted mt-2">
        {isJs
          ? <>Access previous step outputs via <code>inputData</code>. Return an object for the step output.</>
          : <>Access input via <code>input_data</code> dict. Print JSON for output.</>
        }
      </p>
    </div>
  );
}
