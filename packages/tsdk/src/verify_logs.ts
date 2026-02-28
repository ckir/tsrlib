import { RSdk } from './index.js';
import { LoggersSection } from '@tsrlib/loggers';

/**
 * SDK Health Check Pulse
 */

console.log("🔍 Checking Rust SDK Status...");
try {
    const status = RSdk.checkRsdkStatus();
    console.log(`✅ Rust Bridge status: ${status}`);
} catch (e) {
    console.error("❌ FAILED to load Rust Bridge. Run Cockpit Option 1 first.");
    console.error(e);
    process.exit(1);
}

console.log("🚀 Sending test pulse to Vector on :9000...");
LoggersSection.logger.info({ 
    event: "manual_health_check", 
    status: "verified", 
    message: "Pipeline is ALIVE!",
    bridge_status: "connected" 
});

setTimeout(() => {
    console.log("✅ Pulse sent. Check your sidecar terminal.");
    process.exit(0);
}, 1000);