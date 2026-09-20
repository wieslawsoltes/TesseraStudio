# Architecture and data flow

The app shell is static HTML and native ES modules. Its command dispatcher mutates an editable project through stable-ID operations. The texture engine composites the affected channel and UDIM on demand; it maintains separate CPU dirty state and pending GPU uploads so UI previews cannot consume renderer updates. The renderer only draws when the scene changes, except during an explicitly enabled turntable.

Geometry uses a nine-float vertex record and an axis-aligned bounding volume hierarchy. Painting transforms screen coordinates into a world ray, finds the nearest triangle, interpolates UVs and records normalized stamp positions. The demo scene is generated from ellipsoids, toruses and rounded boxes; its base textures are deterministic procedural canvases.

Layer raster caches are derived data. The project persists ordered stroke descriptions, image data and layer properties; exported JSON is sufficient to reconstruct it. Canvas behavior can differ slightly across browser rasterizers, so replay is not promised to be bit-identical across platforms.

Hosted projects have an immutable initial JSON snapshot in blob storage. D1 stores project ownership, membership, invitations, comments and server-ordered operations. Large operation payloads are kept in content-addressed immutable blob objects; log rows retain references and hashes. Log reads are paginated with a response-size budget. Blob uploads occur before log insertion; an interrupted insertion can leave an unused blob, which is safe but currently requires offline cleanup.

There is no cross-store transaction. Initial snapshot upload followed by project-row failure can likewise leave an orphaned blob. This release does not compact logs or create later authoritative checkpoints, so the log remains the source of all edits after the initial snapshot.

The client uses a fresh immutable ID per submitted operation and retains unacknowledged records in IndexedDB. Acknowledgement never moves the polling cursor beyond unseen operations. Polling consumes increasing server sequences; own accepted operations are removed from recovery storage. When canonical ordering changes, the client rebuilds from the snapshot and replays the log, then reapplies pending local edits. Snapshot creation temporarily blocks editing to avoid losing changes made during the first save.

The default hosted site is owner-private. Project memberships add app-level authorization but cannot expand site access. Production hosting must supply authenticated identity from a trusted gateway. The local launcher intentionally supplies one local identity and never binds to a public interface.
