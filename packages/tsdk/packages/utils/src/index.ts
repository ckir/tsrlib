/**
 * packages/tsdk/packages/utils/src/index.ts
 */

/**
 * Standardized response structure for all SDK operations.
 */
export interface SerializedResponse<T> {
    status: 'success' | 'error';
    data?: T;
    message?: string;
}

/**
 * Type alias for SerializedResponse to simplify database return types.
 */
export type Result<T> = SerializedResponse<T>;

/**
 * Utility class for wrapping data or errors into a SerializedResponse.
 */
export class RequestResponseSerialize {
    /**
     * Wraps a successful result.
     * @param data The data to return.
     */
    static wrapResult<T>(data: T): SerializedResponse<T> {
        return {
            status: 'success',
            data
        };
    }

    /**
     * Wraps an error into a consistent format.
     * @param error The error object or message.
     */
    static wrapError(error: any): SerializedResponse<any> {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Named exports for cleaner functional usage across the project.
 */
export const wrapResult = RequestResponseSerialize.wrapResult;
export const wrapError = RequestResponseSerialize.wrapError;