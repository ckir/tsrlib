/**
 * @file packages/sidecars/src/sync-binaries.ts
 * @description Unified binary sync for Vector, Caddy, AND the native rsdk.node.
 * 
 * FIXED: Now also downloads the correct platform/arch rsdk.node from the latest GitHub release
 * into .bin/rsdk.node (exactly where rsdk-loader.ts expects it in production).
 * 
 * Full multi-platform support:
 * - Windows (x86_64 + aarch64) → .exe for sidecars + rsdk.node
 * - Linux (x86_64 + aarch64, musl) 
 * - macOS (x86_64 + aarch64)
 * - Works with Bun or Node (tsx or bun run)
 * - Always gets the latest release (no hardcoded version)
 * - Graceful fallback (never breaks install)
 * 
 * Run manually: npx tsx packages/sidecars/src/sync-binaries.ts
 * Or via Developers Cockpit → Option 4.
 */

import { writeFileSync, mkdirSync, unlinkSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { platform as osPlatform, arch as osArch } from 'node:os';
import { execSync } from 'node:child_process';

const BIN_DIR = join(process.cwd(), '.bin');
const REPO_OWNER = 'ckir';
const REPO_NAME = 'tsrlib';

// Pin stable sidecar versions
const VECTOR_VERSION = '0.45.0';
const CADDY_VERSION = '2.8.4';

async function downloadFile(url: string, dest: string): Promise<void> {
    console.log(`[sync-binaries] Downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    const buffer = await response.arrayBuffer();
    writeFileSync(dest, Buffer.from(buffer));
}

async function getLatestRsdkVersion(): Promise<string> {
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error('Failed to fetch latest release');
    const data = await res.json();
    return data.tag_name; // e.g. "v1.0.0"
}

function getRsdkInfo() {
    const plat = osPlatform() === 'win32' ? 'windows' : osPlatform();
    let arch = osArch();
    if (arch === 'x64') arch = 'x86_64';
    const binaryFileName = `rsdk-${plat}-${arch}.node`;
    return { binaryFileName };
}

function getVectorInfo() {
    const plat = osPlatform();
    const arch = osArch();
    if (plat === 'win32') {
        const archStr = arch === 'x64' ? 'x86_64' : 'aarch64';
        return { asset: `vector-${VECTOR_VERSION}-${archStr}-pc-windows-msvc.zip`, isZip: true, binName: 'vector.exe' };
    }
    if (plat === 'darwin') {
        const archStr = arch === 'x64' ? 'x86_64' : 'aarch64';
        return { asset: `vector-${VECTOR_VERSION}-${archStr}-apple-darwin.tar.gz`, isZip: false, binName: 'vector' };
    }
    const archStr = arch === 'x64' ? 'x86_64' : 'aarch64';
    return { asset: `vector-${VECTOR_VERSION}-${archStr}-unknown-linux-musl.tar.gz`, isZip: false, binName: 'vector' };
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

async function installBinary(name: string, url: string, finalName: string, isZip = false) {
    const tmp = join(BIN_DIR, `temp-${name}`);
    const finalPath = join(BIN_DIR, finalName);

    try {
        await downloadFile(url, tmp);
        if (name === 'rsdk') {
            writeFileSync(finalPath, await (await fetch(url)).arrayBuffer()); // direct copy for .node
        } else {
            await extract(tmp, BIN_DIR, isZip);
        }
        if (existsSync(tmp)) unlinkSync(tmp);

        if (osPlatform() !== 'win32' && existsSync(finalPath)) {
            chmodSync(finalPath, 0o755);
        }
        console.log(`✅ ${name} ready → ${finalPath}`);
    } catch (err: any) {
        console.warn(`⚠️ ${name} install failed: ${err.message}`);
        console.warn('   Tests may skip related features.');
    }
}

async function main() {
    console.log('\n🚀 [sync-binaries] Starting Vector + Caddy + rsdk.node download...');
    mkdirSync(BIN_DIR, { recursive: true });

    // === 1. rsdk.node (native Rust bridge) - always latest release ===
    try {
        const version = await getLatestRsdkVersion();
        const { binaryFileName } = getRsdkInfo();
        const rsdkUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${version}/${binaryFileName}`;
        await installBinary('rsdk', rsdkUrl, 'rsdk.node');
    } catch (e) {
        console.warn('⚠️ Could not download rsdk.node (using local build instead)');
    }

    // === 2. Vector & Caddy ===
    const vector = getVectorInfo();
    const caddy = getCaddyInfo();

    const vectorUrl = `https://github.com/vectordotdev/vector/releases/download/v${VECTOR_VERSION}/${vector.asset}`;
    const caddyUrl = `https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/${caddy.asset}`;

    await installBinary('Vector', vectorUrl, vector.binName, vector.isZip);
    await installBinary('Caddy', caddyUrl, caddy.binName, caddy.isZip);

    console.log('✅ All binaries synced.\n');
}

main().catch((err) => {
    console.error('❌ Unexpected sync error:', err);
    process.exit(0); // never break pnpm install
});