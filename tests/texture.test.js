import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { TextureEngine } from '../public/packages/core/texture.js';
import { createProject, createLayer } from '../public/packages/core/project.js';
let native;
try {
    const require = createRequire(import.meta.url);
    try {
        native = require('@napi-rs/canvas');
    }
    catch {
        if (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)
            native = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/@napi-rs/canvas');
    }
}
catch { }
if (native)
    globalThis.document = { createElement: () => native.createCanvas(1, 1) };
const options = { skip: !native };
test('UV thumbnails do not consume renderer upload flags', options, () => { const engine = new TextureEngine(createProject('test', 'Sphere', 256)); assert.equal(engine.flush().length, 24); engine.invalidate('basecolor', 2); engine.composite('basecolor', 2); const uploads = engine.flush(); assert.equal(uploads.length, 1); assert.equal(uploads[0].index, 2); assert.equal(engine.flush().length, 0); });
test('layer visibility and removal recompose the expected pixels', options, () => { const p = createProject('test', 'Sphere', 256), layer = createLayer('red', 'fill', { color: '#ff0000' }); p.channels.basecolor.push(layer); const engine = new TextureEngine(p), pixel = () => [...engine.composite('basecolor', 0).getContext('2d').getImageData(120, 120, 1, 1).data]; assert.deepEqual(pixel(), [255, 0, 0, 255]); layer.visible = false; engine.invalidate('basecolor'); assert.notDeepEqual(pixel(), [255, 0, 0, 255]); layer.visible = true; engine.invalidate('basecolor'); assert.deepEqual(pixel(), [255, 0, 0, 255]); p.channels.basecolor.pop(); engine.invalidate('basecolor'); assert.notDeepEqual(pixel(), [255, 0, 0, 255]); });
test('eraser removes paint while preserving lower layer', options, () => { const p = createProject('test', 'Sphere', 256), layer = p.channels.basecolor[1], s = { id: 'a', tile: 0, points: [[.5, .5, 1]], size: 40, color: '#ff0000', hardness: 1, opacity: 1, flow: 1 }; layer.strokes.push(s); const engine = new TextureEngine(p), pixel = () => [...engine.composite('basecolor', 0).getContext('2d').getImageData(128, 128, 1, 1).data]; assert.deepEqual(pixel(), [255, 0, 0, 255]); layer.strokes.push({ ...s, id: 'b', erase: true }); engine.invalidateLayer(layer.id, 0); assert.notDeepEqual(pixel(), [255, 0, 0, 255]); assert.equal(pixel()[3], 255); });
test('painting dirties only the edited material channel and UDIM', options, () => { const p = createProject('test', 'Sphere', 256), engine = new TextureEngine(p); engine.flush(); engine.invalidateLayer('basecolor-paint', 3); assert.equal(engine.flush().length, 1); });
