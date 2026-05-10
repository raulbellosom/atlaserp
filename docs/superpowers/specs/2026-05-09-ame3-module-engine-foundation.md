# @atlas/module-engine Package Foundation (AME3 Phase 1)

Date: 2026-05-09  
Status: Draft  
Author: Claude Code (claude-sonnet-4-6)  
Spec file: docs/superpowers/specs/2026-05-09-ame3-module-engine-foundation.md  
Plan file: docs/superpowers/plans/2026-05-09-ame3-module-engine-foundation.md

---

## 1. Feature title

`@atlas/module-engine` Package Foundation — AME3 Phase 1

---

## 2. Problem

The `defineAtlasModule`, `defineModel`, `defineView`, and `definePage` APIs are the entire foundation of the Atlas Module Engine v3 architecture. They are referenced throughout architecture documentation and developer guides, but the `@atlas/module-engine` package does not exist. No module can be built using the AME3 API until the package is importable.

Additionally, two utilities required by the Atlas ORM (Phase 3) must be built now as part of the package foundation to avoid retrofitting them into an already-operational provisioning layer:

- **SQL generator** — a pure function that converts a `defineModel` result into a `CREATE TABLE IF NOT EXISTS` PostgreSQL DDL string. The ORM will call this during table provisioning.
- **Migration safety guard** — a function that asserts a SQL string contains no destructive DDL before the ORM executes it. This is the last line of defense before any SQL touches the database.
- **Model checksum** — a deterministic hash of a model's schema-relevant fields. The ORM will use this to detect schema drift between successive module installs and alert when a migration is needed.

Building these in Phase 1 ensures they are tested and stable before the ORM uses them in Phase 3.

---

## 3. Goals

The package must export exactly these names, in this order:

| Export | Kind | Description |
|---|---|---|
| `ModuleEngineError` | class | Custom error class for all validation failures in this package |
| `defineAtlasModule` | function | Validates and returns the manifest with defaults applied. Throws `ModuleEngineError`. |
| `validateManifest` | function | Returns `{ valid, errors }` without throwing. Used by the discovery service. |
| `defineModel` | function | Validates and returns a model definition with defaults. Throws `ModuleEngineError`. |
| `validateModel` | function | Returns `{ valid, errors }` without throwing. |
| `FIELD_TYPES` | object | Frozen object mapping field type constants to their string values (17 types). |
| `defineView` | function | Validates and returns a view/blueprint declaration. Throws `ModuleEngineError`. |
| `validateView` | function | Returns `{ valid, errors }` without throwing. |
| `definePage` | function | Validates and returns a page declaration. Throws `ModuleEngineError`. |
| `validatePage` | function | Returns `{ valid, errors }` without throwing. |
| `ModuleRegistry` | class | In-memory registry of module manifests (results of `defineAtlasModule`). |
| `ModelRegistry` | class | In-memory registry of model definitions (results of `defineModel`). |
| `ComponentRegistry` | class | In-memory registry mapping `moduleKey:ComponentName` keys to React components. |
| `generateCreateTableSql` | function | Pure function. Returns a PostgreSQL `CREATE TABLE IF NOT EXISTS` DDL string. No DB connection. |
| `assertSafeMigrationSql` | function | Throws `ModuleEngineError` if the SQL string contains forbidden destructive patterns. Returns void if safe. |
| `createChecksum` | function | Returns a deterministic SHA-256 hex string for a model's schema-relevant fields. |

Additional implementation requirements:

- Package is `type: "module"` (ESM only). No CommonJS.
- Zero external npm dependencies. Only Node.js built-ins are allowed (`node:crypto`).
- JavaScript only. No TypeScript.
- `node --check` passes on every source file.
- Tests use `node:test` (Node 18+ built-in — requires no npm install). Every test file runs with `node --test`.

---

## 4. Non-goals

1. File-system discovery of `modules/custom/` or `modules/official/` directories — Phase 2.
2. Atlas ORM table provisioning (executing `generateCreateTableSql` output against a live database) — Phase 3.
3. `AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration` Prisma metadata tables — Phase 3.
4. Route Loader (auto-mounting module API routers) — Phase 4.
5. Blueprint renderer (`AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView`) — Phase 6.
6. Integration with `apps/api/src/index.js`, `apps/api/src/services/`, or any existing API service.
7. Any changes to `apps/desktop/src/`.
8. Any changes to `packages/maps/`, `packages/core/`, `packages/sdk/`, or `packages/validators/`.
9. Any changes to `prisma/schema.prisma` or any migration files.
10. Any changes to `modules/custom/` — that directory does not exist yet and is not created here.
11. TypeScript types or `.d.ts` file generation.
12. Publishing to npm or a private registry.
13. Removal of `createModuleManifest` from `@atlas/core` — deprecated but kept until Phase 5.

---

## 5. Architecture impact

- Adds one new workspace package `packages/module-engine/`. The `pnpm-workspace.yaml` already includes `packages/*` — no workspace config changes needed.
- The package is ESM-only (`"type": "module"`). All existing packages in this repo are already ESM.
- Zero runtime npm dependencies. The only Node.js built-in used is `node:crypto` (for SHA-256 in `createChecksum`).
- `node:test` is used in test files only. It is a Node 18+ built-in — no npm install required.
- No existing file is modified.

### Dependency graph after Phase 1

```
@atlas/module-engine
  (no npm dependencies — node:crypto built-in only)

@atlas/core
  (no changes — still exports createModuleManifest, deprecated)

apps/api
  (no changes in Phase 1 — will import @atlas/module-engine in Phase 2)

apps/desktop
  (no changes in Phase 1 — will import @atlas/module-engine in Phase 6)
```

---

## 6. Module impact

No existing module code is modified in this phase. The package provides the API that future modules will use. Official modules in `packages/maps/` are untouched. Custom modules cannot yet be discovered (Phase 2 capability).

Namespace rules enforced by `validateManifest`:
- `key` must be a non-empty string with at least one dot separator.
- `key` must not contain path traversal characters (`/`, `\`, `..`).
- Dot-separated segments must all be non-empty (no leading/trailing dots).
- `kind` must be one of: `CORE`, `FEATURE`, `INTEGRATION`, `WEBSITE`.
- Namespace ownership (rejecting `atlas.*` for modules in `modules/custom/`) is enforced at **discovery time** by the discovery service (Phase 2), not by `validateManifest`. `validateManifest` validates structure only.

---

## 7. Prisma impact

None. Zero changes to `prisma/schema.prisma`, zero new migration files, zero Prisma client calls.

---

## 8. Atlas ORM / metadata impact

The SQL generator, migration safety guard, and checksum function are foundational utilities for the Atlas ORM. In Phase 1 they are pure functions with zero database interaction.

- `generateCreateTableSql(modelDef)` — returns a SQL string. The Atlas ORM provisioning service (Phase 3) will call this to obtain DDL before executing it.
- `assertSafeMigrationSql(sql)` — throws `ModuleEngineError` if the SQL contains destructive patterns. Called by the ORM before executing any SQL. Returns `undefined` if safe.
- `createChecksum(modelDef)` — returns a hex string. The Atlas ORM will store this in `AtlasModel.schemaChecksum` (Phase 3) to detect schema drift.

No `AtlasModel`, `AtlasField`, `AtlasView`, or `ModuleMigration` tables exist in this phase.

---

## 9. Blueprint impact

`defineView` produces a blueprint object whose shape matches what the `Blueprint` table stores in its `schema` JSONB column. The `Blueprint` table is not modified. No rendering changes.

Supported blueprint kinds: `ENTITY`, `FORM`, `TABLE`, `DETAIL`, `PAGE`, `DASHBOARD`, `ACTION`, `RELATION`, `CUSTOM`.

---

## 10. API impact

None. No changes to any file in `apps/api/src/`.

---

## 11. Frontend impact

None. No changes to any file in `apps/desktop/src/`.

---

## 12. Security considerations

**Manifest key validation:**
- Rejects empty strings, null, non-string values.
- Rejects keys containing `/`, `\`, or `..` to prevent path traversal exploitation in discovery (Phase 2).
- Requires at least one dot separator (e.g., `custom.fleet`, not just `fleet`).
- All errors are thrown as `ModuleEngineError` with a specific error code.

**Table name validation:**
- Table names must be valid SQL identifiers: letters, digits, and underscores only; must start with a letter or underscore (`/^[a-zA-Z_][a-zA-Z0-9_]*$/`).
- Table names must not start with PostgreSQL reserved prefixes: `pg_`, `_pg_`, `sql_`.
- **Convention (enforced only by documentation, not the validator):**
  - Official Atlas modules: `atlas_<module>_<entity>` (e.g., `atlas_fleet_vehicle`)
  - Custom modules: `custom_<module>_<entity>` or `<module>_<entity>` (e.g., `custom_fleet_vehicle`)
- The validator does not require an `atlas_` prefix. Any safe SQL identifier not starting with a reserved system prefix is accepted.

**SQL safety (`assertSafeMigrationSql`):**
- Rejects SQL containing any of these patterns (case-insensitive): `DROP TABLE`, `DROP COLUMN`, `DROP INDEX`, `ALTER TABLE`, `TRUNCATE`, `DELETE FROM`, `INSERT INTO`, `UPDATE` (DML).
- Only additive DDL is allowed: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`.

**SQL identifier quoting:**
- `generateCreateTableSql` validates every identifier (column name, table name, index name) against `/^[a-zA-Z_][a-zA-Z0-9_]*$/` before wrapping in double quotes. Any identifier that fails this check throws `ModuleEngineError`.
- SQL column types come from `SQL_TYPE_MAP` (a closed constant), not from user-supplied strings.

**Component Registry key format:**
- `ComponentRegistry.register` rejects keys that do not match `moduleKey:ComponentName` format (colon separator required, component name must start with an uppercase letter).

---

## 13. Migration safety

This phase introduces no database migrations. `generateCreateTableSql` produces DDL strings but does not execute them. `assertSafeMigrationSql` is the enforcement gate that the Atlas ORM (Phase 3) will call before executing any SQL.

Forward-only rule: `assertSafeMigrationSql` blocks any SQL containing `DROP`, `TRUNCATE`, `ALTER TABLE`, `DELETE FROM`, `UPDATE` (DML), or `INSERT INTO`. These are forbidden regardless of context. If a column must be removed, that is a manual DBA operation documented as a forward migration note — never automated.

---

## 14. Acceptance criteria

1. `import('@atlas/module-engine').then(m => console.log(typeof m.defineAtlasModule))` prints `function`.
2. All 16 named exports from Goal 3 are importable from `@atlas/module-engine`.
3. `defineAtlasModule({ key: 'custom.fleet', name: 'Flota', version: '0.1.0', kind: 'FEATURE' })` returns an object with `key === 'custom.fleet'`.
4. `defineAtlasModule({})` throws a `ModuleEngineError` (not a plain `Error`) with a message mentioning `key`.
5. `validateManifest({ key: 'custom.fleet', name: 'Flota', version: '0.1.0', kind: 'FEATURE' })` returns `{ valid: true, errors: [] }`.
6. `validateManifest({})` returns `{ valid: false, errors }` with entries mentioning `key`, `name`, and `version`. Does not throw.
7. `defineModel({ key: 'vehicle', tableName: 'fleet_vehicle', fields: [] })` succeeds — `fleet_vehicle` is a safe identifier that does not start with a reserved prefix.
8. `defineModel({ key: 'vehicle', tableName: 'pg_vehicle', fields: [] })` throws because `pg_` is a reserved PostgreSQL prefix.
9. `defineModel({ key: 'vehicle', tableName: 'fleet vehicle', fields: [] })` throws because the name contains a space (not a safe SQL identifier).
10. `defineModel({ ..., fields: [{ name: 'status', type: 'unknown_type' }] })` throws with a message mentioning `unknown_type`.
11. `generateCreateTableSql(vehicleModel)` returns a string starting with `CREATE TABLE IF NOT EXISTS "fleet_vehicle"` (or whatever the tableName is).
12. `generateCreateTableSql` output for a `text` field with `maxLength: 20` contains `VARCHAR(20)`.
13. `generateCreateTableSql` output for a `relation` field contains `UUID`.
14. `generateCreateTableSql` output for `companyScoped: true` contains `"company_id" UUID NOT NULL`.
15. `generateCreateTableSql` output for `softDelete: true` contains `"enabled" BOOLEAN NOT NULL DEFAULT true`.
16. All 17 field types produce output in `generateCreateTableSql` without throwing.
17. `assertSafeMigrationSql('CREATE TABLE IF NOT EXISTS "x" (id UUID);')` returns without throwing.
18. `assertSafeMigrationSql('DROP TABLE "x";')` throws `ModuleEngineError`.
19. `assertSafeMigrationSql('ALTER TABLE "x" ADD COLUMN y INT;')` throws `ModuleEngineError`.
20. `createChecksum(vehicleModel)` called twice with the same model returns the same 64-character hex string.
21. Changing any field's `type` in `vehicleModel` causes `createChecksum` to return a different value.
22. Changing only a field's `label` (UI metadata) does not change the `createChecksum` output.
23. `new ModuleRegistry()`, `new ModelRegistry()`, `new ComponentRegistry()` all construct without error.
24. `node --check packages/module-engine/src/*.js` exits with code 0.
25. `node --test packages/module-engine/src/__tests__/*.test.js` exits with code 0, all tests passing.

---

## 15. Validation commands

Run in sequence after implementation.

```bash
# Step 1: Syntax check all source files
node --check packages/module-engine/src/index.js
node --check packages/module-engine/src/constants.js
node --check packages/module-engine/src/field-types.js
node --check packages/module-engine/src/errors.js
node --check packages/module-engine/src/define-module.js
node --check packages/module-engine/src/define-model.js
node --check packages/module-engine/src/define-view.js
node --check packages/module-engine/src/define-page.js
node --check packages/module-engine/src/sql-generator.js
node --check packages/module-engine/src/checksum.js
node --check packages/module-engine/src/module-registry.js
node --check packages/module-engine/src/model-registry.js
node --check packages/module-engine/src/component-registry.js

# Step 2: Run unit tests (node:test is Node 18+ built-in — no npm install required)
node --test packages/module-engine/src/__tests__/define-module.test.js
node --test packages/module-engine/src/__tests__/define-model.test.js
node --test packages/module-engine/src/__tests__/sql-generator.test.js
node --test packages/module-engine/src/__tests__/checksum.test.js

# Step 3: Install workspace and verify all exports are importable
pnpm install
node -e "
import('@atlas/module-engine').then(m => {
  const expected = [
    'ModuleEngineError','defineAtlasModule','validateManifest',
    'defineModel','validateModel','FIELD_TYPES',
    'defineView','validateView','definePage','validatePage',
    'ModuleRegistry','ModelRegistry','ComponentRegistry',
    'generateCreateTableSql','assertSafeMigrationSql','createChecksum',
  ]
  for (const name of expected) {
    const t = typeof m[name]
    console.log(name + ':', t === 'undefined' ? 'MISSING' : t)
  }
})
"

# Expected output for step 3:
# ModuleEngineError: function
# defineAtlasModule: function
# validateManifest: function
# defineModel: function
# validateModel: function
# FIELD_TYPES: object
# defineView: function
# validateView: function
# definePage: function
# validatePage: function
# ModuleRegistry: function
# ModelRegistry: function
# ComponentRegistry: function
# generateCreateTableSql: function
# assertSafeMigrationSql: function
# createChecksum: function

# Step 4: Verify no regression in the existing build
pnpm --filter ./apps/desktop build:web
# Expected: exits 0
```
