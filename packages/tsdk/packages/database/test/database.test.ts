/**
 * packages/tsdk/packages/database/test/database.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseModule, DatabaseDriver, DatabaseConnection } from '../src/index.js';

describe('Database Module - Exhaustive Suite', () => {
    let mockConnection: DatabaseConnection;
    let mockDriver: DatabaseDriver;
    let db: DatabaseModule;

    beforeEach(() => {
        mockConnection = {
            execute: vi.fn().mockResolvedValue([]),
            close: vi.fn().mockResolvedValue(undefined),
        };
        mockDriver = {
            connect: vi.fn().mockResolvedValue(mockConnection),
        };
        db = new DatabaseModule(mockDriver);
    });

    describe('SqliteDb: Transactions (Hidden Context)', () => {
        it('should wrap success values correctly', async () => {
            const result = await db.query('SELECT 1');
            expect(result.status).toBe('success');
            expect(result.data).toEqual([]);
        });

        it('should wrap and serialize errors', async () => {
            mockConnection.execute = vi.fn().mockRejectedValue(new Error('Syntax Error'));
            const result = await db.query('SELECT !');
            expect(result.status).toBe('error');
            expect(result.message).toBe('Syntax Error');
        });

        it('stateless: should connect, execute, and disconnect on every query', async () => {
            const connectSpy = vi.spyOn(mockDriver, 'connect');
            const disconnectSpy = vi.spyOn(mockConnection, 'close');

            await db.query('SELECT 1');
            expect(connectSpy).toHaveBeenCalledTimes(1);
            expect(disconnectSpy).toHaveBeenCalledTimes(1);
        });

        it('should commit on success and rollback on error', async () => {
            const execSpy = vi.spyOn(mockConnection, 'execute');

            await db.transaction(async (tx) => {
                await tx.query('INSERT INTO logs VALUES ("test")');
            });

            expect(execSpy).toHaveBeenCalledWith('BEGIN');
            expect(execSpy).toHaveBeenCalledWith('COMMIT');

            execSpy.mockClear();
            mockConnection.execute = vi.fn().mockImplementation(async (sql) => {
                if (sql.includes('fail')) throw new Error('DB Error');
                return [];
            });

            await db.transaction(async (tx) => {
                const res = await tx.query('INSERT INTO logs VALUES ("fail")');
                
                // Manually trigger a throw if the internal query fails
                // so the transaction wrapper can catch it and call ROLLBACK.
                if (res.status === 'error') {
                    throw new Error('Transaction failed');
                }
            });

            expect(mockConnection.execute).toHaveBeenCalledWith('ROLLBACK');
        });

        it('should ensure nested queries use the SAME connection and do not re-connect', async () => {
            const connectSpy = vi.spyOn(mockDriver, 'connect');
            const disconnectSpy = vi.spyOn(mockConnection, 'close');

            await db.transaction(async (tx) => {
                // Use 'tx' which carries the transaction connection
                await tx.query('SELECT 1');
                await tx.query('SELECT 2');
            });

            // Transaction starts: 1 connect. Queries inside use the same connection.
            expect(connectSpy).toHaveBeenCalledTimes(1);
            // Transaction finishes: 1 close.
            expect(disconnectSpy).toHaveBeenCalledTimes(1);
        });
    });
});