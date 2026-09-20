const copy = x => JSON.parse(JSON.stringify(x));
const uid = () => crypto.randomUUID();
/** Ordered, idempotent HTTP collaboration. Server order is authoritative. */
export class CollaborationClient {
    constructor({ baseURL = '/api', transport = null, recoveryDatabaseName = 'tessera-recovery', applyOperation, onState = () => { }, onStatus = () => { } } = {}) { if (typeof applyOperation !== 'function')
        throw Error('An applyOperation reducer is required'); this.transport = transport; this.recoveryDatabaseName = recoveryDatabaseName; this.applyOperation = applyOperation; this.baseURL = baseURL; this.onState = onState; this.onStatus = onStatus; this.pending = []; this.operations = []; this.cursor = 0; this.running = false; this.sending = false; this.stopped = false; this.acknowledged = new Set(); }
    async request(path, options = {}) { if (this.transport) return this.transport(path, options); const r = await fetch(this.baseURL + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } }); let data; try {
        data = await r.json();
    }
    catch {
        throw Error('Project service is unavailable. Download a local project to keep your work.');
    } if (!r.ok)
        throw Error(data.error || 'Project request failed'); return data; }
    async connect(id) { this.id = id; const data = await this.request('/projects/' + id); if (this.stopped)
        return data; this.base = data.project; this.role = data.role; this.user = data.user; this.cursor = 0; this.operations = []; await this.restorePending(); if (this.stopped)
        return data; await this.poll(); if (this.stopped)
        return data; this.timer = setInterval(() => this.poll().catch(e => this.onStatus('Offline · edits retained', e)), 2000); return data; }
    enqueue(op) { const pending = { id: uid(), payload: copy(op) }; this.pending.push(pending); this.persistPending().then(() => this.send()).catch(e => this.onStatus('Local recovery unavailable', e)); this.onStatus('Syncing ' + this.pending.length + ' edit' + (this.pending.length === 1 ? '' : 's') + '…'); }
    async send() { if (this.sending || this.stopped || !this.pending.length)
        return; this.sending = true; try {
        for (const op of this.pending.slice(0, 20)) {
            if (this.stopped)
                break;
            await this.request('/projects/' + this.id + '/ops', { method: 'POST', body: JSON.stringify(op) });
        }
        if (!this.stopped)
            await this.poll();
    }
    catch (e) {
        if (!this.stopped)
            this.onStatus('Offline · edits retained', e);
    }
    finally {
        this.sending = false;
    } }
    async poll() { if (this.running || this.stopped)
        return; this.running = true; try {
        let changed = false, more = true;
        while (more) {
            const data = await this.request(`/projects/${this.id}/ops?after=${this.cursor}`);
            if (this.stopped)
                return;
            const known = new Set(this.operations.map(o => o.id));
            for (const o of data.operations) {
                if (!known.has(o.id)) {
                    this.operations.push(o);
                    known.add(o.id);
                    changed = true;
                }
                this.cursor = Math.max(this.cursor, o.seq);
            }
            more = data.hasMore;
        }
        const accepted = new Set(this.operations.map(o => o.id));
        const before = this.pending.length;
        for (const o of this.pending)
            if (accepted.has(o.id))
                this.acknowledged.add(o.id);
        this.pending = this.pending.filter(o => !accepted.has(o.id));
        if (before !== this.pending.length)
            await this.persistPending();
        if (this.stopped)
            return;
        if (changed) {
            const p = copy(this.base);
            for (const op of this.operations)
                this.applyOperation(p, op.payload);
            for (const op of this.pending)
                this.applyOperation(p, op.payload);
            this.onState(p);
        }
        this.onStatus(this.pending.length ? `${this.pending.length} pending edits` : 'All changes saved');
    }
    finally {
        this.running = false;
    } if (this.pending.length && !this.sending && !this.stopped)
        this.send(); }
    async db() { if (this._db)
        return this._db; this._db = await new Promise((resolve, reject) => { const r = indexedDB.open(this.recoveryDatabaseName, 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('operations')) {
        const s = r.result.createObjectStore('operations', { keyPath: 'key' });
        s.createIndex('project', 'project');
    } }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); return this._db; }
    async restorePending() { try {
        const db = await this.db();
        this.pending = await new Promise((resolve, reject) => { const r = db.transaction('operations').objectStore('operations').index('project').getAll(this.id); r.onsuccess = () => resolve((r.result || []).map(x => x.operation)); r.onerror = () => reject(r.error); });
    }
    catch (e) {
        this.onStatus('Recovery storage unavailable', e);
    } }
    async persistPending() { const db = await this.db(); return new Promise((resolve, reject) => { const tx = db.transaction('operations', 'readwrite'), store = tx.objectStore('operations'), acked = [...this.acknowledged]; for (const operation of this.pending)
        store.put({ key: this.id + ':' + operation.id, project: this.id, operation: copy(operation) }); for (const id of acked)
        store.delete(this.id + ':' + id); tx.oncomplete = () => { for (const id of acked)
        this.acknowledged.delete(id); resolve(); }; tx.onerror = () => reject(tx.error); }); }
    close() { this.stopped = true; clearInterval(this.timer); }
}
