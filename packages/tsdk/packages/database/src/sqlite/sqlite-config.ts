import type { BaseDbConfig } from '../core/types.js';

export interface SqliteConfig extends BaseDbConfig {
    authToken?: string;
    localPath?: string;
    maxConnections?: number;
}