/**
 * @file packages/tsdk/test/global-setup.ts
 * @description Vitest global setup/teardown for integration tests.
 * 
 * FIXED: Added cross-platform port cleanup for Linux + macOS (pkill).
 * Previously only Windows had cleanup → flaky "address already in use" on Linux/macOS CI and local runs.
 * 
 * Full support now:
 * - Windows: taskkill
 * - Linux/macOS: pkill -f (safe with || true)
 * - Bun/Node: identical (child_process works the same)
 */

import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

let vectorProc: ChildProcess | undefined;
let caddyProc: ChildProcess | undefined;

export async function setup() {
    console.log('\n🚀 Starting Sidecars for Integration Tests...');

    // === CROSS-PLATFORM PORT CLEANUP (Windows + Linux + macOS) ===
    const isWindows = process.platform === 'win32';
    if (isWindows) {
        try {
            execSync('taskkill /F /IM vector.exe /T', { stdio: 'ignore' });
            execSync('taskkill /F /IM caddy.exe /T', { stdio: 'ignore' });
        } catch (_) {}
    } else {
        // Linux + macOS (pkill is available on both)
        try {
            execSync('pkill -9 -f vector || true', { stdio: 'ignore' });
            execSync('pkill -9 -f caddy || true', { stdio: 'ignore' });
        } catch (_) {}
    }

    const binDir = path.resolve(process.cwd(), '.bin');
    const vectorConfig = path.resolve(process.cwd(), 'packages/sidecars/vector/vector.toml');
    const caddyConfig = path.resolve(process.cwd(), 'packages/sidecars/caddy/Caddyfile');

    const ext = isWindows ? '.exe' : '';
    const vectorBin = path.join(binDir, `vector${ext}`);
    const caddyBin = path.join(binDir, `caddy${ext}`);

    // Safely spawn Vector
    if (fs.existsSync(vectorBin)) {
        vectorProc = spawn(vectorBin, ['--config', vectorConfig], { stdio: 'inherit' });
    } else {
        console.warn(`⚠️ Vector binary not found at ${vectorBin}. Telemetry tests may fail or timeout.`);
    }

    // Safely spawn Caddy
    if (fs.existsSync(caddyBin)) {
        caddyProc = spawn(caddyBin, ['run', '--config', caddyConfig, '--adapter', 'caddyfile'], { stdio: 'inherit' });
    } else {
        console.warn(`⚠️ Caddy binary not found at ${caddyBin}. Proxy tests may fail.`);
    }

    // Give them time to bind ports
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Sidecars setup complete.');
}

export async function teardown() {
    console.log('\n🛑 Shutting down sidecars...');
    if (vectorProc && !vectorProc.killed) vectorProc.kill();
    if (caddyProc && !caddyProc.killed) caddyProc.kill();
}