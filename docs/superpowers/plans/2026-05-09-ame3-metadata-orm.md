# AME3 Metadata ORM Core Tables and Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AME3 metadata persistence tables plus core metadata/migration services so Atlas can persist module declarations (models/fields/views) and track additive module SQL migrations, without implementing discovery.

**Architecture:** Extend Prisma with four metadata models (`AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration`) and implement two internal services in `apps/api/src/services/`. Keep this phase internal-only: no discovery scanner wiring, no route-loader integration, no custom module edits.

**Tech Stack:** Prisma + PostgreSQL, Node.js ESM services, `@atlas/module-engine` safety utilities (`generateCreateTableSql`, `assertSafeMigrationSql`, `createChecksum`), node:test.

---

## File Structure Map

### Files to create

1. `apps/api/src/services/module-metadata-service.js`  
Purpose: metadata persistence and query operations for module declarations.

2. `apps/api/src/services/module-migration-service.js`  
Purpose: additive SQL generation/planning/application with migration ledger writes.

3. `apps/api/src/services/__tests__/module-metadata-service.test.js`  
Purpose: service contract tests for model/field/view upsert and listing behavior.

4. `apps/api/src/services/__tests__/module-migration-service.test.js`  
Purpose: service contract tests for SQL generation/safety/planning/migration ledger behavior.

5. `prisma/migrations/<timestamp>_ame3_metadata_orm_core/migration.sql`  
Purpose: additive schema migration for new metadata models.

### Files to modify

1. `prisma/schema.prisma`  
Changes: add `AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration` models with required fields, relations, indexes, and unique constraints.

### Files forbidden to modify

- `modules/custom/custom.fleet/**`
- `packages/module-engine/**`
- `packages/maps/**`
- `apps/desktop/**`
- `apps/api/src/index.js`
- `apps/api/src/routes/modules.js`
- `package.json`
- `pnpm-workspace.yaml`
- Existing migration history under `prisma/migrations/**/migration.sql` (immutable)

---

## Task 1: Prisma Metadata Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **1.1 Add `AtlasModel` model**
- [ ] **1.2 Add `AtlasField` model**
- [ ] **1.3 Add `AtlasView` model with optional relation by `modelName -> AtlasModel.name`**
- [ ] **1.4 Add `ModuleMigration` model**
- [ ] **1.5 Add required indexes and unique constraints exactly as specified**
- [ ] **1.6 Persist `AtlasModel.name` as deterministic namespaced key (`<moduleKey>.<modelKey>`) to keep global uniqueness safe**

Validation commands:

```bash
pnpm.cmd prisma validate
pnpm.cmd db:migrate
pnpm.cmd db:generate
```

Expected output:
- Prisma schema validates successfully.
- Prisma client generation succeeds with no schema errors.

Commit checkpoint:

```bash
git add prisma/schema.prisma
git commit -m "feat(ame3): add metadata ORM prisma models"
```

---

## Task 2: Prisma Migration (Additive Only)

**Files:**
- Create: `prisma/migrations/<timestamp>_ame3_metadata_orm_core/migration.sql`

- [ ] **2.1 Create migration from updated Prisma schema**
- [ ] **2.2 Review generated SQL for additive-only behavior**
- [ ] **2.3 Confirm no destructive SQL operations appear**
- [ ] **2.4 Confirm existing migration history files were not edited**

Validation commands:

```bash
pnpm.cmd prisma migrate dev --name ame3_metadata_orm_core
```

Expected output:
- New migration directory is created.
- Migration applies without destructive statements.
- Database and Prisma migration state remain consistent.
- No changes in previously applied migration directories.

Commit checkpoint:

```bash
git add prisma/migrations
git commit -m "feat(ame3): add metadata ORM additive migration"
```

---

## Task 3: Module Metadata Service

**Files:**
- Create: `apps/api/src/services/module-metadata-service.js`

- [ ] **3.1 Export `createModuleMetadataService({ prisma })`**
- [ ] **3.2 Implement `upsertModel({ moduleKey, model })` with schema snapshot persistence**
- [ ] **3.3 Implement `upsertField({ modelId, field, order })` with `(modelId, name)` uniqueness and order persistence**
- [ ] **3.4 Implement `upsertView({ moduleKey, view })` with key-based upsert**
- [ ] **3.5 Implement `syncModuleMetadata({ manifest, models, views })` as transactional orchestration**
- [ ] **3.6 Implement `listModels`, `getModelByName`, `listViews`, `getViewByKey`**

Implementation notes:
- Keep service internal, pure-domain style (no Hono context).
- Persist `model.schema` and `view.schema` JSON snapshots from declarations.
- `model.name` should be deterministic from declaration key (implementation-defined but must be consistent and tested).

Validation commands:

```bash
node --check apps/api/src/services/module-metadata-service.js
node -e "import('./apps/api/src/services/module-metadata-service.js').then(() => console.log('metadata service import OK'))" --input-type=module
```

Expected output:
- Syntax check exits 0 silently.

Commit checkpoint:

```bash
git add apps/api/src/services/module-metadata-service.js
git commit -m "feat(ame3): add module metadata service"
```

---

## Task 4: Module Migration Service

**Files:**
- Create: `apps/api/src/services/module-migration-service.js`

- [ ] **4.1 Export `createModuleMigrationService({ prisma })`**
- [ ] **4.2 Implement `generateSqlForModel(model)` using `generateCreateTableSql`**
- [ ] **4.3 Enforce `assertSafeMigrationSql` before execution or plan return**
- [ ] **4.4 Implement `planModelMigrations({ moduleKey, models })` with deterministic checksum usage via `createChecksum`**
- [ ] **4.5 Implement `applySqlMigration({ moduleKey, filename, sql })` with transactional ledger write to `ModuleMigration`**
- [ ] **4.6 Implement `listAppliedMigrations(moduleKey)`**

Implementation notes:
- No auto-run from install flow in this phase.
- `applySqlMigration` must support idempotent-safe behavior on duplicate `(moduleKey, filename)` according to explicit service contract.

Validation commands:

```bash
node --check apps/api/src/services/module-migration-service.js
node -e "import('./apps/api/src/services/module-migration-service.js').then(() => console.log('migration service import OK'))" --input-type=module
```

Expected output:
- Syntax check exits 0 silently.

Commit checkpoint:

```bash
git add apps/api/src/services/module-migration-service.js
git commit -m "feat(ame3): add module migration service"
```

---

## Task 5: Metadata Service Tests

**Files:**
- Create: `apps/api/src/services/__tests__/module-metadata-service.test.js`

- [ ] **5.1 Add tests for `syncModuleMetadata` with custom.fleet-like declarations**
- [ ] **5.2 Add tests for model/field/view upserts**
- [ ] **5.3 Add tests for query methods (`listModels`, `getModelByName`, `listViews`, `getViewByKey`)**
- [ ] **5.4 Add tests for idempotent repeated sync behavior**

Test strategy:
- Use service-level tests with mocked/stubbed Prisma methods where possible.
- If integration-style DB tests are used, isolate them clearly and keep deterministic data setup.

Validation commands:

```bash
node --test apps/api/src/services/__tests__/module-metadata-service.test.js
```

Expected output:
- Test file passes with 0 failures.

Commit checkpoint:

```bash
git add apps/api/src/services/__tests__/module-metadata-service.test.js
git commit -m "test(ame3): cover module metadata service"
```

---

## Task 6: Migration Service Tests

**Files:**
- Create: `apps/api/src/services/__tests__/module-migration-service.test.js`

- [ ] **6.1 Add test: `generateSqlForModel` returns create-table SQL**
- [ ] **6.2 Add test: unsafe SQL is rejected by `assertSafeMigrationSql` gate**
- [ ] **6.3 Add test: `planModelMigrations` uses deterministic checksums**
- [ ] **6.4 Add test: `applySqlMigration` writes `ModuleMigration` rows**
- [ ] **6.5 Add test: duplicate `(moduleKey, filename)` handling is safe**

Validation commands:

```bash
node --test apps/api/src/services/__tests__/module-migration-service.test.js
```

Expected output:
- Test file passes with 0 failures.

Commit checkpoint:

```bash
git add apps/api/src/services/__tests__/module-migration-service.test.js
git commit -m "test(ame3): cover module migration service"
```

---

## Task 7: Full Validation and Regression Guard

**Files:**
- No new files expected

- [ ] **7.1 Run aggregate service tests**
- [ ] **7.2 Re-run Prisma validation/generation**
- [ ] **7.3 Run desktop build guard**
- [ ] **7.4 Confirm forbidden files remain untouched**

Validation commands:

```bash
node --test apps/api/src/services/__tests__/*.test.js
pnpm.cmd prisma validate
pnpm.cmd db:migrate
pnpm.cmd db:generate
pnpm.cmd --filter ./apps/desktop build:web
git status --short
```

Expected output:
- New metadata service tests pass.
- Prisma checks pass.
- Desktop build succeeds.
- Git diff contains only planned files.

Commit checkpoint:

```bash
git add apps/api/src/services prisma/schema.prisma prisma/migrations
git commit -m "feat(ame3): add metadata ORM core tables and services"
```

---

## Expected Outputs (Summary)

1. New Prisma metadata models exist and migrate successfully.
2. `module-metadata-service` exposes required API and passes tests.
3. `module-migration-service` exposes required API and passes tests.
4. SQL safety checks are enforced before migration execution.
5. No discovery implementation is introduced.
6. No `custom.fleet` or forbidden-path files are changed.

---

## Rollback Notes

If implementation must be rolled back:

1. Revert service files and tests.
2. Create a forward corrective Prisma migration if schema rollback is needed.
3. Do not rewrite existing migration history.
