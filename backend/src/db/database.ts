import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../data/workflow.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Workflows table
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'paused')),
    definition TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Executions table
  CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
    triggered_by TEXT CHECK(triggered_by IN ('manual', 'schedule', 'webhook', 'api')),
    start_time TEXT,
    end_time TEXT,
    success_rate REAL DEFAULT 0,
    result TEXT,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
  );

  -- Execution logs table
  CREATE TABLE IF NOT EXISTS execution_logs (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    station_id TEXT,
    step_id TEXT,
    level TEXT CHECK(level IN ('debug', 'info', 'warn', 'error')),
    message TEXT NOT NULL,
    data TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_execution_logs_execution_id ON execution_logs(execution_id);
`);

export default db;
