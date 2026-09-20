import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { BrowserProjectService } from '../public/packages/storage/index.js';
import { CollaborationClient } from '../public/packages/collaboration/index.js';
import { applyOperation } from '../public/packages/core/project.js';

const root = new URL('../', import.meta.url);
test('Pages build creates a root entry point with explicit browser-local storage', async () => {
    execFileSync(process.execPath, ['scripts/build-pages.mjs'], { cwd: root });
    const index = await readFile(new URL('dist/pages/index.html', root), 'utf8');
    assert.match(index, /name="tessera-storage" content="browser"/);
    assert.equal(index, await readFile(new URL('dist/pages/studio.html', root), 'utf8'));
    assert.doesNotMatch(index, /(?:src|href)="\//);
    await access(new URL('dist/pages/.nojekyll', root));
    await access(new URL('dist/pages/packages/storage/index.js', root));
    const entries = await readdir(new URL('dist/pages/', root));
    for (const excluded of ['server', '.openai', '.env', 'node_modules', 'db']) assert.ok(!entries.includes(excluded));
});
test('all editor ESM relative imports resolve inside the static distribution', async () => {
    async function walk(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const path = resolve(directory, entry.name);
            if (entry.isDirectory()) await walk(path);
            else if (entry.name.endsWith('.js')) {
                const source = await readFile(path, 'utf8');
                for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g)) {
                    await access(resolve(directory, match[1]));
                }
            }
        }
    }
    await walk(resolve('public'));
});
test('custom collaboration transport leaves HTTP unused and preserves recovery namespace', async () => {
    let received;
    const client = new CollaborationClient({ applyOperation, recoveryDatabaseName: 'tessera-test-recovery', transport: async (path, options) => { received = [path, options]; return { ok: true }; } });
    assert.deepEqual(await client.request('/projects', { method: 'GET' }), { ok: true });
    assert.deepEqual(received, ['/projects', { method: 'GET' }]);
    assert.equal(client.recoveryDatabaseName, 'tessera-test-recovery');
    client.close();
});
test('browser storage rejects unsupported routes and remote invitations explicitly', async () => {
    const service = new BrowserProjectService({ indexedDB: null });
    await assert.rejects(service.request('/unknown'), /Not found/);
    await assert.rejects(service.request('/projects/a/invites', { method: 'POST', body: '{}' }), /Live collaboration requires/);
    await assert.rejects(service.request('/projects'), /Browser storage is unavailable/);
});
test('browser storage validates operations before opening a transaction', async () => {
    const service = new BrowserProjectService({ indexedDB: null });
    await assert.rejects(service.request('/projects/a/ops', { method: 'POST', body: JSON.stringify({ id: 'op', payload: { type: 'rename', name: '' } }) }), /Invalid project name/);
    await assert.rejects(service.request('/projects/a/ops', { method: 'POST', body: JSON.stringify({ id: 'op', payload: { type: 'unsupported' } }) }), /Unknown operation/);
});
