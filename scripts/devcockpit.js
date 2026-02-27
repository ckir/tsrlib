import { execSync } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import http from 'http';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const run = (cmd) => {
    try {
        execSync(cmd, { stdio: 'inherit' });
        return true;
    } catch (e) { return false; }
};

const lifecycle = {
    async checkHealth() {
        console.log('\n--- 🏥 System Health Report ---');
        const checkCaddy = () => new Promise((res) => {
            const req = http.get('http://localhost:8080', (r) => res(r.statusCode === 200));
            req.on('error', () => res(false));
            req.end();
        });
        const caddyStatus = await checkCaddy() ? '✅ Online' : '❌ Offline (Start them with option 4)';
        console.log(`Caddy Gateway: ${caddyStatus}`);
    },

    async startEnvironment() {
        console.log('\n--- 🚀 Starting Sidecars (Foreground) ---');
        // Calling the physical file instead of -e string
        try {
            execSync('pnpm tsx scripts/start-sidecars.ts', { stdio: 'inherit' });
        } catch (e) {
            console.log('\nℹ️ Sidecars shut down.');
        }
    },

    async buildAll() {
        console.log('\n--- 🏗️ Building SDKs ---');
        run('pnpm install && pnpm build:debug');
    },

    async syncBins() {
        console.log('\n--- 📡 Syncing Binaries ---');
        run('pnpm tsx packages/sidecars/src/sync-binaries.ts');
    }
};

const showMenu = () => {
    console.log(`
--- TSRLIB DevelopersCockpit ---
1. Build RS/TS SDKs
2. Run Tests
3. START Vector & Caddy (Foreground)
4. SYNC Binaries (Download)
5. Check Health
6. Exit`);

    rl.question('\nSelect Action: ', async (choice) => {
        if (choice === '1') await lifecycle.buildAll();
        else if (choice === '2') run('pnpm test');
        else if (choice === '3') await lifecycle.startEnvironment();
        else if (choice === '4') await lifecycle.syncBins();
        else if (choice === '5') await lifecycle.checkHealth();
        else if (choice === '6') process.exit(0);
        
        setTimeout(showMenu, 500);
    });
};

showMenu();
