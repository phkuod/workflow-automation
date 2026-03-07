import db from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowDefinition } from '../types/workflow';

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  definition: WorkflowDefinition;
  changeSummary?: string;
  createdAt: string;
}

interface VersionRow {
  id: string;
  workflow_id: string;
  version: number;
  definition: string;
  change_summary: string | null;
  created_at: string;
}

export class VersionModel {
  static create(workflowId: string, version: number, definition: WorkflowDefinition, changeSummary?: string): WorkflowVersion {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO workflow_versions (id, workflow_id, version, definition, change_summary)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, workflowId, version, JSON.stringify(definition), changeSummary || null);
    return {
      id,
      workflowId,
      version,
      definition,
      changeSummary,
      createdAt: new Date().toISOString(),
    };
  }

  static getByWorkflowId(workflowId: string, limit = 50): WorkflowVersion[] {
    const stmt = db.prepare(`
      SELECT * FROM workflow_versions
      WHERE workflow_id = ?
      ORDER BY version DESC
      LIMIT ?
    `);
    const rows = stmt.all(workflowId, limit) as VersionRow[];
    return rows.map(this.rowToVersion);
  }

  static getByVersion(workflowId: string, version: number): WorkflowVersion | null {
    const stmt = db.prepare(`
      SELECT * FROM workflow_versions
      WHERE workflow_id = ? AND version = ?
    `);
    const row = stmt.get(workflowId, version) as VersionRow | undefined;
    return row ? this.rowToVersion(row) : null;
  }

  static getLatestVersion(workflowId: string): number {
    const stmt = db.prepare(`
      SELECT MAX(version) as max_version FROM workflow_versions WHERE workflow_id = ?
    `);
    const row = stmt.get(workflowId) as { max_version: number | null } | undefined;
    return row?.max_version || 0;
  }

  static deleteOldVersions(workflowId: string, keepCount = 50): void {
    const stmt = db.prepare(`
      DELETE FROM workflow_versions
      WHERE workflow_id = ? AND version NOT IN (
        SELECT version FROM workflow_versions
        WHERE workflow_id = ?
        ORDER BY version DESC
        LIMIT ?
      )
    `);
    stmt.run(workflowId, workflowId, keepCount);
  }

  private static rowToVersion(row: VersionRow): WorkflowVersion {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      version: row.version,
      definition: JSON.parse(row.definition),
      changeSummary: row.change_summary || undefined,
      createdAt: row.created_at,
    };
  }
}
