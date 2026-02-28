import { spawn, execSync } from 'child_process';
import path from 'path';

let vectorProc: any;
let caddyProc: any;

export async function setup() {
    console.log('\n🚀 Starting Sidecars for Integration Tests...');

    // Windows-specific port cleanup to prevent 'os error 10048'
    if (process.platform === 'win32') {
        try {
            // Kill any process using Vector (9000/9001) or Caddy (8080/2019) ports
            execSync('taskkill /F /IM vector.exe /T', { stdio: 'ignore' });
            execSync('taskkill /F /IM caddy.exe /T', { stdio: 'ignore' });
        } catch (e) {
            // Ignore errors if processes weren't running
        }
    }

    const binDir = path.resolve(process.cwd(), '.bin');
    const vectorConfig = path.resolve(process.cwd(), 'packages/sidecars/vector/vector.toml');
    const caddyConfig = path.resolve(process.cwd(), 'packages/sidecars/caddy/Caddyfile');

    vectorProc = spawn(path.join(binDir, 'vector.exe'), ['--config', vectorConfig], { stdio: 'inherit' });
    caddyProc = spawn(path.join(binDir, 'caddy.exe'), ['run', '--config', caddyConfig, '--adapter', 'caddyfile'], { stdio: 'inherit' });

    // Give them a moment to bind to ports
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Sidecars active.');
}

export async function teardown() {
    console.log('\n🛑 Shutting down sidecars...');
    vectorProc?.kill();
    caddyProc?.kill();
}