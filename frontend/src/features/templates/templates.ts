import type { WorkflowDefinition } from '../../shared/types/workflow';

export type TemplateCategory = 'Notifications' | 'Reports' | 'Data Processing' | 'Approvals';

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  definition: WorkflowDefinition;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Notifications', 'Reports', 'Data Processing', 'Approvals',
];

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'daily-report',
    name: 'Scheduled Daily Report',
    description: 'Every morning, fetch fresh data and email a report to your team.',
    category: 'Reports',
    definition: {
      stations: [
        {
          id: 'stage-collect', name: 'Collect data', position: { x: 100, y: 150 },
          steps: [
            { id: 'step-trigger', name: 'Every day at 9:00', type: 'trigger-cron', config: { cronExpression: '0 9 * * *' }, position: { x: 100, y: 100 } },
            { id: 'step-fetch', name: 'Fetch report data', type: 'http-request', config: { url: 'https://api.example.com/report-data', method: 'GET' }, position: { x: 300, y: 100 } },
          ],
        },
        {
          id: 'stage-send', name: 'Send report', position: { x: 400, y: 150 },
          steps: [
            { id: 'step-email', name: 'Email the team', type: 'action-email', config: { emailTo: 'team@example.com', emailSubject: 'Daily Report', emailBody: 'Report data: ${stage-collect.output.stepResults}' }, position: { x: 100, y: 100 } },
          ],
        },
      ],
    },
  },
  {
    id: 'data-pipeline',
    name: 'Data Processing Pipeline',
    description: 'Fetch data from a service, transform it, and keep the result.',
    category: 'Data Processing',
    definition: {
      stations: [
        {
          id: 'stage-fetch', name: 'Fetch', position: { x: 100, y: 150 },
          steps: [
            { id: 'step-trigger', name: 'Start manually', type: 'trigger-manual', config: {}, position: { x: 100, y: 100 } },
            { id: 'step-get', name: 'Get source data', type: 'http-request', config: { url: 'https://api.example.com/data', method: 'GET' }, position: { x: 300, y: 100 } },
          ],
        },
        {
          id: 'stage-transform', name: 'Transform', position: { x: 400, y: 150 },
          steps: [
            { id: 'step-transform', name: 'Reshape the data', type: 'script-js', config: { code: 'const items = input.data || [];\nreturn { count: items.length, items };' }, position: { x: 100, y: 100 } },
            { id: 'step-store', name: 'Remember the result', type: 'set-variable', config: { variableName: 'processedData', variableValue: '${step-transform.output.count}' }, position: { x: 300, y: 100 } },
          ],
        },
      ],
    },
  },
  {
    id: 'webhook-orders',
    name: 'Webhook Order Processor',
    description: 'When another system sends an order, validate it and notify the channel.',
    category: 'Data Processing',
    definition: {
      stations: [
        {
          id: 'stage-receive', name: 'Receive order', position: { x: 100, y: 150 },
          steps: [
            { id: 'step-trigger', name: 'When an order arrives', type: 'trigger-webhook', config: { webhookMethod: 'POST' }, position: { x: 100, y: 100 } },
            { id: 'step-check', name: 'Is the total above 0?', type: 'if-else', config: { condition: 'input.total > 0' }, position: { x: 300, y: 100 } },
          ],
        },
        {
          id: 'stage-notify', name: 'Notify', position: { x: 400, y: 150 },
          steps: [
            { id: 'step-slack', name: 'Post to Slack', type: 'action-slack', config: { slackWebhookUrl: '', slackMessage: 'New order received: ${input.body}' }, position: { x: 100, y: 100 } },
          ],
        },
      ],
    },
  },
  {
    id: 'health-alert',
    name: 'Service Health Alert',
    description: 'Check a service on a schedule and alert Slack if it looks unhealthy.',
    category: 'Notifications',
    definition: {
      stations: [
        {
          id: 'stage-check', name: 'Check service', position: { x: 100, y: 150 },
          steps: [
            { id: 'step-trigger', name: 'Every 30 minutes', type: 'trigger-cron', config: { cronExpression: '*/30 * * * *' }, position: { x: 100, y: 100 } },
            { id: 'step-ping', name: 'Ping the service', type: 'http-request', config: { url: 'https://api.example.com/health', method: 'GET' }, position: { x: 300, y: 100 } },
            { id: 'step-healthy', name: 'Is it healthy?', type: 'if-else', config: { condition: 'input.status === "ok"' }, position: { x: 500, y: 100 } },
          ],
        },
        {
          id: 'stage-alert', name: 'Alert', position: { x: 400, y: 150 },
          steps: [
            { id: 'step-slack', name: 'Alert the channel', type: 'action-slack', config: { slackWebhookUrl: '', slackMessage: '⚠️ Service health check failed!' }, position: { x: 100, y: 100 } },
          ],
        },
      ],
    },
  },
  {
    id: 'welcome-email',
    name: 'New Signup Welcome Email',
    description: 'When a new user signs up, send them a welcome email.',
    category: 'Notifications',
    definition: {
      stations: [
        {
          id: 'stage-welcome', name: 'Welcome', position: { x: 100, y: 150 },
          steps: [
            { id: 'step-trigger', name: 'When a signup arrives', type: 'trigger-webhook', config: { webhookMethod: 'POST' }, position: { x: 100, y: 100 } },
            { id: 'step-email', name: 'Send the welcome email', type: 'action-email', config: { emailTo: '${input.body.email}', emailSubject: 'Welcome!', emailBody: 'Thanks for signing up. We are glad you are here.' }, position: { x: 300, y: 100 } },
          ],
        },
      ],
    },
  },
  {
    id: 'approval-reminder',
    name: 'Pending Approval Reminder',
    description: 'Each afternoon, check for pending approvals and remind the approver by email.',
    category: 'Approvals',
    definition: {
      stations: [
        {
          id: 'stage-check', name: 'Check approvals', position: { x: 100, y: 150 },
          steps: [
            { id: 'step-trigger', name: 'Every day at 15:00', type: 'trigger-cron', config: { cronExpression: '0 15 * * *' }, position: { x: 100, y: 100 } },
            { id: 'step-fetch', name: 'Fetch pending approvals', type: 'http-request', config: { url: 'https://api.example.com/approvals?status=pending', method: 'GET' }, position: { x: 300, y: 100 } },
            { id: 'step-any', name: 'Anything pending?', type: 'if-else', config: { condition: 'input.count > 0' }, position: { x: 500, y: 100 } },
          ],
        },
        {
          id: 'stage-remind', name: 'Remind', position: { x: 400, y: 150 },
          steps: [
            { id: 'step-email', name: 'Email the approver', type: 'action-email', config: { emailTo: 'approver@example.com', emailSubject: 'You have pending approvals', emailBody: 'There are items waiting for your approval.' }, position: { x: 100, y: 100 } },
          ],
        },
      ],
    },
  },
];
