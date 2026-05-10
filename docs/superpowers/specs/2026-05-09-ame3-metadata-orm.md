# AME3 Metadata ORM Core Tables and Services

Date: 2026-05-09  
Status: Draft  
Owner: Atlas ERP AME3

---

## Problem

AME3 currently has:
- Architecture contract in `docs/architecture/atlas-module-engine-v3.md`
- Declaration APIs in `@atlas/module-engine` (`defineAtlasModule`, `defineModel`, `defineView`, `definePage`)
- A sample declarative module (`modules/custom/custom.fleet`)

But Atlas still lacks a persistent metadata layer for module declarations. Model and view declarations exist only in files and cannot yet be stored as normalized records for later lifecycle, ORM provisioning, drift detection, or migration tracking.

Without this layer:
- There is no canonical persisted source for module-defined models and fields.
- There is no persisted source for module-defined views.
- There is no module migration ledger for additive SQL changes.
- Discovery and route loading (future phases) have no stable persistence target.

---

## Goals

1. Add Prisma metadata models to persist module declarations:
- `AtlasModel`
- `AtlasField`
- `AtlasView`
- `ModuleMigration`

2. Add a metadata service at `apps/api/src/services/module-metadata-service.js` with a stable internal API to upsert and query model/view metadata.

3. Add a migration service at `apps/api/src/services/module-migration-service.js` with additive-only SQL planning and application primitives.

4. Enforce migration safety through `@atlas/module-engine` utilities:
- `generateCreateTableSql`
- `assertSafeMigrationSql`
- `createChecksum`

5. Prepare Atlas for future discovery sync of modules like `custom.fleet`, without implementing discovery in this phase.

---

## Non-goals

1. Module discovery (`modules/custom` scan, boot-time discovery, `/modules/sync` discovery wiring).
2. Automatic execution of module SQL during install/uninstall lifecycle.
3. Migrating existing official modules (`packages/maps`) to metadata records.
4. Deleting or replacing existing Prisma business models.
5. Frontend rendering, route registration, or shell navigation changes.
6. Blueprint renderer implementation.
7. Destructive schema operations (`DROP`, `TRUNCATE`, rename/drop column flows).

---

## Architecture impact

This phase adds a new internal AME3 persistence layer:

- Declaration files remain source-of-definition.
- New services persist normalized copies of those declarations in metadata tables.
- Future discovery can call `syncModuleMetadata` and `planModelMigrations` as a post-parse persistence step.

Data flow for future phases:

`module.manifest.js + models/*.model.js + views/*.js`  
`-> module-metadata-service`  
`-> AtlasModel / AtlasField / AtlasView`

`models/*.model.js`  
`-> module-migration-service`  
`-> generated SQL (safe additive)`  
`-> ModuleMigration ledger`

No route loader/discovery lifecycle is added in this phase.

---

## Prisma impact

`prisma/schema.prisma` will be extended with the following models.

### AtlasModel

- `id String @id @default(cuid())`
- `moduleKey String`
- `name String @unique`
- `tableName String @unique`
- `label String`
- `pluralLabel String?`
- `companyScoped Boolean @default(true)`
- `schema Json`
- `enabled Boolean @default(true)`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- relation `fields AtlasField[]`
- relation `views AtlasView[]`
- index `@@index([moduleKey])`

### AtlasField

- `id String @id @default(cuid())`
- `modelId String`
- `name String`
- `label String`
- `type String`
- `required Boolean @default(false)`
- `readonly Boolean @default(false)`
- `defaultValue Json?`
- `options Json?`
- `relation Json?`
- `validation Json?`
- `order Int @default(0)`
- relation `model AtlasModel @relation(fields: [modelId], references: [id], onDelete: Cascade)`
- unique `@@unique([modelId, name])`

### AtlasView

- `id String @id @default(cuid())`
- `moduleKey String`
- `key String @unique`
- `modelName String?`
- `type String`
- `title String?`
- `schema Json`
- `enabled Boolean @default(true)`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- optional relation to `AtlasModel` by `modelName -> name`
- indexes `@@index([moduleKey])`, `@@index([modelName])`

Canonical relation shape in Prisma (valid and safe):

```prisma
model AtlasModel {
  id    String     @id @default(cuid())
  name  String     @unique
  views AtlasView[]
}

model AtlasView {
  id        String      @id @default(cuid())
  modelName String?
  model     AtlasModel? @relation(fields: [modelName], references: [name], onDelete: SetNull, onUpdate: Cascade)
}
```

Safety note:
- `modelName -> AtlasModel.name` is valid in Prisma because `AtlasModel.name` is unique.
- To avoid cross-module name collisions, `AtlasModel.name` should be persisted as a namespaced identifier (recommended: `<moduleKey>.<modelKey>`).

### ModuleMigration

- `id String @id @default(cuid())`
- `moduleKey String`
- `filename String`
- `checksum String`
- `appliedAt DateTime @default(now())`
- unique `@@unique([moduleKey, filename])`

Tracking adequacy note:
- This schema is intentionally minimal and is sufficient for phase scope when combined with deterministic `checksum` and immutable SQL file content.
- It does not store raw SQL text or execution error payloads; those are deferred to a later observability phase if needed.

Migration strategy:
- Additive Prisma migration only.
- No edits to previously applied migration SQL.
- No destructive operations in migration SQL.

---

## Atlas ORM / metadata impact

### New service: module-metadata-service

File: `apps/api/src/services/module-metadata-service.js`

Public API contract:

- `createModuleMetadataService({ prisma })`
- `syncModuleMetadata({ manifest, models, views })`
- `upsertModel({ moduleKey, model })`
- `upsertField({ modelId, field, order })`
- `upsertView({ moduleKey, view })`
- `listModels({ moduleKey })`
- `getModelByName(name)`
- `listViews({ moduleKey })`
- `getViewByKey(key)`

Behavioral expectations:

- Model upsert is keyed by `name` and `tableName` consistency.
- Fields are upserted by `(modelId, name)` and include ordering.
- View upsert is keyed by `key`.
- Sync operation is transactional and idempotent.
- `schema` JSON stores full model/view declaration snapshots for forward compatibility.

### New service: module-migration-service

File: `apps/api/src/services/module-migration-service.js`

Public API contract:

- `createModuleMigrationService({ prisma })`
- `generateSqlForModel(model)`
- `planModelMigrations({ moduleKey, models })`
- `applySqlMigration({ moduleKey, filename, sql })`
- `listAppliedMigrations(moduleKey)`

Behavioral expectations:

- `generateSqlForModel` uses `generateCreateTableSql(model)`.
- Every produced or incoming SQL statement passes `assertSafeMigrationSql(sql)`.
- `createChecksum(model)` is used to derive deterministic model fingerprints for planning.
- `planModelMigrations` returns additive plan items only.
- `applySqlMigration` records `(moduleKey, filename, checksum)` in `ModuleMigration` in transaction.
- Duplicate `(moduleKey, filename)` is treated as idempotent skip or explicit conflict by policy (must be documented in implementation).

---

## Module impact

- No changes to `modules/custom/custom.fleet/**`.
- No changes to module file format.
- This phase only enables persistence and migration planning for declarations that already exist.

---

## Blueprint impact

- No renderer changes.
- `AtlasView` becomes canonical persisted metadata for future blueprint assembly/query layers.
- Existing `Blueprint` model remains untouched in this phase.

---

## API impact

External API impact in this phase: none.

Internal API changes:
- Two new service modules under `apps/api/src/services/`.
- No required route integration in this phase.
- No discovery wiring in `apps/api/src/routes/modules.js` in this phase.

---

## Frontend impact

None.

- No desktop route changes.
- No shell/module catalog changes.
- No SDK changes.

---

## Security considerations

1. SQL safety gate is mandatory:
- `assertSafeMigrationSql` is called before any SQL execution path in migration service.

2. Additive-only policy:
- service rejects destructive SQL patterns.
- no runtime drop/alter-destructive execution path.

3. Metadata trust boundary:
- services accept parsed declarations (future discovery concern), but do not execute arbitrary JS.
- module key, model names, table names, and view keys must be validated before persistence.

4. Integrity and drift detection:
- `createChecksum` reduces accidental drift by giving deterministic model fingerprints.

5. Transactional writes:
- sync and apply operations use Prisma transactions to avoid partial state.

---

## Migration safety

Hard rules for this phase:

1. Prisma migration is additive only.
2. Never edit old migration files under `prisma/migrations/**`.
3. `generateCreateTableSql` output must pass `assertSafeMigrationSql`.
4. `applySqlMigration` must record metadata and SQL execution atomically.
5. No automatic execution during install/discovery yet.
6. No destructive SQL (`DROP`, `TRUNCATE`, unsafe `ALTER`, etc.).

Rollback posture:
- Service-level rollback via code revert.
- Metadata table rollback via forward migration only (no history rewrite).

---

## Acceptance criteria

1. `prisma/schema.prisma` includes `AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration` with required fields, indexes, and relations.
2. A new Prisma migration is created and applies cleanly.
3. `module-metadata-service.js` exports `createModuleMetadataService` and all required methods.
4. `module-migration-service.js` exports `createModuleMigrationService` and all required methods.
5. `generateSqlForModel(model)` uses `generateCreateTableSql`.
6. Migration SQL is guarded with `assertSafeMigrationSql`.
7. Migration planning uses `createChecksum`.
8. `syncModuleMetadata` can persist a `custom.fleet`-shaped manifest/models/views payload through direct service invocation (no discovery).
9. `upsertField` enforces deterministic field ordering persistence.
10. `listModels/getModelByName` and `listViews/getViewByKey` return persisted metadata correctly.
11. `applySqlMigration` records `(moduleKey, filename, checksum, appliedAt)` in `ModuleMigration`.
12. Duplicate migration filename for the same module is handled safely (idempotent or explicit conflict per implementation contract).
13. No files under `modules/custom/custom.fleet/**` are modified.
14. No discovery feature is implemented in this phase.
15. Existing API and desktop builds remain green.
16. `AtlasView.modelName -> AtlasModel.name` relation compiles in Prisma with nullable FK semantics.
17. `AtlasModel.name` persistence strategy is namespaced and deterministic for collision safety.

---

## Validation commands

```bash
# 1) Prisma schema checks
pnpm.cmd prisma validate
pnpm.cmd db:migrate
pnpm.cmd db:generate

# 2) Migration creation/apply (additive only)
pnpm.cmd prisma migrate dev --name ame3_metadata_orm_core

# 3) Service test scope
node --test apps/api/src/services/__tests__/module-metadata-service.test.js
node --test apps/api/src/services/__tests__/module-migration-service.test.js

# 4) Optional aggregate service tests
node --test apps/api/src/services/__tests__/*.test.js

# 5) API/desktop regression guards
pnpm.cmd --filter @atlas/api test
pnpm.cmd --filter ./apps/desktop build:web

# 6) Service import smoke checks (ESM loadability)
node -e "import('./apps/api/src/services/module-metadata-service.js').then(() => console.log('metadata service import OK'))" --input-type=module
node -e "import('./apps/api/src/services/module-migration-service.js').then(() => console.log('migration service import OK'))" --input-type=module
```

Expected high-level results:
- Prisma validation/generation succeed.
- Migration applies without destructive SQL.
- New service tests pass.
- No regression in existing build/test guards.
