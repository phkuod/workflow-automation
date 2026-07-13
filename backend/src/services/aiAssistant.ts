import { v4 as uuidv4 } from 'uuid';
import type { WorkflowDefinition, Station, Step, StepType } from '../types/workflow';
import { createLogger } from '../utils/logger';

const log = createLogger('aiAssistant');

const VALID_STEP_TYPES: StepType[] = [
  'trigger-manual', 'trigger-cron', 'trigger-webhook',
  'script-js', 'script-python', 'http-request', 'if-else',
  'set-variable', 'wait', 'notification-slack', 'action-email',
  'action-slack', 'connector-db',
];

export function isAiEnabled(): boolean {
  return Boolean(process.env.AI_API_KEY && process.env.AI_MODEL);
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

const AI_REQUEST_TIMEOUT_MS = 60_000;

async function chat(messages: ChatMessage[]): Promise<string> {
  const baseUrl = process.env.AI_API_BASE_URL || 'https://openrouter.ai/api/v1';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      messages,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`AI provider returned status ${response.status}`);
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI provider returned no content');
  }
  return content;
}

const DRAFT_SYSTEM_PROMPT = `You design automations for a workflow tool. Respond with ONLY a JSON object, no prose, no markdown fences.
Schema:
{
  "name": string,                       // short automation name
  "description": string,                // one sentence
  "stations": [                         // 1-4 sequential stages
    {
      "name": string,                   // short stage name
      "steps": [                        // 1-4 actions per stage
        { "name": string, "type": string, "config": object }
      ]
    }
  ]
}
Allowed step types and their config keys:
- "trigger-manual" {} | "trigger-cron" {"cronExpression"} | "trigger-webhook" {"webhookMethod"}
- "http-request" {"url","method"} | "action-email" {"emailTo","emailSubject","emailBody"}
- "action-slack" {"slackWebhookUrl","slackMessage"} | "if-else" {"condition"}
- "set-variable" {"variableName","variableValue"} | "wait" {"duration","unit"}
- "script-js" {"code"} | "script-python" {"code"} | "connector-db" {"dbType","dbQuery"}
Rules: exactly one trigger step, placed first in the first stage. Prefer simple 2-stage designs. Use realistic placeholder values the user can edit.`;

export interface AiDraft {
  name: string;
  description: string;
  definition: WorkflowDefinition;
}

interface RawDraftStep {
  name?: unknown;
  type?: unknown;
  config?: unknown;
}

interface RawDraftStation {
  name?: unknown;
  steps?: unknown;
}

/** Parse and validate LLM draft output; normalize into a full WorkflowDefinition. */
export function parseDraft(content: string): AiDraft {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let raw: { name?: unknown; description?: unknown; stations?: unknown };
  try {
    raw = JSON.parse(stripped);
  } catch {
    throw new Error('AI response was not valid JSON');
  }

  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Untitled Automation';
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';

  if (!Array.isArray(raw.stations) || raw.stations.length === 0) {
    throw new Error('Draft must contain at least one stage');
  }

  const stations: Station[] = (raw.stations as RawDraftStation[]).map((st, i) => {
    if (!st || typeof st !== 'object' || Array.isArray(st)) {
      throw new Error('Every stage must be an object');
    }
    if (!Array.isArray(st.steps) || st.steps.length === 0) {
      throw new Error('Every stage must contain at least one action');
    }
    const steps: Step[] = (st.steps as RawDraftStep[]).map((s, j) => {
      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        throw new Error('Every action must be an object');
      }
      if (typeof s.type !== 'string' || !VALID_STEP_TYPES.includes(s.type as StepType)) {
        throw new Error(`Unknown step type: ${String(s.type)}`);
      }
      const config = s.config && typeof s.config === 'object' && !Array.isArray(s.config)
        ? (s.config as Step['config'])
        : {};
      return {
        id: uuidv4(),
        name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : `Action ${j + 1}`,
        type: s.type as StepType,
        config,
        position: { x: 100 + j * 200, y: 100 },
      };
    });
    return {
      id: uuidv4(),
      name: typeof st.name === 'string' && st.name.trim() ? st.name.trim() : `Stage ${i + 1}`,
      steps,
      position: { x: 100 + i * 300, y: 150 },
    };
  });

  return { name, description, definition: { stations } };
}

export async function draftAutomation(userDescription: string): Promise<AiDraft> {
  const content = await chat([
    { role: 'system', content: DRAFT_SYSTEM_PROMPT },
    { role: 'user', content: userDescription },
  ]);
  const draft = parseDraft(content);
  log.info({ name: draft.name, stations: draft.definition.stations.length }, 'AI draft generated');
  return draft;
}

const EXPLAIN_SYSTEM_PROMPT = `You explain automation failures to non-technical office workers.
Answer in 2-3 plain sentences: what went wrong in everyday language, then one concrete suggestion to fix it.
No stack traces, no jargon, no markdown.`;

export interface ExplainContext {
  workflowName: string;
  stationName: string;
  stepName: string;
  stepType: string;
  errorMessage: string;
}

export async function explainRunError(ctx: ExplainContext): Promise<string> {
  const content = await chat([
    { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Automation "${ctx.workflowName}", stage "${ctx.stationName}", action "${ctx.stepName}" (type ${ctx.stepType}) failed with: ${ctx.errorMessage}`,
    },
  ]);
  return content.trim();
}
