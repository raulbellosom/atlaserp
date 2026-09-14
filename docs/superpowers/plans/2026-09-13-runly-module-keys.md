# Runly module keys - stage 4a

Date: 2026-09-13
Status: Complete (local stage 4a)
Mode: IMPLEMENTATION
Authorization: user requested continuation.
Spec: `docs/superpowers/specs/2026-09-13-runly-module-keys-design.md`

## File Structure Map

- `apps/desktop/src/app/AtlasApp.jsx`

- `packages/core/src/module-identity.js`
- `packages/core/src/index.js`
- `packages/core/src/module-registry.js`
- `packages/module-engine/package.json`
- `packages/module-engine/src/module-registry.js`
- `pnpm-lock.yaml`
- `apps/api/src/services/module-key-alias.js`
- `apps/api/src/routes/modules.js`
- `apps/api/src/routes/__tests__/runly-module-alias.test.js`
- `apps/desktop/src/app/ModuleOutlet.jsx`
- `scripts/lib/runly-module-audit.js`
- `scripts/audit-runly-module-keys.mjs`
- `scripts/__tests__/runly-module-identity.test.js`
- `scripts/__tests__/runly-module-audit.test.js`
- `docs/migrations/runly-module-keys-source-audit.json`
- `docs/migrations/runly-module-keys.md`
- `docs/TASKS.md`

## Tasks

- [x] Explicit identity catalog and exact-first registry compatibility.
- [x] API aliases and permission-preserving module URL handling.
- [x] Offline inventory and read-only database audit.
- [x] Isolated database, regression tests, build, lint and documentation.

## Evidence

Verified on 2026-09-13:

- 121 distinct Node tests passed: 106 module-engine/registry/alias/API/upload/package-compatibility tests, 4 audit tests including the isolated database case, and 11 PWA regression tests. Targeted tests reran successfully after the encoded-path redirect fix.
- PostgreSQL 18 fixture: started a separate temporary container using the existing local image, no existing volumes or databases, published only on an ephemeral loopback port. Seeded synthetic collision/reference data; confirmed read-only mode, exact counts, collision/unknown-key reporting, rollback and row equality. Removed the fixture container after the test.
- Offline source inventory generated at `docs/migrations/runly-module-keys-source-audit.json`: 436 tracked files, 104 candidate schema columns, 9 direct module-key columns and 4 tables with UUID relationships to the module catalog. This is not a live database audit and never certifies conversion readiness.
- `pnpm.cmd install --frozen-lockfile --ignore-scripts` passed. Added only the engine-to-core workspace dependency and its legacy alias. External lockfile package resolutions/snapshots are unchanged from stage 3b.
- `pnpm.cmd --filter @runly/desktop build:web` passed, with existing large-chunk warnings. Exact-first alias resolution uses the visible module map; child routes keep the registered key and existing availability/path checks. PWA configuration uses the resolved module identity after loading.
- Scoped ESLint and `git diff --check` passed. CLI smoke checks reject --apply and refuse database mode without an explicit RUNLY_MIGRATION_DATABASE_URL; no .env fallback.
- React Doctor: 48/100, 59 warnings (58 from the prior baseline plus one complexity warning in ModuleOutlet after adding the guarded alias redirect). Reviewed that branch: it runs after existing access checks and redirects before child screens mount. No correctness error reported; no warning suppressions or unrelated UI cleanup.

Review notes: encoded module URL segments are decoded for alias matching to avoid redirects to an unchanged encoded path. Exact name collisions never overwrite/merge registrations; API fallback checks the exact persisted Runly record first. Legacy API requests retain their original behavior. API tests confirm 401/403 happen before alias database lookups. The source-only schema report does not contain any customer data.

Limits: stage 4a provides compatibility and diagnostics, not a full key conversion. Persisted identifiers, manifests, roles/grants, module UUIDs, sync history, files and physical table names remain unchanged. Full database bidirectional compatibility and semantic JSON conversion are stage 4b. No existing database audit, schema/data mutation, module sync/seed, native build, image/publication/deployment or user asset edit was performed.

References: PostgreSQL READ ONLY/REPEATABLE READ semantics checked at https://www.postgresql.org/docs/current/sql-set-transaction.html. Supabase changelog reviewed; extension/GraphQL/Studio changes do not affect these catalog/count SELECT queries.
