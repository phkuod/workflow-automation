import { describe, it, expect, vi, afterEach } from 'vitest';
import { DbConnectorService } from '../services/dbConnector';
import { StepConfig } from '../types/workflow';

// Mock dependencies
vi.mock('pg', () => {
  const mClient = {
    query: vi.fn(),
    release: vi.fn()
  };
  const mPool = {
    connect: vi.fn(() => mClient),
    end: vi.fn()
  };
  const Pool = vi.fn(function(this: any) {
    Object.assign(this, mPool);
  });
  return { Pool };
});

vi.mock('mysql2/promise', () => {
  const mConnection = {
    execute: vi.fn(),
    end: vi.fn()
  };
  return {
    default: {
      createConnection: vi.fn(() => mConnection)
    }
  };
});

import { Pool as PgPool } from 'pg';
import mysql from 'mysql2/promise';

describe('DbConnectorService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('PostgreSQL', () => {
    it('should successfully execute a postgres query', async () => {
      const config: StepConfig = {
        dbType: 'postgres',
        dbHost: 'localhost',
        dbUser: 'testuser',
        dbPassword: 'password',
        dbName: 'testdb'
      };
      
      const mockResult = { rows: [{ id: 1, name: 'Test' }] };
      const mPool = new PgPool();
      const mClient = await mPool.connect();
      (mClient.query as any).mockResolvedValueOnce(mockResult);

      const rows = await DbConnectorService.executeQuery(config, 'SELECT * FROM test');

      expect(rows).toEqual(mockResult.rows);
      expect(PgPool).toHaveBeenCalledWith(expect.objectContaining({
        host: 'localhost',
        user: 'testuser',
        password: 'password',
        database: 'testdb',
        port: 5432
      }));
      expect(mClient.query).toHaveBeenCalledWith('SELECT * FROM test');
      expect(mClient.release).toHaveBeenCalled();
      expect(mPool.end).toHaveBeenCalled();
    });

    it('should throw an error if postgres query fails', async () => {
      const config: StepConfig = {
        dbType: 'postgres'
      };
      
      const mPool = new PgPool();
      const mClient = await mPool.connect();
      (mClient.query as any).mockRejectedValueOnce(new Error('Syntax error'));

      await expect(DbConnectorService.executeQuery(config, 'BAD QUERY'))
        .rejects.toThrow('Syntax error');
        
      expect(mClient.release).toHaveBeenCalled();
      expect(mPool.end).toHaveBeenCalled();
    });
  });

  describe('MySQL', () => {
    it('should successfully execute a mysql query', async () => {
      const config: StepConfig = {
        dbType: 'mysql',
        dbHost: 'remotehost',
        dbUser: 'admin',
        dbPassword: '123',
        dbName: 'mydb',
        dbPort: 3307
      };
      
      const mockRows = [{ id: 2, value: 'Data' }];
      const mConnection = await mysql.createConnection({});
      (mConnection.execute as any).mockResolvedValueOnce([mockRows, []]);

      const rows = await DbConnectorService.executeQuery(config, 'SELECT value FROM table');

      expect(rows).toEqual(mockRows);
      expect(mysql.createConnection).toHaveBeenCalledWith(expect.objectContaining({
        host: 'remotehost',
        user: 'admin',
        password: '123',
        database: 'mydb',
        port: 3307
      }));
      expect(mConnection.execute).toHaveBeenCalledWith('SELECT value FROM table');
      expect(mConnection.end).toHaveBeenCalled();
    });

    it('should throw an error if mysql connection fails', async () => {
      const config: StepConfig = { dbType: 'mysql' };
      
      (mysql.createConnection as any).mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(DbConnectorService.executeQuery(config, 'SELECT 1'))
        .rejects.toThrow('Connection timeout');
    });
  });

  describe('Validation', () => {
    it('should throw error if dbType is missing', async () => {
      await expect(DbConnectorService.executeQuery({} as StepConfig, 'SELECT 1'))
        .rejects.toThrow('Database type (dbType) is required');
    });

    it('should throw error if query is missing', async () => {
      await expect(DbConnectorService.executeQuery({ dbType: 'mysql' } as StepConfig, ''))
        .rejects.toThrow('Database query (dbQuery) is required');
    });
    
    it('should throw error if unsupported dbType', async () => {
      await expect(DbConnectorService.executeQuery({ dbType: 'mongodb' as any } as StepConfig, 'SELECT 1'))
        .rejects.toThrow('Unsupported database type: mongodb');
    });
  });
});
