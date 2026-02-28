/**
 * TSRLIB TypeScript SDK - Main Entry Point
 * Wraps the Rust Native Bridge and TS Logic Modules
 */
import * as rsdk from './rsdk-loader.js';

// The Primary SDK Controller
export const RSdk = {
    /** Initialize OpenTelemetry tracing via Rust */
    initTracing: rsdk.initTracing,

    /** Gracefully shut down the tracing layers */
    shutdownTracing: rsdk.shutdownTracing,

    /** Check the health of the Rust bridge */
    checkRsdkStatus: rsdk.checkRsdkStatus,

    /** Perform heavy CPU work in Rust */
    heavyCompute: rsdk.heavyCompute
};

// Export individual Logic Sections (Pnpm Workspace Packages)
export * from '@tsrlib/loggers';
export * from '@tsrlib/configs';
export * from '@tsrlib/connections';
export * from '@tsrlib/markets';
export * from '@tsrlib/retrieve';
export * from '@tsrlib/utils';
export * from '@tsrlib/core';