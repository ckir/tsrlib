/**
 * packages/tsdk/packages/markets/src/Nasdaq/Datafeeds/Streaming/Yahoo/YahooStreaming.ts
 */
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { DateTime } from 'luxon';
import { serializeError } from 'serialize-error';
import { LoggersSection } from '@tsrlib/loggers';
import { DatabaseModule } from '@tsrlib/database';
import { fromBinary } from "@bufbuild/protobuf";
import { PricingDataSchema } from "./generated/yaticker_pb.js";

/**
 * Configuration options for the YahooStreaming module.
 */
export interface YahooStreamingOptions {
    db: DatabaseModule;
    /** Silence timeout in seconds before forcing a reconnect. Default: 60 */
    silenceTimeoutSec?: number;
    /** Interval in seconds for logging summary metrics. Default: 3600 (1 hour) */
    summaryIntervalSec?: number;
}

/**
 * YahooStreaming is a long-running handler for the Yahoo Finance Streaming API.
 * It features session-based SQLite persistence, silence monitoring, and automated
 * exponential backoff for reconnections.
 */
export class YahooStreaming extends EventEmitter {
    private static readonly WS_URL = 'wss://streamer.finance.yahoo.com/?version=2';
    private static readonly NY_ZONE = 'America/New_York';

    private db: DatabaseModule;
    private logger = LoggersSection.logger.child({ section: 'YahooStreaming' });
    
    private ws: WebSocket | null = null;
    private subscriptions: Set<string> = new Set();
    
    private silenceTimer: NodeJS.Timeout | null = null;
    private summaryTimer: NodeJS.Timeout | null = null;
    
    private silenceTimeoutMs: number;
    private summaryIntervalMs: number;
    
    private reconnectAttempts = 0;
    private isIntentionallyClosed = false;

    private metrics = {
        messagesReceived: 0,
        totalLagMs: 0,
        reconnections: 0
    };

    constructor(options: YahooStreamingOptions) {
        super();
        this.db = options.db;
        this.silenceTimeoutMs = (options.silenceTimeoutSec || 60) * 1000;
        this.summaryIntervalMs = (options.summaryIntervalSec || 3600) * 1000;
    }

    /**
     * Prepares the session database and establishes the connection.
     */
    public async init(): Promise<void> {
        try {
            this.logger.info('Initializing YahooStreaming session...');
            await this.setupDatabase();
            this.startSummaryLogger();
            this.connect();
        } catch (e) {
            this.logger.error({ msg: 'Initialization Failed', error: serializeError(e) });
            throw e;
        }
    }

    /**
     * Configures the SQLite table. Data is cleared on every init to ensure 
     * persistence is limited to a single session.
     */
    private async setupDatabase(): Promise<void> {
        await this.db.query(`CREATE TABLE IF NOT EXISTS yahoo_subs_session (symbol TEXT PRIMARY KEY)`);
        await this.db.query(`DELETE FROM yahoo_subs_session`);
    }

    /**
     * Establishes the WebSocket connection and registers event handlers.
     */
    private connect(): void {
        if (this.isIntentionallyClosed) return;

        this.logger.debug(`Connecting to: ${YahooStreaming.WS_URL}`);
        this.ws = new WebSocket(YahooStreaming.WS_URL);

        this.ws.on('open', () => {
            this.logger.info('WebSocket Connected.');
            this.reconnectAttempts = 0;
            this.emit('status', 'receiving');
            this.resubscribeAll();
            this.resetSilenceTimer();
        });

        this.ws.on('message', (data) => this.handleIncoming(data));

        this.ws.on('error', (err) => {
            this.logger.error({ msg: 'WebSocket Error', error: serializeError(err) });
        });

        this.ws.on('close', () => {
            this.emit('status', 'notreceiving');
            this.cleanupSilenceTimer();
            if (!this.isIntentionallyClosed) {
                this.scheduleReconnect();
            }
        });
    }

    /**
     * Parses the outer JSON envelope and filters for "pricing" types.
     */
    private handleIncoming(data: WebSocket.Data): void {
        this.resetSilenceTimer();
        try {
            const envelope = JSON.parse(data.toString());
            if (envelope.type === 'pricing' && envelope.message) {
                this.decodeAndEmit(envelope.message);
            } else {
                this.logger.debug({ msg: 'Non-pricing frame', data: envelope });
            }
        } catch (e) {
            this.logger.error({ msg: 'Frame parse error', error: serializeError(e) });
        }
    }

    /**
     * Decodes the Base64 Protobuf message and calculates network lag.
     */
    private decodeAndEmit(base64: string): void {
        try {
            const buffer = Buffer.from(base64, 'base64');
            const decoded = fromBinary(PricingDataSchema, buffer);

            // Handle BigInt conversion from protobuf-es v2
            const ts = typeof decoded.time === 'bigint' ? Number(decoded.time) : (decoded.time as number);
            
            const now = DateTime.now().setZone(YahooStreaming.NY_ZONE);
            const msgTime = DateTime.fromMillis(ts).setZone(YahooStreaming.NY_ZONE);
            const lagMs = now.diff(msgTime).as('milliseconds');

            this.metrics.messagesReceived++;
            this.metrics.totalLagMs += lagMs;

            this.emit('pricing', {
                ...decoded,
                lagMs,
                nyTime: msgTime.toISO()
            });
        } catch (e) {
            this.logger.error({ msg: 'Protobuf decode error', error: serializeError(e) });
        }
    }

    /**
     * Subscribes to symbols, persists them to SQLite, and updates the active stream.
     */
    public async subscribe(symbols: string[]): Promise<void> {
        for (const symbol of symbols) {
            if (!this.subscriptions.has(symbol)) {
                await this.db.query(`INSERT OR IGNORE INTO yahoo_subs_session (symbol) VALUES (?)`, [symbol]);
                this.subscriptions.add(symbol);
            }
        }
        this.sendWsMessage('subscribe', symbols);
    }

    /**
     * Unsubscribes from symbols and removes them from persistence.
     */
    public async unsubscribe(symbols: string[]): Promise<void> {
        for (const symbol of symbols) {
            await this.db.query(`DELETE FROM yahoo_subs_session WHERE symbol = ?`, [symbol]);
            this.subscriptions.delete(symbol);
        }
        this.sendWsMessage('unsubscribe', symbols);
    }

    private resubscribeAll(): void {
        if (this.subscriptions.size > 0) {
            this.sendWsMessage('subscribe', Array.from(this.subscriptions));
        }
    }

    private sendWsMessage(type: 'subscribe' | 'unsubscribe', symbols: string[]): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ [type]: symbols }));
        }
    }

    /**
     * Triggers exponential backoff logic for reconnections.
     */
    private scheduleReconnect(): void {
        this.metrics.reconnections++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        this.logger.warn(`Scheduling reconnect in ${delay}ms...`);
        setTimeout(() => this.connect(), delay);
    }

    /**
     * Monitors the stream for silence. Terminates connection if threshold is hit.
     */
    private resetSilenceTimer(): void {
        this.cleanupSilenceTimer();
        this.silenceTimer = setTimeout(() => {
            this.logger.warn(`Silence watchdog triggered (no data for ${this.silenceTimeoutMs}ms).`);
            this.ws?.terminate(); 
        }, this.silenceTimeoutMs);
    }

    private cleanupSilenceTimer(): void {
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
    }

    /**
     * Logs summary metrics and resets them for the next interval.
     */
    private startSummaryLogger(): void {
        this.summaryTimer = setInterval(() => {
            const avgLag = this.metrics.messagesReceived > 0 
                ? (this.metrics.totalLagMs / this.metrics.messagesReceived).toFixed(2) 
                : 0;

            this.logger.info({
                msg: 'YahooStreaming Summary Report',
                totalReceived: this.metrics.messagesReceived,
                reconnections: this.metrics.reconnections,
                avgLagMs: avgLag,
                activeSubs: this.subscriptions.size
            });

            this.metrics = { messagesReceived: 0, totalLagMs: 0, reconnections: 0 };
        }, this.summaryIntervalMs);
    }

    /**
     * Gracefully shuts down the module and cleans up all timers.
     */
    public dispose(): void {
        this.isIntentionallyClosed = true;
        this.cleanupSilenceTimer();
        if (this.summaryTimer) clearInterval(this.summaryTimer);
        this.ws?.close();
        this.logger.info('YahooStreaming session closed.');
    }
}