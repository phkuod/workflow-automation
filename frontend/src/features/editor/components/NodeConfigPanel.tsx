import { useState, useEffect } from 'react';
import type { Step, StepConfig, Workflow } from '../../../shared/types/workflow';
import { STEP_TYPE_INFO } from '../../../shared/types/workflow';
import { X, Trash2, Save, Package } from 'lucide-react';

import ScriptConfigForm from './step-configs/ScriptConfigForm';
import HttpRequestConfigForm from './step-configs/HttpRequestConfigForm';
import ConditionConfigForm from './step-configs/ConditionConfigForm';
import VariableConfigForm from './step-configs/VariableConfigForm';
import TriggerConfigForm from './step-configs/TriggerConfigForm';
import WaitConfigForm from './step-configs/WaitConfigForm';
import NotificationConfigForm from './step-configs/NotificationConfigForm';
import DatabaseConfigForm from './step-configs/DatabaseConfigForm';

interface NodeConfigPanelProps {
  step: Step;
  workflow: Workflow;
  onUpdate: (data: Partial<Step>) => void;
  onDelete: () => void;
  onClose: () => void;
}

function NodeConfigPanel({ step, workflow, onUpdate, onDelete, onClose }: NodeConfigPanelProps) {
  const [name, setName] = useState(step.name);
  const [code, setCode] = useState(step.config.code || '');
  const [url, setUrl] = useState(step.config.url || '');
  const [method, setMethod] = useState(step.config.method || 'GET');
  const [body, setBody] = useState(step.config.body || '');
  const [headers, setHeaders] = useState<{key: string, value: string}[]>(
    step.config.headers ? Object.entries(step.config.headers).map(([key, value]) => ({ key, value: value as string })) : []
  );
  const [timeout, setTimeoutValue] = useState(step.timeout ? step.timeout / 1000 : 30);
  const [condition, setCondition] = useState(step.config.condition || '');
  const [variableName, setVariableName] = useState(step.config.variableName || '');
  const [variableValue, setVariableValue] = useState(step.config.variableValue || '');
  const [cronExpression, setCronExpression] = useState(step.config.cronExpression || '');
  const [duration, setDuration] = useState(step.config.duration || 5);
  const [unit, setUnit] = useState(step.config.unit || 'seconds');
  const [webhookMethod, setWebhookMethod] = useState(step.config.webhookMethod || 'POST');
  const [emailTo, setEmailTo] = useState(step.config.emailTo || '');
  const [emailSubject, setEmailSubject] = useState(step.config.emailSubject || '');
  const [emailBody, setEmailBody] = useState(step.config.emailBody || '');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(step.config.slackWebhookUrl || '');
  const [slackMessage, setSlackMessage] = useState(step.config.slackMessage || '');
  const [dbType, setDbType] = useState(step.config.dbType || 'postgres');
  const [dbHost, setDbHost] = useState(step.config.dbHost || '');
  const [dbPort, setDbPort] = useState(step.config.dbPort || 5432);
  const [dbName, setDbName] = useState(step.config.dbName || '');
  const [dbUser, setDbUser] = useState(step.config.dbUser || '');
  const [dbPassword, setDbPassword] = useState(step.config.dbPassword || '');
  const [dbQuery, setDbQuery] = useState(step.config.dbQuery || '');

  // Retry Policy
  const [retryEnabled, setRetryEnabled] = useState(!!step.retryPolicy);
  const [maxAttempts, setMaxAttempts] = useState(step.retryPolicy?.maxAttempts || 3);
  const [initialInterval, setInitialInterval] = useState(step.retryPolicy?.initialInterval || 1000);
  const [backoffCoefficient, setBackoffCoefficient] = useState(step.retryPolicy?.backoffCoefficient || 2);

  useEffect(() => {
    setName(step.name);
    setCode(step.config.code || '');
    setUrl(step.config.url || '');
    setMethod(step.config.method || 'GET');
    setBody(step.config.body || '');
    setHeaders(step.config.headers ? Object.entries(step.config.headers).map(([key, value]) => ({ key, value: value as string })) : []);
    setTimeoutValue(step.timeout ? step.timeout / 1000 : 30);
    setCondition(step.config.condition || '');
    setVariableName(step.config.variableName || '');
    setVariableValue(step.config.variableValue || '');
    setCronExpression(step.config.cronExpression || '');
    setDuration(step.config.duration || 5);
    setUnit(step.config.unit || 'seconds');
    setWebhookMethod(step.config.webhookMethod || 'POST');
    setEmailTo(step.config.emailTo || '');
    setEmailSubject(step.config.emailSubject || '');
    setEmailBody(step.config.emailBody || '');
    setSlackWebhookUrl(step.config.slackWebhookUrl || '');
    setSlackMessage(step.config.slackMessage || '');
    setDbType(step.config.dbType || 'postgres');
    setDbHost(step.config.dbHost || '');
    setDbPort(step.config.dbPort || 5432);
    setDbName(step.config.dbName || '');
    setDbUser(step.config.dbUser || '');
    setDbPassword(step.config.dbPassword || '');
    setDbQuery(step.config.dbQuery || '');
    setRetryEnabled(!!step.retryPolicy);
    setMaxAttempts(step.retryPolicy?.maxAttempts || 3);
    setInitialInterval(step.retryPolicy?.initialInterval || 1000);
    setBackoffCoefficient(step.retryPolicy?.backoffCoefficient || 2);
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
        config.method = method as StepConfig['method'];
        config.body = body;
        config.headers = headers.length > 0 ? Object.fromEntries(headers.filter(h => h.key).map(h => [h.key, h.value])) : undefined;
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
      case 'wait':
        config.duration = Number(duration);
        config.unit = unit as StepConfig['unit'];
        break;
      case 'trigger-webhook':
        config.webhookMethod = webhookMethod as StepConfig['webhookMethod'];
        break;
      case 'action-email':
        config.emailTo = emailTo;
        config.emailSubject = emailSubject;
        config.emailBody = emailBody;
        break;
      case 'action-slack':
        config.slackWebhookUrl = slackWebhookUrl;
        config.slackMessage = slackMessage;
        break;
      case 'connector-db':
        config.dbType = dbType as StepConfig['dbType'];
        config.dbHost = dbHost;
        config.dbPort = Number(dbPort);
        config.dbName = dbName;
        config.dbUser = dbUser;
        config.dbPassword = dbPassword;
        config.dbQuery = dbQuery;
        break;
    }

    const updateData: Partial<Step> = { name, config, timeout: timeout * 1000 };

    if (retryEnabled) {
      updateData.retryPolicy = {
        maxAttempts: Number(maxAttempts),
        initialInterval: Number(initialInterval),
        backoffCoefficient: Number(backoffCoefficient)
      };
    } else {
      updateData.retryPolicy = undefined;
    }

    onUpdate(updateData);
  };

  const typeInfo = STEP_TYPE_INFO[step.type] || { label: step.type, icon: <Package size={16} />, color: '#64748b' };

  const renderConfigFields = () => {
    switch (step.type) {
      case 'script-js':
      case 'script-python':
        return <ScriptConfigForm type={step.type} code={code} onCodeChange={setCode} />;

      case 'http-request':
        return (
          <HttpRequestConfigForm
            stepId={step.id} workflow={workflow}
            url={url} method={method} body={body} headers={headers} timeout={timeout}
            onUrlChange={setUrl} onMethodChange={setMethod} onBodyChange={setBody}
            onHeadersChange={setHeaders} onTimeoutChange={setTimeoutValue}
          />
        );

      case 'if-else':
        return (
          <ConditionConfigForm
            stepId={step.id} workflow={workflow}
            condition={condition} onConditionChange={setCondition}
          />
        );

      case 'set-variable':
        return (
          <VariableConfigForm
            stepId={step.id} workflow={workflow}
            variableName={variableName} variableValue={variableValue}
            onVariableNameChange={setVariableName} onVariableValueChange={setVariableValue}
          />
        );

      case 'trigger-cron':
      case 'trigger-webhook':
      case 'trigger-manual':
        return (
          <TriggerConfigForm
            type={step.type} stepId={step.id}
            cronExpression={cronExpression} webhookMethod={webhookMethod}
            onCronExpressionChange={setCronExpression} onWebhookMethodChange={setWebhookMethod}
          />
        );

      case 'wait':
        return (
          <WaitConfigForm
            duration={duration} unit={unit}
            onDurationChange={setDuration} onUnitChange={setUnit}
          />
        );

      case 'action-email':
        return (
          <NotificationConfigForm
            type="action-email" stepId={step.id} workflow={workflow}
            emailTo={emailTo} emailSubject={emailSubject} emailBody={emailBody}
            onEmailToChange={setEmailTo} onEmailSubjectChange={setEmailSubject} onEmailBodyChange={setEmailBody}
          />
        );

      case 'action-slack':
        return (
          <NotificationConfigForm
            type="action-slack" stepId={step.id} workflow={workflow}
            slackWebhookUrl={slackWebhookUrl} slackMessage={slackMessage}
            onSlackWebhookUrlChange={setSlackWebhookUrl} onSlackMessageChange={setSlackMessage}
          />
        );

      case 'connector-db':
        return (
          <DatabaseConfigForm
            dbType={dbType} dbHost={dbHost} dbPort={dbPort} dbName={dbName}
            dbUser={dbUser} dbPassword={dbPassword} dbQuery={dbQuery}
            onDbTypeChange={setDbType} onDbHostChange={setDbHost} onDbPortChange={setDbPort}
            onDbNameChange={setDbName} onDbUserChange={setDbUser} onDbPasswordChange={setDbPassword}
            onDbQueryChange={setDbQuery}
          />
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
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close configuration panel">
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

        {/* Retry Policy - Only for actions, not triggers */}
        {!step.type.startsWith('trigger-') && step.type !== 'if-else' && step.type !== 'wait' && (
          <div className="mt-8 pt-6 border-t border-color">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold">Retry Policy</h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={retryEnabled}
                  onChange={(e) => setRetryEnabled(e.target.checked)}
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {retryEnabled && (
              <div className="space-y-4">
                <div className="form-group">
                  <label className="form-label">Max Attempts</label>
                  <input
                    type="number"
                    className="form-input"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Number(e.target.value))}
                    min={1}
                    max={10}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Interval (ms)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={initialInterval}
                    onChange={(e) => setInitialInterval(Number(e.target.value))}
                    min={100}
                    step={100}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Backoff Coefficient</label>
                  <input
                    type="number"
                    className="form-input"
                    value={backoffCoefficient}
                    onChange={(e) => setBackoffCoefficient(Number(e.target.value))}
                    min={1}
                    step={0.1}
                  />
                </div>
              </div>
            )}
          </div>
        )}
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
        <button className="btn btn-danger btn-sm" onClick={onDelete} aria-label="Delete step">
          <Trash2 size={14} />
          Delete
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          style={{ marginLeft: 'auto' }}
          aria-label="Save step configuration"
        >
          <Save size={14} />
          Save
        </button>
      </div>
    </div>
  );
}

export default NodeConfigPanel;
