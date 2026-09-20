# Validation record

The automated suite completed with **21 tests passed, 0 failed, 0 skipped** in this environment with Node.js and the available native Canvas 2D implementation. It covers:

- Matrix inversion and camera rays.
- BVH nearest-hit picking and UV interpolation.
- Finite demo geometry, supported tile coverage and outward sphere normals.
- OBJ negative indices, UV preservation, unsupported input rejection and OBJ round trips.
- Stable operation identity, local undo isolation and concurrent layer-order preservation.
- Project structure validation and ZIP CRC/container headers.
- Hosted API ownership, viewer restrictions, invites, member removal, comments and cross-origin mutation rejection.
- Two-editor ordered strokes and duplicate-request idempotency.
- Canonical collaboration replay and stale-client callback prevention.
- Raster erasing, lower-layer preservation, visibility/deletion updates, separate upload invalidation, and active-tile updates.

The final run result is recorded in the delivery response. Raster tests automatically skip when `@napi-rs/canvas` is unavailable; they ran in the delivery environment.

The hosted production build is also checked for a Worker entrypoint, copied public module assets, and generated database migrations. Source module syntax and package generation are checked before delivery.

Not performed: browser-driven end-to-end or visual QA, actual WebGPU/WebGL shader execution on physical hardware, GPU performance measurements, device-loss recovery qualification, tablet/device testing, enterprise security review, large production texture projects or interoperability certification. Shader source was reviewed and corrected, but a successful source build does not establish GPU runtime compatibility.


## GitHub Pages publishing increment

The static publishing increment adds IndexedDB project persistence, the injectable
collaboration transport, a subpath-safe build and automated browser checks. Local
Node verification produced 26 tests: 22 passed, four raster tests skipped because
the native canvas test dependency was not installed. The deployment workflow
installs that dependency and runs the raster tests, browser smoke test and library
packaging before publishing. Its actual run result is the authority for deployment
qualification; physical-GPU and production-scale qualification remain separate.
