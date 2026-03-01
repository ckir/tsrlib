/**
 * packages/tsdk/packages/database/src/index.ts
 */
import { LoggersSection } from "@tsrlib/loggers";
import { wrapResult, wrapError, Result } from "@tsrlib/utils";

/**
 * Interface representing a generic database connection.
 */
export interface DatabaseConnection {
    execute(sql: string, params?: any[]): Promise<any>;
    close(): Promise<void>;
}

/**
 * Interface representing a database driver capable of establishing connections.
 */
export interface DatabaseDriver {
    connect(): Promise<DatabaseConnection>;
}

/**
 * Database Module managing connections and transactions.
 * Uses LoggersSection.logger to create a scoped child logger.
 */
export class DatabaseModule {
    // Access the existing logger object and create a child scoped to "Database"
    private logger = LoggersSection.logger.child({ section: "Database" });
    private connectionOverride?: DatabaseConnection;

    constructor(private driver: DatabaseDriver, connection?: DatabaseConnection) {
        this.connectionOverride = connection;
    }

    /**
     * Executes a database query. 
     * If a connectionOverride exists (from a transaction), it reuses it.
     */
    async query<T = any>(sql: string, params?: any[]): Promise<Result<T>> {
        const conn = this.connectionOverride || (await this.driver.connect());
        try {
            const result = await conn.execute(sql, params);
            return wrapResult(result);
        } catch (e: any) {
            this.logger.error(`Query Error: ${e.message}`);
            return wrapError(e);
        } finally {
            // Only close if we are not in a transaction context
            if (!this.connectionOverride) {
                await conn.close();
            }
        }
    }

    /**
     * Runs operations within a transaction.
     * Provides a new DatabaseModule instance to the callback that reuses the connection.
     */
    async transaction<T>(fn: (db: DatabaseModule) => Promise<T>): Promise<Result<T>> {
        const isNested = !!this.connectionOverride;
        const conn = this.connectionOverride || (await this.driver.connect());
        
        // Create a scoped instance for the callback using the current connection
        const txDb = new DatabaseModule(this.driver, conn);

        try {
            if (!isNested) {
                await conn.execute("BEGIN");
            }
            
            const data = await fn(txDb);
            
            if (!isNested) {
                await conn.execute("COMMIT");
            }
            return wrapResult(data);
        } catch (e: any) {
            if (!isNested) {
                await conn.execute("ROLLBACK");
                this.logger.error(`Transaction Error: ${e.message}`);
            }
            return wrapError(e);
        } finally {
            if (!isNested) {
                await conn.close();
            }
        }
    }
}