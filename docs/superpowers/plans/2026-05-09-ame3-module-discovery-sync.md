# AME3 Module Discovery + Sync Implementation Plan

Status: Complete

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement filesystem module discovery and sync so `POST /modules/sync` ingests `modules/official/*/module.manifest.js` and `modules/custom/*/module.manifest.js` as the AME3 primary source, then persists valid modules/permissions/views metadata safely.

**Architecture:** Add a dedicated discovery service (`module-discovery-service.js`) and wire `apps/api/src/routes/modules.js` sync flow to use it. Keep SQL migrations out of discovery sync. Keep route-loader and frontend renderer out of scope.

**Tech Stack:** Node.js ESM, Hono routes, Prisma services/tables already present, `@atlas/module-engine` declaration contracts/validators, node:test.

---

## File Structure Map

### Files to create

1. `apps/api/src/services/module-discovery-service.js`  
Purpose: discover module folders, load manifests/models/views, validate records, and return per-module `VALID`/`ERROR` results.

2. `apps/api/src/services/__tests__/module-discovery-service.test.js`  
Purpose: verify discovery behavior, namespace rules, duplicate resolution, and error isolation.

3. `apps/api/src/routes/__tests__/modules.sync.test.js`  
Purpose: verify `/modules/sync` orchestration with discovery-driven input and resilient response structure.

### Files to modify

1. `apps/api/src/routes/modules.js`  
Changes:
- Replace `packages/maps` as primary sync source in `POST /modules/sync`.
- Call discovery service and process valid/error records.
- Sync valid modules into `AtlasModule`, permissions, and metadata service.
- Return structured summary with synced/errors counts.

2. `apps/api/src/services/module-lifecycle-service.js` (optional only if needed)  
Changes:
- Only if shared upsert helpers must be reused for permissions/blueprints to avoid duplication.
- No behavior change outside sync path.

### Files forbidden to modify

- `apps/desktop/**`
- `packages/module-engine/**`
- `modules/custom/custom.fleet/**`
- `packages/maps/**` (except read-only bridge import if temporarily required)
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `apps/api/src/index.js`
- `package.json`
- `pnpm-lock.yaml`

---

## Task 1: Discovery Service Skeleton and Contracts

**Files:**
- Create: `apps/api/src/services/module-discovery-service.js`

- [ ] **1.1 Export required API:**
  - `discoverModules({ rootDir })`
  - `discoverOfficialModules({ rootDir })`
  - `discoverCustomModules({ rootDir })`
  - `loadModuleManifest({ manifestPath, source })`
  - `loadModuleModels({ moduleDir, manifest })`
  - `loadModuleViews({ moduleDir, manifest })`
  - `validateDiscoveredModule(record)`
- [ ] **1.2 Define and document discovery record shape (`VALID`/`ERROR`)**
- [ ] **1.3 Add source enum handling (`official`, `custom`)**

Validation commands:

```bash
node --check apps/api/src/services/module-discovery-service.js
node -e "import('./apps/api/src/services/module-discovery-service.js').then(m => console.log(Object.keys(m)))"
```

Expected output:
- Syntax check exits 0.
- Import lists required exports.

Commit checkpoint:

```bash
git add apps/api/src/services/module-discovery-service.js
git commit -m "feat(ame3): scaffold module discovery service contracts"
```

---

## Task 2: Filesystem Discovery and Path Safety

**Files:**
- Modify: `apps/api/src/services/module-discovery-service.js`

- [ ] **2.1 Resolve root directories safely (`modules/official`, `modules/custom`)**
- [ ] **2.2 Return `[]` if either source root does not exist**
- [ ] **2.3 Iterate only directory entries; skip non-directories**
- [ ] **2.4 Skip folders missing `module.manifest.js`**
- [ ] **2.5 Enforce path traversal/symlink escape protections**

Implementation notes:
- Normalize all candidate paths and ensure they stay under resolved source roots.
- Do not invoke shell commands for discovery.

Validation commands:

```bash
node --check apps/api/src/services/module-discovery-service.js
node --test apps/api/src/services/__tests__/module-discovery-service.test.js
```

Expected output:
- Discovery handles missing folders and skipped manifests without exceptions.

Commit checkpoint:

```bash
git add apps/api/src/services/module-discovery-service.js apps/api/src/services/__tests__/module-discovery-service.test.js
git commit -m "feat(ame3): add safe filesystem scanning for official and custom modules"
```

---

## Task 3: Manifest, Model, View, and Page Loading

**Files:**
- Modify: `apps/api/src/services/module-discovery-service.js`
- Modify/Create: `apps/api/src/services/__tests__/module-discovery-service.test.js`

- [ ] **3.1 Implement dynamic import for `module.manifest.js` via validated file URL**
- [ ] **3.2 Validate manifest export shape and capture structured errors**
- [ ] **3.3 Load model declarations only from local paths explicitly listed in `manifest.models`**
- [ ] **3.4 Load view/page declarations only from local paths explicitly listed in `manifest.views` and `manifest.pages`**
- [ ] **3.5 Keep per-module error isolation (`status: ERROR`, continue)**

Security constraints for Task 3:
- Do not rewrite module source code to patch imports.
- Do not import `data:` URLs or eval-like generated code.
- If `@atlas/module-engine` (or any package) cannot be resolved by normal module resolution, mark module as `ERROR` and continue.

Validation commands:

```bash
node --check apps/api/src/services/module-discovery-service.js
node --test apps/api/src/services/__tests__/module-discovery-service.test.js
```

Expected output:
- Valid modules include hydrated `manifest`, `models`, `views`.
- Broken imports produce `ERROR` records, not process crashes.

Commit checkpoint:

```bash
git add apps/api/src/services/module-discovery-service.js apps/api/src/services/__tests__/module-discovery-service.test.js
git commit -m "feat(ame3): load manifests, models, and views with isolated failures"
```

---

## Task 4: Namespace and Duplicate-Key Rules

**Files:**
- Modify: `apps/api/src/services/module-discovery-service.js`
- Modify: `apps/api/src/services/__tests__/module-discovery-service.test.js`

- [ ] **4.1 Enforce key namespace policy**
  - custom/community cannot use `atlas.*`, `core.*`, `system.*`, `identity.*`
  - official must use `atlas.*`
- [ ] **4.2 Detect duplicate keys across discovered records**
- [ ] **4.3 Apply precedence: official wins over custom**
- [ ] **4.4 Mark losing duplicate as `ERROR` with deterministic error code/message**

Validation commands:

```bash
node --test apps/api/src/services/__tests__/module-discovery-service.test.js
```

Expected output:
- Duplicate resolution is deterministic and tested.
- Namespace violations are surfaced without aborting full discovery.

Commit checkpoint:

```bash
git add apps/api/src/services/module-discovery-service.js apps/api/src/services/__tests__/module-discovery-service.test.js
git commit -m "feat(ame3): enforce namespace and duplicate key discovery rules"
```

---

## Task 5: Route Integration for POST /modules/sync

**Files:**
- Modify: `apps/api/src/routes/modules.js`

- [ ] **5.1 Keep current auth/permission guards unchanged**
- [ ] **5.2 Replace primary sync source with discovery service output**
- [ ] **5.3 Sync valid records into `AtlasModule` with default state policy**
  - non-core create default: `UNINSTALLED`, `enabled=false`
  - preserve existing installed state unless explicit policy says otherwise
- [ ] **5.4 Upsert valid permissions for synced modules**
- [ ] **5.5 Sync metadata (`manifest`, `models`, `views`) via `module-metadata-service`**
- [ ] **5.6 Handle invalid records**
  - if key known: optionally upsert/update module error status payload
  - if key unknown: include in response errors only
- [ ] **5.7 Return structured sync result summary**

Bridge behavior:
- If core continuity requires `packages/maps` fallback, use it only as explicit temporary bridge and annotate summary payload (for example `bridgeUsed: true` with reason).

Validation commands:

```bash
node --check apps/api/src/routes/modules.js
node --test apps/api/src/routes/__tests__/modules.sync.test.js
```

Expected output:
- `/modules/sync` runs discovery-based sync and returns breakdown totals/errors.

Commit checkpoint:

```bash
git add apps/api/src/routes/modules.js apps/api/src/routes/__tests__/modules.sync.test.js
git commit -m "feat(ame3): wire modules sync to discovery and metadata persistence"
```

---

## Task 6: Metadata/Blueprint/Permission Sync Guardrails

**Files:**
- Modify: `apps/api/src/routes/modules.js`
- Modify (optional): `apps/api/src/services/module-lifecycle-service.js`
- Modify tests under route/service scope

- [ ] **6.1 Ensure no SQL execution from `module-migration-service.applySqlMigration` during sync**
- [ ] **6.2 Ensure permissions are synced only for `VALID` modules**
- [ ] **6.3 Ensure views/pages are persisted through metadata service**
- [ ] **6.4 Keep current core protections intact**
- [ ] **6.5 Keep any legacy `Blueprint` writes only as temporary compatibility bridge**

Validation commands:

```bash
node --test apps/api/src/routes/__tests__/modules.sync.test.js
node --test apps/api/src/services/__tests__/module-discovery-service.test.js
```

Expected output:
- Sync persists declarations metadata without triggering SQL migrations.
- Core protections and invalid-module resilience remain intact.

Commit checkpoint:

```bash
git add apps/api/src/routes/modules.js apps/api/src/services/module-lifecycle-service.js apps/api/src/routes/__tests__/modules.sync.test.js apps/api/src/services/__tests__/module-discovery-service.test.js
git commit -m "chore(ame3): harden discovery sync guardrails and compatibility bridges"
```

---

## Task 7: End-to-End Validation and Manual Smoke

**Files:**
- No new files expected

- [ ] **7.1 Static checks pass**
- [ ] **7.2 Discovery import smoke passes**
- [ ] **7.3 API starts**
- [ ] **7.4 `/modules/sync` succeeds**
- [ ] **7.5 `custom.fleet` appears in sync response and/or `GET /modules`**
- [ ] **7.6 Confirm forbidden paths untouched**

Validation commands:

```bash
node --check apps/api/src/services/module-discovery-service.js
node --check apps/api/src/routes/modules.js
node -e "import('./apps/api/src/services/module-discovery-service.js').then(m => console.log(Object.keys(m)))"

node --test apps/api/src/services/__tests__/module-discovery-service.test.js
node --test apps/api/src/routes/__tests__/modules.sync.test.js

pnpm.cmd dev:api
Invoke-WebRequest -UseBasicParsing -Method Post http://localhost:4010/modules/sync -Headers @{ Authorization = "Bearer $env:ATLAS_BEARER_TOKEN" }
Invoke-WebRequest -UseBasicParsing http://localhost:4010/modules -Headers @{ Authorization = "Bearer $env:ATLAS_BEARER_TOKEN" }

git status --short
```

Expected output:
- Discovery service exports required methods.
- Sync endpoint returns structured data with valid/error records.
- `custom.fleet` is visible in module data path.
- No forbidden files changed.

Commit checkpoint:

```bash
git add apps/api/src/services/module-discovery-service.js apps/api/src/services/__tests__/module-discovery-service.test.js apps/api/src/routes/modules.js apps/api/src/routes/__tests__/modules.sync.test.js
git commit -m "feat(ame3): implement module discovery and sync pipeline"
```

---

## Expected Outputs (Summary)

1. AME3 discovery service discovers official/custom module manifests from filesystem.
2. Discovery returns resilient per-module `VALID`/`ERROR` records.
3. `/modules/sync` uses discovery as primary input.
4. Valid modules sync to `AtlasModule`, permissions, and metadata views/models.
5. Duplicate key and namespace rules are enforced with official precedence.
6. No SQL migrations are executed during sync.
7. No route loader or frontend renderer behavior is added.

---

## Rollback Notes

If rollback is required:

1. Revert `module-discovery-service.js` and its tests.
2. Revert `/modules/sync` route integration changes.
3. Keep database state intact; do not run destructive cleanup by default.
4. If temporary bridge logic was added, restore previous `packages/maps` sync path with explicit TODO.
