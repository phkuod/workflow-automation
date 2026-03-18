interface TriggerConfigFormProps {
  type: 'trigger-cron' | 'trigger-webhook' | 'trigger-manual';
  stepId: string;
  cronExpression: string;
  webhookMethod: string;
  onCronExpressionChange: (expr: string) => void;
  onWebhookMethodChange: (method: string) => void;
}

export default function TriggerConfigForm({
  type, stepId, cronExpression, webhookMethod,
  onCronExpressionChange, onWebhookMethodChange,
}: TriggerConfigFormProps) {
  if (type === 'trigger-cron') {
    return (
      <div className="form-group">
        <label className="form-label">Cron Expression</label>
        <input
          type="text"
          className="form-input"
          value={cronExpression}
          onChange={(e) => onCronExpressionChange(e.target.value)}
          placeholder="0 * * * *"
        />
        <p className="text-xs text-muted mt-2">
          Examples: <code>0 * * * *</code> (hourly), <code>0 9 * * *</code> (daily at 9am)
        </p>
      </div>
    );
  }

  if (type === 'trigger-webhook') {
    const webhookUrl = `${window.location.protocol}//${window.location.host}/api/webhooks/${stepId}`;
    return (
      <>
        <div className="form-group">
          <label className="form-label">Webhook URL</label>
          <div className="flex gap-2">
            <input type="text" className="form-input" value={webhookUrl} readOnly />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigator.clipboard.writeText(webhookUrl)}
            >
              Copy
            </button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Expected Method</label>
          <select
            className="form-select"
            value={webhookMethod}
            onChange={(e) => onWebhookMethodChange(e.target.value)}
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
            <option value="PUT">PUT</option>
          </select>
        </div>
      </>
    );
  }

  // trigger-manual
  return (
    <div className="text-muted text-sm">
      This trigger is activated manually when you run the workflow.
    </div>
  );
}
