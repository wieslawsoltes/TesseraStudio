export const VERSION = 1;
export const CHANNELS = [{ id: 'basecolor', name: 'Base color', color: '#76a593', space: 'sRGB', default: '#708f7d' }, { id: 'roughness', name: 'Roughness', color: '#afada5', space: 'Raw', default: '#888888' }, { id: 'metallic', name: 'Metallic', color: '#8d9faa', space: 'Raw', default: '#666666' }, { id: 'normal', name: 'Normal', color: '#9297d5', space: 'Raw', default: '#8080ff' }, { id: 'height', name: 'Height', color: '#9eab9c', space: 'Raw', default: '#808080' }, { id: 'emission', name: 'Emission', color: '#c3aa75', space: 'sRGB', default: '#000000' }];
export const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const copy = x => JSON.parse(JSON.stringify(x));
export function createLayer(name = 'Paint layer', kind = 'paint', props = {}) { return { id: uid(), name, kind, visible: true, locked: false, opacity: 1, blend: 'source-over', color: '#73d3b8', pattern: 'noise', scale: 12, seed: 42, strokes: [], ...props }; }
export function createProject(name = 'Scout • surface exploration', model = 'Scout helmet', resolution = 1024) { return { format: 'tessera', version: VERSION, id: uid(), name, model, resolution, tiles: [1001, 1002, 1003, 1004], createdAt: new Date().toISOString(), channels: Object.fromEntries(CHANNELS.map(c => [c.id, [createLayer(c.name + ' foundation', 'surface', { id: `${c.id}-base`, locked: true, color: c.default }), ...(c.id === 'basecolor' ? [createLayer('Paint details', 'paint', { id: 'basecolor-paint' })] : [])]])), graph: { exposure: 0, contrast: 1, saturation: 1, roughness: 1 }, meshData: null }; }
export function validateProject(p) { if (!p || p.format !== 'tessera' || p.version !== VERSION)
    throw Error('Unsupported Tessera project version'); if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 160 || typeof p.model !== 'string')
    throw Error('Invalid project metadata'); if (!p.graph || !['exposure', 'contrast', 'saturation', 'roughness'].every(k => Number.isFinite(p.graph[k]) && Math.abs(p.graph[k]) <= 8))
    throw Error('Invalid shading settings'); if (![256, 512, 1024, 2048].includes(p.resolution))
    throw Error('Unsupported texture resolution'); if (!Array.isArray(p.tiles) || p.tiles.length !== 4 || p.tiles.some((x, i) => x !== 1001 + i))
    throw Error('Supported tiles are 1001–1004'); let count = 0; for (const c of CHANNELS) {
    const layers = p.channels?.[c.id];
    if (!Array.isArray(layers) || layers.length > 48)
        throw Error('Invalid layer stack');
    const ids = new Set();
    for (const l of layers) {
        if (typeof l.id !== 'string' || ids.has(l.id))
            throw Error('Invalid layer identity');
        ids.add(l.id);
        if (typeof l.name !== 'string' || l.name.length > 160 || !/^#[a-f0-9]{6}$/i.test(l.color) || !Array.isArray(l.strokes) || typeof l.visible !== 'boolean' || typeof l.locked !== 'boolean')
            throw Error('Invalid layer data');
        if (l.tile !== undefined && l.tile !== null && (!Number.isInteger(l.tile) || l.tile < 0 || l.tile > 3))
            throw Error('Invalid layer tile');
        if (!['source-over', 'multiply', 'screen', 'overlay', 'soft-light', 'difference', 'lighter'].includes(l.blend))
            throw Error('Unsupported layer blend mode');
        if (!['paint', 'fill', 'surface', 'procedural', 'image'].includes(l.kind))
            throw Error('Unsupported layer type');
        if (!Number.isFinite(l.opacity) || l.opacity < 0 || l.opacity > 1)
            throw Error('Invalid layer opacity');
        if (l.image && !/^data:image\/(png|jpeg|webp);base64,/.test(l.image))
            throw Error('Only embedded PNG, JPEG and WebP images are supported');
        for (const s of l.strokes) {
            if (typeof s.id !== 'string' || !Number.isInteger(s.tile) || s.tile < 0 || s.tile > 3 || !/^#[a-f0-9]{6}$/i.test(s.color) || !Number.isFinite(s.size) || s.size < .1 || s.size > 512 || !['opacity', 'flow', 'hardness'].every(k => Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 1))
                throw Error('Invalid brush stroke');
            count += s.points?.length || 0;
            if (!Array.isArray(s.points) || !s.points.every(p => p.length === 3 && p.every(x => Number.isFinite(x) && x >= 0 && x <= 1)))
                throw Error('Invalid stroke points');
        }
    }
} if (count > 2000000)
    throw Error('Project exceeds the two million stamp limit'); if (p.meshData) {
    if (!Array.isArray(p.meshData.vertices) || p.meshData.vertices.length % 27 || p.meshData.vertices.length > 13500000 || !p.meshData.vertices.every(Number.isFinite))
        throw Error('Invalid project mesh');
    for (let i = 8; i < p.meshData.vertices.length; i += 9)
        if (!Number.isInteger(p.meshData.vertices[i]) || p.meshData.vertices[i] < 0 || p.meshData.vertices[i] > 3)
            throw Error('Invalid mesh UV tile');
} return p; }
export function applyOperation(p, op) { const layers = p.channels[op.channel], find = () => layers?.find(x => x.id === op.layerId); switch (op.type) {
    case 'addLayer':
        if (layers && !layers.some(x => x.id === op.layer.id))
            layers.splice(op.index ?? layers.length, 0, copy(op.layer));
        break;
    case 'removeLayer':
        if (layers) {
            const i = layers.findIndex(x => x.id === op.layerId);
            if (i >= 0)
                layers.splice(i, 1);
        }
        break;
    case 'setLayer': {
        const l = find();
        if (l)
            Object.assign(l, copy(op.props));
        break;
    }
    case 'stroke': {
        const l = find();
        if (l && !l.strokes.some(s => s.id === op.stroke.id))
            l.strokes.push(copy(op.stroke));
        break;
    }
    case 'removeStroke': {
        const l = find();
        if (l)
            l.strokes = l.strokes.filter(s => s.id !== op.strokeId);
        break;
    }
    case 'reorder':
        if (layers) {
            const map = new Map(layers.map(l => [l.id, l]));
            p.channels[op.channel] = [...op.ids.map(id => map.get(id)).filter(Boolean), ...layers.filter(l => !op.ids.includes(l.id))];
        }
        break;
    case 'graph':
        Object.assign(p.graph, op.props);
        break;
    case 'rename':
        p.name = String(op.name).slice(0, 160);
        break;
    default: throw Error('Unknown operation ' + op.type);
} return p; }
export function inverseOperation(p, op) { const layers = p.channels[op.channel], l = layers?.find(x => x.id === op.layerId); switch (op.type) {
    case 'addLayer': return { type: 'removeLayer', channel: op.channel, layerId: op.layer.id };
    case 'removeLayer': return l ? { type: 'addLayer', channel: op.channel, layer: copy(l), index: layers.indexOf(l) } : null;
    case 'setLayer': return l ? { type: 'setLayer', channel: op.channel, layerId: l.id, props: Object.fromEntries(Object.keys(op.props).map(k => [k, copy(l[k] ?? null)])) } : null;
    case 'stroke': return { type: 'removeStroke', channel: op.channel, layerId: op.layerId, strokeId: op.stroke.id };
    case 'removeStroke': return l ? { type: 'stroke', channel: op.channel, layerId: op.layerId, stroke: copy(l.strokes.find(s => s.id === op.strokeId)) } : null;
    case 'reorder': return { type: 'reorder', channel: op.channel, ids: layers.map(l => l.id) };
    case 'graph': return { type: 'graph', props: copy(p.graph) };
    case 'rename': return { type: 'rename', name: p.name };
    default: return null;
} }
export class CommandHistory {
    constructor(limit = 80) { this.undoStack = []; this.redoStack = []; this.limit = limit; }
    execute(project, op, label) { const inverse = inverseOperation(project, op); applyOperation(project, op); this.undoStack.push({ op: copy(op), inverse, label, time: Date.now() }); if (this.undoStack.length > this.limit)
        this.undoStack.shift(); this.redoStack = []; return op; }
    undo(project) { const entry = this.undoStack.pop(); if (!entry?.inverse)
        return null; applyOperation(project, entry.inverse); this.redoStack.push(entry); return entry.inverse; }
    redo(project) { const entry = this.redoStack.pop(); if (!entry)
        return null; applyOperation(project, entry.op); this.undoStack.push(entry); return entry.op; }
}
export const MATERIALS = [{ name: 'Patina', color: '#598d7d', rough: .55, metal: .65 }, { name: 'Brushed gold', color: '#c49c5c', rough: .32, metal: .92 }, { name: 'Porcelain', color: '#c9cfc2', rough: .22, metal: .05 }, { name: 'Carbon', color: '#222b30', rough: .63, metal: .25 }, { name: 'Terracotta', color: '#b5684e', rough: .81, metal: .03 }, { name: 'Cobalt', color: '#4c729a', rough: .35, metal: .7 }, { name: 'Titanium', color: '#a0a9aa', rough: .27, metal: .95 }, { name: 'Signal red', color: '#b44e45', rough: .38, metal: .12 }, { name: 'Ivory', color: '#d6cbb1', rough: .65, metal: .08 }];
