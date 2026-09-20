import { createServer } from 'node:http';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname } from 'node:path';
import { handleAPI } from './api.js';
import { sqliteAdapter, fileBucket } from './local-adapters.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), dataDir = resolve(process.env.TESSERA_DATA_DIR || join(root, '.tessera-data'));
await mkdir(dataDir, { recursive: true });
const db = sqliteAdapter(join(dataDir, 'projects.sqlite'));
db.sqlite.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)');
for (const file of (await readdir(join(root, 'drizzle'))).filter(n => n.endsWith('.sql')).sort()) {
    if (!db.sqlite.prepare('SELECT name FROM _migrations WHERE name=?').get(file)) {
        db.sqlite.exec(await readFile(join(root, 'drizzle', file), 'utf8'));
        db.sqlite.prepare('INSERT INTO _migrations VALUES (?)').run(file);
    }
}
const env = { DB: db, BUCKET: fileBucket(join(dataDir, 'blobs')) }, mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain' }, port = Number(process.env.PORT || 3000);
const server = createServer(async (req, res) => { try {
    const url = new URL(req.url, 'http://localhost:' + port);
    if (url.pathname.startsWith('/api/')) {
        const buffers = [];
        let size = 0;
        for await (const chunk of req) {
            size += chunk.length;
            if (size > 50000000) {
                res.writeHead(413);
                res.end('Request too large');
                return;
            }
            buffers.push(chunk);
        }
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers))
            if (v)
                headers.set(k, Array.isArray(v) ? v.join(',') : v);
        headers.set('oai-authenticated-user-id', 'local-designer');
        headers.set('oai-authenticated-user-email', 'designer@localhost');
        headers.set('oai-authenticated-user-full-name', 'Local designer');
        headers.delete('oai-authenticated-user-full-name-encoding');
        const request = new Request(url, { method: req.method, headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(buffers) }) });
        const response = await handleAPI(request, env);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
    }
    const pathname = decodeURIComponent(url.pathname === '/' ? '/studio.html' : url.pathname), base = join(root, 'public'), path = resolve(base, '.' + pathname);
    if (!path.startsWith(base + '/')) {
        res.writeHead(403);
        res.end();
        return;
    }
    try {
        const file = await readFile(path);
        res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
        res.end(file);
    }
    catch {
        res.writeHead(404);
        res.end('Not found');
    }
}
catch (e) {
    res.writeHead(500);
    res.end('Local server error');
    console.error(e);
} });
server.listen(port, '127.0.0.1', () => console.log(`Tessera Studio: http://localhost:${port}\nLocal single-user server. Data: ${dataDir}\nFor network collaboration, deploy the authenticated Worker service.`));
