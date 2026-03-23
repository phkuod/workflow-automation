import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so these are available when vi.mock factory runs (hoisted above imports)
const { mockGet, mockPost, mockPut, mockDelete, mockInstance } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  const mockPut = vi.fn();
  const mockDelete = vi.fn();
  const mockInstance = {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };
  return { mockGet, mockPost, mockPut, mockDelete, mockInstance };
});

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockInstance),
  },
}));

// Import after mock setup
import { workflowApi, executionApi, versionApi, metricsApi } from './workflowApi';
import axios from 'axios';

// Helpers
function successResponse<T>(data: T) {
  return { data: { success: true, data } };
}

function errorResponse(error: string) {
  return { data: { success: false, error } };
}

const mockWorkflow = {
  id: 'wf-1',
  name: 'Test Workflow',
  description: 'A test workflow',
  status: 'draft' as const,
  definition: { stations: [] },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockExecution = {
  id: 'exec-1',
  workflowId: 'wf-1',
  workflowName: 'Test Workflow',
  status: 'completed' as const,
  triggeredBy: 'manual' as const,
  startTime: '2026-01-01T00:00:00Z',
  endTime: '2026-01-01T00:01:00Z',
  successRate: 100,
};

const mockLog = {
  id: 'log-1',
  executionId: 'exec-1',
  stationId: 'station-1',
  stepId: 'step-1',
  level: 'info' as const,
  message: 'Step completed',
  timestamp: '2026-01-01T00:00:30Z',
};

const mockVersion = {
  id: 'ver-1',
  workflowId: 'wf-1',
  version: 1,
  definition: { stations: [] },
  changeSummary: 'Initial version',
  createdAt: '2026-01-01T00:00:00Z',
};

// Capture axios.create call args before any beforeEach clears them
const createCallArgs = vi.mocked(axios.create).mock.calls[0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('axios config', () => {
  it('creates axios instance with correct base URL', () => {
    expect(createCallArgs).toBeDefined();
    expect(createCallArgs[0]).toEqual(expect.objectContaining({ baseURL: '/api' }));
  });

  it('creates axios instance with Content-Type header', () => {
    expect(createCallArgs).toBeDefined();
    expect(createCallArgs[0]).toEqual(
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('propagates network errors', async () => {
    const networkError = new Error('Network Error');
    mockGet.mockRejectedValueOnce(networkError);

    await expect(workflowApi.getAll()).rejects.toThrow('Network Error');
  });
});

describe('workflowApi', () => {
  it('getAll — calls GET /workflows and returns array', async () => {
    mockGet.mockResolvedValueOnce(successResponse([mockWorkflow]));

    const result = await workflowApi.getAll();

    expect(mockGet).toHaveBeenCalledWith('/workflows');
    expect(result).toEqual([mockWorkflow]);
  });

  it('getById — calls GET /workflows/:id', async () => {
    mockGet.mockResolvedValueOnce(successResponse(mockWorkflow));

    const result = await workflowApi.getById('wf-1');

    expect(mockGet).toHaveBeenCalledWith('/workflows/wf-1');
    expect(result).toEqual(mockWorkflow);
  });

  it('create — calls POST /workflows with body', async () => {
    const createData = {
      name: 'New Workflow',
      description: 'desc',
      definition: { stations: [] },
    };
    mockPost.mockResolvedValueOnce(successResponse({ ...mockWorkflow, ...createData }));

    const result = await workflowApi.create(createData);

    expect(mockPost).toHaveBeenCalledWith('/workflows', createData);
    expect(result.name).toBe('New Workflow');
  });

  it('update — calls PUT /workflows/:id', async () => {
    const updateData = { name: 'Updated Name' };
    mockPut.mockResolvedValueOnce(successResponse({ ...mockWorkflow, ...updateData }));

    const result = await workflowApi.update('wf-1', updateData);

    expect(mockPut).toHaveBeenCalledWith('/workflows/wf-1', updateData);
    expect(result.name).toBe('Updated Name');
  });

  it('delete — calls DELETE /workflows/:id', async () => {
    mockDelete.mockResolvedValueOnce(successResponse({ deleted: true }));

    await workflowApi.delete('wf-1');

    expect(mockDelete).toHaveBeenCalledWith('/workflows/wf-1');
  });

  it('execute — calls POST /workflows/:id/execute', async () => {
    const inputData = { key: 'value' };
    mockPost.mockResolvedValueOnce(successResponse(mockExecution));

    const result = await workflowApi.execute('wf-1', inputData);

    expect(mockPost).toHaveBeenCalledWith('/workflows/wf-1/execute', {
      triggeredBy: 'manual',
      inputData,
    });
    expect(result).toEqual(mockExecution);
  });

  it('simulate — calls POST /workflows/:id/simulate', async () => {
    const inputData = { key: 'value' };
    mockPost.mockResolvedValueOnce(successResponse(mockExecution));

    const result = await workflowApi.simulate('wf-1', inputData);

    expect(mockPost).toHaveBeenCalledWith('/workflows/wf-1/simulate', {
      inputData,
    });
    expect(result).toEqual(mockExecution);
  });

  it('getExecutions — calls GET /workflows/:id/executions with limit', async () => {
    mockGet.mockResolvedValueOnce(successResponse([mockExecution]));

    const result = await workflowApi.getExecutions('wf-1', 10);

    expect(mockGet).toHaveBeenCalledWith('/workflows/wf-1/executions', {
      params: { limit: 10 },
    });
    expect(result).toEqual([mockExecution]);
  });
});

describe('executionApi', () => {
  it('getAll — calls GET /executions with limit param', async () => {
    mockGet.mockResolvedValueOnce(successResponse([mockExecution]));

    const result = await executionApi.getAll(25);

    expect(mockGet).toHaveBeenCalledWith('/executions', {
      params: { limit: 25 },
    });
    expect(result).toEqual([mockExecution]);
  });

  it('getById — calls GET /executions/:id', async () => {
    mockGet.mockResolvedValueOnce(successResponse(mockExecution));

    const result = await executionApi.getById('exec-1');

    expect(mockGet).toHaveBeenCalledWith('/executions/exec-1');
    expect(result).toEqual(mockExecution);
  });

  it('getLogs — calls GET /executions/:id/logs', async () => {
    mockGet.mockResolvedValueOnce(successResponse([mockLog]));

    const result = await executionApi.getLogs('exec-1');

    expect(mockGet).toHaveBeenCalledWith('/executions/exec-1/logs');
    expect(result).toEqual([mockLog]);
  });

  it('delete — calls DELETE /executions/:id', async () => {
    mockDelete.mockResolvedValueOnce(successResponse({ deleted: true }));

    await executionApi.delete('exec-1');

    expect(mockDelete).toHaveBeenCalledWith('/executions/exec-1');
  });

  it('cancel — calls POST /executions/:id/cancel', async () => {
    mockPost.mockResolvedValueOnce(successResponse({ cancelled: true }));

    await executionApi.cancel('exec-1');

    expect(mockPost).toHaveBeenCalledWith('/executions/exec-1/cancel');
  });

  it('rejects on API error response', async () => {
    mockGet.mockResolvedValueOnce(errorResponse('Not found'));

    await expect(executionApi.getById('bad-id')).rejects.toThrow('Not found');
  });
});

describe('versionApi', () => {
  it('getVersions — calls GET /workflows/:id/versions', async () => {
    mockGet.mockResolvedValueOnce(successResponse([mockVersion]));

    const result = await versionApi.getVersions('wf-1');

    expect(mockGet).toHaveBeenCalledWith('/workflows/wf-1/versions');
    expect(result).toEqual([mockVersion]);
  });

  it('getVersion — calls GET /workflows/:id/versions/:version', async () => {
    mockGet.mockResolvedValueOnce(successResponse(mockVersion));

    const result = await versionApi.getVersion('wf-1', 1);

    expect(mockGet).toHaveBeenCalledWith('/workflows/wf-1/versions/1');
    expect(result).toEqual(mockVersion);
  });

  it('restore — calls POST /workflows/:id/versions/:version/restore', async () => {
    mockPost.mockResolvedValueOnce(successResponse(mockWorkflow));

    const result = await versionApi.restore('wf-1', 1);

    expect(mockPost).toHaveBeenCalledWith('/workflows/wf-1/versions/1/restore');
    expect(result).toEqual(mockWorkflow);
  });
});

describe('metricsApi', () => {
  it('getExecutionHistory — uses default days param', async () => {
    const historyData = [
      { date: '2026-01-01', completed: 5, failed: 1, total: 6 },
    ];
    mockGet.mockResolvedValueOnce(successResponse(historyData));

    const result = await metricsApi.getExecutionHistory();

    expect(mockGet).toHaveBeenCalledWith('/metrics/executions/history', {
      params: { days: 7 },
    });
    expect(result).toEqual(historyData);
  });

  it('getExecutionHistory — accepts custom days param', async () => {
    const historyData = [
      { date: '2026-01-01', completed: 10, failed: 2, total: 12 },
    ];
    mockGet.mockResolvedValueOnce(successResponse(historyData));

    const result = await metricsApi.getExecutionHistory(30);

    expect(mockGet).toHaveBeenCalledWith('/metrics/executions/history', {
      params: { days: 30 },
    });
    expect(result).toEqual(historyData);
  });
});
