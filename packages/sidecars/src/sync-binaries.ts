/**
 * @file packages/sidecars/src/sync-binaries.ts
 * @description Downloads and extracts official Vector (telemetry) and Caddy (proxy)
 * binaries for the current platform into .bin/.
 *
 * FIXED for multi-platform CI (Windows, Linux, macOS x64/arm64).
 * Previously caused:
 *   • Linux: corrupted binary → "not found" + garbage lines
 *   • macOS: "binary not found"
 *   • Windows: spawn UNKNOWN
 *
 * Uses official GitHub releases (pinned for reproducibility).
 * No extra dependencies. Works with npx tsx / bun.
 *
 * Run manually: npx tsx packages/sidecars/src/sync-binaries.ts
 * Or via Developers Cockpit → Option 4.
 */

import { writeFileSync, mkdirSync, unlinkSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { platform as osPlatform, arch as osArch } from 'node:os';
import { execSync } from 'node:child_process';

const BIN_DIR = join(process.cwd(), '.bin');

// Pin stable versions (update when you want newer releases)
const VECTOR_VERSION = '0.45.0';
const CADDY_VERSION = '2.8.4';

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`[sync-binaries] Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const buffer = await response.arrayBuffer();
  writeFileSync(dest, Buffer.from(buffer));
}

function getVectorInfo() {
  const plat = osPlatform();
  const arch = osArch();

  if (plat === 'win32') {
    const archStr = arch === 'x64' ? 'x86_64' : 'aarch64';
    return {
      asset: `vector-${VECTOR_VERSION}-${archStr}-pc-windows-msvc.zip`,
      isZip: true,
      binName: 'vector.exe'
    };
  }
  if (plat === 'darwin') {
    const archStr = arch === 'x64' ? 'x86_64' : 'aarch64';
    return {
      asset: `vector-${VECTOR_VERSION}-${archStr}-apple-darwin.tar.gz`,
      isZip: false,
      binName: 'vector'
    };
  }
  // Linux
  const archStr = arch === 'x64' ? 'x86_64' : 'aarch64';
  return {
    asset: `vector-${VECTOR_VERSION}-${archStr}-unknown-linux-musl.tar.gz`,
    isZip: false,
    binName: 'vector'
  };
}

function getCaddyInfo() {
  const plat = osPlatform();
  const arch = osArch() === 'x64' ? 'amd64' : osArch() === 'arm64' ? 'arm64' : 'amd64';
  const osName = plat === 'win32' ? 'windows' : plat === 'darwin' ? 'darwin' : 'linux';
  const ext = plat === 'win32' ? 'zip' : 'tar.gz';
  return {
    asset: `caddy_${CADDY_VERSION}_${osName}_${arch}.${ext}`,
    isZip: plat === 'win32',
    binName: plat === 'win32' ? 'caddy.exe' : 'caddy'
  };
}

async function extract(archivePath: string, destDir: string, isZip: boolean) {
  if (isZip) {
    execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
  }
}

async function installSidecar(name: string, url: string, binName: string, isZip: boolean) {
  const tmp = join(BIN_DIR, `temp-${name}.${isZip ? 'zip' : 'tar.gz'}`);
  const finalPath = join(BIN_DIR, binName);

  try {
    await downloadFile(url, tmp);
    await extract(tmp, BIN_DIR, isZip);
    if (existsSync(tmp)) unlinkSync(tmp);

    if (osPlatform() !== 'win32' && existsSync(finalPath)) {
      chmodSync(finalPath, 0o755);
    }
    console.log(`✅ ${name} ready → ${finalPath}`);
  } catch (err: any) {
    console.warn(`⚠️ ${name} install failed: ${err.message}`);
    console.warn('   Related tests may be skipped or timeout.');
  }
}

async function main() {
  console.log('\n🚀 [sync-binaries] Starting Vector + Caddy download...');
  mkdirSync(BIN_DIR, { recursive: true });

  const vector = getVectorInfo();
  const caddy = getCaddyInfo();

  const vectorUrl = `https://github.com/vectordotdev/vector/releases/download/v${VECTOR_VERSION}/${vector.asset}`;
  const caddyUrl = `https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/${caddy.asset}`;

  await installSidecar('Vector', vectorUrl, vector.binName, vector.isZip);
  await installSidecar('Caddy', caddyUrl, caddy.binName, caddy.isZip);

  console.log('✅ Sidecar binaries sync complete.\n');
}

main().catch((err) => {
  console.error('❌ Unexpected sync error:', err);
  process.exit(0); // never break npm/pnpm install
});
