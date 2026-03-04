import fs, { writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { platform, arch } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

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
  // 1. DEVELOPMENT MODE
  if (process.env.TSR_DEV === 'true') {
    console.log('[tsrlib] Local development mode (TSR_DEV=true). Building native binary...');
    try {
      execSync('cd packages/rsdk/crates/ffi-adapter && npx napi build --platform --release --output-dir ../../../tsdk/src', { stdio: 'inherit' });
      // Align the binary
      const srcDir = join(__dirname, '../packages/tsdk/src');
      let generatedFile;
      try {
        const files = fs.readdirSync(srcDir);
        generatedFile = files.find((f: string) => f.endsWith('.node') && f !== 'rsdk.node');
      } catch (e: any) {
        console.error('[tsrlib] Error reading src directory:', e.message);
      }
      if (generatedFile) {
        const oldPath = join(srcDir, generatedFile);
        const newPath = join(srcDir, 'rsdk.node');
        fs.renameSync(oldPath, newPath);
        console.log('[tsrlib] Aligned binary:', generatedFile, '-> rsdk.node');
        if (platform() !== 'win32') {
          chmodSync(newPath, 0o755);
        }
      } else {
        console.warn('[tsrlib] No generated .node file found after build!');
      }
      // Remove conflicting wrapper files
      const filesToRemove = ['index.js', 'index.d.ts', 'rsdk.js', 'rsdk.d.ts'];
      filesToRemove.forEach((file: string) => {
        const filePath = join(srcDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('[tsrlib] Removed conflicting file:', file);
        }
      });
    } catch (e: any) {
      console.error('[tsrlib] Failed to build native binary in dev mode:', e.message);
      process.exit(0); // Exit gracefully
    }
    return;
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
      } catch (e: any) {
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