import axios from 'axios';
import type {
  Workflow,
  WorkflowDefinition,
  Execution,
  ExecutionLog,
  WorkflowVersion,
  ApiResponse
} from '../types/workflow';
import type { DataShapesResponse, ShapeNode } from '../types/shapes';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Workflows API
export const workflowApi = {
  getAll: async (): Promise<Workflow[]> => {
    const response = await api.get<ApiResponse<Workflow[]>>('/workflows');
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  getById: async (id: string): Promise<Workflow> => {
    const response = await api.get<ApiResponse<Workflow>>(`/workflows/${id}`);
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  create: async (data: { name: string; description?: string; definition: WorkflowDefinition }): Promise<Workflow> => {
    const response = await api.post<ApiResponse<Workflow>>('/workflows', data);
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  update: async (id: string, data: Partial<{
    name: string;
    description: string;
    status: 'draft' | 'active' | 'paused';
    definition: WorkflowDefinition;
  }>): Promise<Workflow> => {
    const response = await api.put<ApiResponse<Workflow>>(`/workflows/${id}`, data);
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  delete: async (id: string): Promise<void> => {
    const response = await api.delete<ApiResponse<{ deleted: boolean }>>(`/workflows/${id}`);
    if (!response.data.success) throw new Error(response.data.error);
  },

  execute: async (id: string, inputData?: Record<string, any>): Promise<Execution> => {
    const response = await api.post<ApiResponse<Execution>>(`/workflows/${id}/execute`, {
      triggeredBy: 'manual',
      inputData,
    });
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  simulate: async (id: string, inputData?: Record<string, any>): Promise<Execution> => {
    const response = await api.post<ApiResponse<Execution>>(`/workflows/${id}/simulate`, {
      inputData,
    });
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  getExecutions: async (id: string, limit = 20): Promise<Execution[]> => {
    const response = await api.get<ApiResponse<Execution[]>>(`/workflows/${id}/executions`, {
      params: { limit },
    });
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  getDataShapes: async (id: string): Promise<DataShapesResponse> => {
    const response = await api.get<ApiResponse<DataShapesResponse>>(`/workflows/${id}/data-shapes`);
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },
};

// Executions API
export const executionApi = {
  getAll: async (limit = 50): Promise<Execution[]> => {
    const response = await api.get<ApiResponse<Execution[]>>('/executions', {
      params: { limit },
    });
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  getById: async (id: string): Promise<Execution> => {
    const response = await api.get<ApiResponse<Execution>>(`/executions/${id}`);
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  getLogs: async (id: string): Promise<ExecutionLog[]> => {
    const response = await api.get<ApiResponse<ExecutionLog[]>>(`/executions/${id}/logs`);
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  delete: async (id: string): Promise<void> => {
    const response = await api.delete<ApiResponse<{ deleted: boolean }>>(`/executions/${id}`);
    if (!response.data.success) throw new Error(response.data.error);
  },

  cancel: async (id: string): Promise<void> => {
    const response = await api.post<ApiResponse<{ cancelled: boolean }>>(`/executions/${id}/cancel`);
    if (!response.data.success) throw new Error(response.data.error);
  },
};

// Metrics API
export interface ExecutionHistoryEntry {
  date: string;
  completed: number;
  failed: number;
  total: number;
}

export const versionApi = {
  getVersions: async (workflowId: string): Promise<WorkflowVersion[]> => {
    const response = await api.get<ApiResponse<WorkflowVersion[]>>(`/workflows/${workflowId}/versions`);
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  getVersion: async (workflowId: string, version: number): Promise<WorkflowVersion> => {
    const response = await api.get<ApiResponse<WorkflowVersion>>(`/workflows/${workflowId}/versions/${version}`);
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  restore: async (workflowId: string, version: number): Promise<Workflow> => {
    const response = await api.post<ApiResponse<Workflow>>(`/workflows/${workflowId}/versions/${version}/restore`);
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },
};

export const metricsApi = {
  getExecutionHistory: async (days = 7): Promise<ExecutionHistoryEntry[]> => {
    const response = await api.get<ApiResponse<ExecutionHistoryEntry[]>>('/metrics/executions/history', {
      params: { days },
    });
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },
};

// Schedules API
export interface ScheduleInfo {
  workflowId: string;
  workflowName: string;
  cronExpression: string;
  isActive: boolean;
  nextRun?: string;
  lastRun?: string;
}

export const scheduleApi = {
  getAll: async (): Promise<ScheduleInfo[]> => {
    const response = await api.get<ApiResponse<ScheduleInfo[]>>('/schedules');
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },
};

// AI Assist API
// AI requests can be slow; give them a longer timeout than the default client,
// set above the backend's own request timeout so the server-side 502 fires first.
const AI_REQUEST_TIMEOUT_MS = 120_000;

export const aiApi = {
  getStatus: async (): Promise<{ enabled: boolean }> => {
    const response = await api.get<ApiResponse<{ enabled: boolean }>>('/ai/status');
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  draft: async (description: string): Promise<Workflow> => {
    const response = await api.post<ApiResponse<Workflow>>('/ai/draft', { description }, { timeout: AI_REQUEST_TIMEOUT_MS });
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!;
  },

  explain: async (ctx: {
    workflowName: string; stationName: string; stepName: string; stepType: string; errorMessage: string;
  }): Promise<string> => {
    const response = await api.post<ApiResponse<{ explanation: string }>>('/ai/explain', ctx, { timeout: AI_REQUEST_TIMEOUT_MS });
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!.explanation;
  },

  inferShape: async (step: { name: string; type: string; config: Record<string, unknown> }): Promise<ShapeNode> => {
    const response = await api.post<ApiResponse<{ shape: ShapeNode }>>('/ai/infer-shape', { step }, { timeout: AI_REQUEST_TIMEOUT_MS });
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data!.shape;
  },
};
