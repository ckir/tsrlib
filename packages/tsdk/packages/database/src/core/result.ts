import { serializeError, type ErrorObject } from 'serialize-error';

/**
 * The standard Result pattern used across the library.
 */
export type DatabaseResult<T = any> = 
    | { status: 'success'; value: T; details?: any }
    | { status: 'error'; reason: ErrorObject | { message: string; [key: string]: any } };

export const wrapSuccess = <T>(value: T, details?: any): DatabaseResult<T> => ({
    status: 'success',
    value,
    details
});

export const wrapError = (error: unknown): DatabaseResult<any> => ({
    status: 'error',
    reason: serializeError(error)
});