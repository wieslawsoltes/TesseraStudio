# @tessera/storage

Transactional browser-local project storage, with the request interface expected by `@tessera/collaboration`. No backend, framework, or network access is required. The package imports the sibling `@tessera/core` package; keep both in adjacent directories for unbundled browser ESM, or install the core peer dependency.

```js
import { BrowserProjectService } from './packages/storage/index.js';
import { CollaborationClient } from './packages/collaboration/index.js';
import { createProject, applyOperation } from './packages/core/index.js';

const storage = new BrowserProjectService({ databaseName: 'my-editor-projects' });
const { id } = await storage.request('/projects', {
  method: 'POST', body: JSON.stringify({ project: createProject() })
});
const client = new CollaborationClient({
  applyOperation,
  transport: storage.request.bind(storage),
  recoveryDatabaseName: 'my-editor-pending',
  onState: project => console.log(project)
});
await client.connect(id);
client.enqueue({ type: 'rename', name: 'Saved surface' });
```

Projects, ordered edits, and review notes are persisted in IndexedDB. Writes are atomic and serialized between tabs. Repeated operation IDs are idempotent; edit reads are paginated. Each host can choose a database name to avoid accidental collisions with other applications on the same origin. This is not a security boundary between mutually untrusted apps on a shared origin.

This adapter does **not** provide cross-device collaboration, authentication, remote invitations, or server storage. Browser data may be cleared, denied, or evicted. Export editable project files as portable backups. The application must handle rejected storage requests without claiming that a save succeeded. Same-browser tabs synchronize through the collaboration client's existing polling mechanism.
