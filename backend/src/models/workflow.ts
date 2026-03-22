import db from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { safeJsonParse } from '../utils/safeJsonParse';
import {
  Workflow,
  WorkflowDefinition,
  CreateWorkflowRequest, 
  UpdateWorkflowRequest 
} from '../types/workflow';

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused';
  definition: string;
  created_at: string;
  updated_at: string;
}

export class WorkflowModel {
  static getAll(limit = 100, offset = 0): Workflow[] {
    const stmt = db.prepare(`
      SELECT id, name, description, status, definition, created_at, updated_at
      FROM workflows
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset) as WorkflowRow[];
    return rows.map(this.rowToWorkflow);
  }

  static count(): number {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM workflows');
    const row = stmt.get() as { count: number } | undefined;
    return row?.count ?? 0;
  }

  static getById(id: string): Workflow | null {
    const stmt = db.prepare(`
      SELECT id, name, description, status, definition, created_at, updated_at 
      FROM workflows 
      WHERE id = ?
    `);
    const row = stmt.get(id) as WorkflowRow | undefined;
    return row ? this.rowToWorkflow(row) : null;
  }

  static create(data: CreateWorkflowRequest): Workflow {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO workflows (id, name, description, status, definition, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.name,
      data.description || null,
      data.status || 'draft',
      JSON.stringify(data.definition),
      now,
      now
    );

    return this.getById(id)!;
  }

  static update(id: string, data: UpdateWorkflowRequest): Workflow | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [now];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.definition !== undefined) {
      updates.push('definition = ?');
      values.push(JSON.stringify(data.definition));
    }

    values.push(id);

    const stmt = db.prepare(`
      UPDATE workflows 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `);
    stmt.run(...values);

    return this.getById(id);
  }

  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM workflows WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private static rowToWorkflow(row: WorkflowRow): Workflow {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      status: row.status,
      definition: safeJsonParse<WorkflowDefinition>(row.definition, { stations: [] } as unknown as WorkflowDefinition, `workflow ${row.id}`),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
