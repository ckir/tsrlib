import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Load the stable rsdk.node binary.
 * This file is created by the build script.
 */
const native = require('./rsdk.node'); 

export const checkRsdkStatus = (): string => native.checkRsdkStatus();
export const heavyCompute = (input: number): Promise<number> => native.heavyCompute(input);