/**
 * @file packages/tsdk/src/rsdk-loader.ts
 * @description Runtime-agnostic loader for the native rsdk binary.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Returns the path to the native binding, prioritizing local builds.
 */
function getBinaryPath(): string {
  const binaryName = 'rsdk.node';
  const devPath = join(__dirname, binaryName);
  const prodPath = join(process.cwd(), '.bin', binaryName);

  if (existsSync(devPath)) return devPath;
  if (existsSync(prodPath)) return prodPath;

  return devPath; 
}

export const isBun = typeof process !== 'undefined' && !!process.versions?.bun;
export const isNode = !isBun;

export function getPlatform(): string {
  return `${process.platform}-${process.arch}`;
}

// Loads the binary via standard CommonJS require (supported by both Bun and Node)
export const nativeBinding = require(getBinaryPath());