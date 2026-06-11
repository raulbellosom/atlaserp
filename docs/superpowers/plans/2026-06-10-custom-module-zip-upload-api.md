# Custom Module ZIP Upload — Plan A: API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POST /modules/:key/upload` (ZIP extraction to filesystem) and `DELETE /modules/:key/purge` (filesystem + DB hard-delete) endpoints to the Atlas ERP API, secured by two new `core.modules.*` permissions.

**Architecture:** A new `module-upload-service.js` holds all validation and filesystem logic (path traversal guard, size limits, manifest key check, atomic extraction, purge). Two thin handlers in the existing `apps/api/src/routes/modules.js` call the service. Permissions are declared in the `atlas.core` manifest and picked up by `prisma/seed.js` automatically. The new `ATLAS_MODULES_DIR` env var is the only runtime configuration required.

**Tech Stack:** Node.js 20 ESM, Hono, jszip (already installed), node:fs/promises, node:path (cross-platform — Mac/Linux/Windows), Prisma 7.

**Spec:** `docs/superpowers/specs/2026-06-10-custom-module-zip-upload-design.md`

---

## File Structure Map

| Action | File | Responsibility |
|---|---|---|
| Create | `apps/api/src/services/module-upload-service.js` | ZIP validation, extraction, file purge, DB purge |
| Modify | `apps/api/src/routes/modules.js` | Two new route handlers (thin, delegate to service) |
| Modify | `apps/api/src/manifests/official/core-modules.js` | Add `core.modules.upload` + `core.modules.purge` permissions to atlas.core |
| Modify | `apps/api/src/permission-catalog.js` | Add display names for the two new permissions |
| Modify | `packages/sdk/src/index.js` | Add `uploadModuleZip` + `purgeModule` SDK methods |
| Modify | `.env.example` | Document `ATLAS_MODULES_DIR` |

---

## Task 1: Environment variable + service skeleton

**Files:**
- Modify: `.env.example`
- Create: `apps/api/src/services/module-upload-service.js`

- [ ] **Step 1.1: Add `ATLAS_MODULES_DIR` to `.env.example`**

Open `.env.example` and add after the existing module-related vars (or at the end of the Atlas section):

```
# Path to the directory where custom module ZIPs are extracted.
# In Docker deployments this is the volume-mounted custom-modules/ directory
# inside the container (e.g. /app/modules/custom).
# Required for POST /modules/:key/upload and DELETE /modules/:key/purge to work.
# Leave blank to disable ZIP upload/purge endpoints (they will return 503).
ATLAS_MODULES_DIR=
```

- [ ] **Step 1.2: Create the service file with the skeleton**

Create `apps/api/src/services/module-upload-service.js`:

```js
import JSZip from 'jszip';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const MAX_COMPRESSED_BYTES = 50 * 1024 * 1024;    // 50 MB
const MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024;  // 150 MB

// Returns the resolved absolute path from ATLAS_MODULES_DIR, or null if not set.
export function resolveModulesDir() {
  const raw = process.env.ATLAS_MODULES_DIR;
  if (!raw || !raw.trim()) return null;
  return path.resolve(raw.trim());
}
```

- [ ] **Step 1.3: Syntax-check the new file**

```bash
node --check apps/api/src/services/module-upload-service.js
```

Expected: no output (clean).

- [ ] **Step 1.4: Commit**

```bash
git add apps/api/src/services/module-upload-service.js .env.example
git commit -m "feat(module-upload): add service skeleton and ATLAS_MODULES_DIR env var"
```

---

## Task 2: ZIP validation helpers

**Files:**
- Modify: `apps/api/src/services/module-upload-service.js`

These are pure functions that can be tested without touching the filesystem.

- [ ] **Step 2.1: Add the path-safety check**

Append to `module-upload-service.js`:

```js
// Returns true if the resolved path stays within targetBase (prevents path traversal).
// Handles forward-slash ZIP entry names on Windows by normalizing to path.sep.
function isSafePath(targetBase, relativeEntryPath) {
  const normalized = relativeEntryPath.split('/').join(path.sep);
  const resolved = path.resolve(targetBase, normalized);
  // Allow exact match (targetBase itself) or any descendant
  return resolved === targetBase || resolved.startsWith(targetBase + path.sep);
}
```

- [ ] **Step 2.2: Add root-prefix detection**

Append to `module-upload-service.js`:

```js
// Returns '' if module.manifest.js is at the ZIP root.
// Returns 'folderName/' if the ZIP has a single root folder containing the manifest.
// Returns null if the structure is ambiguous (reject).
function detectRootPrefix(filenames) {
  if (filenames.some(f => f === 'module.manifest.js')) return '';
  const rootEntries = [...new Set(filenames.map(f => f.split('/')[0]))].filter(Boolean);
  if (
    rootEntries.length === 1 &&
    filenames.some(f => f === rootEntries[0] + '/module.manifest.js')
  ) {
    return rootEntries[0] + '/';
  }
  return null;
}
```

- [ ] **Step 2.3: Add manifest key extractor (regex, no eval)**

Append to `module-upload-service.js`:

```js
// Extracts the `key:` literal string from a manifest file using a regex.
// Does NOT execute the file. Returns null if the pattern is not found (dynamic key).
function extractManifestKey(content) {
  const match = content.match(/key\s*:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}
```

- [ ] **Step 2.4: Write a quick unit test for path safety**

Create `apps/api/src/services/__tests__/module-upload-service.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

// Inline the function under test to avoid importing the full service
// (which imports jszip — not worth mocking for this check).
function isSafePath(targetBase, relativeEntryPath) {
  const normalized = relativeEntryPath.split('/').join(path.sep);
  const resolved = path.resolve(targetBase, normalized);
  return resolved === targetBase || resolved.startsWith(targetBase + path.sep);
}

const base = path.resolve('/data/modules/custom.fleet');

describe('isSafePath', () => {
  it('allows files within the target directory', () => {
    assert.ok(isSafePath(base, 'api/index.js'));
    assert.ok(isSafePath(base, 'module.manifest.js'));
    assert.ok(isSafePath(base, 'models/vehicle.model.js'));
  });

  it('blocks path traversal with ../', () => {
    assert.ok(!isSafePath(base, '../../apps/api/src/index.js'));
    assert.ok(!isSafePath(base, '../custom.other/api/index.js'));
  });

  it('blocks absolute paths embedded in entry names', () => {
    // path.resolve will resolve this relative to base, still safe if starts correctly
    // but an absolute-looking path like /etc/passwd should fail
    const absPath = path.resolve('/etc/passwd');
    // isSafePath receives a relative entry from ZIP, not absolute
    // so this tests that an attacker cannot escape via multiple ..
    assert.ok(!isSafePath(base, '../../../etc/passwd'));
  });
});
```

- [ ] **Step 2.5: Run the test**

```bash
node --test apps/api/src/services/__tests__/module-upload-service.test.js
```

Expected: 3 passing tests.

- [ ] **Step 2.6: Commit**

```bash
git add apps/api/src/services/module-upload-service.js apps/api/src/services/__tests__/module-upload-service.test.js
git commit -m "feat(module-upload): add path-safety, prefix-detection, and manifest-key helpers"
```

---

## Task 3: Extraction and purge functions

**Files:**
- Modify: `apps/api/src/services/module-upload-service.js`

- [ ] **Step 3.1: Add `validateAndExtractZip`**

Append to `module-upload-service.js`:

```js
/**
 * Validates a ZIP buffer and extracts it to {modulesDir}/{key}/.
 * Throws an Error with statusCode and optional details on validation failure.
 * Returns { fileCount } on success.
 */
export async function validateAndExtractZip(key, fileBuffer, modulesDir) {
  if (fileBuffer.length > MAX_COMPRESSED_BYTES) {
    throw Object.assign(new Error('ZIP_TOO_LARGE'), { statusCode: 413 });
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(fileBuffer);
  } catch {
    throw Object.assign(new Error('INVALID_ZIP'), { statusCode: 422 });
  }

  const filenames = Object.keys(zip.files).filter(n => !zip.files[n].dir);
  const prefix = detectRootPrefix(filenames);

  if (prefix === null) {
    throw Object.assign(new Error('AMBIGUOUS_ZIP_STRUCTURE'), { statusCode: 422 });
  }

  const manifestEntry = zip.files[prefix + 'module.manifest.js'];
  if (!manifestEntry) {
    throw Object.assign(new Error('MISSING_MANIFEST'), { statusCode: 422 });
  }

  const manifestContent = await manifestEntry.async('text');
  const manifestKey = extractManifestKey(manifestContent);
  if (!manifestKey) {
    throw Object.assign(new Error('MANIFEST_KEY_UNREADABLE'), { statusCode: 422 });
  }
  if (manifestKey !== key) {
    throw Object.assign(new Error('MANIFEST_KEY_MISMATCH'), {
      statusCode: 422,
      details: { expected: key, found: manifestKey },
    });
  }

  const targetBase = path.resolve(modulesDir, key);
  let totalUncompressed = 0;

  // Validate all paths and accumulate uncompressed size before writing anything
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const relative = prefix ? name.slice(prefix.length) : name;
    if (!isSafePath(targetBase, relative)) {
      throw Object.assign(new Error('PATH_TRAVERSAL_DETECTED'), {
        statusCode: 422,
        details: { entry: name },
      });
    }
    totalUncompressed += entry._data?.uncompressedSize ?? 0;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw Object.assign(new Error('UNCOMPRESSED_SIZE_EXCEEDED'), { statusCode: 413 });
    }
  }

  // Atomically replace the existing directory (if any)
  if (existsSync(targetBase)) {
    await fs.rm(targetBase, { recursive: true, force: true });
  }
  await fs.mkdir(targetBase, { recursive: true });

  let fileCount = 0;
  try {
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const relative = prefix ? name.slice(prefix.length) : name;
      // Convert forward slashes to OS separator (Windows compatibility)
      const dest = path.resolve(targetBase, relative.split('/').join(path.sep));
      await fs.mkdir(path.dirname(dest), { recursive: true });
      const content = await entry.async('nodebuffer');
      await fs.writeFile(dest, content);
      fileCount++;
    }
  } catch (writeErr) {
    // Cleanup partial write — do not leave a broken module directory
    await fs.rm(targetBase, { recursive: true, force: true }).catch(() => {});
    throw Object.assign(new Error('WRITE_FAILED'), { statusCode: 500, cause: writeErr });
  }

  return { fileCount };
}
```

- [ ] **Step 3.2: Add `purgeModuleFiles` and `purgeModuleFromDb`**

Append to `module-upload-service.js`:

```js
/**
 * Deletes the module directory from the filesystem.
 * Returns true if deleted, false if the directory did not exist (not an error).
 */
export async function purgeModuleFiles(key, modulesDir) {
  const targetBase = path.resolve(modulesDir, key);
  if (!existsSync(targetBase)) return false;
  await fs.rm(targetBase, { recursive: true, force: true });
  return true;
}

/**
 * Hard-deletes all DB records for a module.
 * Requires module.status !== 'INSTALLED' || module.enabled === false.
 * Runs in a Prisma transaction: AtlasField → AtlasModel → Blueprint → AtlasModule.
 */
export async function purgeModuleFromDb(key, prisma) {
  return prisma.$transaction(async (tx) => {
    const module = await tx.atlasModule.findUnique({ where: { key } });
    if (!module) {
      throw Object.assign(new Error('MODULE_NOT_FOUND'), { statusCode: 404 });
    }
    if (module.status === 'INSTALLED' && module.enabled) {
      throw Object.assign(new Error('MODULE_MUST_BE_UNINSTALLED'), { statusCode: 409 });
    }

    const models = await tx.atlasModel.findMany({
      where: { moduleKey: key },
      select: { id: true },
    });
    const modelIds = models.map(m => m.id);
    if (modelIds.length > 0) {
      await tx.atlasField.deleteMany({ where: { modelId: { in: modelIds } } });
    }
    await tx.atlasModel.deleteMany({ where: { moduleKey: key } });
    await tx.blueprint.deleteMany({ where: { moduleKey: key } });
    await tx.atlasModule.delete({ where: { key } });

    return { moduleKey: key };
  });
}
```

- [ ] **Step 3.3: Syntax-check the complete service**

```bash
node --check apps/api/src/services/module-upload-service.js
```

Expected: no output.

- [ ] **Step 3.4: Commit**

```bash
git add apps/api/src/services/module-upload-service.js
git commit -m "feat(module-upload): implement validateAndExtractZip, purgeModuleFiles, purgeModuleFromDb"
```

---

## Task 4: Permissions — manifest + catalog

**Files:**
- Modify: `apps/api/src/manifests/official/core-modules.js`
- Modify: `apps/api/src/permission-catalog.js`

- [ ] **Step 4.1: Add permissions to atlas.core manifest**

In `core-modules.js`, find the `atlas.core` manifest's `permissions` array (around line 40-45). It currently ends with:
```js
{ key: "core.modules.delete", name: "Uninstall Core Modules" },
```
Add two entries after it:
```js
{ key: "core.modules.upload", name: "Upload Custom Module ZIP" },
{ key: "core.modules.purge", name: "Purge Custom Module from Server" },
```

- [ ] **Step 4.2: Add display names to `permission-catalog.js`**

In `permission-catalog.js`, find the `"core.modules.delete"` entry (around line 118-123):
```js
"core.modules.delete": {
  displayNameEs: "Desinstalar modulos desde core",
  descriptionEs: "Permite desinstalar modulos instalados.",
  groupKey: "core",
  order: 70,
},
```
Add after it:
```js
"core.modules.upload": {
  displayNameEs: "Subir modulo custom (ZIP)",
  descriptionEs: "Permite subir un modulo custom como archivo ZIP al servidor.",
  groupKey: "core",
  order: 75,
},
"core.modules.purge": {
  displayNameEs: "Purgar modulo custom del servidor",
  descriptionEs: "Permite eliminar permanentemente un modulo custom del servidor y la base de datos.",
  groupKey: "core",
  order: 76,
},
```

- [ ] **Step 4.3: Verify the seed picks them up**

```bash
pnpm db:seed
```

Expected output includes: `Atlas modules seeded (N)` with no errors. Then verify in Prisma Studio or via curl that `core.modules.upload` and `core.modules.purge` exist in the `Permission` table.

- [ ] **Step 4.4: Commit**

```bash
git add apps/api/src/manifests/official/core-modules.js apps/api/src/permission-catalog.js
git commit -m "feat(module-upload): add core.modules.upload and core.modules.purge permissions"
```

---

## Task 5: Upload endpoint in modules router

**Files:**
- Modify: `apps/api/src/routes/modules.js`

The upload handler is thin — all logic lives in `module-upload-service.js`. Add the import at the top of the file and the route near the end of the router (after the existing lifecycle routes).

- [ ] **Step 5.1: Add the import**

At the top of `apps/api/src/routes/modules.js`, add among the existing service imports:

```js
import {
  resolveModulesDir,
  validateAndExtractZip,
  purgeModuleFiles,
  purgeModuleFromDb,
} from '../services/module-upload-service.js';
```

- [ ] **Step 5.2: Add the upload route handler**

Find the last route in the router (the file ends around line 2221). Add the upload handler **before** the final `export default router` (or before the closing of the router registration block — follow the exact same pattern as the other `router.post` calls in the file):

```js
// POST /modules/:key/upload — extract a custom module ZIP to ATLAS_MODULES_DIR
router.post(
  "/:key/upload",
  authMiddleware,
  requirePermission("core.modules.upload"),
  async (c) => {
    const key = c.req.param("key");

    const modulesDir = resolveModulesDir();
    if (!modulesDir || !existsSync(modulesDir)) {
      return c.json({ error: "MODULES_DIR_NOT_CONFIGURED" }, 503);
    }

    const body = await c.req.parseBody();
    const file = body.file;
    if (!file || typeof file.arrayBuffer !== "function") {
      return c.json({ error: "Campo file requerido" }, 422);
    }
    if (!file.name?.toLowerCase().endsWith(".zip")) {
      return c.json({ error: "El archivo debe ser un ZIP" }, 422);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      const { fileCount } = await validateAndExtractZip(key, buffer, modulesDir);

      // Trigger a sync scoped to this module key so it appears in the catalog
      const discoveryRootInfo = await getDiscoveryRootInfo();
      const discoveredAll = await discoverModules({
        rootDir: discoveryRootInfo.projectRoot,
      });
      const discovered = discoveredAll.filter((r) => r?.key === key);
      const actorId = await resolveSyncActorId(prisma, c.get("userContext"));
      const syncResult = await syncDiscoveredModuleDependencies({
        prisma,
        discovered,
        actorId,
        autoRepairEnabled: false,
      });

      return c.json({ data: { moduleKey: key, fileCount, syncResult } });
    } catch (err) {
      return c.json(
        { error: err.message, details: err.details ?? null },
        err.statusCode ?? 500
      );
    }
  }
);
```

> **Note:** `resolveSyncActorId`, `syncDiscoveredModuleDependencies`, `discoverModules`, `getDiscoveryRootInfo`, `prisma`, `authMiddleware`, `requirePermission`, and `existsSync` are all already imported/available in this file. Verify the exact names by searching the top of `modules.js`.

- [ ] **Step 5.3: Check `existsSync` is imported**

`modules.js` currently uses `import fs from "node:fs/promises"`. The sync `existsSync` is a named export from `"node:fs"` (not the promises version). Check the top of the file for an existing `import { existsSync }` or add:

```js
import { existsSync } from "node:fs";
```

- [ ] **Step 5.4: Syntax-check**

```bash
node --check apps/api/src/routes/modules.js
```

Expected: no output.

- [ ] **Step 5.5: Smoke-test the endpoint**

Start the API (`pnpm dev:api`) and test with a valid module ZIP (use `custom.fleet` or `custom.musicfy` from the installer's `custom-modules/` directory):

```bash
# Mac/Linux
curl -X POST http://localhost:4010/modules/custom.fleet/upload \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -F "file=@/path/to/custom.fleet.zip"

# Windows PowerShell
$headers = @{ Authorization = "Bearer $env:ATLAS_TOKEN" }
$form = @{ file = Get-Item "C:\path\to\custom.fleet.zip" }
Invoke-RestMethod -Uri "http://localhost:4010/modules/custom.fleet/upload" -Method Post -Headers $headers -Form $form
```

Expected: `{ data: { moduleKey: "custom.fleet", fileCount: N, syncResult: {...} } }`

- [ ] **Step 5.6: Commit**

```bash
git add apps/api/src/routes/modules.js
git commit -m "feat(module-upload): add POST /modules/:key/upload endpoint"
```

---

## Task 6: Purge endpoint in modules router

**Files:**
- Modify: `apps/api/src/routes/modules.js`

- [ ] **Step 6.1: Add the purge route handler**

After the upload handler (Task 5), add:

```js
// DELETE /modules/:key/purge — hard-delete filesystem files + all DB records for a module
router.delete(
  "/:key/purge",
  authMiddleware,
  requirePermission("core.modules.purge"),
  async (c) => {
    const key = c.req.param("key");
    const modulesDir = resolveModulesDir();

    try {
      await purgeModuleFromDb(key, prisma);

      let fsDeleted = false;
      if (modulesDir) {
        fsDeleted = await purgeModuleFiles(key, modulesDir);
        if (!fsDeleted) {
          console.warn(`[module-purge] Directory not found on filesystem for ${key}`);
        }
      }

      await cacheDel(`modules:list`).catch(() => {});

      return c.json({ data: { moduleKey: key, deleted: true, fsDeleted } });
    } catch (err) {
      return c.json(
        { error: err.message },
        err.statusCode ?? 500
      );
    }
  }
);
```

- [ ] **Step 6.2: Syntax-check**

```bash
node --check apps/api/src/routes/modules.js
```

Expected: no output.

- [ ] **Step 6.3: Smoke-test the purge endpoint**

With an UNINSTALLED module:

```bash
# Mac/Linux
curl -X DELETE http://localhost:4010/modules/custom.fleet/purge \
  -H "Authorization: Bearer $ATLAS_TOKEN"

# Windows PowerShell
Invoke-RestMethod -Uri "http://localhost:4010/modules/custom.fleet/purge" -Method Delete -Headers @{ Authorization = "Bearer $env:ATLAS_TOKEN" }
```

Expected: `{ data: { moduleKey: "custom.fleet", deleted: true, fsDeleted: true } }`

Test with an INSTALLED+enabled module → expected 409.

- [ ] **Step 6.4: Commit**

```bash
git add apps/api/src/routes/modules.js
git commit -m "feat(module-upload): add DELETE /modules/:key/purge endpoint"
```

---

## Task 7: SDK methods

**Files:**
- Modify: `packages/sdk/src/index.js`

The modules domain starts around line 188. Add the two new methods at the end of the `modules` object, after `seed`.

- [ ] **Step 7.1: Add `uploadModuleZip` and `purgeModule`**

Find the closing of the `modules:` block (after `seed: ...` around line 280). Add before the closing `}`:

```js
uploadModuleZip: (key, formData, token) =>
  request(`/modules/${encodeURIComponent(key)}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    // Do NOT set Content-Type — let the browser/fetch set multipart boundary
  }),
purgeModule: (key, token) =>
  request(`/modules/${encodeURIComponent(key)}/purge`, {
    method: "DELETE",
    headers: withAuthHeaders(token),
  }),
```

> **Note:** `uploadModuleZip` takes a `FormData` object (constructed by the caller), not raw bytes. This matches how `dist-upload-service` is called from the frontend.

- [ ] **Step 7.2: Syntax-check**

```bash
node --check packages/sdk/src/index.js
```

Expected: no output.

- [ ] **Step 7.3: Build the full project**

```bash
pnpm build
```

Expected: no errors.

- [ ] **Step 7.4: Commit**

```bash
git add packages/sdk/src/index.js
git commit -m "feat(module-upload): add uploadModuleZip and purgeModule SDK methods"
```

---

## Spec Coverage Verification

| Spec requirement | Covered by |
|---|---|
| `POST /modules/:key/upload` — size limits | Task 3 (`validateAndExtractZip`, MAX_COMPRESSED_BYTES / MAX_UNCOMPRESSED_BYTES) |
| Path traversal prevention | Task 2 (`isSafePath`) + Task 3 (pre-extraction loop) |
| Manifest presence + key match | Task 3 (`detectRootPrefix`, `extractManifestKey`) |
| Auto-sync after upload | Task 5 (calls `discoverModules` + `syncDiscoveredModuleDependencies`) |
| `DELETE /modules/:key/purge` — 409 if INSTALLED | Task 3 (`purgeModuleFromDb` check) |
| DB transaction for purge | Task 3 (`prisma.$transaction`) |
| Filesystem delete | Task 3 (`purgeModuleFiles`) |
| `ATLAS_MODULES_DIR` 503 when not set | Task 5 route handler |
| Two new permissions in catalog + seeded | Task 4 |
| SDK methods | Task 7 |
