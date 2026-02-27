import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export class SidecarManager {
  private processes: Map<string, ChildProcess> = new Map();

  private getBinPath(name: string): string {
    const ext = process.platform === 'win32' ? '.exe' : '';
    return path.resolve(process.cwd(), '.bin', `${name}${ext}`);
  }

  async startVector() {
    const bin = this.getBinPath('vector');
    const config = path.resolve(process.cwd(), 'packages/sidecars/vector/vector.toml');
    if (!fs.existsSync(bin)) throw new Error(`Vector binary missing`);

    console.log('📊 Starting Vector...');
    // We remove shell: true and pass args as an array for security and stability
    const proc = spawn(bin, ['--config', config], { stdio: 'inherit' });
    this.processes.set('vector', proc);
  }

  async startCaddy() {
    const bin = this.getBinPath('caddy');
    const config = path.resolve(process.cwd(), 'packages/sidecars/caddy/Caddyfile');
    if (!fs.existsSync(bin)) throw new Error(`Caddy binary missing`);

    console.log('🚀 Starting Caddy...');
    const proc = spawn(bin, ['run', '--config', config, '--adapter', 'caddyfile'], { 
        stdio: 'inherit' 
    });
    this.processes.set('caddy', proc);
  }

  stopAll() {
    console.log('🛑 Shutting down sidecars...');
    this.processes.forEach((p) => p.kill());
    this.processes.clear();
  }
}
