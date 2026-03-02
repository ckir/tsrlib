/**
 * @file scripts/cli.ts
 * @description CLI Tool for TSRLIB sidecar management.
 * Provides commands like 'tsrlib start vector' with automatic config discovery.
 */

import { Command } from 'commander';
import { spawn, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const program = new Command();

program
  .name('tsrlib')
  .description('TSRLIB Sidecar Management Utility')
  .version('1.0.0');

/**
 * Helper to manage the lifecycle of a sidecar process.
 * Ensures the sidecar dies when the parent Node/Bun process exits.
 */
function manageSidecar(name: string, binary: string, args: string[]) {
  console.log(chalk.blue(`[tsrlib] Starting ${name}...`));

  const child: ChildProcess = spawn(binary, args, {
    stdio: 'inherit',
    shell: true,
  });

  // Handle process termination to clean up sidecars
  const cleanup = () => {
    if (!child.killed) {
      console.log(chalk.yellow(`\n[tsrlib] Shutting down ${name} sidecar...`));
      child.kill();
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  child.on('error', (err) => {
    console.error(chalk.red(`[tsrlib] Failed to start ${name}:`), err);
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(chalk.red(`[tsrlib] ${name} exited with code ${code}`));
    }
  });
}

program
  .command('start')
  .description('Start a sidecar service (vector or caddy)')
  .argument('<sidecar>', 'The sidecar to start (vector|caddy)')
  .action((sidecar: string) => {
    const projectRoot = process.cwd();
    const service = sidecar.toLowerCase();

    if (service === 'vector') {
      // 1. Search for user config in their project root
      const userConfig = join(projectRoot, 'vector.toml');
      // 2. Fallback to the library's default config
      const defaultConfig = join(__dirname, '../packages/sidecars/vector/vector.toml');
      
      const configPath = existsSync(userConfig) ? userConfig : defaultConfig;
      const binaryPath = 'vector'; // Assumes 'vector' is in the system PATH

      console.log(chalk.gray(`[tsrlib] Using Vector config: ${configPath}`));
      manageSidecar('Vector', binaryPath, ['--config', configPath]);

    } else if (service === 'caddy') {
      const userConfig = join(projectRoot, 'Caddyfile');
      const defaultConfig = join(__dirname, '../packages/sidecars/caddy/Caddyfile');
      
      const configPath = existsSync(userConfig) ? userConfig : defaultConfig;
      const binaryPath = 'caddy';

      console.log(chalk.gray(`[tsrlib] Using Caddy config: ${configPath}`));
      manageSidecar('Caddy', binaryPath, ['run', '--config', configPath]);

    } else {
      console.error(chalk.red(`[tsrlib] Unknown sidecar: ${sidecar}`));
      console.log('Available sidecars: vector, caddy');
      process.exit(1);
    }
  });

program.parse();