import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Loading the native binary directly.
 * The build script copies *.node to this directory.
 */
const native = require('./rsdk.win32-x64-msvc.node'); 

export const checkRsdkStatus = (): string => native.checkRsdkStatus();
export const heavyCompute = (input: number): Promise<number> => native.heavyCompute(input);\n