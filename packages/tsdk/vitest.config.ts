/**
 * @file packages/tsdk/vitest.config.ts
 * @description Vitest configuration for TSRLIB integration tests.
 * 
 * FIXED: execArgv is now dynamic so it works on Node 20 (CI) and still
 * suppresses the webstorage warning on Node 22+ (local dev).
 * 
 * All test discovery, aliases, globalSetup (sidecars), and worker settings
 * are unchanged.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dynamic Node version check (prevents "bad option" on Node 20)
const nodeMajor = parseInt(process.version.slice(1).split('.')[0] || '0');

export default defineConfig({
  test: {
    // Enable describe/it/expect globally
    globals: true,

    // Environment for FFI and Socket testing
    environment: 'node',

    // Start Vector/Caddy before tests and stop them after
    globalSetup: [path.resolve(__dirname, './test/global-setup.ts')],

    // Map your @tsrlib/* aliases to the local source files
    alias: {
      '@tsrlib/core': path.resolve(__dirname, './packages/core/src/index.ts'),
      '@tsrlib/configs': path.resolve(__dirname, './packages/configs/src/index.ts'),
      '@tsrlib/connections': path.resolve(__dirname, './packages/connections/src/index.ts'),
      '@tsrlib/loggers': path.resolve(__dirname, './packages/loggers/src/index.ts'),
      '@tsrlib/markets': path.resolve(__dirname, './packages/markets/src/index.ts'),
      '@tsrlib/retrieve': path.resolve(__dirname, './packages/retrieve/src/index.ts'),
      '@tsrlib/utils': path.resolve(__dirname, './packages/utils/src/index.ts'),
    },

    // Handling for Native Modules & ESM
    server: {
      deps: {
        external: [
          /\.node$/,               // Don't transform the Rust binary
          /pino-socket/            // Externalize pino-socket for worker-thread stability
        ],
      },
    },

    // Include tests from all sub-packages
    include: [
      'packages/*/test/**/*.{test,spec}.ts',
      'packages/tsdk/packages/*/test/**/*.{test,spec}.ts',
      'test/**/*.{test,spec}.ts'
    ],

    // Increase timeout for the first run in case Rust/Sidecars take a moment to warm up
    testTimeout: 10000,

    /**
     * FIXED: Dynamic execArgv
     * - Always passes --expose-gc
     * - Only passes --no-experimental-webstorage on Node >= 22
     *   (Node 20 throws "bad option" – the exact CI crash on all platforms)
     */
    execArgv: [
      '--expose-gc',
      ...(nodeMajor >= 22 ? ['--no-experimental-webstorage'] : [])
    ],

    isolate: false,
    maxWorkers: 1,
    vmMemoryLimit: '300Mb',
  },
});