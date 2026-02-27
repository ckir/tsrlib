import { RSdk, LoggersSection } from './packages/tsdk/src/index.js';

const { logger } = LoggersSection;

console.log('--- Manual Console Check ---');
console.log('Rust Status:', RSdk.checkRsdkStatus());

// This log travels: Pino -> TCP:9000 -> Vector Source -> Vector Transform -> Cockpit Console
logger.info({ 
    msg: 'Hello from TSDK Telemetry!', 
    rust_status: RSdk.checkRsdkStatus(),
    version: '1.0.0' 
});

// We keep the process alive for a second to ensure the TCP buffer flushes to Vector
setTimeout(() => {
    console.log('--- Test Complete ---');
    process.exit(0);
}, 1000);
