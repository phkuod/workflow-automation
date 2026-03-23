import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Helper: minimal valid WorkflowDefinition for creating workflows.
 */
function makeDefinition(label = 'default') {
  return {
    stations: [
      {
        id: `station-${label}`,
        name: `Station ${label}`,
        steps: [],
        position: { x: 0, y: 0 },
      },
    ],
  };
}

/**
 * Helper: create a workflow via the WorkflowModel so foreign-key
 * dependent models (execution, log, version) have a valid parent.
 */
async function createParentWorkflow(nameSuffix = 'parent') {
  const { WorkflowModel } = await import('../models/workflow');
  return WorkflowModel.create({
    name: `Test Workflow ${nameSuffix}`,
    description: 'Created for FK tests',
    definition: makeDefinition(nameSuffix),
  });
}

describe('Model CRUD Integration', () => {
  let tmpDb: string;

  beforeEach(() => {
    tmpDb = path.join(
      os.tmpdir(),
      `test-models-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );
    process.env.DB_PATH = tmpDb;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DB_PATH;
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    vi.resetModules();
  });

  // ─── WorkflowModel ──────────────────────────────────────────────

  describe('WorkflowModel', () => {
    it('create() returns workflow with id, name, status', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const { WorkflowModel } = await import('../models/workflow');

      const wf = WorkflowModel.create({
        name: 'My Workflow',
        description: 'A test workflow',
        definition: makeDefinition('create'),
      });

      expect(wf.id).toBeDefined();
      expect(typeof wf.id).toBe('string');
      expect(wf.name).toBe('My Workflow');
      expect(wf.status).toBe('draft');
      expect(wf.description).toBe('A test workflow');
      expect(wf.createdAt).toBeDefined();
      expect(wf.updatedAt).toBeDefined();
      expect(wf.definition.stations).toHaveLength(1);
    });

    it('getById() returns created workflow', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const { WorkflowModel } = await import('../models/workflow');

      const created = WorkflowModel.create({
        name: 'Find Me',
        definition: makeDefinition('find'),
      });

      const found = WorkflowModel.getById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Find Me');
    });

    it('getById() returns null for non-existent', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const { WorkflowModel } = await import('../models/workflow');

      const result = WorkflowModel.getById('non-existent-id');
      expect(result).toBeNull();
    });

    it('getAll() returns all created workflows', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const { WorkflowModel } = await import('../models/workflow');

      WorkflowModel.create({ name: 'Alpha', definition: makeDefinition('a') });
      WorkflowModel.create({ name: 'Beta', definition: makeDefinition('b') });
      WorkflowModel.create({ name: 'Gamma', definition: makeDefinition('c') });

      const all = WorkflowModel.getAll();
      expect(all).toHaveLength(3);
      const names = all.map(w => w.name);
      expect(names).toContain('Alpha');
      expect(names).toContain('Beta');
      expect(names).toContain('Gamma');
    });

    it('getAll() returns updated workflow first', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const { WorkflowModel } = await import('../models/workflow');

      const wf1 = WorkflowModel.create({ name: 'Old', definition: makeDefinition('old') });
      WorkflowModel.create({ name: 'Other', definition: makeDefinition('other') });

      // Update wf1 so its updated_at is the most recent
      WorkflowModel.update(wf1.id, { name: 'Updated Old' });

      const all = WorkflowModel.getAll();
      expect(all[0].id).toBe(wf1.id);
      expect(all[0].name).toBe('Updated Old');
    });

    it('count() returns correct count', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const { WorkflowModel } = await import('../models/workflow');

      expect(WorkflowModel.count()).toBe(0);

      WorkflowModel.create({ name: 'One', definition: makeDefinition('1') });
      WorkflowModel.create({ name: 'Two', definition: makeDefinition('2') });

      expect(WorkflowModel.count()).toBe(2);
    });

    it('update() updates name and status', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const { WorkflowModel } = await import('../models/workflow');

      const created = WorkflowModel.create({
        name: 'Original',
        definition: makeDefinition('upd'),
      });

      const updated = WorkflowModel.update(created.id, {
        name: 'Renamed',
        status: 'active',
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Renamed');
      expect(updated!.status).toBe('active');
      expect(updated!.id).toBe(created.id);
    });

    it('update() returns null for non-existent id', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const { WorkflowModel } = await import('../models/workflow');

      const result = WorkflowModel.update('does-not-exist', { name: 'Nope' });
      expect(result).toBeNull();
    });

    it('delete() returns true and removes workflow', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const { WorkflowModel } = await import('../models/workflow');

      const created = WorkflowModel.create({
        name: 'Delete Me',
        definition: makeDefinition('del'),
      });

      const deleted = WorkflowModel.delete(created.id);
      expect(deleted).toBe(true);
      expect(WorkflowModel.getById(created.id)).toBeNull();
    });

    it('delete() returns false for non-existent id', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const { WorkflowModel } = await import('../models/workflow');

      const result = WorkflowModel.delete('ghost-id');
      expect(result).toBe(false);
    });
  });

  // ─── ExecutionModel ──────────────────────────────────────────────

  describe('ExecutionModel', () => {
    it('create() returns execution with running status', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('exec-create');
      const { ExecutionModel } = await import('../models/execution');

      const exec = ExecutionModel.create(wf.id, wf.name, 'manual');

      expect(exec.id).toBeDefined();
      expect(exec.workflowId).toBe(wf.id);
      expect(exec.workflowName).toBe(wf.name);
      expect(exec.status).toBe('running');
      expect(exec.triggeredBy).toBe('manual');
      expect(exec.startTime).toBeDefined();
      expect(exec.successRate).toBe(0);
    });

    it('getById() returns created execution', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('exec-getbyid');
      const { ExecutionModel } = await import('../models/execution');

      const created = ExecutionModel.create(wf.id, wf.name, 'api');
      const found = ExecutionModel.getById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.triggeredBy).toBe('api');
    });

    it('getByWorkflowId() returns executions for workflow', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('exec-bywf');
      const { ExecutionModel } = await import('../models/execution');

      ExecutionModel.create(wf.id, wf.name, 'manual');
      ExecutionModel.create(wf.id, wf.name, 'schedule');

      const execs = ExecutionModel.getByWorkflowId(wf.id);
      expect(execs).toHaveLength(2);
      execs.forEach((e) => expect(e.workflowId).toBe(wf.id));
    });

    it('getAll() respects limit parameter', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('exec-limit');
      const { ExecutionModel } = await import('../models/execution');

      ExecutionModel.create(wf.id, wf.name, 'manual');
      ExecutionModel.create(wf.id, wf.name, 'manual');
      ExecutionModel.create(wf.id, wf.name, 'manual');

      const limited = ExecutionModel.getAll(2);
      expect(limited).toHaveLength(2);

      const all = ExecutionModel.getAll(50);
      expect(all).toHaveLength(3);
    });

    it('update() changes status and endTime', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('exec-upd');
      const { ExecutionModel } = await import('../models/execution');

      const exec = ExecutionModel.create(wf.id, wf.name, 'manual');
      const endTime = new Date().toISOString();

      const updated = ExecutionModel.update(exec.id, {
        status: 'completed',
        endTime,
        successRate: 100,
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('completed');
      expect(updated!.endTime).toBe(endTime);
      expect(updated!.successRate).toBe(100);
    });

    it('update() stores result as JSON', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('exec-result');
      const { ExecutionModel } = await import('../models/execution');

      const exec = ExecutionModel.create(wf.id, wf.name, 'manual');
      const result = {
        stations: [
          {
            stationId: 'st-1',
            stationName: 'Station 1',
            status: 'completed' as const,
            steps: [],
          },
        ],
      };

      const updated = ExecutionModel.update(exec.id, {
        status: 'completed',
        result,
      });

      expect(updated).not.toBeNull();
      expect(updated!.result).toBeDefined();
      expect(updated!.result!.stations).toHaveLength(1);
      expect(updated!.result!.stations[0].stationId).toBe('st-1');
    });

    it('delete() removes execution', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('exec-del');
      const { ExecutionModel } = await import('../models/execution');

      const exec = ExecutionModel.create(wf.id, wf.name, 'manual');
      const deleted = ExecutionModel.delete(exec.id);

      expect(deleted).toBe(true);
      expect(ExecutionModel.getById(exec.id)).toBeNull();
    });
  });

  // ─── LogModel ────────────────────────────────────────────────────

  describe('LogModel', () => {
    it('create() creates log entry', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('log-create');
      const { ExecutionModel, LogModel } = await import('../models/execution');

      const exec = ExecutionModel.create(wf.id, wf.name, 'manual');

      const log = LogModel.create({
        executionId: exec.id,
        stationId: 'station-1',
        stepId: 'step-1',
        level: 'info',
        message: 'Step started',
      });

      expect(log.id).toBeDefined();
      expect(log.executionId).toBe(exec.id);
      expect(log.stationId).toBe('station-1');
      expect(log.stepId).toBe('step-1');
      expect(log.level).toBe('info');
      expect(log.message).toBe('Step started');
      expect(log.timestamp).toBeDefined();
    });

    it('getByExecutionId() returns logs ordered by timestamp ASC', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('log-order');
      const { ExecutionModel, LogModel } = await import('../models/execution');

      const exec = ExecutionModel.create(wf.id, wf.name, 'manual');

      LogModel.create({ executionId: exec.id, level: 'info', message: 'First' });
      LogModel.create({ executionId: exec.id, level: 'warn', message: 'Second' });
      LogModel.create({ executionId: exec.id, level: 'error', message: 'Third' });

      const logs = LogModel.getByExecutionId(exec.id);
      expect(logs).toHaveLength(3);
      // All timestamps should be the same or ascending since they are created sequentially
      expect(logs[0].message).toBe('First');
      expect(logs[1].message).toBe('Second');
      expect(logs[2].message).toBe('Third');
    });

    it('createMany() inserts batch atomically', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('log-batch');
      const { ExecutionModel, LogModel } = await import('../models/execution');

      const exec = ExecutionModel.create(wf.id, wf.name, 'manual');

      const batch = [
        { executionId: exec.id, level: 'info' as const, message: 'Batch log 1' },
        { executionId: exec.id, level: 'debug' as const, message: 'Batch log 2' },
        { executionId: exec.id, level: 'warn' as const, message: 'Batch log 3' },
      ];

      LogModel.createMany(batch);

      const logs = LogModel.getByExecutionId(exec.id);
      expect(logs).toHaveLength(3);
      const messages = logs.map((l) => l.message);
      expect(messages).toContain('Batch log 1');
      expect(messages).toContain('Batch log 2');
      expect(messages).toContain('Batch log 3');
    });
  });

  // ─── VersionModel ───────────────────────────────────────────────

  describe('VersionModel', () => {
    it('create() stores version with definition JSON', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('ver-create');
      const { VersionModel } = await import('../models/version');

      const definition = makeDefinition('v1');
      const version = VersionModel.create(wf.id, 1, definition, 'Initial version');

      expect(version.id).toBeDefined();
      expect(version.workflowId).toBe(wf.id);
      expect(version.version).toBe(1);
      expect(version.definition.stations).toHaveLength(1);
      expect(version.changeSummary).toBe('Initial version');
      expect(version.createdAt).toBeDefined();
    });

    it('getByWorkflowId() returns versions ordered DESC', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('ver-list');
      const { VersionModel } = await import('../models/version');

      VersionModel.create(wf.id, 1, makeDefinition('v1'), 'First');
      VersionModel.create(wf.id, 2, makeDefinition('v2'), 'Second');
      VersionModel.create(wf.id, 3, makeDefinition('v3'), 'Third');

      const versions = VersionModel.getByWorkflowId(wf.id);
      expect(versions).toHaveLength(3);
      // Ordered by version DESC
      expect(versions[0].version).toBe(3);
      expect(versions[1].version).toBe(2);
      expect(versions[2].version).toBe(1);
    });

    it('getByVersion() returns specific version', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('ver-specific');
      const { VersionModel } = await import('../models/version');

      VersionModel.create(wf.id, 1, makeDefinition('v1'), 'First');
      VersionModel.create(wf.id, 2, makeDefinition('v2'), 'Second');

      const v2 = VersionModel.getByVersion(wf.id, 2);
      expect(v2).not.toBeNull();
      expect(v2!.version).toBe(2);
      expect(v2!.changeSummary).toBe('Second');

      const missing = VersionModel.getByVersion(wf.id, 99);
      expect(missing).toBeNull();
    });

    it('getLatestVersion() returns max version number', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('ver-latest');
      const { VersionModel } = await import('../models/version');

      VersionModel.create(wf.id, 1, makeDefinition('v1'));
      VersionModel.create(wf.id, 2, makeDefinition('v2'));
      VersionModel.create(wf.id, 5, makeDefinition('v5'));

      expect(VersionModel.getLatestVersion(wf.id)).toBe(5);
    });

    it('getLatestVersion() returns 0 when no versions exist', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('ver-empty');
      const { VersionModel } = await import('../models/version');

      expect(VersionModel.getLatestVersion(wf.id)).toBe(0);
    });

    it('deleteOldVersions() keeps only keepCount versions', async () => {
      const { initDatabase } = await import('../db/database');
      await initDatabase();
      const wf = await createParentWorkflow('ver-prune');
      const { VersionModel } = await import('../models/version');

      // Create 5 versions
      for (let i = 1; i <= 5; i++) {
        VersionModel.create(wf.id, i, makeDefinition(`v${i}`), `Version ${i}`);
      }

      expect(VersionModel.getByWorkflowId(wf.id)).toHaveLength(5);

      // Keep only the 2 newest
      VersionModel.deleteOldVersions(wf.id, 2);

      const remaining = VersionModel.getByWorkflowId(wf.id);
      expect(remaining).toHaveLength(2);
      // Should keep versions 5 and 4 (the highest)
      expect(remaining[0].version).toBe(5);
      expect(remaining[1].version).toBe(4);
    });
  });
});
