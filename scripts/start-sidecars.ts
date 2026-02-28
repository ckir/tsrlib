import { SidecarManager } from "../packages/sidecars/src/index";

const sm = new SidecarManager();

async function boot() {
    try {
        await sm.startVector();
        await sm.startCaddy();
        console.log('\n✅ Sidecars are active.');
        console.log('Press CTRL+C to stop services...\n');
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error('❌ Failed to start sidecars:', message);
        process.exit(1);
    }
}

process.on("SIGINT", () => {
    sm.stopAll();
    process.exit(0);
});

boot();

// Keep the process alive
setInterval(() => { }, 1000);
