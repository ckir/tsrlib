import { LoggersSection } from './index.ts'; // Changed .js to .ts for the test

console.log("🚀 Sending test pulse to Vector on :9000...");

LoggersSection.logger.info({ 
    event: "manual_health_check",
    status: "verified",
    message: "If you see this in the other terminal, the pipeline is ALIVE!"
});

setTimeout(() => {
    console.log("✅ Pulse sent. Check your sidecar terminal.");
    process.exit(0);
}, 1000);