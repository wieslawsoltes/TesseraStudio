import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
export function sqliteAdapter(filename = ':memory:') { const sqlite = new DatabaseSync(filename); sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;'); class Statement {
    constructor(sql, args = []) { this.sql = sql; this.args = args; }
    bind(...args) { return new Statement(this.sql, args); }
    async first() { return sqlite.prepare(this.sql).get(...this.args) || null; }
    async all() { return { results: sqlite.prepare(this.sql).all(...this.args) }; }
    async run() { const result = sqlite.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; }
} return { sqlite, prepare: sql => new Statement(sql), async batch(statements) { sqlite.exec('BEGIN IMMEDIATE'); try {
        const out = [];
        for (const s of statements)
            out.push(await s.run());
        sqlite.exec('COMMIT');
        return out;
    }
    catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
    } } }; }
export function fileBucket(root) { return { async put(key, value) { const p = join(root, encodeURIComponent(key)); await mkdir(dirname(p), { recursive: true }); await writeFile(p, value); return { key }; }, async get(key) { try {
        const data = await readFile(join(root, encodeURIComponent(key)));
        return { text: async () => data.toString('utf8') };
    }
    catch (e) {
        if (e.code === 'ENOENT')
            return null;
        throw e;
    } } }; }
