import { add, sub, mul, dot, cross, normalize, transform, identity } from './math.js';
export class MeshBuilder {
    constructor() { this.data = []; this.parts = []; }
    vertex(p, n, uv, tile) { this.data.push(...p, ...n, ...uv, tile); }
    surface(name, fn, nu, nv, tile = 0) { const start = this.data.length / 9; for (let j = 0; j < nv; j++)
        for (let i = 0; i < nu; i++) {
            const corners = [[i / nu, j / nv], [(i + 1) / nu, j / nv], [(i + 1) / nu, (j + 1) / nv], [i / nu, (j + 1) / nv]];
            for (const k of [0, 1, 2, 0, 2, 3]) {
                const [u, v] = corners[k], p = fn(u, v), du = sub(fn(u + .0001, v), fn(u - .0001, v)), dv = sub(fn(u, v + .0001), fn(u, v - .0001));
                this.vertex(p, normalize(cross(du, dv)), [u, v], tile);
            }
        } this.parts.push({ name, start, count: this.data.length / 9 - start, tile }); return this; }
    sphere(name, center, scale, tile = 0, nu = 64, nv = 36) { const start = this.data.length; this.surface(name, (u, v) => add(center, [Math.sin(u * 2 * Math.PI) * Math.sin(v * Math.PI) * scale[0], Math.cos(v * Math.PI) * scale[1], Math.cos(u * 2 * Math.PI) * Math.sin(v * Math.PI) * scale[2]]), nu, nv, tile); for (let i = start; i < this.data.length; i += 9) {
        const n = normalize([0, 1, 2].map(a => (this.data[i + a] - center[a]) / (scale[a] * scale[a])));
        for (let a = 0; a < 3; a++)
            this.data[i + 3 + a] = n[a];
    } return this; }
    torus(name, center, major, minor, tile = 1, axis = 'y', nu = 64, nv = 12) { const start = this.data.length; this.surface(name, (u, v) => { const a = u * 2 * Math.PI, b = v * 2 * Math.PI; let p = [Math.sin(a) * (major + minor * Math.cos(b)), minor * Math.sin(b), Math.cos(a) * (major + minor * Math.cos(b))]; if (axis === 'z')
        p = [p[0], p[2], p[1]]; if (axis === 'x')
        p = [p[1], p[0], p[2]]; return add(center, p); }, nu, nv, tile); if (axis !== 'y')
        for (let i = start; i < this.data.length; i += 9)
            for (let k = 3; k < 6; k++)
                this.data[i + k] *= -1; return this; }
    box(name, c, s, tile = 1, bevel = .08) { const faces = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]]; for (const [n, x, y] of faces)
        this.surface(name, (u, v) => { let p = add(n, add(mul(x, 2 * u - 1), mul(y, 2 * v - 1))); p = p.map((q, i) => q * s[i] / 2); const inner = s.map(q => Math.max(0, q / 2 - bevel)), b = p.map((q, i) => Math.max(-inner[i], Math.min(inner[i], q))), out = normalize(sub(p, b)); return add(c, add(b, mul(out, bevel))); }, 8, 8, tile); return this; }
    finish(name = 'Mesh') { return new Mesh(new Float32Array(this.data), this.parts, name); }
}
export class Mesh {
    constructor(vertices, parts = [], name = 'Mesh') { if (!vertices.length || vertices.length % 27 || !vertices.every(Number.isFinite))
        throw Error('Mesh requires finite, complete triangles'); this.vertices = vertices; this.parts = parts; this.name = name; this.triangleCount = vertices.length / 27; this.buildBVH(); }
    buildBVH() { const v = this.vertices; const tris = Array.from({ length: this.triangleCount }, (_, i) => { const o = i * 27, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (let k = 0; k < 3; k++)
        for (let a = 0; a < 3; a++) {
            min[a] = Math.min(min[a], v[o + k * 9 + a]);
            max[a] = Math.max(max[a], v[o + k * 9 + a]);
        } return { i, min, max, c: min.map((x, a) => (x + max[a]) / 2) }; }); const build = ts => { const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (const t of ts)
        for (let a = 0; a < 3; a++) {
            min[a] = Math.min(min[a], t.min[a]);
            max[a] = Math.max(max[a], t.max[a]);
        } if (ts.length < 12)
        return { min, max, indices: ts.map(t => t.i) }; const sizes = max.map((x, a) => x - min[a]), axis = sizes.indexOf(Math.max(...sizes)); ts.sort((a, b) => a.c[axis] - b.c[axis]); const mid = ts.length >> 1; return { min, max, left: build(ts.slice(0, mid)), right: build(ts.slice(mid)) }; }; this.bvh = build(tris); }
    raycast(origin, direction) { let best = null, limit = Infinity; const v = this.vertices; const box = n => { let lo = 0, hi = limit; for (let a = 0; a < 3; a++) {
        if (Math.abs(direction[a]) < 1e-12) {
            if (origin[a] < n.min[a] || origin[a] > n.max[a])
                return false;
            continue;
        }
        let t1 = (n.min[a] - origin[a]) / direction[a], t2 = (n.max[a] - origin[a]) / direction[a];
        if (t1 > t2)
            [t1, t2] = [t2, t1];
        lo = Math.max(lo, t1);
        hi = Math.min(hi, t2);
        if (hi < lo)
            return false;
    } return true; }; const visit = n => { if (!box(n))
        return; if (n.indices) {
        for (const i of n.indices) {
            const o = i * 27, a = Array.from(v.slice(o, o + 3)), b = Array.from(v.slice(o + 9, o + 12)), c = Array.from(v.slice(o + 18, o + 21));
            const e1 = sub(b, a), e2 = sub(c, a), h = cross(direction, e2), det = dot(e1, h);
            if (Math.abs(det) < 1e-9)
                continue;
            const inv = 1 / det, s = sub(origin, a), u = dot(s, h) * inv;
            if (u < 0 || u > 1)
                continue;
            const q = cross(s, e1), w = dot(direction, q) * inv;
            if (w < 0 || u + w > 1)
                continue;
            const t = dot(e2, q) * inv;
            if (t < 0 || t >= limit)
                continue;
            limit = t;
            best = { distance: t, triangle: i, tile: Math.round(v[o + 8]), uv: [v[o + 6] * (1 - u - w) + v[o + 15] * u + v[o + 24] * w, v[o + 7] * (1 - u - w) + v[o + 16] * u + v[o + 25] * w], position: add(origin, mul(direction, t)) };
        }
    }
    else {
        visit(n.left);
        visit(n.right);
    } }; visit(this.bvh); return best; }
}
export function createDemoMesh() { const m = new MeshBuilder(); m.sphere('Enamel shell', [0, .12, 0], [1.08, 1.17, .86], 0); m.torus('Crown seam', [0, .42, 0], .99, .035, 1); m.torus('Collar gasket', [0, -.83, 0], .83, .10, 2); m.torus('Lower titanium rim', [0, -.99, 0], .68, .11, 1); m.box('Visor housing', [0, .26, .82], [1.45, .77, .35], 2, .19); m.box('Optical glass', [0, .27, 1.015], [1.23, .53, .15], 3, .12); m.box('Brow guard', [0, .68, .86], [1.37, .14, .28], 0, .06); m.box('Nose plate', [0, -.40, .86], [.44, .43, .25], 1, .05); for (const x of [-1, 1]) {
    m.sphere('Ear casing', [x * 1.06, .05, -.01], [.26, .57, .55], 0, 32, 24);
    m.torus('Ear ring', [x * 1.24, .08, .02], .34, .09, 1, 'x', 36);
    m.sphere('Ear hub', [x * 1.26, .08, .02], [.10, .28, .28], 2, 28, 18);
    m.box('Cheek panel', [x * .67, -.46, .63], [.32, .39, .42], 0, .065);
    m.box('Service latch', [x * .89, -.43, .59], [.10, .28, .10], 1, .025);
    m.sphere('Fastener', [x * .61, .57, 1.02], [.035, .035, .028], 1, 10, 8);
    m.sphere('Fastener', [x * .61, -.04, 1.02], [.035, .035, .028], 1, 10, 8);
} for (let i = 0; i < 5; i++)
    m.box('Vent slat', [(i - 2) * .115, -.40, 1.015], [.052, .18, .026], 2, .012); m.box('Receiver', [.64, 1.10, -.16], [.13, .34, .14], 1, .03); m.sphere('Receiver cap', [.64, 1.27, -.16], [.065, .065, .07], 2, 12, 8); return m.finish('Scout helmet'); }
export function createPrimitive(type) { const b = new MeshBuilder(); if (type === 'Sphere')
    b.sphere('Sphere', [0, 0, 0], [1.2, 1.2, 1.2]);
else if (type === 'Torus')
    b.torus('Torus', [0, 0, 0], .95, .38, 0);
else
    b.box('Cube', [0, 0, 0], [1.8, 1.8, 1.8], 0, .12); return b.finish(type); }
export function parseOBJ(text) { const positions = [], uvs = [], normals = [], data = [], parts = []; let part = 'Imported mesh', start = 0, missingUV = false; const resolve = (i, a) => a[i < 0 ? a.length + i : i - 1]; for (const line of text.split(/\r?\n/)) {
    const [t, ...args] = line.trim().split(/\s+/);
    if (t === 'v')
        positions.push(args.slice(0, 3).map(Number));
    else if (t === 'vt')
        uvs.push(args.slice(0, 2).map(Number));
    else if (t === 'vn')
        normals.push(args.slice(0, 3).map(Number));
    else if (t === 'o' || t === 'g') {
        if (data.length / 9 > start)
            parts.push({ name: part, start, count: data.length / 9 - start });
        part = args.join(' ') || 'Part';
        start = data.length / 9;
    }
    else if (t === 'f') {
        const face = args.map(a => a.split('/').map(Number));
        if (face.length > 3) {
            const points = face.map(x => resolve(x[0], positions));
            if (points.some(x => !x))
                throw Error('Invalid OBJ vertex index');
            const n = normalize(cross(sub(points[1], points[0]), sub(points[2], points[1])));
            let sign = 0;
            for (let i = 0; i < points.length; i++) {
                const d = dot(cross(sub(points[(i + 1) % points.length], points[i]), sub(points[(i + 2) % points.length], points[(i + 1) % points.length])), n);
                if (Math.abs(d) > 1e-8) {
                    if (sign && Math.sign(d) !== sign)
                        throw Error('Concave OBJ polygons must be triangulated before import');
                    sign = Math.sign(d);
                }
            }
        }
        for (let j = 1; j < face.length - 1; j++) {
            const tri = [face[0], face[j], face[j + 1]], ps = tri.map(x => resolve(x[0], positions));
            if (ps.some(x => !x))
                throw Error('Invalid OBJ vertex index');
            const n = normalize(cross(sub(ps[1], ps[0]), sub(ps[2], ps[0])));
            const coords = tri.map(x => resolve(x[1], uvs));
            if (coords.some(x => !x))
                missingUV = true;
            const center = coords.every(Boolean) ? coords.reduce((s, x) => [s[0] + x[0] / 3, s[1] + x[1] / 3], [0, 0]) : [0, 0];
            const tu = Math.floor(center[0] + 1e-7), tv = Math.floor(center[1] + 1e-7), tile = tu + tv * 10;
            if (tile < 0 || tile > 3)
                throw Error('This release supports four UDIM tiles: 1001–1004');
            tri.forEach((x, k) => { const uv = coords[k] || [0, 0]; data.push(...ps[k], ...(resolve(x[2], normals) || n), uv[0] - tu, 1 - (uv[1] - tv), tile); });
        }
    }
} if (!data.length)
    throw Error('No triangle geometry found'); if (missingUV)
    throw Error('Mesh has faces without UV coordinates. Unwrap the mesh before importing.'); if (data.length > 13500000)
    throw Error('Mesh exceeds the 500,000 triangle import limit'); parts.push({ name: part, start, count: data.length / 9 - start }); const arr = new Float32Array(data); normalizeMesh(arr); return new Mesh(arr, parts, part); }
export function normalizeMesh(v) { const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < v.length; i += 9)
    for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], v[i + a]);
        max[a] = Math.max(max[a], v[i + a]);
    } const size = Math.max(...max.map((x, a) => x - min[a])); if (!Number.isFinite(size) || size === 0)
    throw Error('Invalid mesh bounds'); for (let i = 0; i < v.length; i += 9)
    for (let a = 0; a < 3; a++)
        v[i + a] = (v[i + a] - (min[a] + max[a]) / 2) * 2.6 / size; }
export function exportOBJ(mesh) { const v = mesh.vertices, lines = ['# Tessera Studio geometry']; for (let i = 0; i < v.length; i += 9)
    lines.push(`v ${v[i]} ${v[i + 1]} ${v[i + 2]}`); for (let i = 0; i < v.length; i += 9)
    lines.push(`vt ${v[i + 6] + v[i + 8]} ${1 - v[i + 7]}`); for (let i = 0; i < v.length; i += 9)
    lines.push(`vn ${v[i + 3]} ${v[i + 4]} ${v[i + 5]}`); for (let i = 1; i <= v.length / 9; i += 3)
    lines.push(`f ${i}/${i}/${i} ${i + 1}/${i + 1}/${i + 1} ${i + 2}/${i + 2}/${i + 2}`); return lines.join('\n'); }
