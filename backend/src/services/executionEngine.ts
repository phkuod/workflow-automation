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

interface ExecutionContext {
  executionId: string;
  workflow: Workflow;
  variables: Record<string, any>;
  stations: Record<string, StationResult>;
  steps: Record<string, StepResult>;
  logs: Omit<ExecutionLog, 'id' | 'timestamp'>[];
}

export class ExecutionEngine {
  /**
   * Execute a workflow
   */
  static async execute(
    workflow: Workflow, 
    triggeredBy: Execution['triggeredBy'] = 'manual',
    inputData: Record<string, any> = {}
  ): Promise<Execution> {
    // Create execution record
    const execution = ExecutionModel.create(workflow.id, workflow.name, triggeredBy);
    
    // Initialize context
    const context: ExecutionContext = {
      executionId: execution.id,
      workflow,
      variables: { ...inputData },
      stations: {},
      steps: {},
      logs: []
    };

    this.log(context, 'info', `Starting workflow: ${workflow.name}`);

    const result: ExecutionResult = {
      stations: []
    };

    let totalSteps = 0;
    let completedSteps = 0;
    let failed = false;

    // Execute stations sequentially
    for (const station of workflow.definition.stations) {
      if (failed) break;

      // Check station condition
      if (!this.shouldExecuteStation(station, context)) {
        this.log(context, 'info', `Skipping station: ${station.name} (condition not met)`, undefined, station.id);
        const skippedResult = this.createSkippedStationResult(station);
        result.stations.push(skippedResult);
        continue;
      }

      this.log(context, 'info', `Starting station: ${station.name}`, undefined, station.id);

      const stationResult = await this.executeStation(station, context);
      result.stations.push(stationResult);

      // Count steps
      totalSteps += station.steps.length;
      completedSteps += stationResult.steps.filter(s => s.status === 'completed').length;

      // Check if station failed
      if (stationResult.status === 'failed') {
        failed = true;
        result.error = {
          message: `Workflow stopped at station: ${station.name}`,
          code: 'STATION_FAILED'
        };
        this.log(context, 'error', `Station failed: ${station.name}`, undefined, station.id);
      } else {
        this.log(context, 'info', `Station completed: ${station.name}`, stationResult.output, station.id);
      }

      // Store station result for variable access
      context.stations[station.id] = stationResult;
      context.stations[station.name] = stationResult;
    }

    // Calculate success rate
    const successRate = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    // Save logs
    if (context.logs.length > 0) {
      LogModel.createMany(context.logs);
    }

    // Update execution record
    const updatedExecution = ExecutionModel.update(execution.id, {
      status: failed ? 'failed' : 'completed',
      endTime: new Date().toISOString(),
      successRate,
      result
    });

    this.log(context, 'info', `Workflow ${failed ? 'failed' : 'completed'}. Success rate: ${successRate.toFixed(1)}%`);

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

    // Execute steps sequentially
    for (const step of station.steps) {
      const stepResult = await this.executeStep(step, context);
      stationResult.steps.push(stepResult);

      // Store step result for variable access
      context.steps[step.id] = stepResult;
      context.steps[step.name] = stepResult;

      // If step failed, stop the workflow
      if (stepResult.status === 'failed') {
        stationResult.status = 'failed';
        stationResult.endTime = new Date().toISOString();
        return stationResult;
      }

      // Add step output to context variables
      if (stepResult.output) {
        context.variables[step.id] = { output: stepResult.output };
        context.variables[step.name] = { output: stepResult.output };
      }
    }

    // Station completed - aggregate results
    stationResult.status = 'completed';
    stationResult.endTime = new Date().toISOString();
    stationResult.output = this.aggregateStationOutput(station, stationResult.steps, context);

    // Store station output for next stations
    context.variables[station.id] = { output: stationResult.output };
    context.variables[station.name] = { output: stationResult.output };

    return stationResult;
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

    this.log(context, 'info', `Executing step: ${step.name}`, stepResult.input, undefined, step.id);

    try {
      let result: ScriptResult;

      switch (step.type) {
        case 'script-js':
          result = await ScriptRunner.executeJS(
            step.config.code || '',
            { ...context.variables, inputData: stepResult.input },
            step.timeout || 30000
          );
          break;

        case 'script-python':
          result = await ScriptRunner.executePython(
            step.config.code || '',
            { ...context.variables, inputData: stepResult.input },
            step.timeout || 30000
          );
          break;

        case 'http-request':
          result = await ScriptRunner.executeHttpRequest(
            step.config,
            { ...context.variables, inputData: stepResult.input }
          );
          break;

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
          result = {
            success: true,
            output: { triggered: true, timestamp: new Date().toISOString() },
            logs: ['Trigger activated']
          };
          break;

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
        stepResult.output = result.output;
        this.log(context, 'info', `Step completed: ${step.name}`, result.output, undefined, step.id);
      } else {
        stepResult.status = 'failed';
        stepResult.error = { message: result.error || 'Unknown error' };
        this.log(context, 'error', `Step failed: ${step.name} - ${result.error}`, undefined, undefined, step.id);
      }

    } catch (error: any) {
      stepResult.status = 'failed';
      stepResult.error = {
        message: error.message || String(error),
        stack: error.stack
      };
      this.log(context, 'error', `Step error: ${step.name} - ${error.message}`, undefined, undefined, step.id);
    }

    stepResult.endTime = new Date().toISOString();
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
        return ScriptRunner.evaluateCondition(station.condition.expression, context.variables);
      
      default:
        return true;
    }
  }

  /**
   * Resolve input variables for a step
   */
  private static resolveInputVariables(step: Step, context: ExecutionContext): Record<string, any> {
    const input: Record<string, any> = {};

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
  ): Record<string, any> {
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
   * Add log entry
   */
  private static log(
    context: ExecutionContext,
    level: ExecutionLog['level'],
    message: string,
    data?: any,
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
