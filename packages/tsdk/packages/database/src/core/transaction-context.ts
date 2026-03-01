import { AsyncLocalStorage } from 'node:async_hooks';
import type { DbDriver } from './driver.js';

export const transactionStorage = new AsyncLocalStorage<DbDriver>();

export function getActiveTransaction(): DbDriver | undefined {
    return transactionStorage.getStore();
}