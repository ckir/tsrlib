import { downloadBinary, getSidecarUrls } from './downloader.js';

async function main() {
    const { vectorUrl, caddyUrl } = getSidecarUrls();
    if (vectorUrl) await downloadBinary('vector', vectorUrl);
    if (caddyUrl) await downloadBinary('caddy', caddyUrl);
}

main().catch(console.error);
