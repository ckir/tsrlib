import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      'packages/*/test/**/*.{test,spec}.ts',       // Matches packages/tsdk/test
      'packages/tsdk/packages/*/test/**/*.{test,spec}.ts', // Matches packages/tsdk/packages/loggers/test
      'test/**/*.{test,spec}.ts'                   // Matches root test folder
    ],

    // Increase timeout for the first run in case Rust/Sidecars take a moment to warm up
    testTimeout: 10000,
  },
});