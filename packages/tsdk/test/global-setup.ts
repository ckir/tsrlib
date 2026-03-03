import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

let vectorProc: ChildProcess | undefined;
let caddyProc: ChildProcess | undefined;

export async function setup() {
    console.log('\n🚀 Starting Sidecars for Integration Tests...');

    // Determine OS-specific executable extension
    const isWindows = process.platform === 'win32';
    const ext = isWindows ? '.exe' : '';

    // Windows-specific port cleanup to prevent 'os error 10048'
    if (isWindows) {
        try {
            // Kill any process using Vector (9000/9001) or Caddy (8080/2019) ports
            execSync(`taskkill /F /IM vector${ext} /T`, { stdio: 'ignore' });
            execSync(`taskkill /F /IM caddy${ext} /T`, { stdio: 'ignore' });
        } catch (e) {
            // Ignore errors if processes weren't running
        }
    }

    const binDir = path.resolve(process.cwd(), '.bin');
    const vectorConfig = path.resolve(process.cwd(), 'packages/sidecars/vector/vector.toml');
    const caddyConfig = path.resolve(process.cwd(), 'packages/sidecars/caddy/Caddyfile');

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

    // Give them a moment to bind to ports
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Sidecars setup complete.');
}

export async function teardown() {
    console.log('\n🛑 Shutting down sidecars...');
    if (vectorProc && !vectorProc.killed) vectorProc.kill();
    if (caddyProc && !caddyProc.killed) caddyProc.kill();
}