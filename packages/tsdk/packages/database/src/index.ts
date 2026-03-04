/**
 * @file packages/tsdk/packages/database/src/index.ts
 */

import { Database } from './sqlite/index.js';

export * from './core/driver.js';
export * from './core/errors.js';
export * from './core/result.js';
export * from './core/transaction-context.js';
export * from './core/types.js';
export * from './core/utils.js';

export * from './sqlite/index.js';
export * from './postgres/index.js';

export { Database };

export const DatabaseSection = {
  status: 'active' as const,
  Database,
};