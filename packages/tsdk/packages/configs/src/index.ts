/**
 * @file packages/tsdk/packages/configs/src/index.ts
 */

import { ConfigManager } from './ConfigManager.js';

export * from './ConfigManager.js';
export * from './ConfigUtils.js';

/**
 * Exported ConfigSection for the unified RSdk interface.
 */
export const ConfigSection = {
  manager: ConfigManager.getInstance()
};