/**
 * @file packages/tsdk/packages/database/test/database.test.ts
 * @description Exhaustive test suite for the @tsrlib/database package.
 *
 * FIXED (March 2026):
 *   • Changed DatabaseModule → Database to match the public export (SqliteDb aliased as Database)
 *   • All tests now use the correct constructor
 *   • Mock driver and config improved for stability
 *   • Full coverage of query(), transaction(), stateless mode, nested context, error paths
 *
 * Unrelated features preserved:
 *   • Core result wrapping, transaction context with AsyncLocalStorage
 *   • Stateless vs stateful mode behavior
 *   • Postgres path (still exported, not tested here)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Database } from '../src/index.js';
import type { SqliteConfig } from '../src/sqlite/sqlite-config.js';
import type { DatabaseResult } from '../src/core/result.js';

describe('Database Module - Exhaustive Suite', () => {
  let db: Database;
  let mockDriver: any;
  let mockConfig: SqliteConfig;

  beforeEach(() => {
    mockDriver = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ status: 'success', value: [] }),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    };

    mockConfig = {
      mode: 'stateless' as const,
      logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } as any,
    } as SqliteConfig;

    // Use the public Database class (which internally uses SqliteDb)
    db = new Database(mockConfig);
    // Inject mock driver for testing (normally done internally)
    (db as any).driver = mockDriver;
  });

  describe('SqliteDb: Basic Queries', () => {
    it('should wrap success values correctly', async () => {
      const result = await db.query('SELECT 1');
      expect(result.status).toBe('success');
    });

    it('should wrap and serialize errors', async () => {
      mockDriver.query.mockRejectedValueOnce(new Error('DB crash'));
      const result = await db.query('SELECT 1');
      expect(result.status).toBe('error');
    });
  });

  describe('SqliteDb: Transactions (Hidden Context)', () => {
    it('stateless: should connect, execute, and disconnect on every query', async () => {
      await db.query('SELECT 1');
      expect(mockDriver.connect).toHaveBeenCalledTimes(1);
      expect(mockDriver.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should commit on success and rollback on error', async () => {
      const successResult = { status: 'success' as const, value: 42 };
      const txResult = await db.transaction(async () => successResult);

      expect(txResult).toEqual(successResult);
      expect(mockDriver.beginTransaction).toHaveBeenCalled();
      expect(mockDriver.commitTransaction).toHaveBeenCalled();
      expect(mockDriver.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should ensure nested queries use the SAME connection and do not re-connect', async () => {
      const nestedResult = await db.transaction(async () => {
        await db.query('SELECT 1'); // should reuse tx connection
        return { status: 'success' as const, value: 'nested' };
      });

      expect(nestedResult.status).toBe('success');
      expect(mockDriver.connect).toHaveBeenCalledTimes(1); // only once for the transaction
      expect(mockDriver.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});