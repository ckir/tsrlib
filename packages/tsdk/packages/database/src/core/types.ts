import type { LoggersSection } from '@tsrlib/loggers';

/**
 * Re-uses the existing library logger type from LoggersSection.
 */
export type LibraryLogger = typeof LoggersSection.logger;

/**
 * Operation mode for the database.
 * 'stateless': Connect-Execute-Disconnect (Edge/Lambda).
 * 'stateful': Maintains persistent connections (Server).
 */
export type DbMode = 'stateless' | 'stateful';

/**
 * Base configuration shared by all database dialects.
 */
export interface BaseDbConfig {
    url: string;
    mode: DbMode;
    logger: LibraryLogger;
    timeoutMs?: number;
}

/** Parameters for SQL queries (positional or named) */
export type QueryParams = any[] | Record<string, any>;

/** Standard data structure for successful query results */
export interface QueryResponse<T = any> {
    rows: T[];
    affectedRows?: number;
    lastInsertId?: string | number;
}