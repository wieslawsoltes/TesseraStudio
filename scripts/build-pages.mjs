import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'dist/pages');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, 'public'), out, { recursive: true });
const html = (await readFile(join(root, 'public/studio.html'), 'utf8')).replace('</head>', '<meta name="tessera-storage" content="browser"></head>');
await writeFile(join(out, 'studio.html'), html);
await writeFile(join(out, 'index.html'), html);
await writeFile(join(out, '.nojekyll'), '');
await writeFile(join(out, 'build-info.json'), JSON.stringify({ app: 'Tessera Studio', storage: 'browser-local', commit: process.env.GITHUB_SHA || 'local' }, null, 2) + '\n');
console.log('Built dist/pages: static editor with browser-local project storage. No server or credentials included.');
