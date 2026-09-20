# Tessera Studio

A plain HTML/JavaScript 3D texture-painting application with independently packageable engine, rendering, UI and collaboration modules in one repository.

**This is an initial working release, not full Mari feature parity or a production-qualified replacement.** The exact implementation boundaries are in [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

## GitHub Pages

**Live app:** https://wieslawsoltes.github.io/TesseraStudio/

The Pages edition uses the same plain HTML/JavaScript editor and rendering libraries, with **browser-local IndexedDB storage** in place of the server API. Save a project once with **Ctrl/Cmd+S**; subsequent edits are saved automatically. Projects, ordered edits, and local review notes survive reloads. Two tabs in the same browser can work on the same local project. Export editable project files as backups: clearing site data or browser storage eviction removes local projects.

GitHub Pages does **not** run the authenticated collaboration API, SQLite/D1, or R2. It does not provide cross-device multi-user collaboration. The Share action offers editable-project download rather than creating a nonfunctional invitation. The complete original server and hosted deployment adapters remain in this repository.

```sh
node scripts/build-pages.mjs
node scripts/preview-pages.mjs
```

The preview is served at **http://localhost:4173/TesseraStudio/**, deliberately matching the GitHub project-site subpath. The build output is `dist/pages/`. Static assets use relative paths, so the same output also supports custom domains. Neither a framework build nor dependency installation is needed to build or run the Pages edition.

The GitHub Actions workflow runs unit/raster tests, browser smoke tests, packages the standalone libraries, and deploys Pages after successful validation on `main`. Browser automation dependencies are installed in an isolated temporary directory, not added to the editor's runtime.

## Run locally

Requires **Node.js 22.13 or later**. No dependency installation is required for the standalone app:

```sh
node server/local.js
```

Open **http://localhost:3000**. The launcher serves the unbundled HTML/JS app and saves projects to SQLite and local blob files in `.tessera-data`. It binds to `127.0.0.1` and uses a single local designer identity. It is a development/personal launcher; do not expose it as a multi-user authenticated server.

Optional environment variables: `PORT` and `TESSERA_DATA_DIR`.

## Working features

- WebGPU rendering, with a WebGL 2 fallback; both use texture arrays and a metallic/roughness BRDF.
- Direct 3D surface painting through a CPU BVH and barycentric UV picking.
- Perspective, UV and split views; orbit, pan, zoom, frame and turntable controls.
- Paint, eraser, fill, color picker, pen-pressure size, flow, opacity, hardness, spacing and UV mirror symmetry.
- Six material channels: base color, roughness, metallic, normal, height and emission.
- Four horizontal UDIM tiles, 1001–1004, with project resolutions from 256 to 2048 pixels per tile. The UI offers 512, 1024 and 2048.
- Editable paint, fill, procedural and embedded-image layers; visibility, locking, opacity, blend modes, duplication, reordering and a checker mask.
- Procedural noise/checker/stripe/cell patterns, material presets and a searchable asset shelf.
- An editable fixed shading pipeline for color grade and PBR viewport settings.
- UV-mapped OBJ import and OBJ export; project JSON import/export; PNG and ZIP texture exports; viewport PNG export.
- Durable hosted project snapshots, ordered edit logs, invite links with editor/reviewer roles, member removal, comments, and pending-edit recovery.
- Light/dark themes, keyboard shortcuts, touch/pen pointer events and responsive workspace layouts.

## Repository layout

```text
public/studio.html             Plain HTML application entry
public/app/                    Workspace UI and styles
public/packages/core/          Meshes, BVH, math, project operations, textures, ZIP
public/packages/renderer/      WebGPU/WebGL renderer and shaders
public/packages/controls/      UI helpers and layer-stack custom element
public/packages/collaboration/ Ordered log client and offline recovery
public/packages/storage/       Transactional browser-local project API
server/api.js                  Shared authenticated project API
server/local.js                Dependency-free local launcher
server/local-adapters.js       SQLite and filesystem adapters
app/api/                       Hosted Worker API adapter
app/page.tsx                   Hosted redirect to the plain HTML app
db/schema.ts                  Schema definitions
drizzle/                      Generated database migrations
tests/                        Engine, raster, API and collaboration tests
docs/                         APIs, architecture and compatibility notes
```

The hosted adapter uses the bundled Vinext/Cloudflare infrastructure for routing and deployment. **The editor itself uses plain HTML, CSS, JavaScript modules and Web Components**, with no React rendering path. The original four library packages have no framework dependency.

## Libraries

```sh
node scripts/package-libraries.mjs
```

This generates five installable `.tgz` packages in `artifacts/`. They are not published to npm. The `@tessera` package scope is a local packaging name; no public registry ownership is implied.

See [docs/API.md](docs/API.md) for integration examples. Modules can be copied and served directly as ESM, or consumed through their package exports.

## Hosted build

The source contains a lockfile for reproducible installation. With the declared package-manager version available:

```sh
pnpm install --frozen-lockfile
pnpm build
```

The hosted API expects `DB` (Cloudflare D1), `BUCKET` (R2), and trusted authentication headers supplied by the hosting gateway. Database migrations must run before the Worker starts. A separate hosting deployment must arrange authenticated ingress; do not accept client-supplied identity headers on an untrusted public endpoint.

## Verification

```sh
node --test tests/*.test.js
```

The raster tests run when `@napi-rs/canvas` is available and otherwise report skips. The core, API and collaboration tests use Node built-ins. See [docs/VALIDATION.md](docs/VALIDATION.md) for the recorded result and testing boundaries.

## Controls

Paint: **B** · Erase: **E** · Fill: **G** · Pick: **I** · Orbit: **Alt + drag** · Pan: **Shift + Alt + drag** · Zoom: **wheel** · Frame: **F** · UV mirror: **X** · Undo: **Ctrl/Cmd + Z** · Redo: **Ctrl/Cmd + Shift + Z** · Save: **Ctrl/Cmd + S**.

Double-click a layer to rename it; drag layers to reorder. Double-click a shading node to edit its parameters. For numeric channels, select the channel in the left sidebar or the layer-panel selector.

## Attribution

Tessera is independently implemented. The demo geometry and procedural materials are generated by this source; no proprietary Mari code or assets are included. Foundry's publicly documented Mari workflows informed the feature comparison:

- https://www.foundry.com/products/mari
- https://www.foundry.com/products/mari/features
- https://learn.foundry.com/mari/Content/getting_started_guide/mari_workspace/mari_workspace.html

The original source is MIT licensed. Bundled hosting build dependencies retain their respective licenses.
