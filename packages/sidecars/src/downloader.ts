import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

export async function downloadBinary(name: string, url: string) {
    const binDir = path.join(process.cwd(), '.bin');
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

    const targetPath = path.join(binDir, process.platform === 'win32' ? `${name}.exe` : name);
    
    console.log(`📡 Downloading ${name} from ${url}...`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
        
        const fileStream = fs.createWriteStream(targetPath);
        await finished(Readable.fromWeb(response.body as any).pipe(fileStream));
        
        if (process.platform !== 'win32') {
            fs.chmodSync(targetPath, 0o755); // Make executable
        }
        console.log(`✅ ${name} saved to .bin/`);
    } catch (err) {
        console.error(`❌ Error downloading ${name}:`, err);
    }
}

export function getSidecarUrls() {
    const arch = process.arch === 'x64' ? 'amd64' : process.arch;
    const platform = process.platform;

    // Mapping for Vector (example versions)
    const vectorVersion = '0.53.0';
    const caddyVersion = '2.11.1';

    let vectorUrl = '';
    let caddyUrl = '';

    if (platform === 'win32') {
        vectorUrl = `https://packages.timber.io/vector/${vectorVersion}/vector-${vectorVersion}-x86_64-pc-windows-msvc.zip`;
        caddyUrl = `https://github.com/caddyserver/caddy/releases/download/v${caddyVersion}/caddy_${caddyVersion}_windows_${arch}.zip`;
    } else if (platform === 'linux') {
        vectorUrl = `https://packages.timber.io/vector/${vectorVersion}/vector-${vectorVersion}-x86_64-unknown-linux-gnu.tar.gz`;
        caddyUrl = `https://github.com/caddyserver/caddy/releases/download/v${caddyVersion}/caddy_${caddyVersion}_linux_${arch}.tar.gz`;
    }

    return { vectorUrl, caddyUrl };
}
