import { execSync } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import http from 'http';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const run = (cmd, silent = false) => {
    try {
        execSync(cmd, { stdio: silent ? 'pipe' : 'inherit' });
        return true;
    } catch (e) { return false; }
};

const lifecycle = {
    async checkPrerequisites() {
        console.log('\n--- 🔍 Checking Prerequisites ---');
        const deps = [
            { name: 'Node.js', cmd: 'node -v' },
            { name: 'PNPM', cmd: 'pnpm -v' },
            { name: 'Rust/Cargo', cmd: 'cargo -v' },
            { name: 'Bun', cmd: 'bun -v' }
        ];

        let allClear = true;
        deps.forEach(dep => {
            if (run(dep.cmd, true)) {
                console.log(`✅ ${dep.name} detected.`);
            } else {
                console.log(`❌ ${dep.name} NOT found.`);
                allClear = false;
            }
        });

        const binPath = path.resolve(process.cwd(), '.bin');
        if (!fs.existsSync(binPath) || fs.readdirSync(binPath).length < 2) {
            console.log('⚠️ Sidecar binaries (Vector/Caddy) missing in .bin/.');
            allClear = false;
        }

        return allClear;
    },

    async cleanProject() {
        console.log('\n--- 🧹 Cleaning Project ---');
        const targets = ['node_modules', 'dist', 'target', 'packages/tsdk/src/rsdk.node'];
        targets.forEach(t => {
            if (fs.existsSync(t)) {
                console.log(`Removing ${t}...`);
                fs.rmSync(t, { recursive: true, force: true });
            }
        });
        console.log('✅ Cleanup complete. Run Option 1 to reinstall.');
    },

    async buildAll() {
        console.log('\n--- 🏗️ Building SDKs ---');
        // Execute build from root to ensure paths like 'packages/tsdk/src' resolve correctly 
        const buildSuccess = run('pnpm build:debug');

        if (buildSuccess) {
            console.log('✅ Native bindings generated.');
            // The rename/move logic you already have handles the rest 
        } else {
            console.error('❌ Build failed. Check if NAPI-RS can access the tsdk/src directory.');
        }
    }
};

const showMenu = () => {
    console.log(`
--- TSRLIB DevelopersCockpit ---
1. Build RS/TS SDKs (Reinstall + Build)
2. Run Tests
3. START Vector & Caddy (Foreground)
4. SYNC Binaries (Download Sidecars)
5. Check Prerequisites & Health
6. CLEAN Project (Delete build artifacts)
7. Exit`);

    rl.question('\nSelect Action: ', async (choice) => {
        if (choice === '1') await lifecycle.buildAll();
        else if (choice === '2') {
            console.log('\n--- 🧪 Running Integration Tests ---');
            // Force Vitest to use the TSDK config which has the globalSetup for sidecars
            run('pnpm vitest run --config packages/tsdk/vitest.config.ts');
        }
        else if (choice === '3') run('pnpm tsx scripts/start-sidecars.ts');
        else if (choice === '4') run('pnpm tsx packages/sidecars/src/sync-binaries.ts');
        else if (choice === '5') {
            const ok = await lifecycle.checkPrerequisites();
            if (ok) console.log('🚀 System is ready for development.');
        }
        else if (choice === '6') await lifecycle.cleanProject();
        else if (choice === '7') process.exit(0);

        setTimeout(showMenu, 500);
    });
};

showMenu();