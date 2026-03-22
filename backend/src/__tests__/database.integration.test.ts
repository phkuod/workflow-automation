import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('database.ts — SqlJsAdapter integration', () => {
  let tmpDb: string;

  beforeEach(() => {
    tmpDb = path.join(os.tmpdir(), `test-db-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    process.env.DB_PATH = tmpDb;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DB_PATH;
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    vi.resetModules();
  });

  it('throws when db is accessed before initDatabase()', async () => {
    const { default: db } = await import('../db/database');
    expect(() => db.prepare('SELECT 1').all()).toThrow('Database not initialized');
  });

  it('initDatabase() creates the db file on disk', async () => {
    const { initDatabase } = await import('../db/database');
    await initDatabase();
    expect(fs.existsSync(tmpDb)).toBe(true);
  });

  it('exec() runs DDL statements', async () => {
    const { initDatabase, default: db } = await import('../db/database');
    await initDatabase();
    db.exec('CREATE TABLE IF NOT EXISTS test_exec (id TEXT PRIMARY KEY)');
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_exec'").all();
    expect(rows).toHaveLength(1);
  });

  it('prepare().run() INSERT returns changes = 1', async () => {
    const { initDatabase, default: db } = await import('../db/database');
    await initDatabase();
    const result = db.prepare(
      `INSERT INTO workflows (id, name, status, definition, created_at, updated_at)
       VALUES (?, ?, 'draft', '{}', datetime('now'), datetime('now'))`
    ).run('wf-1', 'Test Workflow');
    expect(result.changes).toBe(1);
  });

  it('prepare().get() returns a row or undefined', async () => {
    const { initDatabase, default: db } = await import('../db/database');
    await initDatabase();
    db.prepare(
      `INSERT INTO workflows (id, name, status, definition, created_at, updated_at)
       VALUES ('wf-2', 'My Workflow', 'draft', '{}', datetime('now'), datetime('now'))`
    ).run();
    const found = db.prepare('SELECT id, name FROM workflows WHERE id = ?').get('wf-2');
    expect(found).toBeDefined();
    expect(found!.name).toBe('My Workflow');
    const missing = db.prepare('SELECT id FROM workflows WHERE id = ?').get('nonexistent');
    expect(missing).toBeUndefined();
  });

  it('prepare().all() returns multiple rows', async () => {
    const { initDatabase, default: db } = await import('../db/database');
    await initDatabase();
    const insert = db.prepare(
      `INSERT INTO workflows (id, name, status, definition, created_at, updated_at)
       VALUES (?, ?, 'draft', '{}', datetime('now'), datetime('now'))`
    );
    insert.run('wf-a', 'Alpha');
    insert.run('wf-b', 'Beta');
    insert.run('wf-c', 'Gamma');
    const rows = db.prepare('SELECT id FROM workflows ORDER BY id').all();
    expect(rows).toHaveLength(3);
    expect(rows.map((r: any) => r.id)).toEqual(['wf-a', 'wf-b', 'wf-c']);
  });

  it('prepare().all() returns [] when table is empty', async () => {
    const { initDatabase, default: db } = await import('../db/database');
    await initDatabase();
    expect(db.prepare('SELECT * FROM workflows').all()).toEqual([]);
  });

  it('prepare().run() UPDATE returns changes = 1', async () => {
    const { initDatabase, default: db } = await import('../db/database');
    await initDatabase();
    db.prepare(
      `INSERT INTO workflows (id, name, status, definition, created_at, updated_at)
       VALUES ('wf-upd', 'Old Name', 'draft', '{}', datetime('now'), datetime('now'))`
    ).run();
    const result = db.prepare("UPDATE workflows SET name = ?, status = 'active' WHERE id = ?").run('New Name', 'wf-upd');
    expect(result.changes).toBe(1);
    const row = db.prepare('SELECT name, status FROM workflows WHERE id = ?').get('wf-upd');
    expect(row!.name).toBe('New Name');
    expect(row!.status).toBe('active');
  });

  it('prepare().run() DELETE returns correct changes count', async () => {
    const { initDatabase, default: db } = await import('../db/database');
    await initDatabase();
    db.prepare(
      `INSERT INTO workflows (id, name, status, definition, created_at, updated_at)
       VALUES ('wf-del', 'To Delete', 'draft', '{}', datetime('now'), datetime('now'))`
    ).run();
    expect(db.prepare('DELETE FROM workflows WHERE id = ?').run('wf-del').changes).toBe(1);
    expect(db.prepare('SELECT * FROM workflows WHERE id = ?').get('wf-del')).toBeUndefined();
    expect(db.prepare('DELETE FROM workflows WHERE id = ?').run('nonexistent').changes).toBe(0);
  });

  it('transaction() commits all inserts atomically', async () => {
    const { initDatabase, default: db } = await import('../db/database');
    await initDatabase();
    const insert = db.prepare(
      `INSERT INTO workflows (id, name, status, definition, created_at, updated_at)
       VALUES (?, ?, 'draft', '{}', datetime('now'), datetime('now'))`
    );
    const insertMany = db.transaction((ids: string[]) => {
      for (const id of ids) insert.run(id, `Workflow ${id}`);
    });
    insertMany(['tx-1', 'tx-2', 'tx-3']);
    expect(db.prepare('SELECT id FROM workflows ORDER BY id').all()).toHaveLength(3);
  });

  it('transaction() rolls back fully on error', async () => {
    const { initDatabase, default: db } = await import('../db/database');
    await initDatabase();
    db.prepare(
      `INSERT INTO workflows (id, name, status, definition, created_at, updated_at)
       VALUES ('existing', 'Existing', 'draft', '{}', datetime('now'), datetime('now'))`
    ).run();
    const insert = db.prepare(
      `INSERT INTO workflows (id, name, status, definition, created_at, updated_at)
       VALUES (?, ?, 'draft', '{}', datetime('now'), datetime('now'))`
    );
    const failTx = db.transaction((ids: string[]) => {
      for (const id of ids) insert.run(id, `Workflow ${id}`);
    });
    expect(() => failTx(['new-1', 'existing'])).toThrow(); // UNIQUE violation on 'existing'
    expect(db.prepare('SELECT * FROM workflows WHERE id = ?').get('new-1')).toBeUndefined();
    expect(db.prepare('SELECT * FROM workflows').all()).toHaveLength(1);
  });

  it('data persists to disk across re-initialization', async () => {
    { // Phase 1: write data
      const { initDatabase, flushDatabase, default: db } = await import('../db/database');
      await initDatabase();
      db.prepare(
        `INSERT INTO workflows (id, name, status, definition, created_at, updated_at)
         VALUES ('persist-1', 'Persisted Workflow', 'active', '{"nodes":[]}', datetime('now'), datetime('now'))`
      ).run();
      flushDatabase(); // Ensure debounced writes are flushed before re-init
    }
    vi.resetModules(); // same tmpDb still in process.env.DB_PATH
    { // Phase 2: re-load from same file
      const { initDatabase, default: db } = await import('../db/database');
      await initDatabase();
      const row = db.prepare('SELECT name, status FROM workflows WHERE id = ?').get('persist-1');
      expect(row).toBeDefined();
      expect(row!.name).toBe('Persisted Workflow');
      expect(row!.status).toBe('active');
    }
  });

  it('foreign key constraint rejects orphan execution', async () => {
    const { initDatabase, default: db } = await import('../db/database');
    await initDatabase();
    expect(() => {
      db.prepare(
        `INSERT INTO executions (id, workflow_id, workflow_name, status, triggered_by, start_time)
         VALUES ('ex-1', 'nonexistent-wf', 'Missing', 'running', 'manual', datetime('now'))`
      ).run();
    }).toThrow();
  });

  it('ON DELETE CASCADE removes child executions with workflow', async () => {
    const { initDatabase, default: db } = await import('../db/database');
    await initDatabase();
    db.prepare(
      `INSERT INTO workflows (id, name, status, definition, created_at, updated_at)
       VALUES ('wf-cas', 'Cascade WF', 'active', '{}', datetime('now'), datetime('now'))`
    ).run();
    db.prepare(
      `INSERT INTO executions (id, workflow_id, workflow_name, status, triggered_by, start_time)
       VALUES ('ex-cas', 'wf-cas', 'Cascade WF', 'completed', 'manual', datetime('now'))`
    ).run();
    db.prepare('DELETE FROM workflows WHERE id = ?').run('wf-cas');
    expect(db.prepare('SELECT * FROM executions WHERE id = ?').get('ex-cas')).toBeUndefined();
  });
});
