import { CHANNELS } from './project.js';
import { clamp, seeded } from './math.js';
const makeCanvas = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) || 0);
export class TextureEngine {
    constructor(project) { this.project = project; this.size = project.resolution; this.composites = new Map(); this.layerCache = new Map(); this.dirty = new Set(CHANNELS.flatMap(c => [0, 1, 2, 3].map(t => `${c.id}:${t}`))); this.images = new Map(); this.uploadDirty = new Set(this.dirty); }
    invalidate(channel = null, tile = null) { for (const c of CHANNELS)
        if (!channel || c.id === channel)
            for (let t = 0; t < 4; t++)
                if (tile === null || t === tile) {
                    this.dirty.add(`${c.id}:${t}`);
                    this.uploadDirty.add(`${c.id}:${t}`);
                } }
    invalidateLayer(id, tile = null) { for (const [k, entry] of this.layerCache)
        if (k.includes(':' + id + ':') && (tile === null || k.endsWith(':' + tile)))
            entry.stamp = null; for (const c of CHANNELS)
        if (this.project.channels[c.id].some(l => l.id === id))
            this.invalidate(c.id, tile); }
    async loadImages() { const all = Object.values(this.project.channels).flat().filter(l => l.image); await Promise.all(all.map(async (l) => { if (!this.images.has(l.image)) {
        const img = new Image();
        img.src = l.image;
        await img.decode();
        this.images.set(l.image, img);
        for (const layer of Object.values(this.project.channels).flat())
            if (layer.image === l.image)
                this.invalidateLayer(layer.id);
    } })); }
    renderLayer(channel, l, tile) {
        const key = `${channel}:${l.id}:${tile}`;
        let entry = this.layerCache.get(key);
        const stamp = JSON.stringify([l.kind, l.color, l.pattern, l.scale, l.seed, l.image, l.tile, l.strokes.length, l.mask]);
        if (entry?.stamp === stamp)
            return entry.canvas;
        const c = entry?.canvas || makeCanvas(this.size), ctx = c.getContext('2d');
        ctx.clearRect(0, 0, this.size, this.size);
        if (l.tile !== undefined && l.tile !== null && l.tile !== tile)
            return c;
        if (l.kind === 'surface')
            this.surface(ctx, channel, tile, l.color);
        else if (l.kind === 'fill') {
            ctx.fillStyle = l.color;
            ctx.fillRect(0, 0, this.size, this.size);
        }
        else if (l.kind === 'procedural')
            this.procedural(ctx, l);
        else if (l.kind === 'image') {
            const im = this.images.get(l.image);
            if (im)
                ctx.drawImage(im, 0, 0, this.size, this.size);
        }
        for (const stroke of l.strokes)
            if (stroke.tile === tile)
                this.drawStroke(ctx, stroke);
        if (l.mask === 'checker') {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-in';
            const mask = makeCanvas(this.size), m = mask.getContext('2d');
            m.fillStyle = 'white';
            const step = this.size / 8;
            for (let y = 0; y < 8; y++)
                for (let x = 0; x < 8; x++)
                    if ((x + y) % 2 === 0)
                        m.fillRect(x * step, y * step, step, step);
            ctx.drawImage(mask, 0, 0);
            ctx.restore();
        }
        entry = { canvas: c, stamp };
        this.layerCache.set(key, entry);
        return c;
    }
    surface(ctx, channel, tile, color) {
        const n = this.size, colors = ['#6a9881', '#b5a07b', '#253039', '#153a42'];
        ctx.fillStyle = channel === 'basecolor' ? colors[tile] : channel === 'roughness' ? ['#858585', '#777777', '#b5b5b5', '#383838'][tile] : channel === 'metallic' ? ['#777777', '#dddddd', '#555555', '#999999'][tile] : channel === 'normal' ? '#8080ff' : channel === 'height' ? '#808080' : '#000000';
        ctx.fillRect(0, 0, n, n);
        if (channel === 'normal' || channel === 'emission')
            return;
        const rnd = seeded(270 + tile);
        ctx.save();
        for (let i = 0; i < 4600; i++) {
            const x = rnd() * n, y = rnd() * n, s = rnd() * 3 + .3;
            ctx.fillStyle = `rgba(${rnd() > .45 ? '12,25,25' : '221,231,212'},${rnd() * .10})`;
            ctx.fillRect(x, y, s, s);
        }
        if (channel === 'basecolor' && tile === 0) {
            ctx.strokeStyle = '#1b3c354f';
            ctx.lineWidth = n * .006;
            ctx.strokeRect(n * .02, n * .015, n * .96, n * .97);
            for (const x of [.12, .42, .59, .89]) {
                ctx.beginPath();
                ctx.moveTo(n * x, 0);
                ctx.lineTo(n * x, n);
                ctx.stroke();
            }
            ctx.fillStyle = '#d3c5a2';
            ctx.fillRect(n * .235, 0, n * .043, n);
            ctx.fillRect(n * .295, 0, n * .006, n);
            ctx.globalAlpha = .65;
            ctx.font = `600 ${n * .12}px sans-serif`;
            ctx.fillStyle = '#e4e0cb';
            ctx.textAlign = 'center';
            ctx.fillText('07', n * .65, n * .56);
            ctx.font = `500 ${n * .021}px sans-serif`;
            ctx.fillText('S C O U T', n * .65, n * .61);
            ctx.fillStyle = '#e4cf9e';
            for (let i = 0; i < 8; i++)
                ctx.fillRect(n * (.58 + i * .014), n * .67, n * .008, n * .035);
            ctx.globalAlpha = 1;
            for (let i = 0; i < 140; i++) {
                ctx.fillStyle = rnd() > .4 ? '#c5baa283' : '#233b3566';
                const x = rnd() * n, y = rnd() * n;
                ctx.fillRect(x, y, rnd() * 8 + 1, rnd() * 2 + .5);
            }
        }
        if (channel === 'basecolor' && tile === 3) {
            const g = ctx.createLinearGradient(0, 0, n, n);
            g.addColorStop(0, '#336675');
            g.addColorStop(.3, '#0e2027');
            g.addColorStop(.7, '#1e4850');
            g.addColorStop(1, '#102931');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, n, n);
            ctx.fillStyle = '#91dddc28';
            ctx.fillRect(n * .18, 0, n * .18, n);
            ctx.fillStyle = '#9de7e629';
            ctx.fillRect(n * .38, 0, n * .025, n);
            ctx.strokeStyle = '#4d86855c';
            ctx.lineWidth = 2;
            for (let y = 0; y < n; y += n / 42) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(n, y);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
    procedural(ctx, l) { const n = this.size, small = 256, c = makeCanvas(small), cctx = c.getContext('2d'), im = cctx.createImageData(small, small), rgb = hexRGB(l.color), rnd = seeded(l.seed || 42), scale = l.scale || 12, gridSize = Math.ceil(scale) + 2, grid = Array.from({ length: gridSize * gridSize }, () => rnd()); const noise = (x, y) => { const gx = x / 256 * scale, gy = y / 256 * scale, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy; return (grid[iy * gridSize + ix] * (1 - fx) + grid[iy * gridSize + ix + 1] * fx) * (1 - fy) + (grid[(iy + 1) * gridSize + ix] * (1 - fx) + grid[(iy + 1) * gridSize + ix + 1] * fx) * fy; }; for (let y = 0; y < small; y++)
        for (let x = 0; x < small; x++) {
            let v = l.pattern === 'checker' ? ((Math.floor(x / 256 * scale) + Math.floor(y / 256 * scale)) % 2 ? 1 : .18) : l.pattern === 'stripes' ? (Math.sin((x + y) * scale * .04) > .1 ? 1 : .2) : l.pattern === 'cells' ? (Math.sin(x * .012 * scale) * Math.cos(y * .012 * scale) * .4 + .6) : noise(x, y);
            const i = (y * small + x) * 4;
            for (let k = 0; k < 3; k++)
                im.data[i + k] = rgb[k] * (.25 + .75 * v);
            im.data[i + 3] = 255;
        } cctx.putImageData(im, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(c, 0, 0, n, n); }
    drawStroke(ctx, s) { ctx.save(); ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'; const n = this.size; for (const [u, v, pressure = 1] of s.points) {
        const r = Math.max(.4, s.size * pressure / 2), x = u * n, y = v * n;
        ctx.globalAlpha = clamp((s.opacity ?? 1) * (s.flow ?? 1));
        if (s.hardness >= .98) {
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        else {
            const g = ctx.createRadialGradient(x, y, r * clamp(s.hardness ?? .6, 0, .98), x, y, r);
            g.addColorStop(0, s.color);
            g.addColorStop(1, s.color + '00');
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
    } ctx.restore(); }
    composite(channel, tile) { const key = `${channel}:${tile}`; let c = this.composites.get(key); if (!c) {
        c = makeCanvas(this.size);
        this.composites.set(key, c);
    } if (this.dirty.has(key)) {
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, this.size, this.size);
        const def = CHANNELS.find(x => x.id === channel)?.default || '#000000';
        ctx.fillStyle = def;
        ctx.fillRect(0, 0, this.size, this.size);
        for (const l of this.project.channels[channel])
            if (l.visible && l.opacity > 0) {
                ctx.save();
                ctx.globalAlpha = l.opacity;
                ctx.globalCompositeOperation = l.blend || 'source-over';
                ctx.drawImage(this.renderLayer(channel, l, tile), 0, 0);
                ctx.restore();
            }
        this.dirty.delete(key);
    } return c; }
    flush() { const changed = []; for (const key of [...this.uploadDirty]) {
        const [channel, t] = key.split(':');
        changed.push({ channel, tile: +t, index: CHANNELS.findIndex(c => c.id === channel) * 4 + (+t), canvas: this.composite(channel, +t) });
        this.uploadDirty.delete(key);
    } return changed; }
    clear() { this.layerCache.clear(); this.composites.clear(); this.invalidate(); }
}
