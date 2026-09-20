import { validateProject, copy } from '../core/project.js';
import { validateOperation } from '../core/validation.js';

const user = Object.freeze({ id: 'browser-designer', name: 'Local designer' });
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const read = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

/** Local-only project API. IndexedDB transactions serialize edits from multiple tabs.
 * No credentials or project data are sent over the network by this module.
 * Hosts must keep this package beside @tessera/core when serving unbundled ESM.
 */
export class BrowserProjectService {
    constructor({ databaseName = 'tessera-projects', indexedDB = globalThis.indexedDB, keyRange = globalThis.IDBKeyRange } = {}) {
        this.databaseName = databaseName;
        this.indexedDB = indexedDB;
        this.keyRange = keyRange;
    }
    async database() {
        if (!this.indexedDB) fail('Browser storage is unavailable. Download your project to keep your work.', 503);
        if (!this.opening) {
            this.opening = new Promise((resolve, reject) => {
                const request = this.indexedDB.open(this.databaseName, 1);
                request.onupgradeneeded = () => {
                    const db = request.result;
                    db.createObjectStore('projects', { keyPath: 'id' });
                    const ops = db.createObjectStore('operations', { keyPath: ['projectId', 'id'] });
                    ops.createIndex('projectSequence', ['projectId', 'seq'], { unique: true });
                    const comments = db.createObjectStore('comments', { keyPath: 'id' });
                    comments.createIndex('project', 'projectId');
                };
                request.onsuccess = () => {
                    const db = request.result;
                    db.onversionchange = () => { db.close(); this.opening = null; };
                    resolve(db);
                };
                request.onerror = () => { this.opening = null; reject(request.error); };
                request.onblocked = () => { this.opening = null; reject(new Error('Close other Tessera tabs to update browser storage.')); };
            });
        }
        return this.opening;
    }
    async transaction(stores, mode, operation) {
        const db = await this.database(), tx = db.transaction(stores, mode);
        const done = new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onabort = () => reject(tx.error || new Error('Browser save was aborted. Export a backup and check available storage.'));
            tx.onerror = () => reject(tx.error || new Error('Unable to save in this browser. Export a backup.'));
        });
        done.catch(() => {});
        try {
            const value = await operation(tx);
            await done;
            return value;
        } catch (error) {
            try { tx.abort(); } catch { /* A failed transaction may already be finished. */ }
            await done.catch(() => {});
            throw error;
        }
    }
    async request(path, options = {}) {
        const url = new URL(path, 'https://tessera.invalid'), parts = url.pathname.split('/').filter(Boolean);
        const method = (options.method || 'GET').toUpperCase();
        const body = () => {
            if (typeof options.body !== 'string' || options.body.length > 50_000_000) fail('Invalid or oversized project request.');
            try { return JSON.parse(options.body); } catch { fail('Invalid JSON.'); }
        };
        if (parts.length === 1 && parts[0] === 'me' && method === 'GET') return { ...user };
        if (parts[0] !== 'projects') fail('Not found.', 404);
        if (parts.length === 1) {
            if (method === 'GET') return this.transaction(['projects'], 'readonly', async tx => {
                const records = await read(tx.objectStore('projects').getAll());
                return { projects: records.sort((a, b) => b.updated - a.updated).map(({ id, name, created, updated }) => ({ id, name, created, updated, role: 'owner' })) };
            });
            if (method === 'POST') {
                const project = copy(validateProject(body().project)), id = crypto.randomUUID(), now = Date.now();
                return this.transaction(['projects'], 'readwrite', async tx => {
                    await read(tx.objectStore('projects').add({ id, project, name: project.name, created: now, updated: now, seq: 0 }));
                    return { id };
                });
            }
            fail('Method not allowed.', 405);
        }
        const id = parts[1], endpoint = parts[2];
        if (parts.length > 3 || !id || id.length > 100) fail('Invalid project route.');
        if (['invites', 'join'].includes(endpoint)) fail('Live collaboration requires an authenticated server. This edition stores projects only in this browser.', 501);
        const stores = ['projects'];
        if (endpoint === 'ops') stores.push('operations');
        if (endpoint === 'comments') stores.push('comments');
        // Validate before opening a write transaction so failures cannot partially save.
        const data = method === 'POST' ? body() : null;
        if (endpoint === 'ops' && method === 'POST') {
            if (typeof data?.id !== 'string' || !data.id || data.id.length > 100) fail('Invalid operation ID.');
            validateOperation(data.payload);
        }
        if (endpoint === 'comments' && method === 'POST' && (typeof data?.text !== 'string' || !data.text.trim() || data.text.length > 4000)) fail('Comments must contain 1–4000 characters.');
        return this.transaction(stores, method === 'GET' ? 'readonly' : 'readwrite', async tx => {
            const projects = tx.objectStore('projects'), record = await read(projects.get(id));
            if (!record) fail('Project not found in this browser. Open a downloaded project through File → Open project.', 404);
            if (!endpoint && method === 'GET') return { project: copy(record.project), role: 'owner', user: { ...user } };
            if (endpoint === 'members' && method === 'GET') return { members: [{ user_id: user.id, name: user.name, role: 'owner' }] };
            if (endpoint === 'ops') {
                const ops = tx.objectStore('operations');
                if (method === 'GET') {
                    const after = Number(url.searchParams.get('after') || 0);
                    if (!Number.isSafeInteger(after) || after < 0) fail('Invalid operation cursor.');
                    if (after === Number.MAX_SAFE_INTEGER) return { operations: [], hasMore: false };
                    const range = this.keyRange.bound([id, after], [id, Number.MAX_SAFE_INTEGER], true, false);
                    const rows = await read(ops.index('projectSequence').getAll(range, 51));
                    return { operations: rows.slice(0, 50).map(({ id, seq, payload, actor, created }) => ({ id, seq, payload, actor, created })), hasMore: rows.length > 50 };
                }
                if (method === 'POST') {
                    const existing = await read(ops.get([id, data.id]));
                    if (existing) return { accepted: true, duplicate: true, seq: existing.seq };
                    const seq = record.seq + 1;
                    if (!Number.isSafeInteger(seq)) fail('Project edit sequence is exhausted. Export and create a new project.');
                    const now = Date.now();
                    await read(ops.add({ projectId: id, id: data.id, seq, payload: copy(data.payload), actor: user.id, created: now }));
                    record.seq = seq;
                    record.updated = now;
                    if (data.payload.type === 'rename') record.name = data.payload.name;
                    await read(projects.put(record));
                    return { accepted: true, seq };
                }
            }
            if (endpoint === 'comments') {
                const comments = tx.objectStore('comments');
                if (method === 'GET') {
                    const rows = await read(comments.index('project').getAll(id));
                    return { comments: rows.sort((a, b) => b.created - a.created).slice(0, 200) };
                }
                if (method === 'POST') {
                    await read(comments.add({ id: crypto.randomUUID(), projectId: id, user_id: user.id, name: user.name, text: data.text.trim(), channel: data.channel || null, tile: Number.isInteger(data.tile) ? data.tile : null, created: Date.now() }));
                    return { posted: true };
                }
            }
            fail('Method or route not supported.', 405);
        });
    }
    async close() {
        if (this.opening) (await this.opening).close();
        this.opening = null;
    }
}
