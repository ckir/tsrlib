import { LoggersSection } from '@tsrlib/loggers';

/**
 * Standardized structure for serialized HTTP responses.
 */
export interface SerializedResponse<T = any> {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    url: string;
    redirected: boolean;
    type: ResponseType;
    body: T | string;
}

export class RequestResponseSerialize {
    /**
     * Serializes a Fetch API Response object.
     */
    static async serialize<T = any>(response: Response | null | undefined): Promise<SerializedResponse<T> | null> {
        if (!response) return null;

        const headers: Record<string, string> = {};
        response.headers.forEach((v, k) => { headers[k] = v; });

        let body: any;
        const contentType = response.headers.get('content-type') || '';

        try {
            const rawText = await response.text();
            if (contentType.includes('application/json')) {
                try {
                    body = JSON.parse(rawText);
                } catch {
                    body = rawText; 
                }
            } else {
                body = rawText;
            }
        } catch (error) {
            LoggersSection.logger.warn({ msg: 'Failed to read response body', error });
            body = "[Error reading body]";
        }

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers,
            url: response.url,
            redirected: response.redirected,
            type: response.type,
            body,
        };
    }
}