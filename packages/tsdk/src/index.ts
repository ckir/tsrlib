/**
 * @file packages/tsdk/src/index.ts
 * @description Main entry point for the TSRLIB SDK.
 * This file aggregates all modular sections and exposes the unified RSdk interface.
 */

import { ConfigSection } from '../packages/configs/src/index.js';
import { ConnectionsSection } from '../packages/connections/src/index.js';
import { CoreSection } from '../packages/core/src/index.js';
import { LoggersSection } from '../packages/loggers/src/index.js';
import { MarketsSection } from '../packages/markets/src/index.js';
import { RetrieveSection } from '../packages/retrieve/src/index.js';
import { UtilsSection } from '../packages/utils/src/index.js';
import { nativeBinding, isBun, isNode } from './rsdk-loader.js';

/**
 * Explicit Type for RSdk to ensure strict contract and 
 * prevent portability errors related to inferred types.
 */
export interface ITsrSdk {
  configs: typeof ConfigSection;
  connections: typeof ConnectionsSection;
  core: typeof CoreSection;
  loggers: typeof LoggersSection;
  markets: typeof MarketsSection;
  retrieve: typeof RetrieveSection;
  utils: typeof UtilsSection;
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
  /** Configuration management (JSON/Env) */
  configs: ConfigSection,
  /** Network and Peer connections */
  connections: ConnectionsSection,
  /** Core internal logic and state */
  core: CoreSection,
  /** Logging and Telemetry pipelines */
  loggers: LoggersSection,
  /** Market data and exchange streaming */
  markets: MarketsSection,
  /** Data retrieval and HTTP utilities */
  retrieve: RetrieveSection,
  /** General helper utilities */
  utils: UtilsSection,

  /**
   * Check the health and version of the native Rust bridge.
   * @returns {Object} Status and version information from the Rust FFI.
   */
  checkRsdkStatus: () => {
    // FIX: NAPI-RS automatically converts snake_case to camelCase
    return nativeBinding.checkRsdkStatus();
  },

  /** Runtime Environment Metadata */
  runtime: {
    isBun,
    isNode,
    platform: process.platform,
    arch: process.arch
  }
};

// Re-export sections for direct access if needed
export { 
  ConfigSection, 
  ConnectionsSection, 
  CoreSection, 
  LoggersSection, 
  MarketsSection, 
  RetrieveSection, 
  UtilsSection 
};

/**
 * USAGE EXAMPLE for Consumers:
 * * import { Logger, Retrieve, ConfigManager } from 'tsrlib';
 * * const logger = new Logger(...);
 * const retriever = new Retrieve(...);
 */