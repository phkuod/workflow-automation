import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { ScriptResult, ScriptRunner } from './scriptRunner';
import { StepConfig, AiToolDefinition } from '../types/workflow';
import { createLogger } from '../utils/logger';

const log = createLogger('aiService');

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAiToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: ChatMessage;
    finish_reason: 'stop' | 'tool_calls' | 'length';
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class AiService {
  /**
   * Single LLM call -- used by ai-chat step
   */
  static async executeChat(
    config: StepConfig,
    variables: Record<string, unknown>,
    interpolate: (template: string, ctx: Record<string, unknown>) => string,
    simulate: boolean
  ): Promise<ScriptResult> {
    if (simulate) {
      return {
        success: true,
        output: { simulated: true, response: '[Simulated AI response]', model: config.aiModel },
        logs: ['[SIMULATE] AI chat call skipped']
      };
    }

    const logs: string[] = [];

    try {
      const baseUrl = config.aiBaseUrl || process.env.AI_BASE_URL || 'http://localhost:8000/v1';
      const apiKey = config.aiApiKey || process.env.AI_API_KEY || '';
      const model = config.aiModel || process.env.AI_DEFAULT_MODEL || '';

      const messages: ChatMessage[] = [];

      if (config.aiSystemPrompt) {
        messages.push({
          role: 'system',
          content: interpolate(config.aiSystemPrompt, variables)
        });
      }

      if (config.aiUserPrompt) {
        messages.push({
          role: 'user',
          content: interpolate(config.aiUserPrompt, variables)
        });
      }

      logs.push(`Calling AI chat: ${model} at ${baseUrl}`);

      const response = await this.chatCompletion(baseUrl, apiKey, model, messages, {
        temperature: config.aiTemperature,
        maxTokens: config.aiMaxTokens,
        responseFormat: config.aiResponseFormat
      });

      const assistantMessage = response.choices[0]?.message?.content || '';

      let parsedResponse: unknown = assistantMessage;
      if (config.aiResponseFormat === 'json') {
        try {
          parsedResponse = JSON.parse(assistantMessage);
        } catch {
          // Keep as string if parsing fails
        }
      }

      logs.push(`AI response received (${response.usage?.total_tokens || 0} tokens)`);

      return {
        success: true,
        output: {
          response: parsedResponse,
          model,
          usage: response.usage || {}
        },
        logs
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      log.error({ err: error }, 'AI chat execution failed');
      return {
        success: false,
        error: `AI chat failed: ${errMsg}`,
        logs
      };
    }
  }

  /**
   * Agent loop with tool calling -- used by ai-agent step
   */
  static async executeAgent(
    config: StepConfig,
    variables: Record<string, unknown>,
    interpolate: (template: string, ctx: Record<string, unknown>) => string,
    simulate: boolean,
    signal?: AbortSignal
  ): Promise<ScriptResult> {
    if (simulate) {
      return {
        success: true,
        output: { simulated: true, response: '[Simulated AI agent response]', iterations: 0, toolCalls: [] },
        logs: ['[SIMULATE] AI agent execution skipped']
      };
    }

    const logs: string[] = [];
    const allToolCalls: Array<{ name: string; arguments: unknown; result: string }> = [];

    try {
      const baseUrl = config.aiBaseUrl || process.env.AI_BASE_URL || 'http://localhost:8000/v1';
      const apiKey = config.aiApiKey || process.env.AI_API_KEY || '';
      const model = config.aiModel || process.env.AI_DEFAULT_MODEL || '';
      const maxIterations = Math.min(config.aiMaxIterations || 10, 50);
      const tools = config.aiTools || [];

      const messages: ChatMessage[] = [];

      if (config.aiSystemPrompt) {
        messages.push({
          role: 'system',
          content: interpolate(config.aiSystemPrompt, variables)
        });
      }

      if (config.aiUserPrompt) {
        messages.push({
          role: 'user',
          content: interpolate(config.aiUserPrompt, variables)
        });
      }

      const openAiTools = tools.length > 0 ? this.toOpenAiToolSchemas(tools) : undefined;
      let lastUsage = {};
      let iterations = 0;

      logs.push(`Starting AI agent loop: ${model} at ${baseUrl} (max ${maxIterations} iterations)`);

      for (iterations = 0; iterations < maxIterations; iterations++) {
        if (signal?.aborted) {
          logs.push('Agent loop cancelled');
          return {
            success: false,
            error: 'Execution cancelled',
            output: { response: '', iterations, toolCalls: allToolCalls },
            logs
          };
        }

        const response = await this.chatCompletion(baseUrl, apiKey, model, messages, {
          temperature: config.aiTemperature,
          maxTokens: config.aiMaxTokens,
          tools: openAiTools,
          responseFormat: config.aiResponseFormat
        });

        const choice = response.choices[0];
        lastUsage = response.usage || {};

        if (!choice) {
          logs.push('No response from LLM');
          break;
        }

        messages.push(choice.message);

        if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
          logs.push(`Iteration ${iterations + 1}: ${choice.message.tool_calls.length} tool call(s)`);

          for (const toolCall of choice.message.tool_calls) {
            const toolDef = tools.find(t => t.name === toolCall.function.name);
            let toolResult: string;

            if (!toolDef) {
              toolResult = `Error: Unknown tool "${toolCall.function.name}"`;
              logs.push(`Tool not found: ${toolCall.function.name}`);
            } else {
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(toolCall.function.arguments);
              } catch {
                args = {};
              }

              logs.push(`Executing tool: ${toolCall.function.name}`);
              try {
                toolResult = await this.executeTool(toolDef, args, variables, interpolate);
              } catch (err: unknown) {
                const errMsg = err instanceof Error ? err.message : String(err);
                toolResult = `Error: ${errMsg}`;
                logs.push(`Tool error: ${errMsg}`);
              }

              allToolCalls.push({
                name: toolCall.function.name,
                arguments: args,
                result: toolResult
              });
            }

            messages.push({
              role: 'tool',
              content: toolResult,
              tool_call_id: toolCall.id
            });
          }
        } else {
          // finish_reason is 'stop' or 'length' -- agent is done
          const finalResponse = choice.message.content || '';
          logs.push(`Agent completed after ${iterations + 1} iteration(s)`);

          let parsedResponse: unknown = finalResponse;
          if (config.aiResponseFormat === 'json') {
            try {
              parsedResponse = JSON.parse(finalResponse);
            } catch {
              // Keep as string
            }
          }

          return {
            success: true,
            output: {
              response: parsedResponse,
              iterations: iterations + 1,
              toolCalls: allToolCalls,
              model,
              usage: lastUsage
            },
            logs
          };
        }
      }

      // Max iterations reached -- return last assistant message
      const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
      logs.push(`Warning: Max iterations (${maxIterations}) reached`);

      return {
        success: true,
        output: {
          response: lastAssistantMsg?.content || '',
          iterations,
          toolCalls: allToolCalls,
          model,
          usage: lastUsage,
          maxIterationsReached: true
        },
        logs
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      log.error({ err: error }, 'AI agent execution failed');
      return {
        success: false,
        error: `AI agent failed: ${errMsg}`,
        output: { toolCalls: allToolCalls },
        logs
      };
    }
  }

  /**
   * Make a chat completion request to the OpenAI-compatible API
   */
  private static async chatCompletion(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      tools?: OpenAiToolSchema[];
      responseFormat?: string;
    }
  ): Promise<ChatCompletionResponse> {
    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: false
    };

    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
    }

    if (options.responseFormat === 'json') {
      requestBody.response_format = { type: 'json_object' };
    }

    const body = JSON.stringify(requestBody);
    const timeout = parseInt(process.env.AI_REQUEST_TIMEOUT || '120000', 10);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const { data } = await this.httpRequest(
      `${baseUrl}/chat/completions`,
      'POST',
      headers,
      body,
      timeout
    );

    let parsed: ChatCompletionResponse;
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new Error(`Invalid JSON response from LLM API: ${data.substring(0, 200)}`);
    }

    if ((parsed as unknown as Record<string, unknown>).error) {
      const errObj = (parsed as unknown as Record<string, unknown>).error as Record<string, string>;
      throw new Error(`LLM API error: ${errObj.message || JSON.stringify(errObj)}`);
    }

    return parsed;
  }

  /**
   * Convert AiToolDefinition[] to OpenAI tool schema format
   */
  private static toOpenAiToolSchemas(tools: AiToolDefinition[]): OpenAiToolSchema[] {
    return tools.map(tool => {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [name, param] of Object.entries(tool.parameters)) {
        const prop: Record<string, unknown> = {
          type: param.type,
          description: param.description
        };
        if (param.enum) {
          prop.enum = param.enum;
        }
        properties[name] = prop;
        if (param.required) {
          required.push(name);
        }
      }

      return {
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object' as const,
            properties,
            ...(required.length > 0 ? { required } : {})
          }
        }
      };
    });
  }

  /**
   * Execute a single tool call and return the result string
   */
  private static async executeTool(
    tool: AiToolDefinition,
    args: Record<string, unknown>,
    variables: Record<string, unknown>,
    interpolate: (template: string, ctx: Record<string, unknown>) => string
  ): Promise<string> {
    const mergedVars = { ...variables, params: args };

    switch (tool.type) {
      case 'http': {
        const url = interpolate(tool.toolUrl || '', mergedVars);
        const method = tool.toolMethod || 'POST';
        const headers = tool.toolHeaders || {};
        let body: string | undefined;
        if (tool.toolBodyTemplate) {
          body = interpolate(tool.toolBodyTemplate, mergedVars);
        } else if (method !== 'GET') {
          body = JSON.stringify(args);
        }

        const { data } = await this.httpRequest(url, method, {
          'Content-Type': 'application/json',
          ...headers
        }, body);
        return data;
      }

      case 'javascript': {
        const result = await ScriptRunner.executeJS(
          tool.toolCode || '',
          { params: args, variables },
          30000
        );
        if (result.success) {
          return typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
        }
        throw new Error(result.error || 'JavaScript tool execution failed');
      }

      case 'workflow': {
        // Lazy import to avoid circular dependency
        const { WorkflowModel } = require('../models/workflow');
        const { ExecutionEngine } = require('./executionEngine');

        const workflow = WorkflowModel.getById(tool.toolWorkflowId || '');
        if (!workflow) {
          throw new Error(`Workflow not found: ${tool.toolWorkflowId}`);
        }

        const execution = await ExecutionEngine.execute(workflow, 'api', args, false);
        return JSON.stringify({
          status: execution.status,
          result: execution.result
        });
      }

      default:
        throw new Error(`Unknown tool type: ${tool.type}`);
    }
  }

  /**
   * Low-level HTTP request using Node built-in modules
   */
  private static httpRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
    timeout?: number
  ): Promise<{ status: number; data: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;

      const options: http.RequestOptions = {
        method,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          ...headers
        },
        timeout: timeout || 120000
      };

      const req = transport.request(options, (res: http.IncomingMessage) => {
        let data = '';
        res.on('data', (chunk: Buffer | string) => { data += chunk; });
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`AI API request to ${url} timed out after ${timeout || 120000}ms`));
      });

      if (body && method !== 'GET') {
        req.write(body);
      }
      req.end();
    });
  }
}
