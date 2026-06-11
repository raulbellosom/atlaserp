# Custom Module ZIP Upload and Filesystem Purge

Date: 2026-06-10
Status: Draft
Author: Claude Sonnet 4.6
Spec file: docs/superpowers/specs/2026-06-10-custom-module-zip-upload-design.md
Plan file: docs/superpowers/plans/2026-06-10-custom-module-zip-upload.md (created after spec approval)

---

## 1. Feature title

Custom Module ZIP Upload and Filesystem Purge

## 2. Status

Draft

## 3. Context

Atlas ERP is distributed as a set of compiled Docker images that customers deploy on their own VPS. The installer repository (`ATLASERP-INSTALLER`) provisions a docker-compose stack and mounts a `custom-modules/` host directory into the container so that AME3 custom modules can be loaded without rebuilding the image.

Today, installing or updating a custom module on a live VPS requires the customer or developer to transfer files manually via FTP, SCP, or SSH — tools that may not be available to non-technical users and that introduce operational friction for all users. There is no built-in mechanism to upload a module through the Atlas UI or API.

A parallel system already exists for static websites: `dist-upload-service.js` accepts a ZIP file via HTTP, extracts it, and stores the assets in Supabase Storage. Custom modules need an analogous flow, but writing to the local container filesystem instead of object storage, because Node.js must be able to `import()` the module code at runtime.

The installer setup scripts (`setup-local.mjs`, `setup-external.mjs`) already auto-populate `.env`. The new env var introduced by this feature must be added to those scripts automatically so that no manual configuration is required after the installer runs.

## 4. Problem

There is no way to deploy a custom AME3 module to a production Atlas ERP instance without SSH/FTP access to the VPS filesystem. This makes custom module deployment inaccessible to non-technical operators and creates manual steps that are error-prone and hard to audit.

Additionally, when a module must be completely removed (not just disabled/uninstalled from the DB), there is no automated way to delete its files from the VPS filesystem — the operator must do it manually over SSH.

## 5. Goals

1. A superadmin can upload a custom module as a ZIP file through the API (and UI), and the API writes it to the correct directory on the container filesystem so the module is immediately available for install/sync.
2. A superadmin can trigger a complete module purge that removes both the filesystem directory and all related DB records (AtlasModule, Blueprint, AtlasModel, AtlasField).
3. The upload endpoint validates the ZIP for path traversal attacks, size limits, and the presence of a valid `module.manifest.js` at the expected location before writing any file.
4. After a successful upload, the API automatically runs module sync so the module appears in the catalog without a manual additional step.
5. The new `ATLAS_MODULES_DIR` env var is written automatically by the installer setup scripts (both local and external) so operators never need to set it manually.
6. The upload and purge operations are recorded in AuditLog.

## 6. Non-goals

1. Hot-reload or live swap of a module that is currently INSTALLED and enabled — upload requires the module to not be running (or the reload is handled by the existing sync mechanism at boot/manual sync call).
2. Module signing or cryptographic verification of the ZIP — deferred to a future version.
3. A module marketplace or catalog served from a remote registry — out of scope; upload is always a direct file from the operator.
4. Support for uploading module dependencies (npm packages) — the module is assumed to use only built-in Node.js, Atlas framework APIs, and packages already available in the API image.
5. Uploading modules to Supabase Storage — module code must always be on the local container filesystem for `import()` to work.
6. Rollback to a previous module version — deferred; no build history is maintained for module ZIPs.

## 7. User stories

- As a superadmin, I want to upload a custom module ZIP from the module catalog so that I can deploy a new module without SSH access to the VPS.
- As a superadmin, I want to upload a new ZIP for an existing module so that I can update the module code without restarting the server manually.
- As a superadmin, I want to completely purge a module (files + DB) so that the module is fully removed from the instance and its directory is freed from disk.
- As a developer building for Atlas, I want the ZIP upload to be validated before extraction so that a malformed or malicious ZIP does not damage the running API.

## 8. UX requirements

- The module catalog screen (`/app/catalog`) shows a new "Subir módulo" (Upload Module) button in the header area, visible only to users with `atlas.modules.upload` permission.
- Clicking "Subir módulo" opens a `Sheet` (side panel) from `@atlas/ui` with a file input for the ZIP and a text field pre-filled with the detected module key (editable).
- During upload, the Sheet shows a loading state using `toast` with loading indicator (same pattern as website dist upload).
- On success, a success toast appears ("Módulo subido correctamente. Sincronizando...") and the catalog refreshes automatically.
- On error (invalid ZIP, path traversal detected, size exceeded, missing manifest), a descriptive error toast appears with the server error message.
- The complete purge action is accessible from the module detail sheet (not the catalog list) under a "Zona de peligro" section, guarded by a `ConfirmDialog` with explicit warning text ("Esta acción elimina todos los archivos del módulo del servidor y no se puede deshacer").
- Purge is only shown and enabled when the module is in UNINSTALLED or DISABLED status.
- All button labels and toast messages in Spanish.

## 9. Routes/screens

This feature does not introduce new frontend routes. It adds UI affordances to existing screens:

| Existing route | Screen | Change |
|---|---|---|
| /app/catalog | ModuleCatalog | Add "Subir módulo" button + UploadModuleSheet |
| /app/catalog (module detail) | ModuleCatalog detail sheet | Add "Purgar módulo" destructive section |

## 10. Data model

### New models

None. No new Prisma models are required.

### Modified models

None. The existing `AtlasModule`, `Blueprint`, `AtlasModel`, `AtlasField` records are read and deleted during purge but their schemas do not change.

### Filesystem state (not Prisma)

A new directory tree is written to `{ATLAS_MODULES_DIR}/{moduleKey}/` on the container filesystem when a module is uploaded. `ATLAS_MODULES_DIR` is resolved from the env var at API startup. The directory is deleted on purge.

## 11. Prisma impact

New models: None
Modified models: None
New migration required: No
Migration safety notes: N/A

The purge operation performs hard-deletes on existing records using `prisma.atlasModule.delete`, `prisma.blueprint.deleteMany`, `prisma.atlasModel.deleteMany`, `prisma.atlasField.deleteMany` within a transaction. These are standard Prisma operations on existing models.

## 12. API contract

### POST /modules/:key/upload

Auth: required
Permission: `atlas.modules.upload`
Content-Type: `multipart/form-data`
Field: `file` — ZIP file (max 50 MB compressed)

Validation steps (in order, fail fast):
1. `ATLAS_MODULES_DIR` env var is set and directory exists on filesystem — otherwise 503 `{ error: "MODULES_DIR_NOT_CONFIGURED" }`.
2. File is present and has `.zip` extension — otherwise 422.
3. Compressed size ≤ 50 MB — otherwise 413.
4. ZIP is parseable via `jszip` — otherwise 422.
5. All entry names in the ZIP, after stripping a single optional root folder prefix, must resolve to paths **within** `{ATLAS_MODULES_DIR}/{moduleKey}/`. Any entry whose resolved path escapes the target directory is rejected with 422 `{ error: "PATH_TRAVERSAL_DETECTED", entry: "..." }`.
6. Uncompressed total size ≤ 150 MB — otherwise 413.
7. `module.manifest.js` must exist at the ZIP root (or under the single detected root folder) — otherwise 422 `{ error: "MISSING_MANIFEST" }`.
8. The `key` field exported from `module.manifest.js` must match the `:key` route param — otherwise 422 `{ error: "MANIFEST_KEY_MISMATCH", expected: key, found: manifestKey }`. (Manifest is read as text and the key extracted via regex, not executed.)

On validation pass:
- If target directory exists, it is removed recursively before extraction.
- All ZIP entries are written to `{ATLAS_MODULES_DIR}/{moduleKey}/`.
- `POST /modules/:key/sync` logic is called internally (not via HTTP) to update DB state.
- AuditLog entry is written.

Response success: `{ data: { moduleKey, fileCount, syncResult } }`
Response error: `{ error: string, details?: object }`

### DELETE /modules/:key/purge

Auth: required
Permission: `atlas.modules.purge`

Precondition: module must be in `UNINSTALLED` or `DISABLED` status. If `INSTALLED` and enabled, returns 409 `{ error: "MODULE_MUST_BE_UNINSTALLED" }`.

Steps (in transaction where possible):
1. Delete `AtlasField` records for all `AtlasModel` rows owned by this module.
2. Delete `AtlasModel` records owned by this module.
3. Delete `Blueprint` records for this module.
4. Delete `AtlasModule` record.
5. Remove `{ATLAS_MODULES_DIR}/{moduleKey}/` from filesystem (after DB transaction succeeds).
6. Write AuditLog entry.

Response success: `{ data: { moduleKey, deleted: true } }`
Response error: `{ error: string }`

## 13. SDK contract

Domain: `modules` (existing domain in `@atlas/sdk`)

New methods:
- `uploadModuleZip(key, formData, token)` — `POST /modules/:key/upload`, returns `{ data: { moduleKey, fileCount, syncResult } }`
- `purgeModule(key, token)` — `DELETE /modules/:key/purge`, returns `{ data: { moduleKey, deleted: true } }`

## 14. Validator contract

Module-local validators are not applicable (this is a system-level feature, not an AME3 module).

New Zod schemas in `@atlas/validators` or the API validation layer:

- `moduleUploadParamsSchema` — validates `:key` route param: string matching `^[a-z][a-z0-9]*\.[a-z][a-z0-9._-]*$` (Atlas module key format).
- No body schema needed for upload (multipart handled by Hono's built-in form parser).
- `modulePurgeParamsSchema` — same key validation as above.

## 15. Module manifest impact

This feature is not an AME3 module. It extends the existing module lifecycle system.

Two new permission keys are added to the `atlas.identity` permission catalog (or a new `atlas.modules` system permission group):

- `atlas.modules.upload`
- `atlas.modules.purge`

These are seeded in `prisma/seed.js` as system permissions and assigned to the `owner` role by default.

No new manifest file is created. No changes to `apps/api/src/manifests/official/`.

## 16. Navigation impact

No new navigation items. The upload and purge actions surface inside the existing module catalog UI.

## 17. Blueprint impact

N/A

## 18. RBAC/permissions

| Permission key | Guards endpoint(s) | Gates navigation |
|---|---|---|
| `atlas.modules.upload` | `POST /modules/:key/upload` | No (inline button in catalog) |
| `atlas.modules.purge` | `DELETE /modules/:key/purge` | No (inline button in module detail) |

Both permissions are assigned to the `owner` role in seed. `superadmin` inherits all permissions. No other roles receive these by default.

## 19. Multi-company behavior

Module uploads and purges are **instance-level operations**, not company-scoped. A single Atlas instance has one `ATLAS_MODULES_DIR`. The endpoints do not filter by `companyId`. The permission check is sufficient: only the instance owner/superadmin can upload or purge modules.

## 20. Files/storage impact

Files are written to the **local container filesystem** at `{ATLAS_MODULES_DIR}/{moduleKey}/`. Supabase Storage is not used for module code. The `ATLAS_MODULES_DIR` path corresponds to the volume-mounted `custom-modules/` directory in the installer's docker-compose.yml.

No `FileAsset` records are created. No Supabase Storage bucket is used.

## 21. Export/import requirements

N/A

## 22. Audit log requirements

| Action key | Trigger | Payload |
|---|---|---|
| `atlas.modules.upload` | `POST /modules/:key/upload` success | `{ moduleKey, fileCount, uploadedBy }` |
| `atlas.modules.purge` | `DELETE /modules/:key/purge` success | `{ moduleKey, purgedBy }` |

## 23. Edge cases

1. **Module is currently INSTALLED and enabled at upload time** — The ZIP is extracted and files are updated on disk, but the running in-memory router is not replaced until the module is synced/reloaded. The sync call after upload updates DB state but the route-loader only hot-reloads on `POST /modules/:key/sync` or server restart. Document this limitation in the success response: `syncResult.requiresRestart: boolean`.
2. **ZIP contains a single root folder vs. files at root** — Mirror the dist-upload logic: detect whether `module.manifest.js` is at the root or inside a single subdirectory. Strip the subdirectory prefix when extracting. Reject if there are multiple root-level directories (ambiguous structure).
3. **Upload to a key that already has files on disk** — Existing directory is deleted before new extraction begins. If deletion fails (permissions), return 500 and do not write new files.
4. **`ATLAS_MODULES_DIR` not set or directory does not exist** — Return 503 with `MODULES_DIR_NOT_CONFIGURED`. Do not fall back to the repo's `modules/custom/` directory, as that is only valid in development.
5. **Purge of a module whose directory does not exist on disk** — DB cleanup proceeds normally; filesystem step is skipped (not an error — the operator may have manually deleted it already). Log a warning.
6. **Manifest key extraction via regex** — The key is extracted with a simple pattern (`key:\s*['"]([^'"]+)['"]`) without executing the file. If the pattern doesn't match (e.g., key is computed dynamically), return 422 `MANIFEST_KEY_UNREADABLE` and require the ZIP to use a static key literal.
7. **Concurrent uploads to the same module key** — Not explicitly locked. The last write wins. Document this as a known limitation; a distributed lock is a future enhancement.
8. **Partial write failure during ZIP extraction** — If writing any file fails mid-extraction, attempt to clean up the partially-written directory. Log the cleanup result. Return 500.

## 24. Risks

1. **Risk**: Path traversal via crafted ZIP entry names (e.g., `../../apps/api/src/index.js`). **Mitigation**: Normalize each entry path with `path.resolve()` and verify it starts with the absolute target directory path before writing. Reject the entire ZIP if any entry fails this check.
2. **Risk**: ZIP bomb — tiny compressed file that decompresses to gigabytes. **Mitigation**: Track cumulative uncompressed size during extraction; abort and delete partial output if the total exceeds 150 MB.
3. **Risk**: Arbitrary code execution — an attacker with `atlas.modules.upload` permission uploads a malicious module. **Mitigation**: This permission is owner-only. The threat model accepts that the instance owner has code execution capability; this is equivalent to SSH access. Document clearly.
4. **Risk**: Purge deletes records that still have foreign-key references in other tables (e.g., AuditLog referencing AtlasModule). **Mitigation**: Use `onDelete: SetNull` or similar FK behavior; AuditLog entries are retained with a null module reference. Verify FK constraints before finalizing the purge transaction.
5. **Risk**: The `ATLAS_MODULES_DIR` env var is not set in existing deployments that upgrade to this version. **Mitigation**: The endpoint returns 503 with a clear error. The installer update instructions document the new var. No silent fallback to the repo path.

## 25. Acceptance criteria

1. Given `ATLAS_MODULES_DIR` is set and the user has `atlas.modules.upload`, when a valid module ZIP is uploaded to `POST /modules/custom.musicfy/upload`, then the files are written to `{ATLAS_MODULES_DIR}/custom.musicfy/` and the response contains `{ data: { moduleKey: "custom.musicfy", fileCount: N } }`.
2. Given a ZIP containing a path entry `../../apps/api/src/evil.js`, when uploaded, then the API returns 422 with `{ error: "PATH_TRAVERSAL_DETECTED" }` and no files are written to disk.
3. Given a ZIP larger than 50 MB, when uploaded, then the API returns 413 before any extraction begins.
4. Given a ZIP without `module.manifest.js`, when uploaded, then the API returns 422 `{ error: "MISSING_MANIFEST" }`.
5. Given a ZIP where `module.manifest.js` contains `key: 'custom.other'` but the route param is `custom.musicfy`, when uploaded, then the API returns 422 `{ error: "MANIFEST_KEY_MISMATCH" }`.
6. Given a user without `atlas.modules.upload`, when they call `POST /modules/:key/upload`, then the API returns 403.
7. Given a module in INSTALLED+enabled status, when `DELETE /modules/:key/purge` is called, then the API returns 409 `{ error: "MODULE_MUST_BE_UNINSTALLED" }`.
8. Given a module in UNINSTALLED status, when `DELETE /modules/:key/purge` is called with `atlas.modules.purge` permission, then all AtlasModule, Blueprint, AtlasModel, AtlasField records for that key are deleted and the filesystem directory is removed.
9. Given `ATLAS_MODULES_DIR` is not set, when any upload is attempted, then the API returns 503 `{ error: "MODULES_DIR_NOT_CONFIGURED" }`.
10. Given a successful upload, when the catalog UI refreshes, then the newly uploaded module appears in the module list.

## 26. Verification plan

- `pnpm build` — no build errors.
- `pnpm db:seed` — new `atlas.modules.upload` and `atlas.modules.purge` permissions are seeded and visible.
- `node --check apps/api/src/services/module-upload-service.js` — syntax check passes.
- Manual: set `ATLAS_MODULES_DIR` to a temp directory, upload a valid module ZIP → verify files appear in the temp directory and module appears in `GET /modules`.
- Manual: upload a ZIP with `../../evil.js` entry → verify 422 and no file written.
- Manual: upload a 60 MB ZIP → verify 413 before extraction.
- Manual: authenticate as a user without `atlas.modules.upload` → verify 403.
- Manual: uninstall a module, then call `DELETE /modules/:key/purge` → verify records gone from DB and directory removed from filesystem.
- Manual: call purge on an INSTALLED module → verify 409.
- Manual: attempt upload without `ATLAS_MODULES_DIR` → verify 503.
- Manual: upload module ZIP through catalog UI → verify Sheet UX, success toast, catalog refresh.
- Manual: trigger purge from module detail UI → verify ConfirmDialog appears, after confirm the module disappears from catalog.

## 27. Rollback plan

No Prisma migrations are involved. Rollback consists of:
1. Redeploy the previous API image.
2. The new permissions (`atlas.modules.upload`, `atlas.modules.purge`) remain in the DB but are harmless — no endpoints exist to use them.
3. Any module ZIPs already extracted to `ATLAS_MODULES_DIR` remain on disk and continue to function normally via the existing module loading path.
4. No data loss risk from rollback.

## 28. Future enhancements

1. Module signing and signature verification before extraction (cryptographic trust chain for module ZIPs).
2. Upload history log showing who uploaded which version at what time (similar to dist build history).
3. Rollback to a previous module ZIP (requires keeping a builds archive in `ATLAS_MODULES_DIR/{key}/.builds/`).
4. Distributed lock on upload to prevent concurrent overwrites.
5. A module ZIP download endpoint so operators can export the current filesystem state of a module for backup.
6. Trigger a graceful live hot-swap of a running module without requiring a server restart (requires route-loader-service.js to support teardown + reload of a specific module key).
7. Automatic npm install for modules that ship a `package.json` with external dependencies (currently out of scope; requires sandboxing).
