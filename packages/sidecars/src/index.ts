import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export class SidecarManager {
  private processes: Map<string, ChildProcess> = new Map();

  private getBinPath(name: string): string {
    const ext = process.platform === 'win32' ? '.exe' : '';
    return path.join(process.cwd(), '.bin', `${name}${ext}`);
  }

  async startCaddy() {
    const bin = this.getBinPath('caddy');
    const config = path.join(process.cwd(), 'packages/sidecars/caddy/Caddyfile');

    if (!fs.existsSync(bin)) {
        throw new Error("Caddy binary missing. Run 'Sync Sidecar Binaries' first.");
    }

    const proc = spawn(bin, ['run', '--config', config, '--adapter', 'caddyfile'], {
      stdio: 'inherit',
      shell: true
    });

    this.processes.set('caddy', proc);
    console.log('🚀 Caddy Reverse Proxy is running on http://localhost:8080');
  }

  stopAll() {
    this.processes.forEach((p, name) => {
      p.kill();
      console.log(`[Sidecar] Stopped ${name}`);
    });
    this.processes.clear();
  }
}
