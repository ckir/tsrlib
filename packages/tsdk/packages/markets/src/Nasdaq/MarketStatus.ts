/**
 * packages/tsdk/packages/markets/src/Nasdaq/MarketStatus.ts
 */
import { DateTime, Duration } from 'luxon';
import { ApiNasdaqUnlimited, NasdaqResult } from './ApiNasdaqUnlimited.js';
import { serializeError } from 'serialize-error';

/**
 * Interface matching the raw JSON data structure from Nasdaq API
 */
export interface NasdaqMarketInfo {
    country: string;
    marketIndicator: string;     // e.g., "Market Closed"
    uiMarketIndicator: string;
    marketCountDown: string;     // e.g., "Market Opens in 1D 18H 5M"
    mrktStatus: string;          // e.g., "Open" | "Closed" | "Pre Market" | "After Hours"
    mrktCountDown: string;

    // Date Strings
    previousTradeDate: string;   // e.g., "Feb 26, 2026"
    nextTradeDate: string;       // e.g., "Mar 2, 2026"

    // Raw ISO strings (NY Time, no offset in string)
    pmOpenRaw: string;           // "2026-02-27T04:00:00"
    openRaw: string;             // "2026-02-27T09:30:00"
    closeRaw: string;            // "2026-02-27T16:00:00"
    ahCloseRaw: string;          // "2026-02-27T20:00:00"

    isBusinessDay: boolean;
}

export class MarketStatus {
    private static readonly ENDPOINT = 'https://api.nasdaq.com/api/market-info';
    private static readonly ZONE = 'America/New_York';

    /**
     * Fetches the current market status.
     * Guaranteed to return a NasdaqResult without "falling through" to undefined.
     */
    public static async getStatus(): Promise<NasdaqResult<NasdaqMarketInfo>> {
        const logger = (globalThis as any).logger;

        try {
            const result = await ApiNasdaqUnlimited.endPoint<NasdaqMarketInfo>(this.ENDPOINT);

            // Path 1: API returned an error status
            if (result.status === 'error') {
                const errorData = serializeError(result.reason);
                const reasonSerialized = {
                    ...errorData,
                    message: errorData.message || 'Nasdaq API returned an error status'
                };

                // Use robust optional chaining to protect against incomplete loggers in tests
                logger?.error?.({ msg: '[MarketStatus] Fetch Failed', reason: reasonSerialized });
                return { status: 'error', reason: reasonSerialized };
            }

            const data = result.value;

            // Path 2: API succeeded but data is malformed (Schema Validation)
            if (!data || !data.mrktStatus || !data.nextTradeDate) {
                const msg = 'STRICT SCHEMA VALIDATION FAILED: Missing required fields';
                const payload = serializeError(data);

                logger?.fatal?.({ msg, payload });
                return {
                    status: 'error',
                    reason: { message: msg, payload }
                };
            }

            // Path 3: Success
            logger?.debug?.({ msg: '[MarketStatus] Schema validated successfully' });
            return {
                status: 'success',
                value: data,
                details: result.details
            };

        } catch (e) {
            // Path 4: Unexpected Exception (Network failure, parsing crash, etc.)
            const errorData = serializeError(e);
            const serializedReason = {
                ...errorData,
                message: errorData.message || 'Unexpected MarketStatus Exception'
            };

            logger?.error?.({ msg: '[MarketStatus] Unexpected Error', error: serializedReason });
            return {
                status: 'error',
                reason: serializedReason
            };
        }
    }

    /**
     * Calculates how long to sleep/wait based on market status.
     * Mirrors the logic from marketstatus.rs using Luxon.
     */
    public static getSleepDuration(data: NasdaqMarketInfo): Duration {
        // 1. Current NY Time
        const now = DateTime.now().setZone(this.ZONE);

        // 2. If Open, no sleep (0 seconds)
        if (data.mrktStatus === 'Open') {
            return Duration.fromObject({ seconds: 0 });
        }

        // 3. Parse Raw Times (Input is local NY time ISO without 'Z')
        const pmOpen = DateTime.fromISO(data.pmOpenRaw, { zone: this.ZONE });
        const marketOpen = DateTime.fromISO(data.openRaw, { zone: this.ZONE });

        // 4. Determine Target
        let target = (now < pmOpen) ? pmOpen : marketOpen;

        // 5. Handle Weekends/Holidays (If target is in the past)
        if (target <= now) {
            // Format: "MMM d, yyyy" -> e.g., "Mar 2, 2026"
            const nextTrade = DateTime.fromFormat(data.nextTradeDate, 'MMM d, yyyy', { zone: this.ZONE });

            if (nextTrade.isValid) {
                // Set to 04:00:00 NY time
                target = nextTrade.set({ hour: 4, minute: 0, second: 0, millisecond: 0 });
            } else {
                (globalThis as any).logger?.warn?.({
                    msg: '[MarketStatus] Failed to parse nextTradeDate',
                    date: data.nextTradeDate
                });
                return Duration.fromObject({ seconds: 300 });
            }
        }

        // 6. Calculate Diff
        if (target > now) {
            const diff = target.diff(now); // Returns duration
            console.log(`Target NY Open: ${target.toFormat('yyyy-MM-dd HH:mm:ss')} (${diff.toFormat('hh:mm:ss')} remaining)`);
            return diff.valueOf() > 0 ? diff : Duration.fromObject({ seconds: 60 });
        }

        // Default fallback (mirrors Rust's else { 300 })
        return Duration.fromObject({ seconds: 300 });
    }
}