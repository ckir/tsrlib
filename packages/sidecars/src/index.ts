import { spawn, ChildProcess } from 'child_process';
import path from 'path';

export class SidecarManager {
  private processes: Map<string, ChildProcess> = new Map();

  async startVector(configPath: string) {
    // Logic to find binary in .bin/ and start with config
    console.log(`[Sidecar] Starting Vector with config: ${configPath}`);
  }

  stopAll() {
    this.processes.forEach(p => p.kill());
    console.log('[Sidecar] All sidecars stopped.');
  }
}
