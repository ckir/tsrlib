/**
 * TSRLIB Developers Cockpit
 */
import { execSync } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const run = (cmd, cwd = process.cwd()) => {
    try {
        execSync(cmd, { stdio: 'inherit', cwd });
        return true;
    } catch (e) {
        return false;
    }
};

const lifecycle = {
    async buildAll() {
        console.log('\n--- 🏗️ Building Rust Bridge (NAPI-RS) ---');
        const ffiPath = path.resolve(process.cwd(), 'packages/rsdk/crates/ffi-adapter');
        const tsdkSrcPath = path.resolve(process.cwd(), 'packages/tsdk/src');
        
        // 1. Run the build (Release mode for stability)
        const success = run('npx napi build --platform --release --output-dir ../../../tsdk/src', ffiPath);
        
        if (success) {
            const files = fs.readdirSync(tsdkSrcPath);
            
            // 2. Align binary naming
            const nodeFile = files.find(f => f.endsWith('.node') && f !== 'rsdk.node');
            if (nodeFile) {
                console.log(`🔄 Aligning binary: ${nodeFile} -> rsdk.node`);
                fs.renameSync(path.join(tsdkSrcPath, nodeFile), path.join(tsdkSrcPath, 'rsdk.node'));
            }

            // 3. CLEANUP: Delete auto-generated JS/DTS files that cause "Cannot find native binding" errors
            const staleFiles = ['index.js', 'index.d.ts', 'rsdk.js', 'rsdk.d.ts'];
            staleFiles.forEach(f => {
                const p = path.join(tsdkSrcPath, f);
                if (fs.existsSync(p)) {
                    console.log(`🧹 Removing stale file: ${f}`);
                    fs.unlinkSync(p);
                }
            });

            console.log(`✅ Build Complete. Ready for Health Check.`);
        }
    },

    async runTests() {
        console.log('\n--- 🧪 Running Vitest Integration Tests ---');
        run('pnpm vitest run --config packages/tsdk/vitest.config.ts');
    },

    async checkPrerequisites() {
        console.log('\n--- 🔍 Checking Prerequisites ---');
        ['node -v', 'pnpm -v', 'cargo -v', 'bun -v'].forEach(cmd => {
            const ok = run(cmd);
            console.log(ok ? `✅ ${cmd.split(' ')[0]} detected.` : `❌ ${cmd.split(' ')[0]} NOT found.`);
        });
        return true;
    },

    async cleanProject() {
        console.log('\n--- 🧹 Cleaning Project ---');
        const targets = ['node_modules', 'dist', 'target', 'packages/tsdk/src/rsdk.node'];
        targets.forEach(t => {
            if (fs.existsSync(t)) fs.rmSync(t, { recursive: true, force: true });
        });
        run('pnpm install');
    },

    async generateDocs() {
        console.log('\n--- 📚 Generating API Documentation ---');
        run('pnpm typedoc');
    },

    async runHealthCheck() {
        console.log('\n--- 🩺 Running SDK Health Check ---');
        run('bun packages/tsdk/src/verify_logs.ts');
    }
};

const showMenu = () => {
    console.log(`
--- TSRLIB Developers Cockpit ---
1. Build RS/TS SDKs (NAPI + TSDK)
2. Run Tests (Vitest)
3. START Sidecars (Vector & Caddy)
4. SYNC Binaries (Download Sidecars)
5. Check Prerequisites & Health
6. CLEAN & REINSTALL (Fresh Start)
7. Generate Documentation (TypeDoc)
8. Run Health Check Pulse (verify_logs)
0. Exit`);

    rl.question('\nSelect Action: ', async (choice) => {
        if (choice === '1') await lifecycle.buildAll();
        else if (choice === '2') await lifecycle.runTests();
        else if (choice === '3') run('bun scripts/start-sidecars.ts');
        else if (choice === '4') run('bun packages/sidecars/src/sync-binaries.ts');
        else if (choice === '5') await lifecycle.checkPrerequisites();
        else if (choice === '6') await lifecycle.cleanProject();
        else if (choice === '7') await lifecycle.generateDocs();
        else if (choice === '8') await lifecycle.runHealthCheck();
        else if (choice === '0') process.exit(0);
        else console.log('Invalid option');

        setTimeout(showMenu, 500);
    });
};

showMenu();