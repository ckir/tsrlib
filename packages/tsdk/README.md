# @tsrlib/tsdk

The primary TypeScript SDK for TSRLIB, featuring a high-performance Rust Native Bridge via NAPI-RS.

## Overview

This package acts as the unified entry point for the TSRLIB ecosystem. It combines native Rust performance (for heavy compute and tracing) with the flexibility of TypeScript logic across all internal modules.

## Architecture

- Native Bridge: Powered by rsdk.node. Loaded via a custom stable loader to bypass platform-specific naming issues and NPM optional dependency bugs.
- Monorepo Integration: Automatically exports logic from all @tsrlib/* sub-packages (Loggers, Configs, Markets, etc.).
- Sidecar Optimized: Designed to work seamlessly with the Vector (telemetry) and Caddy (proxy) sidecars.

## Development Workflow

To build or update the native bridge, use the Developers Cockpit from the repository root:

1. Build: pnpm cockpit -> Option 1 
   *Compiles Rust, aligns the .node binary, and cleans stale NAPI-RS artifacts.*
2. Verify: pnpm cockpit -> Option 8 
   *Runs a health pulse to ensure the JS -> Rust -> Vector pipeline is alive.*

## Usage

### Initializing the SDK

import { RSdk } from '@tsrlib/tsdk';

// Initialize the native tracing layer
RSdk.initTracing();

// Check bridge health
const status = RSdk.checkRsdkStatus();
console.log(`Bridge Status: ${status}`);

### Using Sub-Packages

The SDK re-exports all logic sections for convenience. You can import specialized logic directly from the @tsrlib/tsdk umbrella:

import { 
    LoggersSection, 
    ConfigsSection, 
    MarketsSection 
} from '@tsrlib/tsdk';

// Access shared configurations
const config = ConfigsSection.getAppConfig();

// Send specialized logs via the TS pipeline
LoggersSection.logger.info({ 
    event: "market_data_refresh", 
    market: "BTC/USD" 
});

## Sidecar Integration

The SDK is built to interact with the following infrastructure components:

1. Vector (Port 9000/9001)
- JSON Telemetry: The LoggersSection sends structured logs to :9000.
- Rust Tracing: The RSdk.initTracing() bridge connects to :9001 via TCP.
- Verification: Run pnpm cockpit -> Option 8 to test this pipeline.

2. Caddy (Port 8080)
- API Proxy: All requests to localhost:8080/api are routed to the internal backend.
- Documentation: View generated TypeDocs at http://localhost:8080/docs/ts/.

## Testing

Integration tests verify the full handshake between TypeScript, the Rust binary, and the sidecars.

# Run the full suite via Vitest
pnpm vitest run --config packages/tsdk/vitest.config.ts

Note: The test runner uses a global-setup.ts hook to automatically start and stop sidecars. If you encounter port conflicts (OS Error 10048), ensure no stale vector.exe or caddy.exe processes are running in Task Manager.

## License

Internal TSRLIB Proprietary.