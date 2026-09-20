import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('../dist/pages/', import.meta.url));
const base = process.env.BASE_PATH || '/TesseraStudio/';
if (!base.startsWith('/') || !base.endsWith('/')) throw new Error('BASE_PATH must start and end with /.');
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://localhost:${port}`);
        if (url.pathname === base.slice(0, -1)) { res.writeHead(302, { Location: base }); res.end(); return; }
        if (!url.pathname.startsWith(base)) throw new Error('Not found');
        const relative = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
        const path = resolve(root, relative);
        if (!path.startsWith(resolve(root) + sep)) throw new Error('Not found');
        const data = await readFile(path);
        res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
        res.end(data);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found');
    }
}).listen(port, '127.0.0.1', () => console.log(`Tessera Pages preview: http://localhost:${port}${base}`));
