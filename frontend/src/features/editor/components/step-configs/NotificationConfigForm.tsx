import { useState } from 'react';
import { Database } from 'lucide-react';
import { VariablePicker } from '../VariablePicker';
import type { Workflow } from '../../../../shared/types/workflow';

interface EmailConfigProps {
  type: 'action-email';
  stepId: string;
  workflow: Workflow;
  emailTo: string;
  emailSubject: string;
  emailBody: string;
  onEmailToChange: (to: string) => void;
  onEmailSubjectChange: (subject: string) => void;
  onEmailBodyChange: (body: string) => void;
}

interface SlackConfigProps {
  type: 'action-slack' | 'notification-slack';
  stepId: string;
  workflow: Workflow;
  slackWebhookUrl: string;
  slackMessage: string;
  onSlackWebhookUrlChange: (url: string) => void;
  onSlackMessageChange: (message: string) => void;
}

type NotificationConfigFormProps = EmailConfigProps | SlackConfigProps;

export default function NotificationConfigForm(props: NotificationConfigFormProps) {
  if (props.type === 'action-email') {
    return <EmailForm {...props} />;
  }
  return <SlackForm {...props} />;
}

function EmailForm({ stepId, workflow, emailTo, emailSubject, emailBody, onEmailToChange, onEmailSubjectChange, onEmailBodyChange }: EmailConfigProps) {
  const [activePicker, setActivePicker] = useState<string | null>(null);

  return (
    <>
      <div className="form-group">
        <label className="form-label">To</label>
        <div className="flex gap-2">
          <input
            type="text"
            className="form-input"
            value={emailTo}
            onChange={(e) => onEmailToChange(e.target.value)}
            placeholder="user@example.com"
          />
          <button
            className={`btn btn-icon btn-sm ${activePicker === 'emailTo' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActivePicker(activePicker === 'emailTo' ? null : 'emailTo')}
            aria-label="Insert variable into email recipient"
          >
            <Database size={14} />
          </button>
        </div>
        {activePicker === 'emailTo' && (
          <div className="mt-2">
            <VariablePicker
              workflow={workflow}
              currentStepId={stepId}
              onSelect={(v) => { onEmailToChange(emailTo + v); setActivePicker(null); }}
            />
          </div>
        )}
      </div>
      <div className="form-group">
        <label className="form-label">Subject</label>
        <input
          type="text"
          className="form-input"
          value={emailSubject}
          onChange={(e) => onEmailSubjectChange(e.target.value)}
          placeholder="Workflow Notification"
        />
      </div>
      <div className="form-group">
        <div className="flex justify-between items-center mb-1">
          <label className="form-label">Body</label>
          <button
            className="btn btn-ghost btn-xs flex gap-1 items-center"
            onClick={() => setActivePicker(activePicker === 'emailBody' ? null : 'emailBody')}
          >
            <Database size={10} /> Insert Variable
          </button>
        </div>
        <textarea
          className="form-textarea"
          value={emailBody}
          onChange={(e) => onEmailBodyChange(e.target.value)}
          placeholder="Hello, the result is {{path}}"
          style={{ minHeight: '120px' }}
        />
        {activePicker === 'emailBody' && (
          <div className="mt-2">
            <VariablePicker
              workflow={workflow}
              currentStepId={stepId}
              onSelect={(v) => { onEmailBodyChange(emailBody + v); setActivePicker(null); }}
            />
          </div>
        )}
      </div>
    </>
  );
}

function SlackForm({ stepId, workflow, slackWebhookUrl, slackMessage, onSlackWebhookUrlChange, onSlackMessageChange }: SlackConfigProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <div className="form-group">
        <label className="form-label">Slack Webhook URL</label>
        <input
          type="text"
          className="form-input"
          value={slackWebhookUrl}
          onChange={(e) => onSlackWebhookUrlChange(e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
        />
      </div>
      <div className="form-group">
        <div className="flex justify-between items-center mb-1">
          <label className="form-label">Message</label>
          <button
            className="btn btn-ghost btn-xs flex gap-1 items-center"
            onClick={() => setShowPicker(!showPicker)}
          >
            <Database size={10} /> Insert Variable
          </button>
        </div>
        <textarea
          className="form-textarea"
          value={slackMessage}
          onChange={(e) => onSlackMessageChange(e.target.value)}
          placeholder="Workflow notification: {{status}}"
          style={{ minHeight: '100px' }}
        />
        {showPicker && (
          <div className="mt-2">
            <VariablePicker
              workflow={workflow}
              currentStepId={stepId}
              onSelect={(v) => { onSlackMessageChange(slackMessage + v); setShowPicker(false); }}
            />
          </div>
        )}
      </div>
    </>
  );
}
