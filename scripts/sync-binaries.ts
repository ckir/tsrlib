import { writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { platform, arch } from 'node:os';
import { fileURLToPath } from 'node:url';

/**
 * sync-binaries.ts
 * This script handles the downloading of platform-specific Rust FFI binaries (.node files).
 * It is designed to run during the 'prepare' or 'postinstall' phase of the package lifecycle.
 */

// Get the absolute path of the directory where this script/file resides.
// When compiled by tsup, this file moves from /scripts to /dist.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration constants
const RSDK_VERSION = "v1.0.5"; 
const REPO_URL = "https://github.com/ckir/tsrlib/releases/download";

async function syncBinaries() {
  // 1. DEVELOPMENT BYPASS
  // If we are developing locally, we don't want to overwrite our local build with a downloaded one.
  if (process.env.TSR_DEV === 'true') {
    console.log('[tsrlib] Local development mode (TSR_DEV=true). Skipping binary download.');
    process.exit(0);
  }

  // 2. ENVIRONMENT DETECTION
  const currentPlatform = platform() === 'win32' ? 'windows' : platform();
  const currentArch = arch() === 'x64' ? 'x86_64' : arch();
  const nodeExtension = '.node';
  
  // Example filename: rsdk-windows-x86_64.node
  const binaryFileName = `rsdk-${currentPlatform}-${currentArch}${nodeExtension}`;
  const downloadUrl = `${REPO_URL}/${RSDK_VERSION}/${binaryFileName}`;
  
  // We save the binary directly into the 'dist' folder.
  // This matches the 'rsdk-loader.ts' logic which looks in __dirname.
  const targetPath = join(__dirname, `rsdk${nodeExtension}`);

  console.log(`[tsrlib] Environment detected: ${currentPlatform}-${currentArch}`);
  console.log(`[tsrlib] Target destination: ${targetPath}`);

  try {
    console.log(`[tsrlib] Fetching binary from GitHub: ${downloadUrl}`);
    
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
      console.warn(`[tsrlib] WARNING: Binary ${binaryFileName} not found at ${downloadUrl}.`);
      console.warn(`[tsrlib] The library may fail at runtime if a local binary is not provided.`);
      return; 
    }
    
    // Process the stream as a buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Write to disk
    // We use standard Node writeFileSync to ensure zero dependencies for the consumer
    writeFileSync(targetPath, buffer);

    // 3. PERMISSIONS
    // On Linux/macOS, we must ensure the .node file is executable
    if (currentPlatform !== 'windows') {
      try {
        chmodSync(targetPath, 0o755);
      } catch (e) {
        console.warn('[tsrlib] Could not set executable permissions on binary.');
      }
    }
    
    console.log(`[tsrlib] Successfully installed native binary.`);
  } catch (error: any) {
    console.error(`[tsrlib] ERROR: Binary synchronization failed.`);
    console.error(`[tsrlib] Detail: ${error.message}`);
    process.exit(0); // Exit gracefully so package installation doesn't hard-fail
  }
}

// Execute
syncBinaries();