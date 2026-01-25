// Workflow Types

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused';
  definition: WorkflowDefinition;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDefinition {
  stations: Station[];
  variables?: Record<string, any>;
}

export interface Station {
  id: string;
  name: string;
  description?: string;
  steps: Step[];
  position: { x: number; y: number };
  condition?: StationCondition;
}

export interface StationCondition {
  type: 'always' | 'expression' | 'previousSuccess';
  expression?: string;
}

export interface Step {
  id: string;
  name: string;
  type: StepType;
  config: StepConfig;
  position: { x: number; y: number };
  inputVars?: VariableMapping[];
  outputVars?: VariableDefinition[];
  timeout?: number;
}

export type StepType = 
  | 'trigger-manual'
  | 'trigger-cron'
  | 'script-js'
  | 'script-python'
  | 'http-request'
  | 'if-else'
  | 'set-variable';

export interface StepConfig {
  // Script nodes
  code?: string;
  
  // HTTP Request
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  
  // If/Else
  condition?: string;
  
  // Set Variable
  variableName?: string;
  variableValue?: string;
  
  // Cron
  cronExpression?: string;
}

export interface VariableMapping {
  name: string;
  source: string; // e.g., "${step1.output.data}"
}

export interface VariableDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
}

// Execution Types

export interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  triggeredBy: 'manual' | 'schedule' | 'webhook' | 'api';
  startTime: string;
  endTime?: string;
  successRate: number;
  result?: ExecutionResult;
}

export interface ExecutionResult {
  stations: StationResult[];
  error?: ErrorInfo;
}

export interface StationResult {
  stationId: string;
  stationName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  steps: StepResult[];
  output?: Record<string, any>;
}

export interface StepResult {
  stepId: string;
  stepName: string;
  stepType: StepType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: ErrorInfo;
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  code?: string;
}

// Log Types

export interface ExecutionLog {
  id: string;
  executionId: string;
  stationId?: string;
  stepId?: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  timestamp: string;
}

// API Types

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  status?: 'draft' | 'active' | 'paused';
  definition: WorkflowDefinition;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  status?: 'draft' | 'active' | 'paused';
  definition?: WorkflowDefinition;
}

export interface ExecuteWorkflowRequest {
  triggeredBy?: 'manual' | 'schedule' | 'webhook' | 'api';
  inputData?: Record<string, any>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
