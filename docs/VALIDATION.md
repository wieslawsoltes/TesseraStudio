# Validation record

## Verified Pages build — 2026-09-20

GitHub Actions run [35508894586](https://github.com/wieslawsoltes/TesseraStudio/actions/runs/35508894586), at commit `98f159929582bd3e9f7f5e59c25fff29c56f4944`, completed with:

- **26 Node tests passed, 0 failed, 0 skipped**, including all four native Canvas raster tests.
- **Seven browser checks passed** in headless Chromium 140 using Playwright 1.55 and the **WebGL 2 software-rendered fallback**.
- Successful generation of all five standalone library packages, the static Pages artifact, and the GitHub Pages deployment.

The browser checks exercised subpath startup, renderer initialization, UV pointer painting, save and automatic edit persistence, reload recovery of the project and strokes, synchronization between two browser tabs, 55 concurrent IndexedDB operations, duplicate-request idempotency, pagination, review-note durability, and editable-project downloads. Desktop and mobile screenshots were captured. No missing assets, uncaught page errors, or requests to an unavailable server API were recorded.

Screenshot review identified an oversized shading-graph icon caused by an overly broad SVG selector. The follow-up fix scopes the connection-overlay rule to the graph's direct SVG child and adds an eighth browser regression check for inline icon dimensions. The workflow also checks the deployed `build-info.json` against the exact commit and runs the browser suite against the public Pages URL after publishing.

The latest [workflow run](https://github.com/wieslawsoltes/TesseraStudio/actions/workflows/ci.yml) is the authority for the latest commit. Browser results, screenshots and library archives are available in its validation artifacts. The recorded first successful run above is historical evidence, not a claim that every later commit passed.

## Reproducing the checks

Run `node --test tests/*.test.js`, `node scripts/build-pages.mjs`, and `node scripts/package-libraries.mjs`. Raster tests skip unless `@napi-rs/canvas` is available. CI installs version 0.1.80 in an isolated test-runtime directory; the editor has no dependency on it. Run `node tests/browser-smoke.mjs` with Playwright installed, or set `TESSERA_TEST_RUNTIME` to the directory containing its `node_modules`.

Without a native Canvas implementation, the current local Node suite reports 22 passed and four skipped. These skips are not counted as raster qualification; the recorded CI run above executed them.

## Boundaries

This verifies the tested workflows, not full Mari parity. Physical-GPU execution, WebGPU shader/device-loss qualification, GPU performance measurements, tablet/device qualification, broad browser interoperability, enterprise security review, production-scale texture projects, and native-format interoperability certification remain unperformed. Browser screenshots and software WebGL execution are not physical-GPU benchmarks.

The Pages edition stores projects in the current browser. Cross-device multi-user collaboration requires the separately hosted authenticated API; the local launcher is not an authenticated public service. The original server API and its ownership, role, invitation, mutation-validation and ordered-edit tests remain in the repository.
