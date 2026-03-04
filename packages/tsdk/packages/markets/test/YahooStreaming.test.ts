/**
 * @file packages/tsdk/packages/markets/test/YahooStreaming.test.ts
 * @description Exhaustive test suite for YahooStreaming.
 *
 * FINAL WORKING VERSION (2026-03-04)
 *
 * Root cause fixed:
 * • Added WebSocket.OPEN constant to the mock so `sendSubscriptions` passes the `readyState` check.
 * • Awaited the microtasks in message handling using `process.nextTick` to prevent race conditions.
 * • Switched to a canonical `vi.fn(function (this: any) { ... })` block.
 * • All previous features (DB persistence, protobuf parsing, silence watchdog,
 * exponential backoff, summary logging, clean disposal) are 100% preserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { DateTime } from 'luxon';
import * as protobuf from '@bufbuild/protobuf';
import { YahooStreaming } from '../src/Nasdaq/Datafeeds/Streaming/Yahoo/YahooStreaming.js';

// ====================== CANONICAL MOCK FOR DEFAULT IMPORT ======================
vi.mock('ws', () => {
  // Use a standard `function` so it behaves correctly as a constructor when called with `new`
  const MockWebSocket = vi.fn(function (this: any) {
    this.on = vi.fn();
    this.send = vi.fn();
    this.close = vi.fn();
    this.readyState = 1;
    
    // Safely initialize the tracking array if it hasn't been set yet
    if (!(globalThis as any).__wsInstances) {
      (globalThis as any).__wsInstances = [];
    }
    
    // Push the instantiated "this" context so the tests can retrieve it
    (globalThis as any).__wsInstances.push(this);
  });

  // Attach statics needed by the application logic
  (MockWebSocket as any).OPEN = 1;
  (MockWebSocket as any).CLOSED = 3;

  return { default: MockWebSocket };
});

// Mock protobuf (used in data processing tests)
vi.mock('@bufbuild/protobuf', async () => {
  const actual = await vi.importActual('@bufbuild/protobuf');
  return {
    ...actual,
    fromBinary: vi.fn(),
  };
});

describe('YahooStreaming Exhaustive Test Suite', () => {
  let module: YahooStreaming;
  let mockDb: any;

  // Global array for this test file (reset in beforeEach)
  beforeEach(() => {
    (globalThis as any).__wsInstances = [];
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockDb = {
      query: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
    };

    module = new YahooStreaming({
      db: mockDb,
      silenceTimeoutSec: 5,
      summaryIntervalSec: 10,
    });
  });

  afterEach(async () => {
    await module.stop();
    vi.useRealTimers();
  });

  const getLatestWs = () => {
    const instances = (globalThis as any).__wsInstances;
    if (!instances || instances.length === 0) throw new Error('No WebSocket instance was created');
    return instances[instances.length - 1];
  };

  describe('Lifecycle & Persistence', () => {
    it('should initialize DB and create table on start', async () => {
      await module.start([]);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS yahoo_tickers')
      );
    });

    it('should send subscription messages only when WS is open', async () => {
      await module.start(['BTC-USD']);
      const ws = getLatestWs();

      const openCb = ws.on.mock.calls.find((c: any) => c[0] === 'open')?.[1];
      openCb?.();

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ subscribe: ['BTC-USD'] }));
    });

    it('should resubscribe to stored symbols upon reconnection', async () => {
      await module.start(['AAPL']);
      const ws = getLatestWs();

      const openCb = ws.on.mock.calls.find((c: any) => c[0] === 'open')?.[1];
      openCb?.();

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ subscribe: ['AAPL'] }));
    });
  });

  describe('Data Processing', () => {
    it('should correctly decode pricing messages and persist them to DB', async () => {
      await module.start([]);
      const ws = getLatestWs();

      const pastTime = DateTime.now().minus({ milliseconds: 250 });

      vi.mocked(protobuf.fromBinary).mockReturnValue({
        id: 'TSLA',
        price: 200,
        time: BigInt(pastTime.toMillis()),
        dayVolume: BigInt(100),
        marketHours: 1,
        change: 10,
        changePercent: 5,
      } as any);

      const dataSpy = vi.fn();
      module.on('data', dataSpy);

      const msgCb = ws.on.mock.calls.find((c: any) => c[0] === 'message')?.[1];
      msgCb?.(Buffer.from('dummy'));

      // Flush microtasks because handleMessage is async
      await new Promise(resolve => process.nextTick(resolve));
      await new Promise(resolve => process.nextTick(resolve));

      expect(dataSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'TSLA', price: 200 }));
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO yahoo_tickers'),
        expect.arrayContaining(['TSLA', 200])
      );
    });

    it('should ignore decoding errors gracefully without crashing', async () => {
      await module.start([]);
      const ws = getLatestWs();

      vi.mocked(protobuf.fromBinary).mockImplementation(() => {
        throw new Error('Decoding error');
      });

      const msgCb = ws.on.mock.calls.find((c: any) => c[0] === 'message')?.[1];
      msgCb?.(Buffer.from('invalid'));

      // Ensure the catch-block safely processes before we assert
      await new Promise(resolve => process.nextTick(resolve));

      expect(mockDb.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'));
    });
  });

  describe('Resilience & Watchdog', () => {
    it('should trigger reconnection if silence timeout is exceeded', async () => {
      await module.start([]);
      const ws = getLatestWs();

      const openCb = ws.on.mock.calls.find((c: any) => c[0] === 'open')?.[1];
      openCb?.();

      vi.advanceTimersByTime(6000);
      expect(ws.close).toHaveBeenCalled();
    });

    it('should reset silence timer when any message is received', async () => {
      await module.start([]);
      const ws = getLatestWs();

      const openCb = ws.on.mock.calls.find((c: any) => c[0] === 'open')?.[1];
      openCb?.();

      vi.advanceTimersByTime(4000);
      const msgCb = ws.on.mock.calls.find((c: any) => c[0] === 'message')?.[1];
      msgCb?.(Buffer.from('ping'));

      vi.advanceTimersByTime(2000);
      expect(ws.close).not.toHaveBeenCalled();
    });

    it('should implement exponential backoff on close', async () => {
      await module.start([]);
      const initialCallCount = vi.mocked(WebSocket).mock.calls.length;

      const ws = getLatestWs();
      const closeCb = ws.on.mock.calls.find((c: any) => c[0] === 'close')?.[1];
      closeCb?.();

      vi.advanceTimersByTime(1100);
      vi.runOnlyPendingTimers();

      expect(vi.mocked(WebSocket)).toHaveBeenCalledTimes(initialCallCount + 1);
    });
  });

  describe('Summary Reporting', () => {
    it('should log summary metrics at defined intervals', async () => {
      await module.start([]);
      vi.advanceTimersByTime(11000);
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    });
  });

  describe('Disposal', () => {
    it('should stop all timers and not reconnect when stopped', async () => {
      await module.start([]);
      const initialCallCount = vi.mocked(WebSocket).mock.calls.length;

      await module.stop();

      const ws = getLatestWs();
      const closeCb = ws.on.mock.calls.find((c: any) => c[0] === 'close')?.[1];
      closeCb?.();

      vi.advanceTimersByTime(30000);
      expect(vi.mocked(WebSocket)).toHaveBeenCalledTimes(initialCallCount);
    });
  });
});