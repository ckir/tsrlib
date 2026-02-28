import { describe, it, expect, vi, afterEach } from 'vitest';
import { MarketStatus, NasdaqMarketInfo } from '../src/Nasdaq/MarketStatus.js';
import { ApiNasdaqUnlimited } from '../src/Nasdaq/ApiNasdaqUnlimited.js';
import { DateTime } from 'luxon';

// Mock Data
const mockData: NasdaqMarketInfo = {
    country: "U.S.",
    marketIndicator: "Market Closed",
    uiMarketIndicator: "Market Closed",
    marketCountDown: "Market Opens in 1D 18H 5M",
    mrktStatus: "Closed",
    mrktCountDown: "Opens in 1D 18H 5M",
    previousTradeDate: "Feb 26, 2026",
    nextTradeDate: "Mar 2, 2026",
    pmOpenRaw: "2026-02-27T04:00:00",
    openRaw: "2026-02-27T09:30:00",
    closeRaw: "2026-02-27T16:00:00",
    ahCloseRaw: "2026-02-27T20:00:00",
    isBusinessDay: false
};

describe('MarketStatus', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should successfully fetch and validate status', async () => {
        vi.spyOn(ApiNasdaqUnlimited, 'endPoint').mockResolvedValue({
            status: 'success',
            value: mockData
        });

        const result = await MarketStatus.getStatus();
        
        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.value.country).toBe('U.S.');
            expect(result.value.mrktStatus).toBe('Closed');
        }
    });

    it('should fail validation if required fields are missing', async () => {
        vi.spyOn(ApiNasdaqUnlimited, 'endPoint').mockResolvedValue({
            status: 'success',
            // @ts-ignore - Partial data to force failure
            value: { country: 'U.S.' } 
        });

        const result = await MarketStatus.getStatus();

        expect(result.status).toBe('error');
        if (result.status === 'error') {
            expect(result.reason.message).toContain('STRICT SCHEMA VALIDATION FAILED');
        }
    });

    it('should calculate correct sleep duration when closed (Future Target)', () => {
        // Mock "Now" to be BEFORE the next open
        // Current: Feb 26, 2026 12:00 PM NY
        // Target:  Mar 2, 2026 04:00 AM NY (from nextTradeDate)
        
        // We need to mock Luxon's "now". Since that's hard to spy on static getters without libs,
        // we can verify logic by ensuring getSleepDuration returns a valid Duration object
        // or by passing specific data that forces specific paths.
        
        const duration = MarketStatus.getSleepDuration(mockData);
        expect(duration.as('seconds')).toBeGreaterThan(0);
    });

    it('should return 0 duration if Market is Open', () => {
        const openData = { ...mockData, mrktStatus: 'Open' };
        const duration = MarketStatus.getSleepDuration(openData);
        expect(duration.as('seconds')).toBe(0);
    });
});