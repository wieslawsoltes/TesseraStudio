export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, s) => a.map(v => v * s);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normalize = a => mul(a, 1 / (Math.hypot(...a) || 1));
export const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export function multiply(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
        for (let k = 0; k < 4; k++)
            o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
export function perspective(fov, aspect, near = .05, far = 100) { const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far); return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]); }
export function lookAt(eye, target, up = [0, 1, 0]) { const z = normalize(sub(eye, target)), x = normalize(cross(up, z)), y = cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]); }
export function inverse(a) { const m = Array.from({ length: 4 }, (_, r) => Array.from({ length: 8 }, (_, c) => c < 4 ? a[c * 4 + r] : +(r === c - 4))); for (let k = 0; k < 4; k++) {
    let p = k;
    for (let j = k + 1; j < 4; j++)
        if (Math.abs(m[j][k]) > Math.abs(m[p][k]))
            p = j;
    if (Math.abs(m[p][k]) < 1e-12)
        return null;
    [m[k], m[p]] = [m[p], m[k]];
    const v = m[k][k];
    m[k] = m[k].map(x => x / v);
    for (let j = 0; j < 4; j++)
        if (j !== k) {
            const t = m[j][k];
            m[j] = m[j].map((x, i) => x - t * m[k][i]);
        }
} return new Float32Array(Array.from({ length: 16 }, (_, i) => m[i % 4][4 + Math.floor(i / 4)])); }
export function transform(m, p, w = 1) { return Array.from({ length: 4 }, (_, r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r] * w); }
export class OrbitCamera {
    constructor() { this.yaw = .48; this.pitch = .13; this.distance = 6; this.target = [0, .05, 0]; this.fov = .65; }
    eye() { return add(this.target, [Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance, Math.sin(this.pitch) * this.distance, Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance]); }
    matrix(aspect) { return multiply(perspective(this.fov, aspect), lookAt(this.eye(), this.target)); }
    ray(x, y, aspect) { const inv = inverse(this.matrix(aspect)), a = transform(inv, [x, y, -1]), b = transform(inv, [x, y, 1]); const p = a.slice(0, 3).map(v => v / a[3]), q = b.slice(0, 3).map(v => v / b[3]); return { origin: p, direction: normalize(sub(q, p)) }; }
    orbit(dx, dy) { this.yaw -= dx * .008; this.pitch = clamp(this.pitch + dy * .008, -1.45, 1.45); }
    zoom(d) { this.distance = clamp(this.distance * Math.exp(d * .001), 1.8, 24); }
    pan(dx, dy) { const right = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)]; this.target = add(this.target, add(mul(right, -dx * this.distance * .0007), [0, dy * this.distance * .0007, 0])); }
    reset() { this.yaw = .48; this.pitch = .13; this.distance = 6; this.target = [0, .05, 0]; }
}
export function seeded(seed = 42) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
