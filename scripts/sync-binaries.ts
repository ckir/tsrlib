/**
 * @file scripts/sync-binaries.ts
 * @description Downloads the platform-specific rsdk binary from GitHub Releases.
 * Includes a bypass for local development when binaries are not yet hosted.
 */

import { existsSync, mkdirSync, chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { platform, arch } from 'node:os';

// 1. DEVELOPMENT BYPASS
// If we are developing locally and haven't pushed to GitHub yet, 
// we skip the download so 'pnpm install' doesn't fail.
if (process.env.TSR_DEV === 'true') {
  console.log('[tsrlib] Local development mode detected (TSR_DEV=true). Skipping binary sync.');
  process.exit(0);
}

const RSDK_VERSION = "v1.0.5"; 
const REPO_URL = "https://github.com/u/ckir/tsrlib/releases/download";

async function syncBinaries() {
  const currentPlatform = platform() === 'win32' ? 'windows' : platform();
  const currentArch = arch() === 'x64' ? 'x86_64' : arch();
  const nodeExtension = '.node';
  
  const binaryFileName = `rsdk-${currentPlatform}-${currentArch}${nodeExtension}`;
  const downloadUrl = `${REPO_URL}/${RSDK_VERSION}/${binaryFileName}`;
  
  const binDir = join(process.cwd(), '.bin');
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
  
  const targetPath = join(binDir, `rsdk${nodeExtension}`);

  console.log(`[tsrlib] Detected Environment: ${currentPlatform}-${currentArch}`);
  
  try {
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
      // If we are in the initial phase, provide a helpful error before failing
      throw new Error(`Release not found at ${downloadUrl}. Ensure the tag exists on GitHub.`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (typeof Bun !== 'undefined') {
      await Bun.write(targetPath, buffer);
    } else {
      writeFileSync(targetPath, buffer);
    }

    if (currentPlatform !== 'windows') {
      chmodSync(targetPath, 0o755);
    }
    
    console.log(`[tsrlib] Binary successfully installed to ${targetPath}`);
  } catch (error: any) {
    console.error(`[tsrlib] CRITICAL ERROR: Could not sync binaries: ${error.message}`);
    // Only fail if NOT in a known dev environment
    process.exit(1); 
  }
}

syncBinaries();