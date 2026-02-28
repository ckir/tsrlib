import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Direct loader for the aligned native binary.
 */
const nativeBinding = require(join(__dirname, 'rsdk.node'));

// NAPI-RS converts snake_case to camelCase for JS exports
export const { 
    checkRsdkStatus, 
    initTracing, 
    shutdownTracing,
    heavyCompute 
} = nativeBinding;