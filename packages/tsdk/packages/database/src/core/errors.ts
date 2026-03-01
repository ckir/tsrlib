import { serializeError } from 'serialize-error';
import type { LibraryLogger } from './types.js';

export function handleDbError(logger: LibraryLogger, message: string, error: unknown) {
    const serialized = serializeError(error);
    logger.error({ msg: message, error: serialized });
    return serialized;
}