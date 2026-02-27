import { execSync } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const run = (cmd) => {
    try {
        execSync(cmd, { stdio: 'inherit' });
        return true;
    } catch (e) {
        console.error(`Error executing: ${cmd}`);
        return false;
    }
};

const lifecycle = {
    async checkPrerequisites() {
        console.log('\n--- 🔍 Checking Prerequisites ---');
        const tools = ['node', 'pnpm', 'rustc', 'cargo'];
        tools.forEach(tool => {
            try {
                execSync(`${tool} --version`, { stdio: 'ignore' });
                console.log(`✅ ${tool} is installed`);
            } catch {
                console.log(`❌ ${tool} is missing`);
            }
        });
    },

    async buildAll() {
        console.log('\n--- 🏗️ Building Full Stack ---');
        console.log('Step 1: Installing dependencies...');
        run('pnpm install');
        console.log('Step 2: Building Rust SDK (NAPI-RS)...');
        run('pnpm build:debug');
    },

    async runTests() {
        console.log('\n--- 🧪 Running All Tests ---');
        console.log('Running Vitest (TS Workspaces)...');
        run('pnpm test');
        console.log('Running Cargo Tests (Rust Core)...');
        run('cargo test -p rsdk-core');
    },

    async clean() {
        console.log('\n--- 🧹 Cleaning Project ---');
        const pathsToClean = [
            'target', 
            'node_modules', 
            '.bin', 
            'packages/tsdk/src/rsdk.js', 
            'packages/tsdk/src/rsdk.d.ts',
            'packages/tsdk/src/rsdk.win32-x64-msvc.node',
            'packages/tsdk/src/rsdk.linux-x64-gnu.node',
            'packages/tsdk/src/rsdk.darwin-x64.node'
        ];
        pathsToClean.forEach(p => {
            const fullPath = path.join(process.cwd(), p);
            if (fs.existsSync(fullPath)) {
                fs.rmSync(fullPath, { recursive: true, force: true });
                console.log(`Removed: ${p}`);
            }
        });
    },

    
    
    async syncSidecars() {
        console.log('--- 📡 Syncing Sidecars (Vector/Caddy) ---');
        // In a real scenario, we'd use ts-node or similar. 
        // For this cockpit, we'll trigger a small bootstrap script.
        run('pnpm tsx packages/sidecars/src/sync-binaries.ts');
    }
    
    
};

const showMenu = () => {
    console.log(`
--- TSRLIB Lifecycle Manager ---
1. Full Setup (Prereqs + Build + Sync)
2. Build (RS + TS SDKs)
3. Test (Unit + Integration)
4. Sync Sidecar Binaries
5. Clean Project
6. Exit
    `);

    rl.question('Action: ', async (choice) => {
        if (choice === '1') { 
            await lifecycle.checkPrerequisites(); 
            await lifecycle.buildAll(); 
            await lifecycle.syncSidecars(); 
        }
        else if (choice === '2') await lifecycle.buildAll();
        else if (choice === '3') await lifecycle.runTests();
        else if (choice === '4') await lifecycle.syncSidecars();
        else if (choice === '5') await lifecycle.clean();
        else if (choice === '6') process.exit(0);
        
        showMenu();
    });
};

showMenu();
