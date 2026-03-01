export * from './sqlite-config.js';
export * from './sqlite-db.js';
import type { SqliteConfig } from './sqlite-config.js';
import { SqliteDb } from './sqlite-db.js';

export function createSqliteDb(config: SqliteConfig): SqliteDb {
    return new SqliteDb(config);
}