import { validateOperation } from '../public/packages/core/validation.js';
export { validateOperation };
import { validateProject, CHANNELS } from '../public/packages/core/project.js';
const response = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const channelIds = CHANNELS.map(c => c.id), idOK = s => typeof s === 'string' && s.length > 0 && s.length < 100;
async function body(req, max = 300000) { const raw = await req.text(); if (new TextEncoder().encode(raw).length > max)
    fail('Request too large', 413); try {
    return JSON.parse(raw);
}
catch {
    fail('Invalid JSON');
} }
async function hash(s) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join(''); }
export async function handleAPI(req, env) {
    try {
        const url = new URL(req.url), path = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean), method = req.method;
        if (method !== 'GET') {
            const origin = req.headers.get('origin');
            if (origin && origin !== url.origin)
                fail('Cross-origin request refused', 403);
        }
        const userId = req.headers.get('oai-authenticated-user-id');
        if (!userId)
            fail('Sign in to this site to save and share projects.', 401);
        const rawName = req.headers.get('oai-authenticated-user-full-name'), encoded = req.headers.get('oai-authenticated-user-full-name-encoding');
        let name = rawName || req.headers.get('oai-authenticated-user-email') || 'Studio user';
        if (rawName && encoded === 'percent-encoded-utf-8') {
            try {
                name = decodeURIComponent(rawName);
            }
            catch { }
        }
        name = name.slice(0, 200);
        if (!env.DB || !env.BUCKET)
            fail('Project storage is unavailable. Download your project and try again later.', 503);
        const db = env.DB;
        if (path[0] === 'me')
            return response({ id: userId, name });
        if (path[0] !== 'projects')
            fail('Not found', 404);
        if (path.length === 1) {
            if (method === 'GET') {
                const r = await db.prepare('SELECT p.id,p.name,p.created,p.updated,m.role FROM projects p JOIN members m ON p.id=m.project_id WHERE m.user_id=? ORDER BY p.updated DESC LIMIT 100').bind(userId).all();
                return response({ projects: r.results });
            }
            if (method === 'POST') {
                const data = await body(req, 50000000);
                const p = validateProject(data.project);
                const id = crypto.randomUUID(), key = `projects/${id}/initial.json`, now = Date.now();
                await env.BUCKET.put(key, JSON.stringify(p), { httpMetadata: { contentType: 'application/json' } });
                await db.batch([db.prepare('INSERT INTO projects (id,owner,name,blob,created,updated) VALUES (?,?,?,?,?,?)').bind(id, userId, p.name, key, now, now), db.prepare('INSERT INTO members (project_id,user_id,name,role) VALUES (?,?,?,?)').bind(id, userId, name, 'owner')]);
                return response({ id }, 201);
            }
            fail('Method not allowed', 405);
        }
        const id = path[1];
        if (!idOK(id))
            fail('Invalid project id');
        if (path[2] === 'join' && method === 'POST') {
            const b = await body(req, 2000);
            if (typeof b.token !== 'string' || b.token.length > 200)
                fail('Invalid invitation');
            const invitation = await db.prepare('SELECT role,expires FROM invites WHERE hash=? AND project_id=?').bind(await hash(b.token), id).first();
            if (!invitation || invitation.expires < Date.now())
                fail('This invitation is invalid or expired.', 403);
            await db.prepare('INSERT INTO members (project_id,user_id,name,role) VALUES (?,?,?,?) ON CONFLICT(project_id,user_id) DO NOTHING').bind(id, userId, name, invitation.role).run();
            return response({ joined: true });
        }
        const member = await db.prepare('SELECT role FROM members WHERE project_id=? AND user_id=?').bind(id, userId).first();
        if (!member)
            fail('Project not found or access denied.', 404);
        const role = member.role;
        if (path.length === 2 && method === 'GET') {
            const p = await db.prepare('SELECT blob FROM projects WHERE id=?').bind(id).first();
            const object = await env.BUCKET.get(p.blob);
            if (!object)
                fail('Project snapshot is unavailable', 503);
            return response({ project: JSON.parse(await object.text()), role, user: { id: userId, name } });
        }
        const endpoint = path[2];
        if (endpoint === 'ops') {
            if (method === 'GET') {
                const after = Number(url.searchParams.get('after') || 0);
                if (!Number.isSafeInteger(after) || after < 0)
                    fail('Invalid cursor');
                const r = await db.prepare('SELECT seq,op_id,actor,payload,created FROM operations WHERE project_id=? AND seq>? ORDER BY seq ASC LIMIT 51').bind(id, after).all();
                const operations = [];
                let bytes = 0;
                for (const o of r.results.slice(0, 50)) {
                    let payload = JSON.parse(o.payload);
                    if (payload.__tesseraBlob) {
                        const object = await env.BUCKET.get(payload.__tesseraBlob);
                        if (!object)
                            fail('Edit data is temporarily unavailable', 503);
                        const raw = await object.text();
                        if (bytes + raw.length > 6000000 && operations.length)
                            break;
                        bytes += raw.length;
                        payload = JSON.parse(raw);
                    }
                    else
                        bytes += o.payload.length;
                    operations.push({ seq: o.seq, id: o.op_id, actor: o.actor, payload, created: o.created });
                }
                return response({ operations, hasMore: r.results.length > operations.length });
            }
            if (method === 'POST') {
                if (role === 'viewer')
                    fail('Reviewers cannot edit project data.', 403);
                const b = await body(req, 16000000);
                if (!idOK(b.id))
                    fail('Invalid operation identity');
                const op = validateOperation(b.payload), now = Date.now(), rawPayload = JSON.stringify(op);
                let storedPayload = rawPayload;
                if (rawPayload.length > 50000) {
                    const digest = await hash(rawPayload), key = `projects/${id}/ops/${digest}.json`;
                    await env.BUCKET.put(key, rawPayload, { httpMetadata: { contentType: 'application/json' } });
                    storedPayload = JSON.stringify({ __tesseraBlob: key, hash: digest });
                }
                const existing = await db.prepare('SELECT actor,payload FROM operations WHERE project_id=? AND op_id=?').bind(id, b.id).first();
                if (existing && (existing.actor !== userId || existing.payload !== storedPayload))
                    fail('Operation identity conflict.', 409);
                await db.batch([db.prepare('INSERT INTO operations (project_id,op_id,actor,payload,created) VALUES (?,?,?,?,?) ON CONFLICT(project_id,op_id) DO NOTHING').bind(id, b.id, userId, storedPayload, now), db.prepare('UPDATE projects SET updated=? WHERE id=?').bind(now, id)]);
                if (op.type === 'rename')
                    await db.prepare('UPDATE projects SET name=? WHERE id=?').bind(op.name, id).run();
                return response({ accepted: true, id: b.id });
            }
        }
        if (endpoint === 'comments') {
            if (method === 'GET') {
                const r = await db.prepare('SELECT id,name,text,channel,tile,created FROM comments WHERE project_id=? ORDER BY created DESC LIMIT 200').bind(id).all();
                return response({ comments: r.results });
            }
            if (method === 'POST') {
                const b = await body(req, 20000);
                if (typeof b.text !== 'string' || !b.text.trim() || b.text.length > 4000)
                    fail('Comment must be between 1 and 4,000 characters.');
                await db.prepare('INSERT INTO comments (id,project_id,user_id,name,text,channel,tile,created) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, userId, name, b.text.trim(), channelIds.includes(b.channel) ? b.channel : null, Number.isInteger(b.tile) ? b.tile : null, Date.now()).run();
                return response({ posted: true }, 201);
            }
        }
        if (endpoint === 'members') {
            if (method === 'GET') {
                const r = await db.prepare('SELECT user_id,name,role FROM members WHERE project_id=?').bind(id).all();
                return response({ members: r.results });
            }
            if (method === 'DELETE') {
                if (role !== 'owner')
                    fail('Only the project owner can remove members.', 403);
                const b = await body(req, 2000);
                await db.prepare('DELETE FROM members WHERE project_id=? AND user_id=? AND role<>?').bind(id, b.userId, 'owner').run();
                return response({ removed: true });
            }
        }
        if (endpoint === 'invites') {
            if (role !== 'owner')
                fail('Only the project owner can manage invitations.', 403);
            if (method === 'POST') {
                const b = await body(req, 2000);
                if (!['editor', 'viewer'].includes(b.role))
                    fail('Invalid permission');
                const token = crypto.randomUUID() + crypto.randomUUID();
                await db.prepare('INSERT INTO invites (hash,project_id,role,expires,created) VALUES (?,?,?,?,?)').bind(await hash(token), id, b.role, Date.now() + 7 * 86400000, Date.now()).run();
                return response({ token }, 201);
            }
            if (method === 'DELETE') {
                await db.prepare('DELETE FROM invites WHERE project_id=?').bind(id).run();
                return response({ revoked: true });
            }
        }
        fail('Not found', 404);
    }
    catch (e) {
        if (!e.status)
            console.error('Tessera API', e.message);
        return response({ error: e.status ? e.message : 'Unable to complete the request. Your local edits have been preserved.' }, e.status || 500);
    }
}
