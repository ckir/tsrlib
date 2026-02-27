import { RSdk, LoggersSection } from './packages/tsdk/src/index.js';

console.log('Rust Status:', RSdk.checkRsdkStatus());
console.log('Pino Initialized:', !!LoggersSection.logger);
