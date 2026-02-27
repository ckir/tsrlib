import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let sidecars: ChildProcess | null = null;

export async function setup() {
  console.log('\n🚀 Starting Sidecars (Vector & Caddy) for Integration Tests...');
  
  // Launch the start-sidecars script using tsx
  sidecars = spawn('pnpm', ['tsx', 'scripts/start-sidecars.ts'], {
    cwd: path.resolve(__dirname, '../../../'),
    stdio: 'inherit',
    shell: true
  });

  // Give the sidecars 2 seconds to bind to ports 9000 (Vector) and 8080 (Caddy)
  await new Promise(resolve => setTimeout(resolve, 2000));
}

export async function teardown() {
  console.log('\n🛑 Shutting down Sidecars...');
  if (sidecars) {
    sidecars.kill('SIGINT');
  }
}