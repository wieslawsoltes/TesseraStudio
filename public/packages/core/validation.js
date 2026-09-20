import { CHANNELS } from './project.js';
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const channelIds = CHANNELS.map(c => c.id), idOK = s => typeof s === 'string' && s.length > 0 && s.length < 100;
const colorOK = s => typeof s === 'string' && /^#[a-f\d]{6}$/i.test(s);
function layerProps(p) { if (!p || typeof p !== 'object' || Array.isArray(p))
    fail('Invalid layer properties'); const allowed = ['name', 'visible', 'locked', 'opacity', 'blend', 'color', 'pattern', 'scale', 'seed', 'mask']; for (const k of Object.keys(p))
    if (!allowed.includes(k))
        fail('Unsupported layer property'); if ('name' in p && (typeof p.name !== 'string' || p.name.length > 160))
    fail('Invalid layer name'); for (const k of ['visible', 'locked'])
    if (k in p && typeof p[k] !== 'boolean')
        fail('Invalid layer flag'); if ('opacity' in p && (!Number.isFinite(p.opacity) || p.opacity < 0 || p.opacity > 1))
    fail('Invalid opacity'); if ('blend' in p && !['source-over', 'multiply', 'screen', 'overlay', 'soft-light', 'difference', 'lighter'].includes(p.blend))
    fail('Invalid blend mode'); if ('color' in p && !colorOK(p.color))
    fail('Invalid color'); if ('pattern' in p && !['noise', 'checker', 'stripes', 'cells'].includes(p.pattern))
    fail('Invalid pattern'); if ('scale' in p && (!Number.isFinite(p.scale) || p.scale < 1 || p.scale > 128))
    fail('Invalid scale'); if ('mask' in p && p.mask !== null && p.mask !== 'checker')
    fail('Invalid mask'); }
export function validateOperation(op) { if (!op || typeof op !== 'object')
    fail('Invalid operation'); const types = ['addLayer', 'removeLayer', 'setLayer', 'stroke', 'removeStroke', 'reorder', 'graph', 'rename']; if (!types.includes(op.type))
    fail('Unknown operation'); if (!['graph', 'rename'].includes(op.type) && !channelIds.includes(op.channel))
    fail('Invalid channel'); if (['removeLayer', 'setLayer', 'stroke', 'removeStroke'].includes(op.type) && !idOK(op.layerId))
    fail('Invalid layer id'); if (op.type === 'addLayer') {
    const l = op.layer;
    if (!l || !idOK(l.id) || !['paint', 'fill', 'procedural', 'image', 'surface'].includes(l.kind) || typeof l.name !== 'string' || l.name.length > 160 || !Array.isArray(l.strokes) || l.strokes.length > 20000)
        fail('Invalid layer');
    layerProps(Object.fromEntries(Object.entries(l).filter(([k]) => ['name', 'visible', 'locked', 'opacity', 'blend', 'color', 'pattern', 'scale', 'seed', 'mask'].includes(k))));
    if (l.image && (!/^data:image\/(png|jpeg|webp);base64,/.test(l.image) || l.image.length > 12000000))
        fail('Invalid texture image');
    for (const s of l.strokes)
        validateStroke(s);
} if (op.type === 'setLayer')
    layerProps(op.props); if (op.type === 'stroke')
    validateStroke(op.stroke); if (op.type === 'removeStroke' && !idOK(op.strokeId))
    fail('Invalid stroke id'); if (op.type === 'reorder' && (!Array.isArray(op.ids) || op.ids.length > 96 || !op.ids.every(idOK) || new Set(op.ids).size !== op.ids.length))
    fail('Invalid layer order'); if (op.type === 'graph') {
    for (const k of Object.keys(op.props || {}))
        if (!['exposure', 'contrast', 'saturation', 'roughness'].includes(k) || !Number.isFinite(op.props[k]) || Math.abs(op.props[k]) > 8)
            fail('Invalid graph property');
} if (op.type === 'rename' && (typeof op.name !== 'string' || !op.name.trim() || op.name.length > 160))
    fail('Invalid project name'); return op; }
function validateStroke(s) { if (!s || !idOK(s.id) || !Number.isInteger(s.tile) || s.tile < 0 || s.tile > 3 || !colorOK(s.color) || !Number.isFinite(s.size) || s.size < .1 || s.size > 512 || !Array.isArray(s.points) || s.points.length > 20000)
    fail('Invalid stroke'); for (const k of ['opacity', 'hardness', 'flow'])
    if (!Number.isFinite(s[k]) || s[k] < 0 || s[k] > 1)
        fail('Invalid brush value'); for (const p of s.points)
    if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite) || p[0] < 0 || p[0] > 1 || p[1] < 0 || p[1] > 1 || p[2] < 0 || p[2] > 1)
        fail('Invalid stroke point'); }
