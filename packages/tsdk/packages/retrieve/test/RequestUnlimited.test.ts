import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse, delay } from 'msw';
import { RequestUnlimited } from '../src/RequestUnlimited.js';

// State for the retry mock so it can be reset between tests
let retryCountState = 0;

/**
 * MSW Server Setup to mock network behavior
 */
const handlers = [
    // Standard Success JSON
    http.get('https://api.test.com/success', () => {
        return HttpResponse.json({ foo: 'bar' });
    }),

    // Plain Text Success
    http.get('https://api.test.com/text', () => {
        return new HttpResponse('plain text', {
            headers: { 'Content-Type': 'text/plain' },
        });
    }),

    // 404 Error (Should return status: 'error' but not throw)
    http.get('https://api.test.com/404', () => {
        return new HttpResponse(null, { status: 404 });
    }),

    // Rate Limit (429) - Stateful mock to test retries
    http.get('https://api.test.com/retry-logic', () => {
        retryCountState++;
        if (retryCountState < 3) return new HttpResponse(null, { status: 429 });
        return HttpResponse.json({ attempts: retryCountState });
    }),

    // Timeout Simulation
    http.get('https://api.test.com/timeout', async () => {
        await delay(1000);
        return HttpResponse.json({ done: true });
    })
];

const server = setupServer(...handlers);

describe('RequestUnlimited', () => {
    beforeAll(() => {
        server.listen({ onUnhandledRequest: 'error' });
        // Mock global logger if not present to prevent test crashes
        if (!(globalThis as any).logger) {
            (globalThis as any).logger = {
                silly: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
                debug: vi.fn()
            };
        }
    });

    afterAll(() => server.close());

    afterEach(() => {
        server.resetHandlers();
        vi.clearAllMocks();
        // Reset the stateful mock counter for the next test
        retryCountState = 0;
    });

    describe('endPoint()', () => {
        it('should successfully fetch and serialize JSON', async () => {
            const result = await RequestUnlimited.endPoint<{ foo: string }>('https://api.test.com/success');

            expect(result.status).toBe('success');
            if (result.status === 'success') {
                expect(result.value.body).toEqual({ foo: 'bar' });
                expect(result.value.status).toBe(200);
                expect(result.value.ok).toBe(true);
            }
        });

        it('should successfully handle plain text responses', async () => {
            const result = await RequestUnlimited.endPoint('https://api.test.com/text');

            expect(result.status).toBe('success');
            if (result.status === 'success') {
                expect(result.value.body).toBe('plain text');
                expect(result.value.headers['content-type']).toContain('text/plain');
            }
        });

        it('should return status error for 404 responses without throwing', async () => {
            const result = await RequestUnlimited.endPoint('https://api.test.com/404');

            expect(result.status).toBe('error');
            if (result.status === 'error') {
                // @ts-ignore - check serialized response reason
                expect(result.reason.status).toBe(404);
                // @ts-ignore
                expect(result.reason.ok).toBe(false);
            }
        });

        it('should retry on 429 (Rate Limit) and eventually succeed', async () => {
            const result = await RequestUnlimited.endPoint('https://api.test.com/retry-logic');

            expect(result.status).toBe('success');
            if (result.status === 'success') {
                // MSW mock returns attempts: 3 on the third try
                expect(result.value.body).toEqual({ attempts: 3 });
            }
        });

        it('should log a message to logger.silly during retries', async () => {
            const sillySpy = vi.spyOn((globalThis as any).logger, 'silly');
            
            await RequestUnlimited.endPoint('https://api.test.com/retry-logic');

            expect(sillySpy).toHaveBeenCalled();
            expect(sillySpy.mock.calls[0][0]).toContain('Retrying API call');
        });

        it('should handle request timeouts gracefully', async () => {
            const result = await RequestUnlimited.endPoint('https://api.test.com/timeout', {
                timeout: 100 // Short timeout to trigger failure
            });

            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.reason).toHaveProperty('name', 'TimeoutError');
            }
        });

        it('should lowercase custom headers and merge them correctly', async () => {
            server.use(
                http.get('https://api.test.com/headers', ({ request }) => {
                    return HttpResponse.json({ 
                        val: request.headers.get('x-custom-header') 
                    });
                })
            );

            const result = await RequestUnlimited.endPoint('https://api.test.com/headers', {
                headers: { 'X-CUSTOM-HEADER': 'test-value' }
            });

            expect(result.status).toBe('success');
            if (result.status === 'success') {
                expect(result.value.body).toEqual({ val: 'test-value' });
            }
        });
    });

    describe('endPoints()', () => {
        it('should handle multiple requests in parallel (mixed results)', async () => {
            const urls = [
                'https://api.test.com/success',
                'https://api.test.com/404',
                'https://api.test.com/text'
            ];

            const results = await RequestUnlimited.endPoints(urls);

            expect(results).toHaveLength(3);
            expect(results[0].status).toBe('success');
            expect(results[1].status).toBe('error');
            expect(results[2].status).toBe('success');
        });

        it('should maintain input order in the results array', async () => {
            const urls = [
                'https://api.test.com/text',
                'https://api.test.com/success'
            ];

            const results = await RequestUnlimited.endPoints(urls);

            if (results[0].status === 'success') {
                expect(results[0].value.body).toBe('plain text');
            }
            if (results[1].status === 'success') {
                expect(results[1].value.body).toEqual({ foo: 'bar' });
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle malformed JSON by falling back to text', async () => {
            server.use(
                http.get('https://api.test.com/malformed', () => {
                    return new HttpResponse('{"bad": json', {
                        headers: { 'Content-Type': 'application/json' },
                    });
                })
            );

            const result = await RequestUnlimited.endPoint('https://api.test.com/malformed');

            // Based on RequestResponseSerialize logic, malformed JSON is returned as raw string
            expect(result.status).toBe('success');
            if (result.status === 'success') {
                expect(result.value.body).toBe('{"bad": json');
            }
        });
    });
});