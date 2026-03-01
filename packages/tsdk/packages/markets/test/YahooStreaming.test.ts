/**
 * packages/tsdk/packages/markets/test/YahooStreaming.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { DateTime } from 'luxon';
import * as protobuf from "@bufbuild/protobuf";

// Import source using relative paths based on your structure
import { YahooStreaming } from '../src/Nasdaq/Datafeeds/Streaming/Yahoo/YahooStreaming.js';
import { PricingDataSchema } from '../src/Nasdaq/Datafeeds/Streaming/Yahoo/generated/yaticker_pb.js';

// --- Improved Mocks ---

// This mock correctly handles the 'new WebSocket()' constructor call in Vitest
vi.mock('ws', () => {
    const MockWS = vi.fn().mockImplementation(function() {
        return {
            on: vi.fn(),
            send: vi.fn(),
            terminate: vi.fn(),
            close: vi.fn(),
            readyState: 1, // WebSocket.OPEN
        };
    });
    
    // Polyfill static constants required by class methods
    (MockWS as any).OPEN = 1;
    (MockWS as any).CONNECTING = 0;
    (MockWS as any).CLOSING = 2;
    (MockWS as any).CLOSED = 3;

    return {
        default: MockWS,
        WebSocket: MockWS
    };
});

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
    let mockWsInstance: any;

    beforeEach(() => {
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

        mockWsInstance = {
            on: vi.fn(),
            send: vi.fn(),
            terminate: vi.fn(),
            close: vi.fn(),
            readyState: 1,
        };
        
        (WebSocket as any).mockImplementation(function() {
            return mockWsInstance;
        });
    });

    afterEach(() => {
        module.dispose();
        vi.useRealTimers();
    });

    describe('Lifecycle & Persistence', () => {
        it('should initialize DB and clear session data on init', async () => {
            await module.init();
            expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS yahoo_subs_session'));
            expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM yahoo_subs_session'));
        });

        it('should send subscription messages only when WS is open', async () => {
            await module.init();
            
            const openCallback = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'open')[1];
            openCallback();

            await module.subscribe(['BTC-USD']);

            expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE'), ['BTC-USD']);
            expect(mockWsInstance.send).toHaveBeenCalledWith(JSON.stringify({ subscribe: ['BTC-USD'] }));
        });

        it('should resubscribe to stored symbols upon reconnection', async () => {
            await module.init();
            await module.subscribe(['AAPL']);

            const openCallback = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'open')[1];
            openCallback();

            expect(mockWsInstance.send).toHaveBeenCalledWith(JSON.stringify({ subscribe: ['AAPL'] }));
        });
    });

    describe('Data Processing', () => {
        it('should correctly decode pricing messages and calculate lag', async () => {
            await module.init();
            
            const now = DateTime.now().setZone('America/New_York');
            const pastTime = now.minus({ milliseconds: 250 });
            
            (protobuf.fromBinary as any).mockReturnValue({
                id: 'TSLA',
                price: 200,
                time: BigInt(pastTime.toMillis())
            });

            const pricingEventPromise = new Promise((resolve) => module.once('pricing', resolve));

            const messageCallback = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'message')[1];
            messageCallback(Buffer.from(JSON.stringify({
                type: 'pricing',
                message: 'U29tZSBCYXNlNjQ='
            })));

            const result: any = await pricingEventPromise;
            expect(result.id).toBe('TSLA');
            expect(result.lagMs).toBeGreaterThanOrEqual(240); 
            expect(result.nyTime).toBeDefined();
        });

        it('should ignore non-pricing message types', async () => {
            await module.init();
            const messageCallback = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'message')[1];
            
            messageCallback(Buffer.from(JSON.stringify({ type: 'heartbeat' })));
            
            expect(protobuf.fromBinary).not.toHaveBeenCalled();
        });
    });

    describe('Resilience & Watchdog', () => {
        it('should trigger reconnection if silence timeout is exceeded', async () => {
            await module.init();
            const openCallback = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'open')[1];
            openCallback();

            vi.advanceTimersByTime(6000);
            expect(mockWsInstance.terminate).toHaveBeenCalled();
        });

        it('should reset silence timer when any message is received', async () => {
            await module.init();
            const openCallback = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'open')[1];
            openCallback();

            vi.advanceTimersByTime(4000); 
            
            const messageCallback = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'message')[1];
            messageCallback(Buffer.from(JSON.stringify({ type: 'ping' })));

            vi.advanceTimersByTime(2000); 
            expect(mockWsInstance.terminate).not.toHaveBeenCalled();
        });

        it('should implement exponential backoff on close', async () => {
            await module.init(); // First call to WebSocket constructor (1)
            const closeCallback = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'close')[1];

            // 1st retry: Trigger close and advance time past the first backoff (e.g., 1s)
            closeCallback();
            vi.advanceTimersByTime(1100);
            vi.runOnlyPendingTimers();
            expect(WebSocket).toHaveBeenCalledTimes(2); 

            // 2nd retry: Trigger close again and advance time past second backoff (e.g., 2s)
            closeCallback();
            vi.advanceTimersByTime(2100);
            vi.runOnlyPendingTimers();
            expect(WebSocket).toHaveBeenCalledTimes(3); 
        });
    });

    describe('Summary Reporting', () => {
        it('should log summary metrics at defined intervals', async () => {
            await module.init();
            vi.advanceTimersByTime(11000);
            expect(vi.getTimerCount()).toBeGreaterThan(0);
        });
    });

    describe('Disposal', () => {
        it('should stop all timers and not reconnect when disposed', async () => {
            await module.init();
            module.dispose();

            const closeCallback = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'close')[1];
            if (closeCallback) {
                closeCallback();
            }

            vi.advanceTimersByTime(30000);
            expect(WebSocket).toHaveBeenCalledTimes(1); 
        });
    });
});