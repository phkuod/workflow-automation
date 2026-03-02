import { Pool as PgPool } from 'pg';
import mysql from 'mysql2/promise';
import { StepConfig } from '../types/workflow';

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
  ): Promise<any[]> {
    const {
      dbType,
      dbHost,
      dbPort,
      dbName,
      dbUser,
      dbPassword,
    } = config;

    if (!dbType) {
      throw new Error('Database type (dbType) is required');
    }
    if (!interpolatedQuery) {
      throw new Error('Database query (dbQuery) is required');
    }

    if (dbType === 'postgres') {
      return this.executePostgresQuery(
        dbHost, 
        dbPort, 
        dbName, 
        dbUser, 
        dbPassword, 
        interpolatedQuery
      );
    } else if (dbType === 'mysql') {
      return this.executeMysqlQuery(
        dbHost, 
        dbPort, 
        dbName, 
        dbUser, 
        dbPassword, 
        interpolatedQuery
      );
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
  ): Promise<any[]> {
    const pool = new PgPool({
      host,
      port: port || 5432,
      database,
      user,
      password,
      // Use short timeouts so workflows don't hang indefinitely on bad connections
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 1000, 
    });

    try {
      const client = await pool.connect();
      try {
        const result = await client.query(query!);
        return result.rows;
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  }

  private static async executeMysqlQuery(
    host?: string,
    port?: number,
    database?: string,
    user?: string,
    password?: string,
    query?: string
  ): Promise<any[]> {
    const connection = await mysql.createConnection({
      host,
      port: port || 3306,
      database,
      user,
      password,
      connectTimeout: 5000,
    });

    try {
      // execute returns [rows, fields]
      const [rows] = await connection.execute(query!);
      return rows as any[];
    } finally {
      await connection.end();
    }
  }
}
