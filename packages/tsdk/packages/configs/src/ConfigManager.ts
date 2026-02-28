import { EventEmitter } from 'node:events';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepmergeCustom } from 'deepmerge-ts';
import yargs from 'yargs';
import { serializeError } from 'serialize-error';
import { 
    getPlatform, 
    getMode, 
    decryptConfig
} from './ConfigUtils.js';

/**
 * Custom merger: Overwrites leaf properties (primitives and arrays) 
 * instead of merging them, as per requirements.
 */
const leafMerger = deepmergeCustom({
    mergeArrays: false,
});

/**
 * ConfigManager handles the lifecycle of the application's configuration.
 * It manages globalThis.sysconfig and provides an event-driven interface 
 * for runtime updates.
 * * Priority: CLI > Environment Variables > Config Files > Defaults
 */
export class ConfigManager extends EventEmitter {
    private static instance: ConfigManager;
    private _config: any = {};
    private _defaultsPath: string;

    private constructor() {
        super();
        const __dirname = dirname(fileURLToPath(import.meta.url));
        this._defaultsPath = join(__dirname, 'ConfigManager.json');
        
        // Initialize the Global Active Object if not already present
        if (!(globalThis as any).sysconfig) {
            (globalThis as any).sysconfig = this._config;
        }
    }

    /**
     * Singleton accessor for the ConfigManager
     */
    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /**
     * Main initialization sequence.
     * 1. Load Defaults
     * 2. Detect CLI -C flag for external config
     * 3. Process Hierarchy (commonAll -> app -> platform -> mode)
     * 4. Apply Env Overrides
     * 5. Apply CLI Overrides
     */
    public async initialize(): Promise<void> {
        // 1. Hardcoded Defaults
        this.loadDefaults();

        // Manual extraction of arguments instead of yargs/helpers
        const args = process.argv.slice(2);

        // 2. Determine if a config file is specified via CLI (-C)
        const argv = await yargs(args).help(false).argv;
        const configPath = argv.C as string | undefined;

        if (configPath) {
            const externalData = await this.fetchExternalConfig(configPath);
            this.processHierarchy(externalData);
        }

        // 3. Apply Environment Variables (TSRLIB_ prefix)
        this.applyEnvOverrides();

        // 4. Apply CLI Overrides (maps kebab-case to config structure)
        await this.applyCliOverrides(args);

        // Finalize global object reference
        (globalThis as any).sysconfig = this._config;
        this.emit('initialized', this._config);
    }

    /**
     * Retrieves the current active configuration object.
     * @returns {any} The current configuration state.
     */
    public getConfig(): any {
        return this._config;
    }

    /**
     * Loads the base ConfigManager.json from the local directory
     */
    private loadDefaults(): void {
        if (existsSync(this._defaultsPath)) {
            try {
                const raw = readFileSync(this._defaultsPath, 'utf8');
                this._config = JSON.parse(raw);
            } catch (e) {
                this.logError('Failed to load defaults', e);
            }
        }
    }

    /**
     * Fetches and parses configuration from a URL or Local Path.
     * Supports .enc decryption and dynamic confbox parsing by extension.
     */
    private async fetchExternalConfig(source: string): Promise<any> {
        let content: string;

        if (source.startsWith('http')) {
            // Tree-shakable dynamic import for RequestUnlimited
            const { default: RequestUnlimited } = await import('../../retrieve/src/RequestUnlimited.js' as any);
            const loader = new RequestUnlimited();
            content = await loader.fetch(source);
        } else {
            content = readFileSync(source, 'utf8');
        }

        const lowerSource = source.toLowerCase();

        if (lowerSource.endsWith('.enc')) {
            return decryptConfig(content);
        }

        // Tree-shakable dynamic import for confbox
        const confbox = await import('confbox');

        // Detect filetype and parse
        if (lowerSource.endsWith('.yaml') || lowerSource.endsWith('.yml')) {
            return confbox.parseYAML(content);
        }
        if (lowerSource.endsWith('.toml')) {
            return confbox.parseTOML(content);
        }
        if (lowerSource.endsWith('.json5')) {
            return confbox.parseJSON5(content);
        }
        if (lowerSource.endsWith('.jsonc')) {
            return confbox.parseJSONC(content);
        }
        if (lowerSource.endsWith('.ini')) {
            return confbox.parseINI(content);
        }
        
        // Fallback to standard JSON
        return confbox.parseJSON(content);
    }

    /**
     * Processes the specific hierarchy:
     * commonAll -> [AppName].common -> [AppName].[platform] -> [AppName].[platform].[mode]
     */
    private processHierarchy(data: any): void {
        if (!data) return;

        const appName = this.getAppName();
        const platform = getPlatform(); // linux | windows
        const mode = getMode();         // development | production

        // Start with commonAll as base
        let layeredConfig = data.commonAll || {};

        // Find App Section (Case Insensitive)
        const appKey = Object.keys(data).find(k => k.toLowerCase() === appName.toLowerCase());
        const appSection = appKey ? data[appKey] : null;

        if (appSection) {
            // Layer 1: App Common
            if (appSection.common) {
                layeredConfig = leafMerger(layeredConfig, appSection.common);
            }

            // Layer 2: Platform
            const platformSection = appSection[platform];
            if (platformSection) {
                // Layer 3: Mode
                const modeSection = platformSection[mode];
                if (modeSection) {
                    layeredConfig = leafMerger(layeredConfig, modeSection);
                }
            }
        }

        this._config = leafMerger(this._config, layeredConfig);
    }

    /**
     * Maps TSRLIB_ prefixed environment variables to config keys.
     * Example: TSRLIB_DB_PORT -> config.db.port
     */
    private applyEnvOverrides(): void {
        const prefix = 'TSRLIB_';
        Object.keys(process.env).forEach(envKey => {
            if (envKey.startsWith(prefix)) {
                const configPath = envKey.slice(prefix.length).toLowerCase().replace(/_/g, '.');
                const value = this.parseValue(process.env[envKey]);
                this.setPath(this._config, configPath, value);
            }
        });
    }

    /**
     * Maps Kebab-case CLI arguments to the config structure.
     */
    private async applyCliOverrides(args: string[]): Promise<void> {
        const argv = await yargs(args).argv;
        
        // Iterate through all CLI flags
        Object.keys(argv).forEach(key => {
            if (key === '_' || key === '$0' || key === 'C') return;
            
            // Convert kebab-case to dot.notation
            const configPath = key.replace(/-/g, '.');
            const value = this.parseValue(argv[key]);
            
            this.updateValue(configPath, value);
        });
    }

    /**
     * Core update method that updates both the local object 
     * and the active globalThis object, then emits events.
     */
    public updateValue(path: string, value: any): void {
        this.setPath(this._config, path, value);
        this.emit('change', { path, value });
        this.emit(`change:${path}`, value);
    }

    /**
     * Helper to set nested object values by string path (e.g., "db.mysql.port")
     */
    private setPath(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        let current = obj;
        
        while (keys.length > 1) {
            const key = keys.shift()!;
            if (!(key in current)) current[key] = {};
            current = current[key];
        }
        
        current[keys[0]] = value;
    }

    /**
     * Parses values from Env/CLI, automatically handling JSON strings for arrays/objects.
     */
    private parseValue(val: any): any {
        if (typeof val !== 'string') return val;
        
        if ((val.startsWith('[') && val.endsWith(']')) || (val.startsWith('{') && val.endsWith('}'))) {
            try { 
                return JSON.parse(val);
            } catch (e) { 
                this.logError('Failed to parse complex JSON from CLI/Env flag', e);
                return val; 
            }
        }
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
        if (!isNaN(Number(val)) && val.trim() !== '') return Number(val);
        
        return val;
    }

    private getAppName(): string {
        try {
            const pkgPath = join(process.cwd(), 'package.json');
            return JSON.parse(readFileSync(pkgPath, 'utf8')).name || 'default-app';
        } catch (e) {
            this.logError('Failed to parse package.json for app name. Falling back to default-app', e);
            return 'default-app';
        }
    }

    /**
     * Logs errors internally. If the global pino logger is available, it uses it
     * along with `serialize-error` to structure the error object for Vector sidecars.
     */
    private logError(msg: string, error?: unknown): void {
        const serialized = error ? serializeError(error) : undefined;
        if ((globalThis as any).logger) {
            (globalThis as any).logger.error({ msg, error: serialized });
        } else {
            console.error(`❌ [ConfigManager] ${msg}`, serialized || '');
        }
    }

    // --- Rust Integration Helpers ---

    public toJsonString(): string {
        return JSON.stringify(this._config);
    }

    public toBuffer(): Buffer {
        return Buffer.from(this.toJsonString());
    }
}