/**
 * @file packages/tsdk/packages/database/src/sqlite/index.ts
 * @description SQLite sub-module public barrel
 *
 * FINAL CORRECT FIX (March 2026)
 *
 * Facts from sqlite-db.ts:
 *   • The actual class is: export class SqliteDb
 *   • The rest of the codebase (RSdk, tests, users) expects: Database
 *
 * Solution: Re-export SqliteDb as Database (alias)
 * This is the standard barrel pattern used throughout the monorepo.
 */

export * from './sqlite-config.js';
export * from './sqlite-db.js';
export * from './sqlite-driver.js';

// Alias the real implementation to the public name expected by the SDK
export { SqliteDb as Database } from './sqlite-db.js';