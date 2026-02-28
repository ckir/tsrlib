import ky, { HTTPError, Options as KyOptions } from 'ky';
import { serializeError, ErrorObject } from 'serialize-error';
import { merge } from 'ts-deepmerge';
import { LoggersSection } from '@tsrlib/loggers';
import { RequestResponseSerialize, SerializedResponse } from './RequestResponseSerialize.js';

/**
 * Discriminated Union for strict and safe response typing.
 */
export type RequestResult<T = any> = 
    | { status: 'success'; value: SerializedResponse<T> }
    | { status: 'error'; reason: SerializedResponse<T> | ErrorObject };

/**
 * RequestUnlimited
 * A high-resilience utility class for making HTTP requests.
 */
export class RequestUnlimited {

    /**
     * Default configuration for ky requests.
     */
    static defaults: KyOptions = {
        timeout: 50000,
        throwHttpErrors: true, 
        retry: {
            limit: 5,
            methods: ['get', 'post', 'put', 'delete', 'patch'],
            backoffLimit: 3000,
            shouldRetry: ({ error, retryCount }) => {
                if (error instanceof HTTPError && error.response) {
                    const status = error.response.status;
                    if (status === 429 && retryCount <= 5) return true;
                    if (status >= 400 && status < 500) return false;
                    return status >= 500;
                }
                return true;
            }
        },
        method: 'get',
        headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
        },
        hooks: {
            beforeRetry: [
                async ({ retryCount }) => {
                    // Match the exact string expected by the test
                    const logger = (globalThis as any).logger || LoggersSection.logger;
                    logger.silly(`Retrying API call, retry count: ${retryCount}`);
                }
            ]
        }
    };

    /**
     * Internal utility to ensure all header keys are lowercase for consistency.
     */
    private static toLowercaseKeys(obj: Record<string, string | undefined>): Record<string, string> {
        const newObj: Record<string, string> = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
                newObj[key.toLowerCase()] = obj[key] as string;
            }
        }
        return newObj;
    }

    /**
     * Makes an HTTP request to a single URL.
     */
    static async endPoint<T = any>(
        url: string | URL | Request, 
        options: KyOptions = {}
    ): Promise<RequestResult<T>> {
        
        // 1. Normalize headers
        const normalizedDefaultHeaders = this.toLowercaseKeys(
            (this.defaults.headers || {}) as Record<string, string>
        );
        
        const normalizedInputHeaders = options.headers 
            ? this.toLowercaseKeys(options.headers as Record<string, string>) 
            : {};

        // 2. Separate headers and hooks from options to handle them manually
        const { headers, hooks, ...remainingOptions } = options;

        // 3. Construct final options. 
        // We manually concat the hooks to ensure the default 'beforeRetry' is never overwritten.
        const kyOptions = merge.withOptions(
            { mergeArrays: false }, 
            this.defaults, 
            remainingOptions,
            { 
                headers: { ...normalizedDefaultHeaders, ...normalizedInputHeaders },
                hooks: {
                    beforeRetry: [
                        ...(this.defaults.hooks?.beforeRetry || []),
                        ...(hooks?.beforeRetry || [])
                    ]
                }
            }
        ) as KyOptions;

        try {
            const responseObject = await ky(url, kyOptions);
            const response = await RequestResponseSerialize.serialize<T>(responseObject);
            
            return { 
                status: 'success', 
                value: response as SerializedResponse<T> 
            };

        } catch (error: any) {
            if (error instanceof HTTPError || error.response) {
                const errorResponse = await RequestResponseSerialize.serialize<T>(error.response);
                
                const logger = (globalThis as any).logger || LoggersSection.logger;
                logger.warn(`${this.name}: HTTP Error`, { 
                    status: errorResponse?.status, 
                    url: url.toString() 
                });

                return { 
                    status: 'error', 
                    reason: errorResponse as SerializedResponse<T> 
                };
            }
            
            const serializedError = serializeError(error);
            const logger = (globalThis as any).logger || LoggersSection.logger;
            logger.error(`${this.name}: Internal/Network Error`, serializedError);

            return { 
                status: 'error', 
                reason: serializedError 
            };
        }
    }

    /**
     * Makes parallel HTTP requests to multiple URLs.
     */
    static async endPoints<T = any>(
        urls: (string | URL | Request)[], 
        options: KyOptions = {}
    ): Promise<RequestResult<T>[]> {
        const promises = urls.map(url => this.endPoint<T>(url, options));
        const results = await Promise.allSettled(promises);

        return results.map(result => {
            if (result.status === 'fulfilled') return result.value;
            return { 
                status: 'error', 
                reason: serializeError(result.reason) 
            };
        });
    }
}