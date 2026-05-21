# AME3 Module Discovery + Sync

Date: 2026-05-09  
Status: Complete  
Owner: Atlas ERP AME3

---

## Problem

AME3 already has:
- `@atlas/module-engine` declaration contracts and validators.
- A sample custom module at `modules/custom/custom.fleet`.
- Metadata persistence services (`module-metadata-service`, `module-migration-service`) and tables.

But module sync still depends on `packages/maps` static imports in API route logic. Atlas cannot yet discover modules directly from filesystem module folders and cannot produce resilient per-module sync results (valid/error) from real declarations.

Without discovery sync:
- Custom modules cannot be onboarded through the AME3 runtime path.
- Invalid manifests can block sync workflows if not isolated.
- Metadata services cannot be fed by a canonical discovery pipeline.
- Atlas cannot progressively move away from `packages/maps` as primary module source.

---

## Goals

1. Add a discovery service at `apps/api/src/services/module-discovery-service.js` to scan:
- `modules/official/*/module.manifest.js`
- `modules/custom/*/module.manifest.js`

2. Load and validate module manifests, then load declarations from:
- `models/*.model.js`
- `views/*.js` (including page declarations exported via `definePage`)

3. Return discovery records with explicit success/error status per module:

```js
{
  key,
  manifest,
  source,
  localPath,
  moduleDir,
  status: 'VALID' | 'ERROR',
  error,
  models,
  views,
}
```

4. Integrate `POST /modules/sync` to use discovery as the primary source.

5. Sync valid discovered modules into:
- `AtlasModule` rows
- permission rows
- metadata tables through `module-metadata-service`

6. Keep sync resilient:
- invalid module records never crash the API
- discovery continues after individual module failures

7. Do not execute SQL migrations during discovery/sync in this phase.

---

## Non-goals

1. API route loader implementation from discovered modules.
2. Frontend dynamic renderer for discovered views/pages.
3. Automatic execution of model SQL migrations during sync.
4. Migration of existing official modules to new declaration format.
5. Changing module install/uninstall lifecycle semantics outside sync onboarding.
6. Deleting current Prisma models or rewriting migration history.

---

## Architecture impact

Primary data flow in this phase:

`filesystem module folders`  
`-> module-discovery-service`  
`-> VALID/ERROR discovery records`  
`-> /modules/sync orchestration`  
`-> AtlasModule + Permission + Blueprint/AtlasView metadata sync`

Key cutover:
- Discovery becomes the primary input for `/modules/sync`.
- `packages/maps` becomes a temporary bridge only for required core continuity while official module folders are completed.

Temporary bridge policy:
- If core modules are required for current runtime stability and are not yet present in `modules/official`, `/modules/sync` may merge fallback core manifests from `packages/maps`.
- This fallback must be explicit, documented in logs/response metadata, and treated as temporary AME3 bridge behavior.

---

## Module discovery behavior

Service API contract:
- `discoverModules({ rootDir })`
- `discoverOfficialModules({ rootDir })`
- `discoverCustomModules({ rootDir })`
- `loadModuleManifest({ manifestPath, source })`
- `loadModuleModels({ moduleDir, manifest })`
- `loadModuleViews({ moduleDir, manifest })`
- `validateDiscoveredModule(record)`

Rules:
1. If `modules/official` does not exist, official discovery returns `[]`.
2. If `modules/custom` does not exist, custom discovery returns `[]`.
3. If a module folder has no `module.manifest.js`, skip silently.
4. Discovery errors are isolated per folder; one bad module never aborts full scan.
5. Duplicate keys are detected across all records.
6. Conflict priority: official record wins over custom record for same key.
7. Duplicate conflict outcome:
- winning record remains `VALID` if otherwise valid.
- losing record becomes `ERROR` with explicit duplicate-key message.

Source constraints:
- Official modules must use keys under `atlas.*`.
- Custom/community modules cannot use reserved namespaces:
  - `atlas.*`
  - `core.*`
  - `system.*`
  - `identity.*`

---

## Manifest loading behavior

`loadModuleManifest({ manifestPath, source })`:
1. Resolve and normalize `manifestPath` under allowed discovery roots.
2. Dynamically import only the explicit manifest file.
3. Require `default` export and validate with module-engine contract expectations.
4. If validation fails:
- produce record `status: "ERROR"`
- include safe error string
- continue discovery.

Manifest minimums for sync eligibility:
- `key`, `name`, `version`
- valid `kind`
- ACL/permission shape compatible with existing module lifecycle rules

---

## Model/view/page loading behavior

`loadModuleModels({ moduleDir, manifest })`:
- Read local model declaration paths from `manifest.models`.
- Import only declaration files explicitly referenced by `manifest.models`.
- Non-fatal behavior on per-file load errors (mark module record `ERROR`).

`loadModuleViews({ moduleDir, manifest })`:
- Read local declaration paths from `manifest.views` and `manifest.pages`.
- Import only declaration files explicitly referenced by `manifest.views`/`manifest.pages`.
- Validate view declarations with `validateView` and page declarations with `validatePage`.
- Normalize pages as view-like metadata entries for persistence (`type: "page"` or declared type).

Behavioral rules:
1. Missing `models/` or `views/` directories is allowed and should yield empty arrays.
2. Imported declarations are validated before sync.
3. Invalid model/view/page declarations mark module `ERROR` but do not crash sync.

---

## Metadata sync behavior

For each `VALID` discovered module:
1. Upsert `AtlasModule` row first.
2. Upsert module permissions.
3. Sync model/view metadata via `createModuleMetadataService({ prisma }).syncModuleMetadata({ manifest, models, views })`.

For `ERROR` discovered modules:
- If key is known, module row may be upserted/updated with error status metadata.
- If key is unknown, include item only in sync error summary.

Phase boundary:
- `module-migration-service` is not invoked to execute SQL in this phase.

---

## AtlasModule sync behavior

`POST /modules/sync` expectations:
1. Calls discovery service using repo root.
2. Processes each record independently with aggregated result summary.
3. Valid modules are upserted into `AtlasModule`.

Status defaults:
- New non-core modules:
  - `status: UNINSTALLED`
  - `enabled: false`
- Core modules remain protected and should retain installed/protected semantics.

Additional sync rules:
- Existing modules preserve install state unless explicit sync policy requires update.
- Sync updates manifest/version metadata and lifecycle config.
- No destructive delete of module rows in this phase.

---

## Permission sync behavior

For each valid module:
1. Upsert permissions from manifest (`permission.key` uniqueness preserved).
2. Ensure `moduleId`, `moduleKey`, `name`, and active flag reflect module state.
3. Deactivate stale permissions for same module key that are no longer declared (soft strategy), or keep them explicit by policy, but never hard-delete by default in this phase.

Invalid module behavior:
- Do not apply permission mutations for records in `ERROR` state.

---

## Blueprint / AtlasView sync behavior

Two persistence targets are acknowledged:
- Existing `Blueprint` table (legacy lifecycle dependency).
- New `AtlasView` metadata table for AME3 declaration persistence.

Phase behavior:
1. Persist discovered view/page declarations through metadata service (`AtlasView` path).
2. Keep `Blueprint` sync compatibility if current app behavior still relies on it.
3. No frontend route rendering is activated from these rows in this phase.

Bridge note:
- If both `Blueprint` and `AtlasView` are written, the sync response must make this explicit to avoid ambiguity.

---

## Error handling

Per-module error isolation is mandatory.

Sync response should include:
- totals: discovered, valid, errored, synced
- warnings/errors array with:
  - source
  - moduleDir or manifestPath
  - key when available
  - machine code + message

Expected failure classes:
- missing manifest
- manifest import failure
- manifest validation failure
- reserved namespace violation
- duplicate key conflict
- model/view import failure
- metadata persistence failure

No class above may crash the entire sync endpoint.

---

## Security considerations

1. Discovery trust boundary:
- module files are local code and treated as privileged repo input, not user input.

2. Controlled import surface:
- only import local files under discovered module directories:
  - `module.manifest.js`
  - files referenced by `manifest.models`
  - files referenced by `manifest.views`
  - files referenced by `manifest.pages`

3. Namespace enforcement:
- block reserved prefixes for non-official modules.

4. No SQL execution:
- discovery/sync only persists metadata and module rows; it does not run generated migration SQL in this phase.

5. Safe error output:
- do not leak stack traces or absolute host internals in API responses.

---

## Path safety

Required safeguards:
1. Resolve `rootDir`, source roots, module dirs, and candidate files using normalized absolute paths.
2. Reject paths that escape root via `..` traversal.
3. Reject symlink escapes that resolve outside allowed roots.
4. Never execute shell commands from discovered manifest content.
5. Skip hidden/system folders and non-directory entries.

---

## Dynamic import safety

1. Convert validated absolute file paths to `file://` URLs before import.
2. Discovery entry import is only the local `<moduleDir>/module.manifest.js` file.
3. Any additional declaration imports (models/views/pages) are allowed only as local files under that same discovered `<moduleDir>`.
4. Allowlisted declaration patterns:
- paths explicitly declared in manifest (`models`, `views`, `pages`) and resolved under `<moduleDir>`
5. Discovery never rewrites module source code and never imports `data:` URLs.
6. If package resolution fails (for example `@atlas/module-engine` cannot be resolved), mark the module as `ERROR` and continue discovery.
7. Workspace/dependency linking is fixed in a separate package-resolution phase, not via runtime source rewriting.
8. Verify expected export shape after import; reject unknown executable hooks in this phase.
9. Continue processing after import failures with `ERROR` records.

---

## API impact

Required integration:
- `apps/api/src/routes/modules.js` updates `POST /modules/sync` to orchestrate discovery-based sync.

No new public endpoints required in this phase.

Route-level behavior updates:
- return discovery/sync summary payload including valid/error breakdown.
- preserve existing auth and permission guards for module sync endpoint.

---

## Validation commands

```bash
# 1) Static syntax checks
node --check apps/api/src/services/module-discovery-service.js
node --check apps/api/src/routes/modules.js

# 2) ESM import smoke check
node -e "import('./apps/api/src/services/module-discovery-service.js').then(m => console.log(Object.keys(m)))"

# 3) Optional focused tests
node --test apps/api/src/services/__tests__/module-discovery-service.test.js
node --test apps/api/src/routes/__tests__/modules.sync.test.js

# 4) Run API for manual sync smoke
pnpm.cmd dev:api

# 5) Manual sync + listing checks (PowerShell examples)
Invoke-WebRequest -UseBasicParsing -Method Post http://localhost:4010/modules/sync -Headers @{ Authorization = "Bearer $env:ATLAS_BEARER_TOKEN" }
Invoke-WebRequest -UseBasicParsing http://localhost:4010/modules -Headers @{ Authorization = "Bearer $env:ATLAS_BEARER_TOKEN" }
```

Expected high-level results:
- discovery service loads and exports successfully.
- `/modules/sync` returns success with per-module summary.
- `custom.fleet` appears in sync result and/or `GET /modules`.
- invalid modules are reported without crashing the API.

---

## Acceptance criteria

1. `module-discovery-service.js` exists and exports all required discovery APIs.
2. Discovery scans both `modules/official` and `modules/custom`.
3. Missing source roots return `[]` without throwing.
4. Missing `module.manifest.js` folders are skipped.
5. Manifest validation failures produce `ERROR` records and discovery continues.
6. Custom/community modules using reserved namespaces are rejected.
7. Official modules not under `atlas.*` are rejected.
8. Duplicate module keys are detected; official wins over custom.
9. `POST /modules/sync` uses discovery output as primary input path.
10. Valid modules are upserted in `AtlasModule`.
11. Valid module permissions are upserted.
12. Valid module view/page declarations are synced through metadata service.
13. Invalid modules never crash API sync.
14. Invalid modules are surfaced either in `AtlasModule` error state (if key known) or in response errors (if key unknown).
15. New non-core modules default to `UNINSTALLED` and `enabled=false` unless explicitly installed.
16. Core module protections remain intact.
17. No SQL migrations are executed during discovery/sync.
18. No route loader implementation is introduced.
19. No frontend renderer implementation is introduced.
20. No official module migration is performed in this phase.
21. `packages/maps` is no longer primary sync source; any fallback bridge is explicitly documented and temporary.
