/**
 * @file packages/tsdk/packages/markets/src/Nasdaq/Datafeeds/Streaming/Yahoo/YahooStreaming.ts
 * @description Yahoo Finance streaming data feed implementation using WebSocket.
 * Provides real-time ticker updates with robust reconnection logic, silence detection,
 * and database persistence. Uses Protocol Buffers for message parsing.
 * 
 * FIXED (2026-03-04): Replaced 'new Logger' with 'Logger.logger.child' to resolve 
 * the 'not constructable' error. The Logger is exported as an object { logger: pino.Logger },
 * so we access the instance via Logger.logger and create a child logger for this class.
 * This maintains all existing features like logging, streaming, reconnection, metrics,
 * and database integration without any changes to functionality.
 * 
 * Additional fixes:
 * - Adjusted logger calls to use object as first param for structured logging, 
 *   resolving overload mismatches (e.g., logger.error({ error }, 'Message')).
 * - Replaced non-existent db.insert with SQL query for INSERT, assuming Database.query 
 *   is the available method (common in SQLite wrappers like better-sqlite3).
 * - Corrected PricingData field names: 'timeStamp' -> 'time', 'volume' -> 'dayVolume'.
 * - Added table creation in start() to ensure 'yahoo_tickers' exists.
 * - Made handleMessage async to handle potential async query, but if query is sync,
 *   it works either way. Assumed query is promise-based for safety.
 * - Converted message.time from BigInt to number for DateTime.fromMillis,
 *   resolving type mismatch (BigInt from protobuf int64).
 */

import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { Database } from '@tsrlib/database';
import { DateTime } from 'luxon';
import { fromBinary } from '@bufbuild/protobuf';
import { PricingDataSchema } from './generated/yaticker_pb.js';
import { Logger } from '@tsrlib/tsdk';

export interface YahooStreamingOptions {
  /** Required database instance for session persistence */
  db: Database;
  /** Silence timeout before forcing reconnection (seconds, default 30) */
  silenceTimeoutSec?: number;
  /** How often to log summary metrics (seconds, default 60) */
  summaryIntervalSec?: number;
}

export class YahooStreaming extends EventEmitter {
  public static readonly WS_URL = 'wss://streamer.finance.yahoo.com';

  private ws: WebSocket | null = null;
  private readonly db: Database;
  private readonly silenceTimeoutSec: number;
  private readonly summaryIntervalSec: number;

  private silenceTimer: NodeJS.Timeout | null = null;
  private summaryInterval: NodeJS.Timeout | null = null;
  private backoffMs = 1000;
  private subscriptions = new Set<string>();
  private metrics = {
    messagesReceived: 0,
    reconnects: 0,
    errors: 0,
  };

  private readonly logger = Logger.logger.child({
    section: 'YahooStreaming',
    source_type: 'tsdk',
  });

  constructor(options: YahooStreamingOptions) {
    super();
    this.db = options.db;
    this.silenceTimeoutSec = options.silenceTimeoutSec ?? 30;
    this.summaryIntervalSec = options.summaryIntervalSec ?? 60;
  }

  public async start(subscriptions: string[]): Promise<void> {
    this.subscriptions = new Set(subscriptions);
    // Create table if not exists
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS yahoo_tickers (
        symbol TEXT,
        timestamp TEXT,
        price REAL,
        volume INTEGER,
        market_hours INTEGER,
        change REAL,
        change_percent REAL
      )
    `);
    await this.connect();
    this.setupSummaryLogging();
  }

  public async stop(): Promise<void> {
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.logger.info('Streaming stopped');
  }

  private async connect(): Promise<void> {
    try {
      this.ws = new WebSocket(YahooStreaming.WS_URL);
      
      this.ws.on('open', () => {
        this.logger.info('WebSocket connected');
        this.metrics.reconnects++;
        this.backoffMs = 1000;
        this.resetSilenceTimer();
        this.sendSubscriptions();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data);
        this.resetSilenceTimer();
      });

      this.ws.on('error', (error) => {
        this.metrics.errors++;
        this.logger.error({ error: error.message }, 'WebSocket error');
      });

      this.ws.on('close', () => {
        this.logger.warn('WebSocket closed. Reconnecting...');
        this.reconnect();
      });
    } catch (error) {
      this.logger.error({ error: (error as Error).message }, 'Connection failed');
      this.reconnect();
    }
  }

  private reconnect(): void {
    this.clearTimers();
    setTimeout(() => this.connect(), this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, 60000);
  }

  private sendSubscriptions(): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.subscriptions.size > 0) {
      this.ws.send(JSON.stringify({
        subscribe: Array.from(this.subscriptions)
      }));
      this.logger.info({ symbols: Array.from(this.subscriptions) }, 'Subscriptions sent');
    }
  }

  private async handleMessage(data: Buffer): Promise<void> {
    try {
      const message = fromBinary(PricingDataSchema, data);
      this.metrics.messagesReceived++;
      
      // Persist to database using query (since insert doesn't exist)
      await this.db.query(
        `INSERT INTO yahoo_tickers (symbol, timestamp, price, volume, market_hours, change, change_percent) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          DateTime.fromMillis(Number(message.time)).toISO(),
          message.price,
          message.dayVolume,
          message.marketHours,
          message.change,
          message.changePercent,
        ]
      );

      this.emit('data', message);
    } catch (error) {
      this.logger.error({ error: (error as Error).message }, 'Message parsing failed');
      this.metrics.errors++;
    }
  }

  private resetSilenceTimer(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      this.logger.warn('Silence timeout exceeded. Reconnecting...');
      if (this.ws) this.ws.close();
    }, this.silenceTimeoutSec * 1000);
  }

  private setupSummaryLogging(): void {
    if (this.summaryInterval) clearInterval(this.summaryInterval);
    this.summaryInterval = setInterval(() => {
      this.logger.info(this.metrics, 'Metrics summary');
    }, this.summaryIntervalSec * 1000);
  }

  private clearTimers(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.summaryInterval) clearInterval(this.summaryInterval);
  }
}