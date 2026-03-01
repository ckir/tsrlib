import { SqliteDriver } from './sqlite-driver.js';
import { transactionStorage, getActiveTransaction } from '../core/transaction-context.js';
import { wrapError, type DatabaseResult } from '../core/result.js';
import type { QueryResponse, QueryParams } from '../core/types.js';
import type { SqliteConfig } from './sqlite-config.js';

/**
 * Public SqliteDb implementation.
 * * This class provides the high-level API for interacting with SQLite/LibSQL.
 * It manages:
 * 1. Result wrapping and normalization.
 * 2. Automatic connection/disconnection for stateless (Edge/Lambda) environments.
 * 3. Transparent transaction context propagation using AsyncLocalStorage.
 */
export class SqliteDb {
    private driver: SqliteDriver;

    constructor(private config: SqliteConfig) {
        this.driver = new SqliteDriver(config);
    }

    /**
     * Executes a single SQL query.
     * * If called inside a `db.transaction` block, it automatically joins the active
     * transaction and uses its stateful connection.
     */
    async query<T = any>(sql: string, params?: QueryParams): Promise<DatabaseResult<QueryResponse<T>>> {
        const txDriver = getActiveTransaction();
        const activeDriver = txDriver || this.driver;

        try {
            // Optimization: If we are in a transaction, the manager already connected the driver.
            if (!txDriver) {
                await activeDriver.connect();
            }

            const result = await activeDriver.query<T>(sql, params);
            
            // Log logical database errors (e.g., syntax errors returned by the engine)
            if (result.status === 'error') {
                this.config.logger.error({ msg: 'Query execution failed', sql, reason: result.reason });
            }
            return result;
        } catch (e) {
            // Log catastrophic failures (e.g., network timeout, driver crash)
            this.config.logger.error({ msg: 'Query catastrophic failure', sql, error: e });
            return wrapError(e);
        } finally {
            // Only disconnect if we are NOT in a transaction and in stateless mode.
            // This prevents closing a connection that is still needed for the transaction.
            if (!txDriver && this.config.mode === 'stateless') {
                await activeDriver.disconnect();
            }
        }
    }

    /**
     * Executes a set of operations within a database transaction.
     * * Uses AsyncLocalStorage to ensure any `db.query` calls within the callback
     * use the same connection and transaction state without requiring explicit propagation.
     */
    async transaction<T>(callback: () => Promise<DatabaseResult<T>>): Promise<DatabaseResult<T>> {
        try {
            await this.driver.connect();
            await this.driver.beginTransaction();

            // Scope the driver within the async storage for "Hidden Context"
            return await transactionStorage.run(this.driver, async () => {
                const result = await callback();
                
                if (result.status === 'success') {
                    await this.driver.commitTransaction();
                } else {
                    // Log the reason why the transaction is being rolled back
                    this.config.logger.warn({ msg: 'Transaction rollback initiated', reason: result.reason });
                    await this.driver.rollbackTransaction();
                }
                return result;
            });
        } catch (e) {
            // Log and rollback on unexpected exceptions within the transaction block
            this.config.logger.error({ msg: 'Transaction failed due to exception', error: e });
            await this.driver.rollbackTransaction();
            return wrapError(e);
        } finally {
            // Ensure cleanup in stateless environments
            if (this.config.mode === 'stateless') {
                await this.driver.disconnect();
            }
        }
    }
}