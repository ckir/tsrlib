import type { DbDriver, PreparedDriverStatement } from '../core/driver.js';
import { wrapSuccess, wrapError, type DatabaseResult } from '../core/result.js';
import type { QueryResponse, QueryParams } from '../core/types.js';
import type { SqliteConfig } from './sqlite-config.js';

export class SqliteDriver implements DbDriver {
    private client: any = null;

    constructor(private config: SqliteConfig) {}

    async connect(): Promise<void> {
        if (this.client) return;
        const { createClient } = await import('@libsql/client');
        this.client = createClient({
            url: this.config.url,
            authToken: this.config.authToken
        });
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.close();
            this.client = null;
        }
    }

    async query<T = any>(sql: string, params?: QueryParams): Promise<DatabaseResult<QueryResponse<T>>> {
        try {
            const res = await this.client.execute({ sql, args: params || [] });
            return wrapSuccess({
                rows: res.rows as unknown as T[],
                affectedRows: Number(res.rowsAffected),
                lastInsertId: res.lastInsertRowid?.toString()
            });
        } catch (e) {
            return wrapError(e);
        }
    }

    async prepare(sql: string): Promise<DatabaseResult<PreparedDriverStatement>> {
        return wrapError(new Error('Prepare not implemented'));
    }

    async beginTransaction(): Promise<void> { await this.client.execute('BEGIN'); }
    async commitTransaction(): Promise<void> { await this.client.execute('COMMIT'); }
    async rollbackTransaction(): Promise<void> { await this.client.execute('ROLLBACK'); }

    async stream<T>(sql: string, params: QueryParams, onRow: (row: T) => void): Promise<DatabaseResult<void>> {
        return wrapError(new Error('Streaming not implemented'));
    }
}