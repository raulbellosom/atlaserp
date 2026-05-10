# AME3 Prisma v7 Upgrade Spec

Date: 2026-05-10
Status: Draft
Owner: Atlas ERP AME3

---

## Problem

Atlas ERP currently runs Prisma `6.19.3` while AME3 metadata persistence is now live (`AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration`). We need Prisma v7 readiness before continuing AME3 Blueprint Renderer and Generic CRUD, but we must avoid regressions in module sync, metadata persistence, and existing API behavior.

---

## Goals

1. Upgrade `prisma` and `@prisma/client` from v6 to v7 using official Prisma v7 guidance.
2. Keep database migration history immutable and in sync.
3. Preserve AME3 metadata behavior and `/modules/sync` workflow (including `custom.fleet` metadata sync).
4. Preserve seed behavior or document and implement the required v7-compatible seed path.
5. Establish clear local reset and rollback procedures distinct from production.

---

## Non-goals

1. Implementing AME3 Blueprint Renderer or Generic CRUD.
2. Refactoring desktop/module UI.
3. Changing `packages/maps/**` manifests.
4. Editing historical applied migration SQL.
5. Introducing unrelated schema changes.

---

## Current Prisma usage (as of 2026-05-10)

- Runtime Prisma client creation:
  - `apps/api/src/index.js` (`new PrismaClient()`)
  - `prisma/seed.js` (`new PrismaClient()`)
- Service layer receives Prisma via dependency injection (many `create*Service({ prisma })` patterns).
- AME3-specific Prisma usage:
  - `apps/api/src/services/module-metadata-service.js` uses `atlasModel`, `atlasField`, `atlasView`, and `$transaction`.
  - `apps/api/src/services/module-migration-service.js` uses `moduleMigration` and `$executeRawUnsafe` inside guarded statements.
- `/modules/sync` route calls `metadataSvc.syncModuleMetadata(...)` and is a critical post-upgrade regression path.
- No Prisma middleware API usage detected (`$use` not used), which reduces one v7 migration risk.

---

## Current package versions

### Declared

- `package.json`
  - `devDependencies.@prisma/client: ^6`
  - `devDependencies.prisma: ^6`
  - `pnpm.overrides.prisma: ^6`

### Installed

- `pnpm.cmd list prisma @prisma/client`
  - `@prisma/client 6.19.3`
  - `prisma 6.19.3`

### Lockfile evidence

- `pnpm-lock.yaml` includes:
  - `@prisma/client@6.19.3`
  - `prisma@6.19.3`

### Environment baseline

- `node -v`: `v22.12.0`
- `pnpm.cmd -v`: `9.15.0`
- `pnpm.cmd outdated prisma @prisma/client`: latest reported `7.8.0` for both.

---

## Current Prisma schema structure

- `generator client` currently uses `provider = "prisma-client-js"`.
- `datasource db`:
  - `provider = "postgresql"`
  - `url = env("DATABASE_URL")`
  - `directUrl = env("DIRECT_URL")`
- Migration lock provider: PostgreSQL (`prisma/migrations/migration_lock.toml`).
- `prisma migrate status` baseline: `21 migrations found`, schema up to date.

### AME3 metadata models already present in schema and migrations

- `AtlasModel`
- `AtlasField`
- `AtlasView`
- `ModuleMigration`

Latest related migration:
- `prisma/migrations/20260510051619_ame3_metadata_orm_core/migration.sql`

---

## AME3 metadata impact analysis

1. `module-metadata-service` depends on stable Prisma model delegates and transactional behavior.
2. `/modules/sync` relies on metadata persistence; this must still work after client generation/import changes.
3. `module-migration-service` depends on `moduleMigration` table and raw SQL execution path; database connectivity and transaction semantics must remain intact.
4. Prisma client import strategy may need updates in API and seed paths depending on v7 generator/provider decisions.

---

## Migration strategy (v6 -> v7)

Reference baseline (official):
- https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7

Planned strategy:

1. Preflight
- Confirm Node and pnpm versions.
- Confirm current Prisma install and lockfile state.
- Ensure no active process is locking Prisma DLL (Windows).

2. Dependency upgrade
- Upgrade both `prisma` and `@prisma/client` to v7 in workspace package manifests and lockfile.

3. Schema/config adjustments (if required by v7)
- Evaluate generator migration from `prisma-client-js` to `prisma-client`.
- If `prisma-client` is adopted, set required `output` path and update all Prisma imports to generated client path.
- Evaluate need for `prisma.config.ts` for datasource/env/CLI behavior in v7.
- Evaluate deprecation of `directUrl` in schema and move CLI datasource config as required.

4. Runtime initialization adjustments (if required)
- Apply driver adapter setup for PostgreSQL (`@prisma/adapter-pg`) if the selected v7 client path requires it.
- Validate SSL behavior against self-hosted Supabase PostgreSQL endpoint.

5. Regeneration and migration checks
- `prisma validate`, client generate, migrate status, and migration workflow checks.

6. AME3 regression checks
- Syntax checks for metadata services.
- Module-engine tests.
- `/modules/sync` functional smoke check including `custom.fleet` sync.
- Prisma Studio inspection of AME3 metadata tables.

---

## Database reset strategy (local development only)

Allowed for local early-development recovery:

1. `pnpm.cmd prisma migrate reset --force`
2. `pnpm.cmd db:seed`
3. Run module sync again (`POST /modules/sync`) to repopulate metadata from discovered modules.

Important:
- This reset path is local-dev only.
- Do not use reset in production/staging environments with persistent business data.

---

## Production caution notes

1. Do not edit old migration files; only forward migrations.
2. Validate v7 datasource/SSL behavior against self-hosted Supabase PostgreSQL (`:5433`) before production rollout.
3. If client generation path changes, verify all production runtime import paths before deploy.
4. If driver adapter settings are introduced, explicitly validate connection pooling/timeouts.
5. Execute a backup/snapshot and tested rollback plan before production upgrade.
6. Keep upgrade isolated from AME3 feature development; no mixed-scope rollout.

---

## Validation commands

Preflight/baseline:

```bash
node -v
pnpm -v
pnpm.cmd -v
pnpm.cmd list prisma @prisma/client
pnpm.cmd outdated prisma @prisma/client
npm.cmd view prisma version
```

Upgrade validation:

```bash
pnpm.cmd install
pnpm.cmd prisma validate
pnpm.cmd db:generate
pnpm.cmd prisma migrate status
pnpm.cmd db:migrate
# or: pnpm.cmd prisma migrate dev
pnpm.cmd db:seed
node --check apps/api/src/services/module-metadata-service.js
node --check apps/api/src/services/module-migration-service.js
node --test packages/module-engine/src/__tests__/*.test.js
```

Functional AME3 validation:

1. Confirm `AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration` visible in Prisma Studio.
2. Trigger `/modules/sync` and verify `custom.fleet` metadata sync succeeds.
3. Confirm no regression in module discovery/metadata behavior.

Known baseline caveat (already observed pre-upgrade):
- `pnpm.cmd db:generate` can fail with Windows `EPERM` rename error when a Node/API process holds Prisma DLL.

---

## Rollback strategy

1. Code/package rollback
- Revert package and code changes to last green commit.
- Restore lockfile and schema/config files.

2. Database rollback
- If schema changes were applied, create forward corrective migration instead of editing migration history.
- For local dev only, reset and reseed is acceptable.

3. Release rollback
- Keep pre-upgrade artifact available and redeploy if runtime regressions appear.

---

## Acceptance criteria

1. Prisma CLI resolves to v7.
2. `@prisma/client` resolves to v7.
3. `pnpm.cmd prisma validate` passes.
4. `pnpm.cmd db:generate` passes (after resolving any Windows DLL lock).
5. `pnpm.cmd prisma migrate status` reports in-sync migrations.
6. Seed works (`pnpm.cmd db:seed`) or documented fix is applied and validated.
7. AME3 metadata tables exist and remain queryable.
8. `/modules/sync` still syncs `custom.fleet` metadata.
9. Prisma Studio shows `AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration`.
10. `node --check` passes for:
- `apps/api/src/services/module-metadata-service.js`
- `apps/api/src/services/module-migration-service.js`
11. `node --test packages/module-engine/src/__tests__/*.test.js` passes.
12. No AME3 discovery or module-engine behavior regresses.

---

## Baseline evidence captured on 2026-05-10 (pre-upgrade)

- `prisma validate`: pass.
- `prisma migrate status`: pass, 21 migrations, up to date.
- `db:generate`: failed once with expected Windows `EPERM` Prisma DLL lock condition.
- `node --check` on both AME3 services: pass.
- `node --test packages/module-engine/src/__tests__/*.test.js`: pass (72/72).

---

## Official references

1. Prisma v7 upgrade guide:
- https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7
2. Prisma v7 breaking-change index page:
- https://docs.prisma.io/docs/v6/orm/more/upgrades/to-v7
3. Prisma generators reference (`prisma-client-js` deprecation context):
- https://www.prisma.io/docs/orm/v6/prisma-schema/overview/generators
