import { Pool as PgPool } from 'pg';
import mysql from 'mysql2/promise';
import { StepConfig } from '../types/workflow';

const CONNECTION_TIMEOUT_MS = 5000;
const QUERY_TIMEOUT_MS = 30000;

/**
 * Build a cache key for connection pool reuse.
 */
function poolKey(dbType: string, host?: string, port?: number, database?: string, user?: string): string {
  return `${dbType}://${user}@${host}:${port}/${database}`;
}

// Singleton connection pools keyed by connection string
const pgPools = new Map<string, PgPool>();

function getPgPool(host?: string, port?: number, database?: string, user?: string, password?: string): PgPool {
  const key = poolKey('pg', host, port, database, user);
  let pool = pgPools.get(key);
  if (!pool) {
    pool = new PgPool({
      host,
      port: port || 5432,
      database,
      user,
      password,
      max: 5,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: 30000,
      statement_timeout: QUERY_TIMEOUT_MS,
    });
    pgPools.set(key, pool);
  }
  return pool;
}

/**
 * Service to handle external database connections and queries
 */
export class DbConnectorService {
  /**
   * Execute a query against an external database
   */
  static async executeQuery(
    config: StepConfig,
    interpolatedQuery: string
  ): Promise<Record<string, unknown>[]> {
    const { dbType, dbHost, dbPort, dbName, dbUser, dbPassword } = config;

    if (!dbType) {
      throw new Error('Database type (dbType) is required');
    }
    if (!interpolatedQuery) {
      throw new Error('Database query (dbQuery) is required');
    }

    if (dbType === 'postgres') {
      return this.executePostgresQuery(dbHost, dbPort, dbName, dbUser, dbPassword, interpolatedQuery);
    } else if (dbType === 'mysql') {
      return this.executeMysqlQuery(dbHost, dbPort, dbName, dbUser, dbPassword, interpolatedQuery);
    } else {
      throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  private static async executePostgresQuery(
    host?: string,
    port?: number,
    database?: string,
    user?: string,
    password?: string,
    query?: string
  ): Promise<Record<string, unknown>[]> {
    const pool = getPgPool(host, port, database, user, password);
    const client = await pool.connect();
    try {
      const result = await client.query(query!);
      return result.rows;
    } finally {
      client.release();
    }
  }

  private static async executeMysqlQuery(
    host?: string,
    port?: number,
    database?: string,
    user?: string,
    password?: string,
    query?: string
  ): Promise<Record<string, unknown>[]> {
    const connection = await mysql.createConnection({
      host,
      port: port || 3306,
      database,
      user,
      password,
      connectTimeout: CONNECTION_TIMEOUT_MS,
    });

    try {
      const [rows] = await connection.execute(query!);
      return rows as Record<string, unknown>[];
    } finally {
      await connection.end();
    }
  }

  /** Drain all cached pools (for graceful shutdown). */
  static async shutdown(): Promise<void> {
    const drains = Array.from(pgPools.values()).map(p => p.end());
    pgPools.clear();
    await Promise.all(drains);
  }
}
