# @tessera/collaboration

Ordered HTTP edit-log synchronization with offline operation recovery.

Native ES modules; no framework runtime. Version 0.1.0 is an initial implementation, not a qualified substitute for a production desktop texturing engine. See the monorepo docs/API.md and docs/COMPATIBILITY.md.

For static hosts, inject `transport(path, options)` and a per-app `recoveryDatabaseName`. The default remains the HTTP API and the existing recovery database. `@tessera/storage` provides a browser-local implementation; this does not turn static hosting into a cross-device collaboration service.
