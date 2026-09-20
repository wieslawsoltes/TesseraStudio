# Library API

All library modules use ESM. The renderer accepts a camera with `matrix(aspect)` and `eye()` methods; it does not depend on the application or its UI. The texture engine requires a DOM-compatible Canvas 2D implementation. Math, mesh, project operations and ZIP generation can run outside the browser.

## Standalone rendering and texture composition

```js
import { createProject, createDemoMesh, OrbitCamera, TextureEngine }
  from '/packages/core/index.js';
import { StudioRenderer } from '/packages/renderer/index.js';

const project = createProject('Surface study', 'Scout helmet', 1024);
const textureEngine = new TextureEngine(project);
const renderer = await new StudioRenderer(document.querySelector('canvas'), {
  onStatus: backend => console.log(backend),
  onError: message => console.error(message)
}).initialize(project.resolution);
renderer.setMesh(createDemoMesh());
renderer.upload(textureEngine.flush());
renderer.render(new OrbitCamera(), project.graph);

// If WebGPU canvas initialization required replacement before fallback,
// renderer.canvas is the authoritative canvas. Bind events after initialize().
```

`StudioRenderer`: `initialize(size)`, `setMesh(mesh)`, `upload(changes)`, `render(camera, graph)`, `resize()`, `dispose()`. Properties: `canvas`, `backend`, `stats`, `mode` (0=PBR, 1–6=isolated channel), `light`, `rotation`, `grid`.

`TextureEngine`: `composite(channel, tile)` returns a canvas; `flush()` returns pending GPU uploads with `{channel,tile,index,canvas}`; `invalidate(channel?,tile?)`, `invalidateLayer(id,tile?)`, `loadImages()`, `clear()`. CPU cache dirtiness and upload dirtiness are independent. Call `flush()` exactly when passing its result to the renderer. Mutating project data directly requires invalidation; immutable/reducer operations are recommended.

## Scene and picking

```js
import { parseOBJ, OrbitCamera } from '/packages/core/index.js';
const mesh = parseOBJ(objText);
const camera = new OrbitCamera();
const { origin, direction } = camera.ray(ndcX, ndcY, width / height);
const hit = mesh.raycast(origin, direction);
// null or { distance, triangle, tile, uv:[u,v], position:[x,y,z] }
```

`Mesh.vertices` is an interleaved `Float32Array`, nine values per vertex: position XYZ, normal XYZ, local texture UV, array tile index. Triangle-list data is nonindexed. Positions are in scene space; texture V increases downwards. Four array layers correspond to 1001, 1002, 1003 and 1004. Import normalizes geometry to a 2.6-unit bounding-box extent.

## Editable document operations

```js
import { createProject, createLayer, applyOperation, CommandHistory }
  from '/packages/core/index.js';
const project = createProject();
const history = new CommandHistory(80);
const layer = createLayer('Scratches');
history.execute(project, { type:'addLayer', channel:'basecolor', layer }, 'Add layer');
history.execute(project, {
  type:'stroke', channel:'basecolor', layerId:layer.id,
  stroke:{ id:crypto.randomUUID(),tile:0,color:'#eecc88',size:24,
    hardness:.7,opacity:1,flow:.6,erase:false,points:[[.3,.4,1],[.31,.4,.8]] }
}, 'Paint');
const inverse = history.undo(project);
```

Operation types: `addLayer`, `removeLayer`, `setLayer`, `stroke`, `removeStroke`, `reorder`, `graph`, `rename`. `applyOperation` mutates the supplied project. Call `validateProject` before importing untrusted document JSON; the hosted API validates incoming operations separately. Stroke identities are deduplicated per layer. Undo of a stroke removes only that stroke ID. Undo of a property update is a new assignment and can override a later collaborator's assignment.

## UI control

```html
<link rel="stylesheet" href="/packages/controls/controls.css">
<script type="module" src="/packages/controls/index.js"></script>
<tessera-layer-stack></tessera-layer-stack>
```

```js
const stack = document.querySelector('tessera-layer-stack');
stack.layers = project.channels.basecolor;
stack.selected = layer.id;
stack.addEventListener('layerselect', ({detail}) => {
  // detail = {id, action:'select'|'visible'|'lock'}
});
stack.addEventListener('layerrename', ({detail}) => {});
stack.addEventListener('layerreorder', ({detail}) => {}); // {from,to}
```

The control emits intent; the host applies operations and supplies updated data. Standalone styling is included as `controls.css`; the application adds workspace-specific overrides. The control package also exports `EventBus`, `icon`, `escapeHTML`, `dialog`, `toast` and `button` helpers. The full docking/layout shell is application code, not a generic docking library.

## Collaboration

```js
import { CollaborationClient } from '/packages/collaboration/index.js';
import { applyOperation } from '/packages/core/index.js';
const client = new CollaborationClient({
  baseURL:'/api', applyOperation,
  onState: project => renderProject(project),
  onStatus: status => showStatus(status)
});
await client.connect(projectId);
client.enqueue(operation);
// client.close() stops future polling and stale callbacks.
```

The reducer is injected, so the collaboration package can operate independently of the Tessera document library. Server sequence numbers establish canonical order. Clients replay canonical operations, then pending local operations. Each request uses an immutable operation ID for safe retry. Unacknowledged operations are recorded independently in IndexedDB so multiple tabs do not overwrite one another's queues. The database is recovery storage, not the authoritative hosted project store.

The HTTP service exposes project list/create/load, operations GET/POST, comments GET/POST, invitations POST/DELETE, invite join POST, and members GET/DELETE. Authentication is required. The standalone local adapter supplies one local identity and binds only to loopback.

## Browser-local storage transport

`@tessera/storage` implements the project's request interface using IndexedDB. `CollaborationClient` accepts an optional `transport(path, options)` function and `recoveryDatabaseName`. Omitting them preserves the existing hosted HTTP behavior. See `public/packages/storage/README.md` for an executable integration example. The static edition does not emulate remote membership or invitation security.
