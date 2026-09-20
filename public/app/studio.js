import { OrbitCamera, clamp, seeded } from '../packages/core/math.js';
import { createDemoMesh, createPrimitive, parseOBJ, exportOBJ, Mesh } from '../packages/core/mesh.js';
import { CHANNELS, MATERIALS, createProject, createLayer, uid, copy, validateProject, CommandHistory, applyOperation } from '../packages/core/project.js';
import { TextureEngine } from '../packages/core/texture.js';
import { StudioRenderer } from '../packages/renderer/index.js';
import { icon, button, escapeHTML as esc, toast, dialog } from '../packages/controls/index.js';
import { BrowserProjectService } from '../packages/storage/index.js';
import { CollaborationClient } from '../packages/collaboration/index.js';
const browserStorage = document.querySelector('meta[name="tessera-storage"]')?.content === 'browser';
const storageScope = new URL('../', import.meta.url).pathname;
const localService = browserStorage ? new BrowserProjectService({ databaseName: 'tessera-projects:' + storageScope }) : null;
const savedLabel = browserStorage ? 'Saved in this browser' : 'All changes saved';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
let project = createProject(), mesh = createDemoMesh(), textures = new TextureEngine(project), history = new CommandHistory(), renderer, camera = new OrbitCamera(), collab = null, needsRender = true, stroke = null, drag = null, lastHit = null, loading = false;
const state = { channel: 'basecolor', layer: 'basecolor-paint', tool: 'brush', view: '3d', lower: 'graph', shelf: 'materials', tile: 0, color: '#e3c38c', size: 36, opacity: 1, hardness: .72, flow: .7, spacing: .18, symmetry: false, uvWire: true, turntable: false, cloudId: null, memberRole: 'owner', activeMaterial: 0 };
function shell() {
    $('#app').innerHTML = `<main class="app">
<header class="topbar"><div class="brand"><img src="${new URL('../favicon.svg', import.meta.url).href}" alt="">Tessera<span>STUDIO</span></div><div class="project-title"><b id="project-name">${esc(project.name)}</b><span class="muted"> &nbsp;/&nbsp; Texturing</span></div><span class="spacer"></span><span class="save-state" id="save-state">Unsaved project</span><button data-action="projects" title="Open projects">${icon('folder')}<span class="mobile-hide">Projects</span></button><button data-action="share" class="secondary">${icon('share')} Share</button><button data-action="export" class="primary">${icon('download')} Export</button></header>
<nav class="menubar" aria-label="Application menu">${['File', 'Edit', 'Paint', 'View', 'Help'].map(m => `<div class="menu-wrap"><button data-menu="${m}">${m}</button></div>`).join('')}<span class="spacer"></span><span class="muted tiny workspace-label">WORKSPACE</span><button data-action="layout-paint" class="active">Painting ${icon('down')}</button></nav>
<div class="contextbar"><button data-action="brush-settings">${icon('brush')}<span class="mobile-hide">Paint brush</span></button><span class="separator"></span><label>Size<input id="brush-size" type="range" min="1" max="180" value="36" aria-label="Brush size"><output id="size-value">36</output></label><label>Opacity<input id="brush-opacity" type="range" min="1" max="100" value="100" aria-label="Brush opacity"><output id="opacity-value">100%</output></label><label class="optional">Flow<input id="brush-flow" type="range" min="1" max="100" value="70" aria-label="Brush flow"><output id="flow-value">70%</output></label><span class="separator optional"></span><label class="mobile-hide"><input type="color" id="paint-color" value="${state.color}" aria-label="Paint color"><span id="paint-hex">${state.color.toUpperCase()}</span></label><span class="spacer"></span><button data-action="symmetry" id="symmetry" title="UV mirror symmetry (X)">${icon('symmetry')}<span class="optional">Symmetry</span></button>${button('undo', 'undo', 'Undo (Ctrl+Z)')}${button('redo', 'redo', 'Redo (Ctrl+Shift+Z)')}</div>
<div class="workspace"><aside class="leftbar" aria-label="Project and assets"><div class="section-head">Project <span class="spacer"></span>${button('import-mesh', 'plus', 'Import geometry')}</div><div class="scene-row selected">${icon('cube')}<span id="model-name">Scout helmet</span><span class="spacer"></span>${icon('eye')}</div><div class="scene-row indent">${icon('layers')}<span>Texture set</span><span class="spacer"></span><span class="badge">4 UDIMs</span></div><div class="scene-row indent muted">${icon('sun')}<span>Studio lighting</span></div><div class="section-head">Channels<span class="spacer"></span><span class="muted tiny">6</span></div><div class="channels">${CHANNELS.map(c => `<button class="channel ${c.id === state.channel ? 'active' : ''}" data-channel="${c.id}"><span class="channel-dot" style="background:${c.color}"></span>${c.name}<small>${c.space}</small></button>`).join('')}</div><div class="section-head">Asset shelf<span class="spacer"></span>${button('import-image', 'upload', 'Import texture image')}</div><div class="panel-tabs"><button data-shelf="materials" class="active">Materials</button><button data-shelf="brushes">Brushes</button><button data-shelf="images">Images</button></div><div class="section-body"><input class="search" id="asset-search" placeholder="Search assets…" aria-label="Search assets"><div id="shelf"></div></div></aside>
<nav class="toolstrip" aria-label="Painting tools">${[['brush', 'brush', 'Paint (B)'], ['erase', 'erase', 'Erase (E)'], ['fill', 'fill', 'Fill layer (G)'], ['pick', 'pipette', 'Pick color (I)']].map(([a, i, t]) => button('tool-' + a, i, t, `class="${a === 'brush' ? 'active' : ''}"`)).join('')}<hr>${button('tool-orbit', 'hand', 'Orbit (O), Alt + drag')}${button('frame', 'frame', 'Frame model (F)')}${button('grid', 'grid', 'Toggle ground grid')}<hr>${button('import-image', 'image', 'Add image layer')}${button('add-procedural', 'node', 'Add procedural layer')}<span class="spacer"></span>${button('theme', 'moon', 'Toggle light or dark theme')}${button('help', 'info', 'Shortcuts and help')}</nav>
<section class="center"><div class="viewport-wrap"><div class="view-tabs"><button data-view="3d" class="active">Perspective</button><button data-view="uv">UV</button><button data-view="split">3D / UV</button><span class="spacer"></span><select id="shading" aria-label="Viewport shading"><option value="0">PBR material</option>${CHANNELS.map((c, i) => `<option value="${i + 1}">${c.name}</option>`).join('')}</select>${button('lighting', 'sun', 'Lighting settings')}${button('frame', 'frame', 'Frame model')}</div><div class="canvas-area"><canvas id="viewport" aria-label="3D texture-painting viewport"></canvas><canvas id="uvcanvas" class="hide" aria-label="UV texture-painting viewport"></canvas></div><div class="viewport-caption"><div class="eyebrow">SURFACE STUDY / 001</div><h2 id="asset-caption">Scout helmet</h2><p id="viewport-detail">Base color · 4 tiles · 1024 × 1024</p></div><div class="axis"><svg viewBox="0 0 50 50"><path d="M24 28V4" stroke="#79b797"/><path d="M24 28 45 37" stroke="#c5817a"/><path d="M24 28 5 40" stroke="#7b99c2"/><circle cx="24" cy="28" r="3" fill="#a4b3b6"/><text x="20" y="9" fill="#9eddb9">Y</text><text x="40" y="46" fill="#e6a29b">X</text><text x="0" y="48" fill="#9dbbe3">Z</text></svg></div><div class="brush-cursor"></div><div class="canvas-footer"><span class="engine-badge" id="engine-badge">INITIALIZING</span><span class="hint">Alt + drag to orbit · Scroll to zoom</span><span class="spacer"></span><button data-action="turntable" title="Turntable preview">${icon('play')}</button></div></div><section class="lower"><div class="lower-bar">${[['graph', 'node', 'Shading graph'], ['tiles', 'grid', 'UDIM tiles'], ['history', 'clock', 'History'], ['review', 'comment', 'Review']].map(([a, i, t]) => `<button data-lower="${a}" class="${a === 'graph' ? 'active' : ''}">${icon(i)}${t}</button>`).join('')}<span class="spacer"></span>${button('lower-action', 'plus', 'Add to workspace')}</div><div class="lower-content" id="lower-content"></div></section></section>
<aside class="rightbar" aria-label="Layers and paint properties"><div class="section-head">Layers <span class="spacer"></span><select id="layer-channel" aria-label="Active channel" style="font-size:11px;max-width:115px;padding:4px">${CHANNELS.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div class="layer-controls"><select id="layer-blend" aria-label="Layer blending mode"><option value="source-over">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="soft-light">Soft light</option><option value="difference">Difference</option><option value="lighter">Add</option></select><input id="layer-opacity" type="number" min="0" max="100" value="100" aria-label="Layer opacity"></div><tessera-layer-stack role="listbox" aria-label="Texture layers"></tessera-layer-stack><div class="layer-actions">${button('add-layer', 'plus', 'New paint layer')}${button('add-fill', 'fill', 'New fill layer')}${button('add-procedural', 'node', 'New procedural layer')}${button('add-mask', 'grid', 'Toggle checker mask')}${button('duplicate-layer', 'copy', 'Duplicate layer')}${button('move-up', 'arrowup', 'Move layer up')}${button('move-down', 'arrowdown', 'Move layer down')}<span class="spacer"></span>${button('delete-layer', 'trash', 'Delete layer')}</div><div class="section-head">Paint properties <span class="spacer"></span>${icon('settings')}</div><div class="section-body"><canvas id="brush-preview" class="brush-preview" width="240" height="52"></canvas><div class="property-row"><label>Brush tip</label><select id="brush-tip"><option value="round">Round</option><option value="soft">Soft airbrush</option><option value="ink">Hard ink</option><option value="grain">Dry brush</option></select></div><div class="property-row"><label>Hardness</label><output id="hardness-value">72%</output></div><input id="brush-hardness" type="range" min="0" max="100" value="72" aria-label="Brush hardness"><div class="property-row"><label>Spacing</label><output id="spacing-value">18%</output></div><input id="brush-spacing" type="range" min="5" max="100" value="18" aria-label="Brush spacing"><div class="property-row"><label>Tablet pressure</label><span class="muted">Size</span></div></div><div class="section-head">Color <span class="spacer"></span><span class="tiny muted" id="color-space">sRGB</span></div><div class="section-body"><div class="color-row"><input type="color" id="color-large" class="color-main" value="${state.color}" aria-label="Paint color"><div><div class="hex-value" id="color-hex">${state.color.toUpperCase()}</div><div class="tiny muted">Foreground color</div></div><span class="spacer"></span>${button('tool-pick', 'pipette', 'Pick from texture')}</div><div class="swatches">${['#e3c38c', '#72b3a0', '#e1e1d2', '#37474b', '#b16951', '#6693ad', '#151e25', '#ffffff'].map(c => `<button class="swatch" data-color="${c}" style="background:${c}" aria-label="Use ${c}"></button>`).join('')}</div></div><div class="section-head">Texture set<span class="spacer"></span>${button('project-settings', 'settings', 'Project settings')}</div><div class="section-body tiny muted"><div class="property-row"><label>Resolution</label><span id="resolution-label">1024 × 1024</span></div><div class="property-row"><label>Bit depth</label><span>8-bit / channel</span></div><div class="property-row"><label>Active tile</label><select id="active-tile">${project.tiles.map((t, i) => `<option value="${i}">${t}</option>`).join('')}</select></div></div></aside></div>
<footer class="statusbar"><span id="status-tool">Paint brush</span><span class="optional">${icon('cube').replace('class="icon"', 'class="icon" style="width:11px;height:11px;vertical-align:middle"')} <b id="mesh-stats">${mesh.triangleCount.toLocaleString()} triangles</b></span><span class="optional">UV tiles <b>1001–1004</b></span><span class="spacer"></span><span id="render-stats">Starting renderer…</span><span class="optional">Tessera 0.1</span></footer></main>`;
}
function selected() { return project.channels[state.channel].find(l => l.id === state.layer); }
function refresh() { $('#project-name').textContent = project.name; $('#model-name').textContent = mesh.name; $('#asset-caption').textContent = mesh.name; $('#mesh-stats').textContent = mesh.triangleCount.toLocaleString() + ' triangles'; $('#resolution-label').textContent = `${project.resolution} × ${project.resolution}`; $('#viewport-detail').textContent = `${CHANNELS.find(c => c.id === state.channel).name} · Tile ${1001 + state.tile} · ${project.resolution} × ${project.resolution}`; $('#color-space').textContent = CHANNELS.find(c => c.id === state.channel).space; const stack = $('tessera-layer-stack'); stack.layers = project.channels[state.channel]; if (!selected())
    state.layer = project.channels[state.channel].at(-1)?.id; stack.selected = state.layer; const l = selected(); $('#layer-blend').value = l?.blend || 'source-over'; $('#layer-opacity').value = Math.round((l?.opacity ?? 1) * 100); $('#layer-channel').value = state.channel; $$('[data-channel]').forEach(b => b.classList.toggle('active', b.dataset.channel === state.channel)); $('#active-tile').value = state.tile; renderLower(); needsRender = true; }
function setColor(c) { state.color = c; $('#paint-color').value = c; $('#color-large').value = c; $('#paint-hex').textContent = c.toUpperCase(); $('#color-hex').textContent = c.toUpperCase(); drawBrushPreview(); }
function setTool(tool) { state.tool = tool; $$('[data-action^="tool-"]').forEach(b => b.classList.toggle('active', b.dataset.action === 'tool-' + tool)); $('#status-tool').textContent = ({ brush: 'Paint brush', erase: 'Erase brush', fill: 'Fill layer', pick: 'Pick color', orbit: 'Orbit camera' })[tool]; }
function setChannel(c) { state.channel = c; state.layer = project.channels[c].at(-1)?.id; refresh(); }
function commit(op, label = 'Edit') { if (loading)
    return; if (state.memberRole === 'viewer')
    return toast('This project is open for review. Ask its owner for editing access.', true); history.execute(project, op, label); if (op.channel) {
    if (op.layerId)
        textures.invalidateLayer(op.layerId, op.stroke?.tile ?? null);
    textures.invalidate(op.channel, op.stroke?.tile ?? null);
}
else if (op.type !== 'graph' && op.type !== 'rename')
    textures.clear(); collab?.enqueue(op); $('#save-state').textContent = collab ? 'Syncing edits…' : 'Unsaved changes'; refresh(); }
function addLayer(kind = 'paint', props = {}) { const names = { paint: 'Paint layer', fill: 'Color fill', procedural: 'Procedural texture', image: 'Image texture' }; const layer = createLayer(names[kind], kind, { color: state.color, ...props }); state.layer = layer.id; commit({ type: 'addLayer', channel: state.channel, layer }, 'Add ' + kind + ' layer'); return layer; }
function setView(view) { state.view = view; $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view)); $('.canvas-area').classList.toggle('split', view === 'split'); renderer.canvas.classList.toggle('hide', view === 'uv'); $('#uvcanvas').classList.toggle('hide', view === '3d'); $('.axis').classList.toggle('hide', view === 'uv'); $('.viewport-caption').classList.toggle('hide', view === 'uv'); needsRender = true; }
function renderShelf() { const q = ($('#asset-search').value || '').toLowerCase(); if (state.shelf === 'materials') {
    $('#shelf').innerHTML = `<div class="shelf-grid">${MATERIALS.map((m, i) => m.name.toLowerCase().includes(q) ? `<button class="material-card ${state.activeMaterial === i ? 'active' : ''}" data-material="${i}" title="Apply ${m.name} to active UDIM tile"><canvas width="100" height="100" data-material-sphere="${i}"></canvas><span>${m.name}</span></button>` : '').join('')}</div><p class="shelf-note">Apply a material to the active tile. Paint on a layer above it.</p>`;
    $$('[data-material-sphere]').forEach(c => drawMaterial(c, MATERIALS[+c.dataset.materialSphere]));
}
else if (state.shelf === 'brushes') {
    $('#shelf').innerHTML = `<div class="shelf-grid">${[['round', 'Round'], ['soft', 'Airbrush'], ['ink', 'Ink'], ['grain', 'Dry brush']].filter(([, n]) => n.toLowerCase().includes(q)).map(([id, n]) => `<button class="material-card" data-brush="${id}"><canvas width="100" height="100" data-brush-preview="${id}"></canvas><span>${n}</span></button>`).join('')}</div><p class="shelf-note">Pressure-sensitive size. Adjust flow and spacing above.</p>`;
    $$('[data-brush-preview]').forEach(c => { const ctx = c.getContext('2d'), g = ctx.createRadialGradient(50, 50, c.dataset.brushPreview === 'ink' ? 29 : 3, 50, 50, 32); g.addColorStop(0, '#d5e3db'); g.addColorStop(1, '#d5e3db00'); ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100); });
}
else {
    const imgs = Object.values(project.channels).flat().filter(l => l.image);
    $('#shelf').innerHTML = `<div class="shelf-grid">${imgs.filter(l => l.name.toLowerCase().includes(q)).map(l => `<button class="material-card" data-image-layer="${l.id}"><img src="${l.image}" width="50" height="50" style="object-fit:cover" alt=""><span>${esc(l.name)}</span></button>`).join('')}</div><button data-action="import-image" class="secondary" style="margin-top:12px;width:100%">${icon('upload')} Import image</button><p class="shelf-note">PNG, JPEG and WebP textures. Images stay embedded in your project.</p>`;
} }
function drawMaterial(canvas, m) { const ctx = canvas.getContext('2d'), im = ctx.createImageData(100, 100), rgb = [1, 3, 5].map(i => parseInt(m.color.slice(i, i + 2), 16)), rnd = seeded(11); for (let y = 0; y < 100; y++)
    for (let x = 0; x < 100; x++) {
        const nx = (x - 50) / 45, ny = (y - 50) / 45, r = nx * nx + ny * ny;
        if (r > 1)
            continue;
        const z = Math.sqrt(1 - r), light = Math.max(0, (-nx * .45 - ny * .65 + z * .65)), spec = Math.pow(Math.max(0, -nx * .35 - ny * .5 + z * .8), 10 + (1 - m.rough) * 60), s = .27 + light * .7 + spec * .8, idx = (y * 100 + x) * 4;
        rgb.forEach((v, k) => im.data[idx + k] = clamp(v * s + spec * 65 + (rnd() - .5) * 9, 0, 255));
        im.data[idx + 3] = 255;
    } ctx.putImageData(im, 0, 0); }
function renderLower() { const container = $('#lower-content'); $$('[data-lower]').forEach(b => b.classList.toggle('active', b.dataset.lower === state.lower)); if (state.lower === 'graph') {
    container.innerHTML = `<div class="graph"><svg viewBox="0 0 750 165" preserveAspectRatio="none"><path d="M150 65C190 65 175 68 215 68M355 68C390 68 370 90 408 90M548 90C590 90 560 68 608 68" fill="none" stroke="#78a99e" stroke-width="2"/></svg><div class="node" data-node="source" style="left:3%;top:29px"><div class="node-title">${icon('layers')}Texture channels</div><div class="node-body"><span class="node-preview" style="background:#638e7a"></span><span>6 channels<br>4 UDIM tiles</span></div><i class="node-port out"></i></div><div class="node selected" data-node="grade" style="left:29%;top:32px"><div class="node-title">${icon('settings')}Color grade</div><div class="node-body">Exposure ${project.graph.exposure.toFixed(1)}<br>Saturation ${project.graph.saturation.toFixed(2)}</div><i class="node-port in"></i><i class="node-port out"></i></div><div class="node" data-node="material" style="left:55%;top:54px"><div class="node-title">${icon('sun')}PBR surface</div><div class="node-body">Metal / roughness<br>Normal + height</div><i class="node-port in"></i><i class="node-port out"></i></div><div class="node" data-node="output" style="left:81%;top:32px"><div class="node-title">${icon('cube')}Viewport</div><div class="node-body">Studio lighting<br>Surface output</div><i class="node-port in"></i></div><div class="graph-info">Double-click a node to edit</div></div>`;
}
else if (state.lower === 'tiles') {
    container.innerHTML = `<div class="tile-row">${project.tiles.map((t, i) => `<button class="tile-card ${i === state.tile ? 'active' : ''}" data-tile="${i}"><canvas width="100" height="100" data-tile-preview="${i}"></canvas><span>${t} <span class="muted">· ${project.resolution}px</span></span></button>`).join('')}</div>`;
    $$('[data-tile-preview]').forEach(c => c.getContext('2d').drawImage(textures.composite(state.channel, +c.dataset.tilePreview), 0, 0, 100, 100));
}
else if (state.lower === 'history') {
    container.innerHTML = history.undoStack.length ? history.undoStack.slice().reverse().map(h => `<div class="history-entry">${icon('check')}<span>${esc(h.label)}</span><span class="spacer"></span><span class="muted">${new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>`).join('') : '<div class="empty">Your edits will appear here. Use Ctrl+Z to undo.</div>';
}
else {
    container.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid var(--line)"><span class="tiny muted">${collab ? 'Project review' : 'Save this project to start a shared review.'}</span><span class="spacer"></span><button class="secondary" data-action="add-comment">${icon('plus')}Add comment</button></div><div id="comments"><div class="empty">Loading review…</div></div>`;
    loadComments();
} }
function drawBrushPreview() { const c = $('#brush-preview'); if (!c)
    return; const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); const points = []; for (let x = 18; x < 220; x += 3)
    points.push([x / c.width, (26 + Math.sin(x * .033) * 6) / c.height, .5 + Math.sin(x / 220 * Math.PI) * .5]); const old = textures.size; textures.size = c.width; const normalized = points.map(([u, v, p]) => [u, v * c.height / c.width, p]); textures.drawStroke(ctx, { points: normalized, color: state.color, size: 19, hardness: state.hardness, opacity: state.opacity, flow: state.flow }); textures.size = old; }
function drawUV() { const c = $('#uvcanvas'); if (c.classList.contains('hide'))
    return; const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.max(1, c.clientWidth * dpr | 0), h = Math.max(1, c.clientHeight * dpr | 0); if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
} const ctx = c.getContext('2d'); ctx.fillStyle = '#20262b'; ctx.fillRect(0, 0, w, h); const n = Math.min(w - 48 * dpr, h - 66 * dpr), x = (w - n) / 2, y = (h - n) / 2; ctx.drawImage(textures.composite(state.channel, state.tile), x, y, n, n); ctx.strokeStyle = '#e9efdb45'; ctx.lineWidth = .6 * dpr; if (state.uvWire) {
    const v = mesh.vertices;
    ctx.beginPath();
    for (let i = 0; i < v.length; i += 27)
        if (Math.round(v[i + 8]) === state.tile) {
            ctx.moveTo(x + v[i + 6] * n, y + v[i + 7] * n);
            ctx.lineTo(x + v[i + 15] * n, y + v[i + 16] * n);
            ctx.lineTo(x + v[i + 24] * n, y + v[i + 25] * n);
            ctx.closePath();
        }
    ctx.stroke();
} ctx.strokeStyle = '#9cc4b6'; ctx.strokeRect(x, y, n, n); ctx.fillStyle = '#b5c5c7'; ctx.font = `${12 * dpr}px system-ui`; ctx.fillText(`UDIM ${1001 + state.tile} · ${project.resolution} × ${project.resolution}`, x, y + n + 21 * dpr); c._uvBounds = { x: x / dpr, y: y / dpr, n: n / dpr }; }
function hitAt(e, target) { const rect = target.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top; if (target.id === 'uvcanvas') {
    const b = target._uvBounds;
    if (!b)
        return null;
    const u = (x - b.x) / b.n, v = (y - b.y) / b.n;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { tile: state.tile, uv: [u, v] } : null;
} const ray = camera.ray(x / rect.width * 2 - 1, 1 - y / rect.height * 2, rect.width / rect.height); return mesh.raycast(ray.origin, ray.direction); }
function pointerDown(e) { if (loading)
    return; if (e.button === 2)
    e.preventDefault(); const target = e.currentTarget; target.setPointerCapture(e.pointerId); if (e.altKey || e.button === 1 || e.button === 2 || state.tool === 'orbit') {
    drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 1 };
    return;
} const hit = hitAt(e, target); if (!hit)
    return; if (state.memberRole === 'viewer')
    return toast('This project is open for review.', true); if (state.tool === 'pick') {
    pickColor(hit);
    return;
} if (state.tool === 'fill') {
    const l = selected();
    if (l?.locked)
        return toast('Unlock this layer or create a new paint layer.', true);
    addLayer('fill', { tile: hit.tile });
    return;
} let layer = selected(); if (!layer || layer.locked)
    return toast('Select an unlocked layer to paint.', true); if (layer.kind !== 'paint') {
    layer = addLayer('paint');
} stroke = { channel: state.channel, layerId: layer.id, segments: [], current: null }; lastHit = null; paintHit(hit, e); }
function paintHit(hit, e) { if (!stroke || !hit) {
    lastHit = null;
    return;
} const pressure = e.pointerType === 'pen' ? clamp(e.pressure, .05, 1) : 1; let segment = stroke.current; if (!segment || segment.tile !== hit.tile) {
    segment = { id: uid(), tile: hit.tile, points: [], size: state.size, color: state.color, opacity: state.opacity, flow: state.flow, hardness: state.hardness, erase: state.tool === 'erase' };
    stroke.segments.push(segment);
    stroke.current = segment;
} const [u, v] = hit.uv; if (lastHit && lastHit.tile === hit.tile) {
    const du = u - lastHit.uv[0], dv = v - lastHit.uv[1], dist = Math.hypot(du, dv) * project.resolution;
    if (dist < state.size * state.spacing * .6)
        return;
    if (dist < project.resolution * .13) {
        const steps = Math.max(1, Math.ceil(dist / (state.size * state.spacing)));
        for (let i = 1; i <= steps; i++)
            segment.points.push([lastHit.uv[0] + du * i / steps, lastHit.uv[1] + dv * i / steps, pressure]);
    }
    else
        segment.points.push([u, v, pressure]);
}
else
    segment.points.push([u, v, pressure]); lastHit = hit; state.tile = hit.tile; const layer = project.channels[stroke.channel].find(l => l.id === stroke.layerId); if (!layer.strokes.some(s => s.id === segment.id))
    layer.strokes.push(segment); textures.invalidateLayer(layer.id, hit.tile); needsRender = true; }
function pointerMove(e) { const target = e.currentTarget; if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.pan)
        camera.pan(dx, dy);
    else
        camera.orbit(dx, dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
    needsRender = true;
    return;
} const c = $('.brush-cursor'), rect = $('.viewport-wrap').getBoundingClientRect(); c.style.left = (e.clientX - rect.left) + 'px'; c.style.top = (e.clientY - rect.top) + 'px'; c.style.width = c.style.height = Math.max(7, state.size * .5) + 'px'; c.style.display = ['brush', 'erase'].includes(state.tool) ? 'block' : 'none'; if (stroke)
    for (const event of e.getCoalescedEvents?.() || [e])
        paintHit(hitAt(event, target), event); }
function pointerUp() { drag = null; if (!stroke)
    return; const st = stroke; stroke = null; const layer = project.channels[st.channel].find(l => l.id === st.layerId); if (!layer)
    return; for (const s of st.segments) {
    layer.strokes = layer.strokes.filter(t => t.id !== s.id);
    if (s.points.length)
        commit({ type: 'stroke', channel: st.channel, layerId: st.layerId, stroke: s }, s.erase ? 'Erase stroke' : 'Paint stroke');
    if (state.symmetry && s.points.length) {
        const mirrored = { ...copy(s), id: uid(), points: s.points.map(([u, v, p]) => [1 - u, v, p]) };
        commit({ type: 'stroke', channel: st.channel, layerId: st.layerId, stroke: mirrored }, 'Mirror stroke');
    }
} lastHit = null; }
function pickColor(hit) { const rgb = textures.composite(state.channel, hit.tile).getContext('2d').getImageData(clamp(Math.floor(hit.uv[0] * project.resolution), 0, project.resolution - 1), clamp(Math.floor(hit.uv[1] * project.resolution), 0, project.resolution - 1), 1, 1).data; setColor('#' + [...rgb].slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('')); setTool('brush'); }
function bindCanvas() { for (const c of [renderer.canvas, $('#uvcanvas')]) {
    c.addEventListener('pointerdown', pointerDown);
    c.addEventListener('pointermove', pointerMove);
    c.addEventListener('pointerup', pointerUp);
    c.addEventListener('pointercancel', pointerUp);
    c.addEventListener('lostpointercapture', pointerUp);
    c.addEventListener('pointerleave', () => $('.brush-cursor').style.display = 'none');
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('wheel', e => { e.preventDefault(); camera.zoom(e.deltaY); needsRender = true; }, { passive: false });
} }
async function request(path, options = {}) { if (localService) return localService.request(path, options); const r = await fetch('/api' + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } }); let d; try {
    d = await r.json();
}
catch {
    throw Error('Project service is unavailable. You can still download your project.');
} if (!r.ok)
    throw Error(d.error || 'Request failed'); return d; }
function download(name, data, type = 'application/json') { const blob = data instanceof Blob ? data : new Blob([data], { type }), a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); }
const safeName = n => n.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 100);
async function saveProject() { if (loading)
    return; if (collab) {
    await collab.send();
    toast(collab.pending.length ? 'Edits are waiting to sync.' : 'Project saved.');
    return;
} loading = true; $('#save-state').textContent = 'Saving project…'; try {
    const data = await request('/projects', { method: 'POST', body: JSON.stringify({ project }) });
    await connectProject(data.id, false);
    toast(browserStorage ? 'Saved in this browser. New edits are saved automatically. Export a backup to keep a portable copy.' : 'Project saved. New edits will sync automatically.');
}
finally {
    loading = false;
} }
async function connectProject(id, replace = true) { collab?.close(); let queued = null; const client = new CollaborationClient({ transport: localService ? request : null, recoveryDatabaseName: browserStorage ? 'tessera-recovery:browser:' + storageScope : 'tessera-recovery', applyOperation, onState: p => { if (stroke) {
        queued = p;
        return;
    } project = p; textures.project = project; textures.clear(); textures.loadImages().then(() => { textures.invalidate(); needsRender = true; }).catch(e => toast(e.message, true)); refresh(); }, onStatus: s => { $('#save-state').textContent = s === 'All changes saved' ? savedLabel : s; } }); collab = client; let data; try { data = await client.connect(id); } catch (e) { client.close(); if (collab === client) collab = null; throw e; } if (collab !== client) return data; state.cloudId = id; state.memberRole = data.role; if (replace) {
    await loadProjectData(data.project, false);
    await collab.poll();
    const p = copy(collab.base);
    for (const o of collab.operations)
        applyOperation(p, o.payload);
    for (const o of collab.pending)
        applyOperation(p, o.payload);
    project = p;
    textures.project = p;
    textures.clear();
    await textures.loadImages();
    refresh();
} const wait = setInterval(() => { if (queued && !stroke && collab === client) {
    const rebased = copy(collab.base);
    for (const o of collab.operations)
        applyOperation(rebased, o.payload);
    for (const o of collab.pending)
        applyOperation(rebased, o.payload);
    project = rebased;
    queued = null;
    textures.project = project;
    textures.clear();
    textures.loadImages().then(() => { textures.invalidate(); needsRender = true; });
    refresh();
} if (collab !== client)
    clearInterval(wait); }, 250); const url = new URL(location.href); url.searchParams.set('project', id); url.searchParams.delete('invite'); window.history.replaceState(null, '', url); return data; }
async function loadProjectData(p, disconnect = true) { loading = true; try {
    return await replaceProjectData(p, disconnect);
}
finally {
    loading = false;
    needsRender = true;
} }
async function replaceProjectData(p, disconnect = true) { validateProject(p); stroke = null; drag = null; lastHit = null; if (disconnect) {
    collab?.close();
    collab = null;
    state.cloudId = null;
    state.memberRole = 'owner';
    window.history.replaceState(null, '', location.pathname);
} project = copy(p); history = new CommandHistory(); mesh = project.meshData ? new Mesh(new Float32Array(project.meshData.vertices), project.meshData.parts, project.meshData.name) : project.model === 'Scout helmet' ? createDemoMesh() : createPrimitive(project.model); if (renderer.size !== project.resolution) {
    renderer.dispose();
    const newCanvas = renderer.canvas.cloneNode();
    renderer.canvas.replaceWith(newCanvas);
    renderer = new StudioRenderer(newCanvas, { onStatus: b => $('#engine-badge').textContent = b.toUpperCase(), onError: m => toast(m, true) });
    await renderer.initialize(project.resolution);
    bindCanvas();
} textures = new TextureEngine(project); await textures.loadImages(); renderer.setMesh(mesh); camera.reset(); state.channel = 'basecolor'; state.layer = project.channels.basecolor.at(-1)?.id; $('#save-state').textContent = collab ? savedLabel : 'Local project'; refresh(); renderShelf(); }
function newProject() { dialog('New texture project', `<div class="field"><label>Project name</label><input name="name" value="Untitled surface" maxlength="160" required></div><div class="field"><label>Geometry</label><select name="model"><option>Scout helmet</option><option>Sphere</option><option>Cube</option><option>Torus</option></select></div><div class="field"><label>Texture resolution per tile</label><select name="resolution"><option value="512">512 × 512 · lightweight</option><option value="1024" selected>1024 × 1024</option><option value="2048">2048 × 2048 · high memory use</option></select></div><p>Four UDIM tiles and six material channels. Download any unsaved work before creating a new project.</p>`, { action: 'Create project', onSubmit: async (f) => { await loadProjectData(createProject(f.get('name'), f.get('model'), +f.get('resolution'))); toast('Project created.'); } }); }
async function openProjects() { const d = dialog('Projects', `<div id="project-list"><p>${browserStorage ? 'Loading projects saved in this browser…' : 'Loading saved projects…'}</p></div>`, { action: 'New project', cancel: 'Close', onSubmit: () => { setTimeout(newProject, 0); } }); try {
    const data = await request('/projects');
    const list = d.element.querySelector('#project-list');
    list.innerHTML = data.projects.length ? data.projects.map(p => `<div class="project-card">${icon('cube')}<div><strong>${esc(p.name)}</strong><p style="margin:3px 0 0;font-size:11px">${esc(p.role)} · ${new Date(p.updated).toLocaleDateString()}</p></div><button class="secondary" data-open="${p.id}">Open</button></div>`).join('') : '<p>No saved projects yet. Use File → Save project to save this surface study.</p>';
    list.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => { try {
        await connectProject(b.dataset.open);
        d.close();
    }
    catch (e) {
        toast(e.message, true);
    } });
}
catch (e) {
    d.element.querySelector('#project-list').innerHTML = `<p>${esc(e.message)}</p><button data-action="download-project" class="secondary">Download current project</button>`;
} }
function chooseFile(accept, onFile) { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = async () => { try {
    if (i.files[0])
        await onFile(i.files[0]);
}
catch (e) {
    toast(e.message, true);
} }; i.click(); }
function importMesh() { chooseFile('.obj', async (f) => { if (f.size > 35 * 1024 * 1024)
    throw Error('OBJ file exceeds 35 MB.'); const imported = parseOBJ(await f.text()); const p = createProject(f.name.replace(/\.obj$/i, ''), imported.name, project.resolution); p.meshData = { name: imported.name, vertices: Array.from(imported.vertices), parts: imported.parts }; await loadProjectData(p); toast(`Imported ${imported.triangleCount.toLocaleString()} triangles. Original UV coordinates preserved.`); }); }
function importImage() { chooseFile('image/png,image/jpeg,image/webp', async (f) => { if (f.size > 8 * 1024 * 1024)
    throw Error('Texture images must be smaller than 8 MB.'); const raw = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(f); }); const image = new Image(); image.src = raw; await image.decode(); const c = document.createElement('canvas'); c.width = c.height = project.resolution; c.getContext('2d').drawImage(image, 0, 0, c.width, c.height); const data = c.toDataURL('image/png'), l = addLayer('image', { name: f.name, image: data, tile: state.tile }); await textures.loadImages(); textures.invalidateLayer(l.id); renderShelf(); needsRender = true; toast('Image added to active channel and tile.'); }); }
async function shareProject() { if (browserStorage) { dialog('Share an editable project', '<p>This GitHub Pages edition stores projects in this browser. It does not upload your textures or provide cross-device collaboration.</p><p>Download an editable project and send it to a collaborator. They can open it through File → Open project. Live multi-user invitations require the separately deployed authenticated server included in the repository.</p>', { action: 'Download project', cancel: 'Close', onSubmit: () => download(safeName(project.name) + '.tessera.json', JSON.stringify(project)) }); return; } if (!collab)
    await saveProject(); const d = dialog('Share project', `<p>Invite someone to paint with you or leave a review. Changes sync automatically while the project is open.</p><div class="field"><label>Link permission</label><select name="role"><option value="editor">Can edit</option><option value="viewer">Can review</option></select></div><div id="share-result"></div><p class="tiny">Visitors also need access to this site. Site access is managed separately from project permissions. Anyone with the generated link and site access can join.</p><div id="member-list"></div>`, { action: 'Create invite link', cancel: 'Close', onSubmit: async (f, el) => { const data = await request('/projects/' + state.cloudId + '/invites', { method: 'POST', body: JSON.stringify({ role: f.get('role') }) }); const url = new URL('../studio.html', import.meta.url); url.searchParams.set('project', state.cloudId); url.searchParams.set('invite', data.token); el.querySelector('#share-result').innerHTML = `<div class="field"><label>Invitation link · expires in 7 days</label><input readonly value="${esc(url.href)}" id="invite-link"></div><button type="button" class="secondary" id="copy-link">Copy link</button>`; el.querySelector('#copy-link').onclick = async () => { try {
        await navigator.clipboard.writeText(url.href);
        toast('Invite link copied.');
    }
    catch {
        el.querySelector('#invite-link').select();
    } }; return false; } }); try {
    const data = await request('/projects/' + state.cloudId + '/members');
    d.element.querySelector('#member-list').innerHTML = `<p style="margin-top:20px">Project members</p>${data.members.map(m => `<div class="project-card"><div><strong>${esc(m.name)}</strong><div class="tiny muted">${esc(m.role)}</div></div>${m.role !== 'owner' && state.memberRole === 'owner' ? `<button type="button" data-remove-member="${esc(m.user_id)}" aria-label="Remove member">${icon('trash')}</button>` : ''}</div>`).join('')}`;
    d.element.querySelectorAll('[data-remove-member]').forEach(b => b.onclick = async () => { try {
        await request('/projects/' + state.cloudId + '/members', { method: 'DELETE', body: JSON.stringify({ userId: b.dataset.removeMember }) });
        b.closest('.project-card').remove();
        toast('Member removed.');
    }
    catch (e) {
        toast(e.message, true);
    } });
}
catch { } }
function exportDialog() { dialog('Export textures', `<div class="field"><label>Export</label><select name="kind"><option value="texture">Active channel / active UDIM · PNG</option><option value="set">All channels / active UDIM · ZIP</option><option value="all">All channels / all UDIMs · ZIP</option><option value="project">Editable project · .tessera.json</option><option value="mesh">Geometry · OBJ</option><option value="render">Viewport image · PNG</option></select></div><div class="property-row"><label>Active channel</label><span>${CHANNELS.find(c => c.id === state.channel).name}</span></div><div class="property-row"><label>Active tile</label><span>${1001 + state.tile}</span></div><p>Textures export at ${project.resolution} × ${project.resolution}, 8-bit RGBA. Base color and emission use sRGB values; numeric channels remain raw. Viewport color grading and lighting are not baked into texture maps.</p>`, { action: 'Export', onSubmit: async (f) => { const kind = f.get('kind'), name = safeName(project.name); if (kind === 'project')
        download(name + '.tessera.json', JSON.stringify(project));
    else if (kind === 'mesh')
        download(name + '.obj', exportOBJ(mesh), 'text/plain');
    else if (kind === 'render') {
        renderer.render(camera, project.graph);
        const c = document.createElement('canvas');
        c.width = renderer.canvas.width;
        c.height = renderer.canvas.height;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#282f33';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(renderer.canvas, 0, 0);
        download(name + '_preview.png', await canvasBlob(c), 'image/png');
    }
    else if (kind === 'texture')
        download(`${name}_${state.channel}.${1001 + state.tile}.png`, await canvasBlob(textures.composite(state.channel, state.tile)), 'image/png');
    else {
        const { createZip } = await import('../packages/core/zip.js'), files = [];
        for (const ch of CHANNELS)
            for (const tile of (kind === 'all' ? [0, 1, 2, 3] : [state.tile])) {
                const blob = await canvasBlob(textures.composite(ch.id, tile));
                files.push({ name: `${name}_${ch.id}.${1001 + tile}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
            }
        download(name + '_textures.zip', createZip(files), 'application/zip');
    } toast('Export ready.'); } }); }
const canvasBlob = c => new Promise((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(Error('Image export failed')), 'image/png'));
function nodeDialog(kind) { if (kind === 'source') {
    state.lower = 'tiles';
    renderLower();
    return;
} if (kind === 'material' || kind === 'output') {
    lightingDialog();
    return;
} dialog('Color grade · viewport', `<p>Adjust the displayed material without changing your texture values.</p>${[['exposure', 'Exposure', -4, 4, .1], ['contrast', 'Contrast', 0, 2, .05], ['saturation', 'Saturation', 0, 2, .05], ['roughness', 'Roughness multiplier', .1, 2, .05]].map(([key, label, min, max, step]) => `<div class="field"><label>${label}</label><input type="number" name="${key}" min="${min}" max="${max}" step="${step}" value="${project.graph[key]}"></div>`).join('')}`, { action: 'Apply grade', onSubmit: f => commit({ type: 'graph', props: Object.fromEntries(['exposure', 'contrast', 'saturation', 'roughness'].map(k => [k, +f.get(k)])) }, 'Adjust material grade') }); }
function lightingDialog() { dialog('Studio lighting', `<div class="field"><label>Environment</label><select name="preset"><option value="1">Soft studio</option><option value="1.5">Bright studio</option><option value="0.55">Low key</option></select></div><div class="field"><label>Light rotation · degrees</label><input name="rotation" type="range" min="-180" max="180" value="${renderer.rotation * 180 / Math.PI}"></div><div class="field"><label>Exposure</label><input type="number" min="-4" max="4" step=".1" name="exposure" value="${project.graph.exposure}"></div><p>Three analytic lights with a procedural ambient term. No external HDR environment is loaded.</p>`, { action: 'Apply lighting', onSubmit: f => { renderer.light = +f.get('preset'); renderer.rotation = +f.get('rotation') * Math.PI / 180; commit({ type: 'graph', props: { exposure: +f.get('exposure') } }, 'Adjust lighting'); } }); }
function proceduralDialog() { dialog('Add procedural texture', `<div class="field"><label>Name</label><input name="name" value="Surface variation" required></div><div class="field"><label>Pattern</label><select name="pattern"><option value="noise">Noise</option><option value="checker">Checker</option><option value="stripes">Stripes</option><option value="cells">Cells</option></select></div><div class="field"><label>Scale</label><input type="number" name="scale" min="2" max="64" value="12"></div><div class="field"><label>Color</label><input type="color" name="color" value="${state.color}"></div><div class="field"><label>Blend</label><select name="blend"><option value="multiply">Multiply</option><option value="overlay">Overlay</option><option value="source-over">Normal</option></select></div>`, { action: 'Add layer', onSubmit: f => addLayer('procedural', { name: f.get('name'), pattern: f.get('pattern'), scale: +f.get('scale'), color: f.get('color'), blend: f.get('blend'), tile: state.tile }) }); }
async function applyMaterial(index) { const m = MATERIALS[index]; state.activeMaterial = index; for (const [channel, color] of [['basecolor', m.color], ['roughness', '#' + Math.round(m.rough * 255).toString(16).padStart(2, '0').repeat(3)], ['metallic', '#' + Math.round(m.metal * 255).toString(16).padStart(2, '0').repeat(3)]]) {
    const l = createLayer(m.name, 'fill', { color, tile: state.tile });
    commit({ type: 'addLayer', channel, layer: l }, 'Apply ' + m.name + ' · ' + channel);
} state.channel = 'basecolor'; const l = createLayer('Paint on ' + m.name); state.layer = l.id; commit({ type: 'addLayer', channel: 'basecolor', layer: l }, 'New material paint layer'); renderShelf(); toast(`${m.name} applied to tile ${1001 + state.tile}.`); }
async function loadComments() { if (!$('#comments'))
    return; if (!collab) {
    $('#comments').innerHTML = '<div class="empty">Comments are saved with your shared project.</div>';
    return;
} try {
    const d = await request('/projects/' + state.cloudId + '/comments');
    if ($('#comments'))
        $('#comments').innerHTML = d.comments.length ? d.comments.map(c => `<div class="comment"><strong>${esc(c.name)}</strong><span class="tiny muted"> &nbsp;${new Date(c.created).toLocaleString()}</span><p>${esc(c.text)}</p></div>`).join('') : '<div class="empty">No comments yet. Add the first review note.</div>';
}
catch (e) {
    if ($('#comments'))
        $('#comments').textContent = e.message;
} }
function addComment() { if (!collab)
    return saveProject().then(addComment); dialog('Add review note', `<div class="field"><label>Comment</label><textarea name="text" rows="5" required maxlength="4000" placeholder="Leave feedback on this surface…"></textarea></div><p>Attached to ${CHANNELS.find(c => c.id === state.channel).name}, tile ${1001 + state.tile}.</p>`, { action: 'Post comment', onSubmit: async (f) => { await request('/projects/' + state.cloudId + '/comments', { method: 'POST', body: JSON.stringify({ text: f.get('text'), channel: state.channel, tile: state.tile }) }); state.lower = 'review'; renderLower(); } }); }
function helpDialog() { dialog('Working in Tessera', `<p>Paint directly on the 3D model or switch to UV view. Layers, visibility, blending and materials update the rendered surface immediately.</p><div class="key-grid">${[['Paint', 'B'], ['Erase', 'E'], ['Fill', 'G'], ['Pick color', 'I'], ['Orbit', 'Alt + drag'], ['Pan', 'Shift + Alt + drag'], ['Zoom', 'Scroll'], ['Frame', 'F'], ['UV mirror', 'X'], ['Undo', 'Ctrl / ⌘ Z'], ['Redo', 'Ctrl / ⌘ Shift Z'], ['Save', 'Ctrl / ⌘ S'], ['Smaller brush', '['], ['Larger brush', ']']].map(([a, b]) => `<div>${a}<kbd>${b}</kbd></div>`).join('')}</div><p style="margin-top:18px">Double-click a layer to rename it. Drag layers to reorder. Double-click shading nodes to edit their settings. Import UV-mapped OBJ files from File.</p><p>Current release: four horizontal UDIMs (1001–1004), 8-bit texture layers, up to 2048px per tile. See the included compatibility documentation for production format and rendering boundaries.</p>`, { action: 'Got it', cancel: 'Close' }); }
const menus = { File: [['new', 'New project', 'Ctrl+N'], ['projects', 'Open saved project', ''], ['open-project', 'Open project file', ''], ['save', 'Save project', 'Ctrl+S'], ['download-project', 'Download project', ''], ['import-mesh', 'Import OBJ geometry', ''], ['import-image', 'Import texture image', ''], ['export', 'Export…', '']], Edit: [['undo', 'Undo', 'Ctrl+Z'], ['redo', 'Redo', 'Ctrl+Shift+Z'], ['duplicate-layer', 'Duplicate layer', ''], ['delete-layer', 'Delete layer', ''], ['rename-project', 'Rename project', '']], Paint: [['tool-brush', 'Paint', 'B'], ['tool-erase', 'Erase', 'E'], ['tool-fill', 'Fill', 'G'], ['tool-pick', 'Pick color', 'I'], ['symmetry', 'UV mirror symmetry', 'X'], ['add-layer', 'New paint layer', ''], ['add-procedural', 'Procedural texture', '']], View: [['view-3d', 'Perspective', ''], ['view-uv', 'UV canvas', ''], ['view-split', '3D / UV', ''], ['frame', 'Frame model', 'F'], ['lighting', 'Lighting…', ''], ['wire', 'Toggle UV wireframe', ''], ['theme', 'Toggle theme', ''], ['turntable', 'Turntable', '']], Help: [['help', 'Keyboard shortcuts', '?'], ['about', 'About Tessera', '']] };
async function action(a) { if (loading)
    return toast('Please wait for the project to finish loading.'); if (a.startsWith('tool-'))
    return setTool(a.slice(5)); if (a.startsWith('view-'))
    return setView(a.slice(5)); switch (a) {
    case 'new':
        newProject();
        break;
    case 'projects':
        await openProjects();
        break;
    case 'save':
        await saveProject();
        break;
    case 'share':
        await shareProject();
        break;
    case 'export':
        exportDialog();
        break;
    case 'open-project':
        chooseFile('.json,.tessera', async (f) => { if (f.size > 60 * 1024 * 1024)
            throw Error('Project file exceeds 60 MB'); await loadProjectData(JSON.parse(await f.text())); toast('Project opened.'); });
        break;
    case 'download-project':
        download(safeName(project.name) + '.tessera.json', JSON.stringify(project));
        toast('Editable project downloaded.');
        break;
    case 'import-mesh':
        importMesh();
        break;
    case 'import-image':
        importImage();
        break;
    case 'add-layer':
        addLayer();
        break;
    case 'add-fill':
        addLayer('fill', { tile: state.tile });
        break;
    case 'add-procedural':
        proceduralDialog();
        break;
    case 'add-mask': {
        const l = selected();
        if (l && !l.locked)
            commit({ type: 'setLayer', channel: state.channel, layerId: l.id, props: { mask: l.mask ? null : 'checker' } }, 'Toggle checker mask');
        else
            toast('Unlock the selected layer first.', true);
        break;
    }
    case 'duplicate-layer': {
        const l = selected();
        if (l) {
            const layer = { ...copy(l), id: uid(), name: l.name + ' copy', locked: false };
            state.layer = layer.id;
            commit({ type: 'addLayer', channel: state.channel, layer }, 'Duplicate layer');
        }
        break;
    }
    case 'delete-layer': {
        const l = selected();
        if (!l)
            return;
        if (l.locked)
            return toast('Unlock the selected layer first.', true);
        commit({ type: 'removeLayer', channel: state.channel, layerId: l.id }, 'Delete layer');
        break;
    }
    case 'move-up':
    case 'move-down': {
        const ids = project.channels[state.channel].map(l => l.id), i = ids.indexOf(state.layer), j = i + (a === 'move-up' ? 1 : -1);
        if (j >= 0 && j < ids.length) {
            [ids[i], ids[j]] = [ids[j], ids[i]];
            commit({ type: 'reorder', channel: state.channel, ids }, 'Reorder layers');
        }
        break;
    }
    case 'undo':
    case 'redo': {
        if (state.memberRole === 'viewer')
            return;
        const op = a === 'undo' ? history.undo(project) : history.redo(project);
        if (op) {
            textures.clear();
            collab?.enqueue(op);
            refresh();
        }
        break;
    }
    case 'frame':
        camera.reset();
        needsRender = true;
        break;
    case 'grid':
        renderer.grid = !renderer.grid;
        needsRender = true;
        break;
    case 'wire':
        state.uvWire = !state.uvWire;
        needsRender = true;
        break;
    case 'theme':
        document.documentElement.classList.toggle('light');
        localStorage.setItem('tessera-theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
        break;
    case 'symmetry':
        state.symmetry = !state.symmetry;
        $('#symmetry').classList.toggle('active', state.symmetry);
        toast(state.symmetry ? 'UV mirror symmetry enabled.' : 'UV mirror symmetry disabled.');
        break;
    case 'turntable':
        state.turntable = !state.turntable;
        $$('[data-action="turntable"]').forEach(b => b.innerHTML = icon(state.turntable ? 'pause' : 'play'));
        needsRender = true;
        break;
    case 'lighting':
        lightingDialog();
        break;
    case 'help':
        helpDialog();
        break;
    case 'about':
        dialog('Tessera Studio', `<p>Version 0.1.0 · A modular, browser-based 3D texture studio.</p><p>Built with native JavaScript modules, WebGPU, WebGL 2 and Canvas 2D. Your project contains editable layers and paint strokes.</p><p>Independent software inspired by professional texture-painting workflows. No affiliation with Foundry. Native Mari projects and proprietary renderer shaders are not supported.</p>`, { action: 'Close' });
        break;
    case 'project-settings':
        dialog('Project settings', `<div class="field"><label>Project name</label><input name="name" value="${esc(project.name)}" maxlength="160" required></div><p>${project.resolution} × ${project.resolution}, four UDIM tiles, six 8-bit channels. Choose resolution when creating a new project.</p>`, { action: 'Save', onSubmit: f => commit({ type: 'rename', name: f.get('name') }, 'Rename project') });
        break;
    case 'rename-project':
        action('project-settings');
        break;
    case 'layout-paint':
        setView('3d');
        state.lower = 'graph';
        renderLower();
        break;
    case 'brush-settings':
        dialog('Brush settings', `<div class="field"><label>Size · texture pixels</label><input type="number" name="size" min="1" max="180" value="${state.size}"></div><div class="field"><label>Hardness · percent</label><input type="number" name="hardness" min="0" max="100" value="${Math.round(state.hardness * 100)}"></div><p>Size responds to pen pressure. UV mirror symmetry reflects the stroke within its UDIM tile.</p>`, { action: 'Apply', onSubmit: f => { state.size = +f.get('size'); state.hardness = +f.get('hardness') / 100; $('#brush-size').value = state.size; $('#size-value').textContent = state.size; $('#brush-hardness').value = state.hardness * 100; $('#hardness-value').textContent = Math.round(state.hardness * 100) + '%'; drawBrushPreview(); } });
        break;
    case 'lower-action':
        if (state.lower === 'review')
            addComment();
        else if (state.lower === 'tiles') {
            setView('uv');
        }
        else if (state.lower === 'history')
            toast('Paint or edit a layer to add a history step.');
        else
            proceduralDialog();
        break;
    case 'add-comment':
        await addComment();
        break;
} }
function bindUI() {
    document.addEventListener('click', async (e) => { const menu = e.target.closest('[data-menu]'); if (menu) {
        const old = menu.parentElement.querySelector('.menu-content');
        $$('.menu-content').forEach(x => x.remove());
        if (!old) {
            const el = document.createElement('div');
            el.className = 'menu-content';
            el.innerHTML = menus[menu.dataset.menu].map(([a, n, k]) => `<button data-action="${a}">${n}<kbd>${k}</kbd></button>`).join('');
            menu.parentElement.append(el);
        }
        return;
    } $$('.menu-content').forEach(x => x.remove()); try {
        const a = e.target.closest('[data-action]');
        if (a)
            await action(a.dataset.action);
        const ch = e.target.closest('[data-channel]');
        if (ch)
            setChannel(ch.dataset.channel);
        const v = e.target.closest('[data-view]');
        if (v)
            setView(v.dataset.view);
        const l = e.target.closest('[data-lower]');
        if (l) {
            state.lower = l.dataset.lower;
            renderLower();
        }
        const s = e.target.closest('[data-shelf]');
        if (s) {
            state.shelf = s.dataset.shelf;
            $$('[data-shelf]').forEach(b => b.classList.toggle('active', b === s));
            renderShelf();
        }
        const co = e.target.closest('[data-color]');
        if (co)
            setColor(co.dataset.color);
        const m = e.target.closest('[data-material]');
        if (m)
            await applyMaterial(+m.dataset.material);
        const br = e.target.closest('[data-brush]');
        if (br) {
            $('#brush-tip').value = br.dataset.brush;
            $('#brush-tip').dispatchEvent(new Event('change'));
        }
        const t = e.target.closest('[data-tile]');
        if (t) {
            state.tile = +t.dataset.tile;
            refresh();
        }
        const im = e.target.closest('[data-image-layer]');
        if (im) {
            for (const c of CHANNELS)
                if (project.channels[c.id].some(l => l.id === im.dataset.imageLayer)) {
                    setChannel(c.id);
                    state.layer = im.dataset.imageLayer;
                    refresh();
                    break;
                }
        }
    }
    catch (err) {
        toast(err.message, true);
    } });
    document.addEventListener('dblclick', e => { const n = e.target.closest('[data-node]'); if (n)
        nodeDialog(n.dataset.node); });
    $('tessera-layer-stack').addEventListener('layerselect', e => { state.layer = e.detail.id; const l = selected(); if (e.detail.action === 'visible')
        commit({ type: 'setLayer', channel: state.channel, layerId: l.id, props: { visible: !l.visible } }, 'Toggle visibility');
    else if (e.detail.action === 'lock')
        commit({ type: 'setLayer', channel: state.channel, layerId: l.id, props: { locked: !l.locked } }, 'Toggle lock');
    else
        refresh(); });
    $('tessera-layer-stack').addEventListener('layerrename', e => { state.layer = e.detail.id; const l = selected(); dialog('Rename layer', `<div class="field"><label>Name</label><input name="name" value="${esc(l.name)}" maxlength="100" required></div>`, { action: 'Rename', onSubmit: f => commit({ type: 'setLayer', channel: state.channel, layerId: l.id, props: { name: f.get('name') } }, 'Rename layer') }); });
    $('tessera-layer-stack').addEventListener('layerreorder', e => { const ids = project.channels[state.channel].map(l => l.id), i = ids.indexOf(e.detail.from), j = ids.indexOf(e.detail.to); ids.splice(i, 1); ids.splice(j, 0, e.detail.from); commit({ type: 'reorder', channel: state.channel, ids }, 'Reorder layers'); });
    $('#layer-channel').onchange = e => setChannel(e.target.value);
    $('#layer-blend').onchange = e => { if (selected())
        commit({ type: 'setLayer', channel: state.channel, layerId: state.layer, props: { blend: e.target.value } }, 'Change blending'); };
    $('#layer-opacity').onchange = e => { if (selected())
        commit({ type: 'setLayer', channel: state.channel, layerId: state.layer, props: { opacity: clamp(+e.target.value / 100) } }, 'Change opacity'); };
    $('#active-tile').onchange = e => { state.tile = +e.target.value; refresh(); };
    $('#shading').onchange = e => { renderer.mode = +e.target.value; needsRender = true; };
    $('#asset-search').oninput = renderShelf;
    for (const [id, key, out, percent] of [['brush-size', 'size', 'size-value', false], ['brush-opacity', 'opacity', 'opacity-value', true], ['brush-flow', 'flow', 'flow-value', true], ['brush-hardness', 'hardness', 'hardness-value', true], ['brush-spacing', 'spacing', 'spacing-value', true]])
        $('#' + id).oninput = e => { state[key] = +e.target.value / (percent ? 100 : 1); $('#' + out).textContent = e.target.value + (percent ? '%' : ''); drawBrushPreview(); };
    $('#paint-color').oninput = e => setColor(e.target.value);
    $('#color-large').oninput = e => setColor(e.target.value);
    $('#brush-tip').onchange = e => { const config = { round: [.72, .7, .18], soft: [0, .2, .1], ink: [1, 1, .12], grain: [.95, .35, .55] }[e.target.value]; [state.hardness, state.flow, state.spacing] = config; for (const [id, key, out] of [['brush-hardness', 'hardness', 'hardness-value'], ['brush-flow', 'flow', 'flow-value'], ['brush-spacing', 'spacing', 'spacing-value']]) {
        $('#' + id).value = state[key] * 100;
        $('#' + out).textContent = Math.round(state[key] * 100) + '%';
    } drawBrushPreview(); setTool('brush'); };
    document.addEventListener('keydown', e => { if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || $('.dialog'))
        return; const k = e.key.toLowerCase(); if ((e.ctrlKey || e.metaKey) && k === 's') {
        e.preventDefault();
        action('save').catch(e => toast(e.message, true));
        return;
    } if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault();
        action(e.shiftKey ? 'redo' : 'undo');
        return;
    } if ((e.ctrlKey || e.metaKey) && k === 'n') {
        e.preventDefault();
        newProject();
        return;
    } if (e.ctrlKey || e.metaKey)
        return; const map = { b: 'tool-brush', e: 'tool-erase', g: 'tool-fill', i: 'tool-pick', o: 'tool-orbit', f: 'frame', x: 'symmetry', '?': 'help' }; if (map[k])
        action(map[k]); if (k === '[' || k === ']') {
        state.size = clamp(state.size + (k === ']' ? 5 : -5), 1, 180);
        $('#brush-size').value = state.size;
        $('#size-value').textContent = state.size;
    } });
    window.addEventListener('resize', () => needsRender = true);
    window.addEventListener('beforeunload', e => { if (stroke || (collab?.pending.length) || (!collab && history.undoStack.length)) {
        e.preventDefault();
        e.returnValue = '';
    } });
}
function frame() { if (state.turntable) {
    camera.yaw += .004;
    needsRender = true;
} if (needsRender && renderer && !loading) {
    try {
        renderer.upload(textures.flush());
        if (state.view !== 'uv')
            renderer.render(camera, project.graph);
        drawUV();
        $('#render-stats').textContent = `${renderer.backend} · ${renderer.stats.frameMs.toFixed(1)} ms submit`;
        needsRender = false;
    }
    catch (e) {
        toast(e.message, true);
        needsRender = false;
    }
} requestAnimationFrame(frame); }
async function boot() { shell(); bindUI(); renderShelf(); drawBrushPreview(); refresh(); try { if (localStorage.getItem('tessera-theme') === 'light') document.documentElement.classList.add('light'); } catch { } if (browserStorage) { $('#save-state').textContent = 'Browser-local project · not saved'; $('#save-state').title = 'Saved projects stay in this browser. Export backups; browser data can be cleared or evicted.'; } try {
    renderer = new StudioRenderer($('#viewport'), { onStatus: b => $('#engine-badge').textContent = b.toUpperCase(), onError: m => toast(m, true) });
    await renderer.initialize(project.resolution);
    renderer.setMesh(mesh);
    bindCanvas();
    requestAnimationFrame(frame);
    window.tessera = { get project() { return project; }, get mesh() { return mesh; }, get textures() { return textures; }, get renderer() { return renderer; }, get camera() { return camera; }, get storageMode() { return browserStorage ? 'browser' : 'server'; }, commit, exportProject: () => copy(project) };
    try { const params = new URLSearchParams(location.search), id = params.get('project'), invite = params.get('invite');
    if (invite && id) {
        await request('/projects/' + id + '/join', { method: 'POST', body: JSON.stringify({ token: invite }) });
    }
    if (id)
        await connectProject(id);
    } catch (e) { $('#save-state').textContent = 'Project could not be opened'; toast(e.message, true); }
}
catch (e) {
    $('#engine-badge').textContent = 'UNAVAILABLE';
    toast(e.message, true);
} }
boot();
