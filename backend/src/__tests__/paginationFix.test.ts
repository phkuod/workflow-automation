import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module before importing models
vi.mock('../db/database', () => {
  const mockRows: Array<Record<string, unknown>> = [];
  return {
    default: {
      prepare: vi.fn((sql: string) => ({
        all: vi.fn((..._args: unknown[]) => mockRows),
        get: vi.fn((..._args: unknown[]) => mockRows[0]),
        run: vi.fn(() => ({ changes: 1 })),
      })),
    },
    __mockRows: mockRows,
  };
});

import db from '../db/database';

describe('WorkflowModel.getAllUnlimited', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exists as a static method on WorkflowModel', async () => {
    const { WorkflowModel } = await import('../models/workflow');
    expect(typeof WorkflowModel.getAllUnlimited).toBe('function');
  });

  it('queries without a LIMIT clause', async () => {
    const { WorkflowModel } = await import('../models/workflow');
    WorkflowModel.getAllUnlimited();

    // Verify db.prepare was called with SQL that does NOT contain LIMIT
    const prepareCalls = (db.prepare as ReturnType<typeof vi.fn>).mock.calls;
    const lastSql = prepareCalls[prepareCalls.length - 1][0] as string;
    expect(lastSql.toUpperCase()).not.toContain('LIMIT');
  });

  it('returns an array of workflow objects', async () => {
    const { WorkflowModel } = await import('../models/workflow');
    const result = WorkflowModel.getAllUnlimited();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('Scheduler uses getAllUnlimited', () => {
  it('scheduler.ts imports and calls getAllUnlimited instead of getAll', async () => {
    // Read the scheduler source file to verify it uses getAllUnlimited
    const fs = await import('fs');
    const path = await import('path');
    const schedulerPath = path.join(__dirname, '..', 'services', 'scheduler.ts');
    const source = fs.readFileSync(schedulerPath, 'utf-8');

    expect(source).toContain('getAllUnlimited');
    // The initialize method should not call getAll() (without Unlimited)
    // Extract the initialize method body
    const initMatch = source.match(/async initialize\(\)[\s\S]*?const workflows = WorkflowModel\.(getAll(?:Unlimited)?)\(\)/);
    expect(initMatch).not.toBeNull();
    expect(initMatch![1]).toBe('getAllUnlimited');
  });
});

describe('Metrics route uses getAllUnlimited', () => {
  it('metrics.ts imports and calls getAllUnlimited instead of getAll', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const metricsPath = path.join(__dirname, '..', 'routes', 'metrics.ts');
    const source = fs.readFileSync(metricsPath, 'utf-8');

    expect(source).toContain('getAllUnlimited');
    // Both occurrences of WorkflowModel.getAll should now be getAllUnlimited
    const getallCalls = source.match(/WorkflowModel\.getAll\(\)/g);
    // There should be zero calls to plain getAll() — all should be getAllUnlimited()
    expect(getallCalls).toBeNull();
  });
});
