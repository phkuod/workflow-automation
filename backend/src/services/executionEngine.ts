import { v4 as uuidv4 } from 'uuid';
import {
  Workflow,
  Station,
  Step,
  Execution,
  ExecutionResult,
  StationResult,
  StepResult,
  ExecutionLog
} from '../types/workflow';
import { ExecutionModel, LogModel } from '../models/execution';
import { ScriptRunner, ScriptResult } from './scriptRunner';
import { DbConnectorService } from './dbConnector';
import { AiService } from './aiService';
import { executionManager } from './executionManager';
import { executionEventBus, ExecutionEvent } from './executionEventBus';
import nodemailer from 'nodemailer';

// Initialize email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface ExecutionContext {
  executionId: string;
  workflow: Workflow;
  variables: Record<string, unknown>;
  stations: Record<string, StationResult>;
  steps: Record<string, StepResult>;
  logs: Omit<ExecutionLog, 'id' | 'timestamp'>[];
  simulate: boolean;
  signal?: AbortSignal;
}

export class ExecutionEngine {
  /**
   * Execute a workflow with a pre-created execution record (used by webhooks)
   */
  static async executeWithId(
    executionId: string,
    workflow: Workflow,
    triggeredBy: Execution['triggeredBy'] = 'manual',
    inputData: Record<string, unknown> = {},
  ): Promise<Execution> {
    return this.executeInternal(executionId, workflow, triggeredBy, inputData, false);
  }

  /**
   * Execute a workflow
   */
  static async execute(
    workflow: Workflow,
    triggeredBy: Execution['triggeredBy'] = 'manual',
    inputData: Record<string, unknown> = {},
    simulate: boolean = false
  ): Promise<Execution> {
    // Create execution record
    const execution = ExecutionModel.create(workflow.id, workflow.name, triggeredBy);
    return this.executeInternal(execution.id, workflow, triggeredBy, inputData, simulate);
  }

  private static async executeInternal(
    executionId: string,
    workflow: Workflow,
    triggeredBy: Execution['triggeredBy'],
    inputData: Record<string, any>,
    simulate: boolean,
  ): Promise<Execution> {
    const execution = { id: executionId, workflowId: workflow.id, workflowName: workflow.name, status: 'running' as const, triggeredBy, startTime: new Date().toISOString(), successRate: 0 };

    // Validate input parameters
    if (workflow.definition.inputParameters?.length) {
      for (const param of workflow.definition.inputParameters) {
        if (inputData[param.name] === undefined && param.defaultValue !== undefined) {
          inputData[param.name] = param.defaultValue;
        } else if (param.required && inputData[param.name] === undefined) {
          throw new Error(`Missing required input parameter: ${param.name}`);
        }
      }
    }

    // Register with execution manager for cancellation support
    const signal = executionManager.register(execution.id);

    // Initialize context
    const context: ExecutionContext = {
      executionId: execution.id,
      workflow,
      variables: { ...inputData, input: { ...inputData } },
      stations: {},
      steps: {},
      logs: [],
      simulate,
      signal
    };

    this.log(context, 'info', `${simulate ? '[SIMULATE] ' : ''}Starting workflow: ${workflow.name}`);

    const result: ExecutionResult = {
      stations: []
    };

    let totalSteps = 0;
    let completedSteps = 0;
    let failed = false;

    // Execute stations sequentially
    let cancelled = false;
    for (const station of workflow.definition.stations) {
      if (failed) break;

      // Check for cancellation
      if (signal.aborted) {
        cancelled = true;
        failed = true;
        result.error = { message: 'Execution cancelled', code: 'CANCELLED' };
        break;
      }

      // Check station condition
      if (!this.shouldExecuteStation(station, context)) {
        this.log(context, 'info', `Skipping station: ${station.name} (condition not met)`, undefined, station.id);
        const skippedResult = this.createSkippedStationResult(station);
        result.stations.push(skippedResult);
        continue;
      }

      this.log(context, 'info', `Starting station: ${station.name}`, undefined, station.id);
      this.emitEvent(context, 'station:start', { stationId: station.id, stationName: station.name });

      const stationResult = await this.executeStation(station, context);
      result.stations.push(stationResult);

      // Count steps
      totalSteps += station.steps.length;
      completedSteps += stationResult.steps.filter(s => s.status === 'completed').length;

      // Check if station failed
      if (stationResult.status === 'failed') {
        failed = true;
        // Check if it was due to cancellation
        if (signal.aborted) {
          cancelled = true;
          result.error = { message: 'Execution cancelled', code: 'CANCELLED' };
        } else {
          result.error = {
            message: `Workflow stopped at station: ${station.name}`,
            code: 'STATION_FAILED'
          };
        }
        this.log(context, 'error', `Station failed: ${station.name}`, undefined, station.id);
        this.emitEvent(context, 'station:failed', { stationId: station.id, stationName: station.name, error: result.error.message });
      } else {
        this.log(context, 'info', `Station completed: ${station.name}`, stationResult.output, station.id);
        this.emitEvent(context, 'station:complete', { stationId: station.id, stationName: station.name, output: stationResult.output });
      }

      // Store station result for variable access
      context.stations[station.id] = stationResult;
      context.stations[station.name] = stationResult;
    }

    // Calculate success rate
    const successRate = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    // Determine final status
    const finalStatus = cancelled ? 'cancelled' : (failed ? 'failed' : 'completed');

    // Save logs
    if (context.logs.length > 0) {
      LogModel.createMany(context.logs);
    }

    // Unregister from execution manager
    executionManager.unregister(execution.id);

    // Emit terminal event
    const terminalEventType: ExecutionEvent['type'] = cancelled ? 'execution:cancelled' : (failed ? 'execution:failed' : 'execution:complete');
    this.emitEvent(context, terminalEventType, {
      status: finalStatus,
      progress: { completed: completedSteps, total: totalSteps }
    });

    // Update execution record
    const updatedExecution = ExecutionModel.update(execution.id, {
      status: finalStatus,
      endTime: new Date().toISOString(),
      successRate,
      result
    });

    if (simulate) {
      this.log(context, 'info', `[SIMULATE] Workflow ${finalStatus}. Success rate: ${successRate.toFixed(1)}%`);
    } else {
      this.log(context, 'info', `Workflow ${finalStatus}. Success rate: ${successRate.toFixed(1)}%`);
    }

    return updatedExecution!;
  }

  /**
   * Execute a station with all its steps
   */
  private static async executeStation(station: Station, context: ExecutionContext): Promise<StationResult> {
    const stationResult: StationResult = {
      stationId: station.id,
      stationName: station.name,
      status: 'running',
      startTime: new Date().toISOString(),
      steps: [],
      output: {}
    };

    if (station.iterator?.enabled) {
      const sourceVar = station.iterator.sourceVariable;
      const resolvedSource = ScriptRunner.interpolateVariables(sourceVar, context.variables);
      let items: unknown[] = [];
      
      try {
        items = JSON.parse(resolvedSource);
        if (!Array.isArray(items)) {
          throw new Error('Resolved source is not an array');
        }
      } catch (e) {
        this.log(context, 'error', `Iteration failed: Source variable ${sourceVar} is not a valid array`, undefined, station.id);
        stationResult.status = 'failed';
        stationResult.endTime = new Date().toISOString();
        return stationResult;
      }

      this.log(context, 'info', `Starting iteration over ${items.length} items`, undefined, station.id);
      
      const iterationResults: unknown[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Scope variables for this iteration
        const iterationContext: ExecutionContext = {
          ...context,
          variables: { 
            ...context.variables, 
            [station.iterator.itemVariableName || 'item']: item,
            ['index']: i
          },
          // We share the same step results and log history to allow access, 
          // but steps in an iterator might overwrite each other in context.steps
          // This is a known limitation for now.
        };

        this.log(context, 'info', `Iteration ${i + 1}/${items.length}`, { item }, station.id);
        
        const iterStepsResult = await this.executeStationSteps(station, iterationContext);
        stationResult.steps.push(...iterStepsResult.steps);

        if (iterStepsResult.status === 'failed') {
          stationResult.status = 'failed';
          stationResult.endTime = new Date().toISOString();
          this.log(context, 'error', `Iteration failed at index ${i}`, undefined, station.id);
          return stationResult;
        }
        
        iterationResults.push(iterStepsResult.output);
      }

      stationResult.status = 'completed';
      stationResult.output = iterationResults;
    } else {
      const res = await this.executeStationSteps(station, context);
      stationResult.status = res.status;
      stationResult.steps = res.steps;
      stationResult.output = res.output as Record<string, any>;
    }

    stationResult.endTime = new Date().toISOString();

    // Store station output for next stations
    context.variables[station.id] = { output: stationResult.output };
    context.variables[station.name] = { output: stationResult.output };

    return stationResult;
  }

  /**
   * Helper to execute a set of steps for a station
   */
  private static async executeStationSteps(station: Station, context: ExecutionContext): Promise<{ status: StationResult['status'], steps: StepResult[], output: unknown }> {
    const steps: StepResult[] = [];

    // If edges defined, use graph-based execution with if-else routing
    if (station.edges && station.edges.length > 0) {
      const stepMap = new Map(station.steps.map(s => [s.id, s]));
      const executed = new Set<string>();

      // Find start steps (no incoming edges)
      const targetIds = new Set(station.edges.map(e => e.target));
      const startStepIds = station.steps
        .filter(s => !targetIds.has(s.id))
        .map(s => s.id);

      const queue: string[] = [...startStepIds];

      while (queue.length > 0) {
        const stepId = queue.shift()!;
        if (executed.has(stepId)) continue;

        const step = stepMap.get(stepId);
        if (!step) continue;

        if (context.signal?.aborted) {
          return { status: 'failed', steps, output: {} };
        }

        const stepResult = await this.executeStep(step, context);
        steps.push(stepResult);
        executed.add(stepId);

        context.steps[step.id] = stepResult;
        context.steps[step.name] = stepResult;

        if (stepResult.status === 'failed') {
          return { status: 'failed', steps, output: {} };
        }

        if (stepResult.output) {
          context.variables[step.id] = { output: stepResult.output };
          context.variables[step.name] = { output: stepResult.output };
        }

        // Find next steps based on edges
        const outEdges = station.edges!.filter(e => e.source === stepId);

        if (step.type === 'if-else' && stepResult.output?.branch) {
          const branch = stepResult.output.branch as string;
          const nextEdges = outEdges.filter(e => e.sourceHandle === branch);
          for (const edge of nextEdges) {
            if (!executed.has(edge.target)) queue.push(edge.target);
          }
          // Mark skipped branch steps
          const skippedEdges = outEdges.filter(e => e.sourceHandle !== branch);
          for (const edge of skippedEdges) {
            this.markBranchSkipped(edge.target, station, executed, steps, context);
          }
        } else {
          for (const edge of outEdges) {
            if (!executed.has(edge.target)) queue.push(edge.target);
          }
        }
      }
    } else {
      // Linear execution (backward compatible)
      for (const step of station.steps) {
        if (context.signal?.aborted) {
          return { status: 'failed', steps, output: {} };
        }

        const stepResult = await this.executeStep(step, context);
        steps.push(stepResult);

        context.steps[step.id] = stepResult;
        context.steps[step.name] = stepResult;

        if (stepResult.status === 'failed') {
          return { status: 'failed', steps, output: {} };
        }

        if (stepResult.output) {
          context.variables[step.id] = { output: stepResult.output };
          context.variables[step.name] = { output: stepResult.output };
        }
      }
    }

    const output = this.aggregateStationOutput(station, steps, context);
    return { status: 'completed', steps, output };
  }

  /**
   * Recursively mark steps in a skipped branch as 'skipped'
   */
  private static markBranchSkipped(
    stepId: string,
    station: Station,
    executed: Set<string>,
    steps: StepResult[],
    context: ExecutionContext
  ): void {
    if (executed.has(stepId)) return;
    executed.add(stepId);

    const step = station.steps.find(s => s.id === stepId);
    if (!step) return;

    const skippedResult: StepResult = {
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      status: 'skipped',
    };
    steps.push(skippedResult);
    context.steps[step.id] = skippedResult;
    context.steps[step.name] = skippedResult;

    const downstreamEdges = (station.edges || []).filter(e => e.source === stepId);
    for (const edge of downstreamEdges) {
      this.markBranchSkipped(edge.target, station, executed, steps, context);
    }
  }

  /**
   * Execute a single step
   */
  private static async executeStep(step: Step, context: ExecutionContext): Promise<StepResult> {
    const stepResult: StepResult = {
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      status: 'running',
      startTime: new Date().toISOString(),
      input: this.resolveInputVariables(step, context)
    };

    this.emitEvent(context, 'step:start', { stepId: step.id, stepName: step.name });

    const startTime = new Date().toISOString();
    let retryAttempts = 0;
    let currentInterval = step.retryPolicy?.initialInterval || 1000;
    const maxAttempts = step.retryPolicy?.maxAttempts || 1;

    while (retryAttempts < maxAttempts) {
      if (retryAttempts > 0) {
        this.log(context, 'warn', `Retrying step: ${step.name} (Attempt ${retryAttempts + 1}/${maxAttempts})`, undefined, undefined, step.id);
        await new Promise(resolve => setTimeout(resolve, currentInterval));
        currentInterval = Math.min(
          currentInterval * (step.retryPolicy?.backoffCoefficient || 2),
          step.retryPolicy?.maxInterval || 300000 // default 5m cap
        );
      }

      this.log(context, 'info', `Executing step: ${step.name}`, stepResult.input, undefined, step.id);

      try {
        let result: ScriptResult;

        switch (step.type) {
          case 'script-js':
            result = await ScriptRunner.executeJS(
              step.config.code || '',
              { 
                variables: context.variables, 
                inputData: stepResult.input,
                steps: context.steps 
              },
              step.timeout || 30000
            );
            break;

          case 'script-python':
            result = await ScriptRunner.executePython(
              step.config.code || '',
              { 
                variables: context.variables, 
                inputData: stepResult.input || {},
                steps: context.steps
              },
              step.timeout || 30000
            );
            break;

          case 'http-request':
            const method = (step.config.method || 'GET').toUpperCase();
            if (context.simulate && method !== 'GET') {
              this.log(context, 'info', `[SIMULATE] Skipping mutating HTTP request (${method}) to ${step.config.url}`, undefined, undefined, step.id);
              result = {
                success: true,
                output: { simulated: true, status: 200, statusText: 'OK (simulated)', data: null },
                logs: [`[SIMULATE] HTTP ${method} request skipped to prevent side effects`]
              };
            } else {
              if (context.simulate) {
                this.log(context, 'info', `[SIMULATE] Executing GET request to fetch real data for simulation`, undefined, undefined, step.id);
              }
              result = await ScriptRunner.executeHttpRequest(
                step.config,
                { ...context.variables, inputData: stepResult.input }
              );
            }
            break;

          case 'wait': {
            const duration = step.config.duration || 0;
            const unit = step.config.unit || 'seconds';
            const multiplier = unit === 'hours' ? 3600000 : unit === 'minutes' ? 60000 : 1000;
            const waitMs = duration * multiplier;
            if (context.simulate) {
              this.log(context, 'info', `[SIMULATE] Skipping wait of ${duration} ${unit}`, undefined, undefined, step.id);
            } else {
              this.log(context, 'info', `Waiting for ${duration} ${unit} (${waitMs}ms)...`, undefined, undefined, step.id);
              await new Promise(resolve => setTimeout(resolve, waitMs));
            }
            result = {
              success: true,
              output: { waited: !context.simulate, simulated: context.simulate, duration, unit, ms: waitMs },
              logs: [context.simulate ? `[SIMULATE] Wait skipped (${duration} ${unit})` : `Waited for ${duration} ${unit}`]
            };
            break;
          }

          case 'if-else':
            const condition = step.config.condition || 'true';
            const conditionResult = ScriptRunner.evaluateCondition(condition, {
              ...context.variables,
              inputData: stepResult.input
            });
            result = {
              success: true,
              output: { result: conditionResult, branch: conditionResult ? 'true' : 'false' },
              logs: [`Condition evaluated to: ${conditionResult}`]
            };
            break;

          case 'set-variable':
            const varName = step.config.variableName || 'variable';
            const varValue = ScriptRunner.interpolateVariables(
              step.config.variableValue || '',
              { ...context.variables, inputData: stepResult.input }
            );
            context.variables[varName] = varValue;
            result = {
              success: true,
              output: { [varName]: varValue },
              logs: [`Set variable ${varName} = ${varValue}`]
            };
            break;

          case 'trigger-manual':
          case 'trigger-cron':
          case 'trigger-webhook':
            result = {
              success: true,
              output: { triggered: true, timestamp: new Date().toISOString() },
              logs: [`Trigger ${step.type} activated`]
            };
            break;

          case 'notification-slack':
          case 'action-slack': {
            const slackUrl = ScriptRunner.interpolateVariables(step.config.slackWebhookUrl || '', { ...context.variables, inputData: stepResult.input });
            const slackMsg = ScriptRunner.interpolateVariables(step.config.slackMessage || '', { ...context.variables, inputData: stepResult.input });

            if (context.simulate) {
              this.log(context, 'info', `[SIMULATE] Skipping Slack message`, { message: slackMsg }, undefined, step.id);
              result = {
                success: true,
                output: { simulated: true, sent: false, message: slackMsg },
                logs: ['[SIMULATE] Slack message skipped']
              };
            } else {
              this.log(context, 'info', `Sending Slack message to ${slackUrl.substring(0, 20)}...`, undefined, undefined, step.id);
              result = await ScriptRunner.executeHttpRequest(
                {
                  url: slackUrl,
                  method: 'POST',
                  body: JSON.stringify({ text: slackMsg })
                },
                { ...context.variables, inputData: stepResult.input }
              );
            }
            break;
          }

          case 'action-email': {
            const to = ScriptRunner.interpolateVariables(step.config.emailTo || '', { ...context.variables, inputData: stepResult.input });
            const subject = ScriptRunner.interpolateVariables(step.config.emailSubject || '', { ...context.variables, inputData: stepResult.input });
            const emailBody = ScriptRunner.interpolateVariables(step.config.emailBody || '', { ...context.variables, inputData: stepResult.input });

            if (context.simulate) {
              this.log(context, 'info', `[SIMULATE] Skipping email to ${to}`, { subject }, undefined, step.id);
              result = {
                success: true,
                output: { simulated: true, sent: false, to, subject, timestamp: new Date().toISOString() },
                logs: [`[SIMULATE] Email to ${to} skipped`]
              };
            } else {
              this.log(context, 'info', `Sending Email to ${to}`, { subject, body: emailBody }, undefined, step.id);

              try {
                const info = await transporter.sendMail({
                  from: process.env.SMTP_FROM || '"Workflow Automation" <no-reply@localhost>',
                  to,
                  subject,
                  text: emailBody,
                });

                result = {
                  success: true,
                  output: { sent: true, to, subject, messageId: info.messageId, timestamp: new Date().toISOString() },
                  logs: [`Email successfully sent to ${to} (MessageId: ${info.messageId})`]
                };
              } catch (err: unknown) {
                const errMsg = err instanceof Error ? err.message : String(err);
                result = {
                  success: false,
                  error: `Failed to send email: ${errMsg}`,
                  output: { sent: false, to, subject, timestamp: new Date().toISOString() },
                  logs: [`Email sending failed: ${errMsg}`]
                };
              }
            }
            break;
          }

          case 'connector-db': {
            const dbQuery = ScriptRunner.interpolateVariables(
              step.config.dbQuery || '',
              { ...context.variables, inputData: stepResult.input }
            );

            if (context.simulate) {
              this.log(context, 'info', `[SIMULATE] Skipping ${step.config.dbType} query`, { query: dbQuery }, undefined, step.id);
              result = {
                success: true,
                output: { simulated: true, rows: [], count: 0 },
                logs: [`[SIMULATE] Database query skipped`]
              };
            } else {
              this.log(context, 'info', `Executing ${step.config.dbType} query...`, { query: dbQuery }, undefined, step.id);

              try {
                const rows = await DbConnectorService.executeQuery(step.config, dbQuery);
                result = {
                  success: true,
                  output: { rows, count: rows.length },
                  logs: [`Query executed successfully, returned ${rows.length} rows`]
                };
              } catch (err: unknown) {
                const errMsg = err instanceof Error ? err.message : String(err);
                result = {
                  success: false,
                  error: `Database connection or query failed: ${errMsg}`,
                  output: { error: errMsg },
                  logs: [`Database error: ${errMsg}`]
                };
              }
            }
            break;
          }

          case 'ai-chat': {
            if (context.simulate) {
              this.log(context, 'info', `[SIMULATE] Skipping AI chat call`, undefined, undefined, step.id);
              result = {
                success: true,
                output: { simulated: true, response: '[Simulated AI response]', model: step.config.aiModel },
                logs: ['[SIMULATE] AI chat call skipped']
              };
            } else {
              result = await AiService.executeChat(
                step.config,
                { ...context.variables, inputData: stepResult.input },
                ScriptRunner.interpolateVariables.bind(ScriptRunner),
                context.simulate
              );
            }
            break;
          }

          case 'ai-agent': {
            if (context.simulate) {
              this.log(context, 'info', `[SIMULATE] Skipping AI agent execution`, undefined, undefined, step.id);
              result = {
                success: true,
                output: { simulated: true, response: '[Simulated AI agent response]', iterations: 0, toolCalls: [] },
                logs: ['[SIMULATE] AI agent execution skipped']
              };
            } else {
              result = await AiService.executeAgent(
                step.config,
                { ...context.variables, inputData: stepResult.input },
                ScriptRunner.interpolateVariables.bind(ScriptRunner),
                context.simulate,
                context.signal
              );
            }
            break;
          }

          default:
            result = {
              success: false,
              error: `Unknown step type: ${step.type}`,
              logs: []
            };
        }

        // Log script output
        for (const log of result.logs) {
          this.log(context, 'debug', log, undefined, undefined, step.id);
        }

        if (result.success) {
          stepResult.status = 'completed';
          stepResult.output = result.output as Record<string, any>;
          this.log(context, 'info', `Step completed: ${step.name}`, result.output, undefined, step.id);
          break; // Exit retry loop
        } else {
          retryAttempts++;
          if (retryAttempts >= maxAttempts) {
            stepResult.status = 'failed';
            stepResult.error = { message: result.error || 'Unknown error' };
            this.log(context, 'error', `Step failed: ${step.name} - ${result.error}`, undefined, undefined, step.id);
          }
        }

      } catch (error: unknown) {
        retryAttempts++;
        if (retryAttempts >= maxAttempts) {
          const errMsg = error instanceof Error ? error.message : String(error);
          const errStack = error instanceof Error ? error.stack : undefined;
          stepResult.status = 'failed';
          stepResult.error = {
            message: errMsg,
            stack: errStack
          };
          this.log(context, 'error', `Step error: ${step.name} - ${errMsg}`, undefined, undefined, step.id);
        }
      }
    }

    stepResult.endTime = new Date().toISOString();

    // Emit step completion/failure event
    if (stepResult.status === 'completed') {
      this.emitEvent(context, 'step:complete', { stepId: step.id, stepName: step.name, output: stepResult.output });
    } else if (stepResult.status === 'failed') {
      this.emitEvent(context, 'step:failed', { stepId: step.id, stepName: step.name, error: stepResult.error?.message });
    }

    return stepResult;
  }

  /**
   * Check if station should execute based on condition
   */
  private static shouldExecuteStation(station: Station, context: ExecutionContext): boolean {
    if (!station.condition) return true;

    switch (station.condition.type) {
      case 'always':
        return true;
      
      case 'previousSuccess':
        // Check if previous station completed successfully
        const stationResults = Object.values(context.stations);
        if (stationResults.length === 0) return true;
        const lastStation = stationResults[stationResults.length - 1];
        return lastStation.status === 'completed';
      
      case 'expression':
        if (!station.condition.expression) return true;
        return ScriptRunner.evaluateCondition(station.condition.expression, {
          ...context.variables,
          steps: context.steps
        });
      
      default:
        return true;
    }
  }

  /**
   * Resolve input variables for a step
   */
  private static resolveInputVariables(step: Step, context: ExecutionContext): Record<string, unknown> {
    const input: Record<string, unknown> = {};

    if (step.inputVars) {
      for (const mapping of step.inputVars) {
        const value = ScriptRunner.interpolateVariables(mapping.source, context.variables);
        try {
          input[mapping.name] = JSON.parse(value);
        } catch {
          input[mapping.name] = value;
        }
      }
    }

    return input;
  }

  /**
   * Aggregate all step outputs into station output
   */
  private static aggregateStationOutput(
    station: Station, 
    stepResults: StepResult[], 
    context: ExecutionContext
  ): Record<string, unknown> {
    return {
      allStepsCompleted: stepResults.every(s => s.status === 'completed'),
      stepCount: stepResults.length,
      completedCount: stepResults.filter(s => s.status === 'completed').length,
      stepResults: stepResults.map(s => ({
        stepId: s.stepId,
        stepName: s.stepName,
        status: s.status,
        output: s.output
      }))
    };
  }

  /**
   * Create a skipped station result
   */
  private static createSkippedStationResult(station: Station): StationResult {
    return {
      stationId: station.id,
      stationName: station.name,
      status: 'skipped',
      steps: station.steps.map(step => ({
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
        status: 'skipped'
      }))
    };
  }

  /**
   * Emit a real-time execution event via the event bus
   */
  private static emitEvent(context: ExecutionContext, type: ExecutionEvent['type'], data: Partial<ExecutionEvent['data']> = {}): void {
    executionEventBus.emitExecutionEvent({
      executionId: context.executionId,
      type,
      data: {
        timestamp: new Date().toISOString(),
        ...data,
      },
    });
  }

  /**
   * Add log entry
   */
  private static log(
    context: ExecutionContext,
    level: ExecutionLog['level'],
    message: string,
    data?: unknown,
    stationId?: string,
    stepId?: string
  ): void {
    context.logs.push({
      executionId: context.executionId,
      stationId,
      stepId,
      level,
      message,
      data
    });
  }
}
