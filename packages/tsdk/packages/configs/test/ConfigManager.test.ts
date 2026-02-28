import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from '../src/ConfigManager.js';
import { getPlatform, getMode } from '../src/ConfigUtils.js';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ConfigManager Integration Tests', () => {
  let tempDir: string;
  let testConfigPath: string;
  const appName = 'test-app';

  beforeEach(() => {
    // 1. Create a safe temporary directory for file operations
    tempDir = mkdtempSync(join(tmpdir(), 'tsrlib-test-'));
    testConfigPath = join(tempDir, 'test-config.json');

    // 2. Mock process.cwd() so getAppName() reads from our temporary directory
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

    // 3. Reset Singleton and Global State
    (ConfigManager as any).instance = undefined;
    delete (globalThis as any).sysconfig;

    // 4. Mock Process Environment
    process.env.NODE_ENV = 'development';
    process.env.TSRLIB_AES_PASSWORD = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    
    // 5. Create a mock package.json in the isolated temp directory to control getAppName()
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: appName }));
  });

  afterEach(() => {
    // Restore the original process.cwd() and other mocked functions
    vi.restoreAllMocks();

    // Clean up the temporary directory to avoid cluttering the OS temp folder
    rmSync(tempDir, { recursive: true, force: true });

    // Clear CLI args added during tests to prevent leaking state between tests
    process.argv = process.argv.slice(0, 2); 
  });

  it('should initialize with globalThis.sysconfig as an "Active Object"', async () => {
    const manager = ConfigManager.getInstance();
    await manager.initialize();

    // Cast globalThis to any to bypass the missing index signature error
    expect((globalThis as any).sysconfig).toBeDefined();
    expect((globalThis as any).sysconfig).toBe(manager.getConfig ? manager.getConfig() : (manager as any)._config);
  });

  it('should follow hierarchy: commonAll -> App -> Platform -> Mode', async () => {
    // Fetch the actual platform and mode values so the test dynamically adapts 
    // to whatever OS it is currently running on (e.g. windows vs linux)
    const currentPlatform = getPlatform();
    const currentMode = getMode();

    const mockData = {
      commonAll: { 
        version: "1.0", 
        tags: ["base"],
        db: { port: 3306, host: "localhost" } 
      },
      [appName]: {
        common: { db: { host: "127.0.0.1" } },
        // Construct the expected hierarchy using the dynamic environment variables
        [currentPlatform]: { 
          [currentMode]: { 
            db: { port: 8080 },
            tags: ["dev", "web"] // Should overwrite ["base"]
          }
        }
      }
    };
    
    writeFileSync(testConfigPath, JSON.stringify(mockData));

    const manager = ConfigManager.getInstance();
    process.argv.push('-C', testConfigPath);
    
    await manager.initialize();
    const config = (globalThis as any).sysconfig;

    // Assertions
    expect(config.db.host).toBe("127.0.0.1"); // App common wins
    expect(config.db.port).toBe(8080); // Mode wins
    expect(config.tags).toEqual(["dev", "web"]); // deepmerge-ts Overwrite check (no "base")
  });

  it('should prioritize CLI flags over File and Env', async () => {
    const mockData = { commonAll: { server: { port: 3000 } } };
    writeFileSync(testConfigPath, JSON.stringify(mockData));

    // Env says 4000
    process.env.TSRLIB_SERVER_PORT = "4000";
    // CLI says 5000
    process.argv.push('-C', testConfigPath, '--server-port', '5000');

    const manager = ConfigManager.getInstance();
    await manager.initialize();

    expect((globalThis as any).sysconfig.server.port).toBe(5000);
    delete process.env.TSRLIB_SERVER_PORT;
  });

  it('should emit events on updateValue (Active Object behavior)', async () => {
    const manager = ConfigManager.getInstance();
    await manager.initialize();

    const changeSpy = vi.fn();
    manager.on('change:ui.theme', changeSpy);

    manager.updateValue('ui.theme', 'dark');

    expect(changeSpy).toHaveBeenCalledWith('dark');
    expect((globalThis as any).sysconfig.ui.theme).toBe('dark');
  });

  it('should parse complex JSON strings from CLI/Env', async () => {
    const manager = ConfigManager.getInstance();
    
    // Simulate complex array from CLI
    process.argv.push('--allowed-origins', '["http://localhost", "https://app.com"]');
    
    await manager.initialize();

    expect((globalThis as any).sysconfig.allowed.origins).toBeInstanceOf(Array);
    expect((globalThis as any).sysconfig.allowed.origins).toContain("https://app.com");
  });
});