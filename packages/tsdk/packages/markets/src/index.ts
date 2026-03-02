/**
 * @file packages/tsdk/packages/markets/src/index.ts
 */

import { ApiNasdaqUnlimited } from './Nasdaq/ApiNasdaqUnlimited.js';
import { MarketStatus } from './Nasdaq/MarketStatus.js';

export * from './Nasdaq/ApiNasdaqUnlimited.js';
export * from './Nasdaq/MarketStatus.js';

/**
 * Exported MarketsSection for the unified RSdk interface.
 */
export const MarketsSection = {
  nasdaq: ApiNasdaqUnlimited,
  status: MarketStatus
};