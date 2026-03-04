/**
 * @file packages/tsdk/src/index.ts
 * @description Main entry point for the TSRLIB SDK.
 * 
 * FINAL CLEAN & FIXED VERSION (error resolved)
 * 
 * Fixed in this update:
 * - Database now imported from the correct package index (not internal driver.js)
 * - YahooStreaming remains directly exported
 * - All clean aliases (Logger, Config, Markets, Database, YahooStreaming, etc.)
 * - Original Section exports kept for full compatibility
 * 
 * You can now use everywhere in finstream:
 * import { Logger, Config, Markets, Database, YahooStreaming, RSdk } from 'tsrlib';
 */

import { ConfigSection } from '../packages/configs/src/index.js';
import { ConnectionsSection } from '../packages/connections/src/index.js';
import { CoreSection } from '../packages/core/src/index.js';
import { LoggersSection } from '../packages/loggers/src/index.js';
import { MarketsSection } from '../packages/markets/src/index.js';
import { RetrieveSection } from '../packages/retrieve/src/index.js';
import { UtilsSection } from '../packages/utils/src/index.js';
import { nativeBinding, isBun, isNode } from './rsdk-loader.js';

// Correct imports for classes that need direct access
import { Database } from '../packages/database/src/index.js';                    // ← FIXED (this was the error)
import { YahooStreaming } from '../packages/markets/src/Nasdaq/Datafeeds/Streaming/Yahoo/YahooStreaming.js';

/**
 * Explicit Type for RSdk
 */
export interface ITsrSdk {
  configs: typeof ConfigSection;
  connections: typeof ConnectionsSection;
  core: typeof CoreSection;
  loggers: typeof LoggersSection;
  markets: typeof MarketsSection;
  retrieve: typeof RetrieveSection;
  utils: typeof UtilsSection;
  database: typeof Database;
  checkRsdkStatus: () => any;
  runtime: {
    isBun: boolean;
    isNode: boolean;
    platform: string;
    arch: string;
  };
}

/**
 * Unified TSRLIB SDK Interface
 */
export const RSdk: ITsrSdk = {
  configs: ConfigSection,
  connections: ConnectionsSection,
  core: CoreSection,
  loggers: LoggersSection,
  markets: MarketsSection,
  retrieve: RetrieveSection,
  utils: UtilsSection,
  database: Database,

  checkRsdkStatus: () => nativeBinding.checkRsdkStatus(),

  runtime: {
    isBun,
    isNode,
    platform: process.platform,
    arch: process.arch
  }
};

// ====================================================================
// ORIGINAL EXPORTS (full backward compatibility)
// ====================================================================
export { 
  ConfigSection, 
  ConnectionsSection, 
  CoreSection, 
  LoggersSection, 
  MarketsSection, 
  RetrieveSection, 
  UtilsSection 
};

// ====================================================================
// CLEAN ALIASES WITHOUT "SECTION" (your requested style)
// ====================================================================
export { LoggersSection as Logger };
export { ConfigSection as Config };
export { MarketsSection as Markets };
export { RetrieveSection as Retrieve };
export { UtilsSection as Utils };
export { ConnectionsSection as Connections };
export { CoreSection as Core };

// Clean class exports
export { Database };
export { YahooStreaming };

/**
 * USAGE EXAMPLES (clean style everywhere):
 * 
 * import { 
 *   Logger, 
 *   Config, 
 *   Markets, 
 *   Database, 
 *   YahooStreaming,
 *   RSdk 
 * } from 'tsrlib';
 * 
 * const logger = Logger.logger;
 * const manager = new Config.ConfigManager(...);
 * const status = await Markets.MarketStatus.getNasdaqStatus();
 * const db = new Database('finstream.db');
 * const streamer = new YahooStreaming(['AAPL']);
 */