import { existsSync, mkdirSync, chmodSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { platform, arch } from 'node:os';
import { fileURLToPath } from 'node:url';

// Get the absolute path of the current file's directory (will be /dist when compiled)
const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. DEVELOPMENT BYPASS
if (process.env.TSR_DEV === 'true') {
  console.log('[tsrlib] Local development mode detected (TSR_DEV=true). Skipping binary sync.');
  process.exit(0);
}

const RSDK_VERSION = "v1.0.5"; 
const REPO_URL = "https://github.com/ckir/tsrlib/releases/download";

async function syncBinaries() {
  const currentPlatform = platform() === 'win32' ? 'windows' : platform();
  const currentArch = arch() === 'x64' ? 'x86_64' : arch();
  const nodeExtension = '.node';
  
  const binaryFileName = `rsdk-${currentPlatform}-${currentArch}${nodeExtension}`;
  const downloadUrl = `${REPO_URL}/${RSDK_VERSION}/${binaryFileName}`;
  
  // Save directly to the directory where this script lives (the /dist folder)
  const targetPath = join(__dirname, `rsdk${nodeExtension}`);

  console.log(`[tsrlib] Detected Environment: ${currentPlatform}-${currentArch}`);
  
  try {
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
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
    process.exit(1); 
  }
}

syncBinaries();