# Prisma v7 Upgrade (AME3) Implementation Plan

Date: 2026-05-10
Spec: docs/superpowers/specs/2026-05-10-prisma-7-upgrade.md
Status: Draft

> This plan is for upgrade execution only. Current task scope is documentation and planning; do not run upgrade edits until approved.

---

## Goal

Upgrade Prisma from v6.19.3 to v7.x safely, preserve AME3 metadata functionality, and validate that module sync and module-engine behavior do not regress.

## Scope and constraints

- Upgrade only Prisma stack and required compatibility code.
- Keep migration history immutable.
- Separate local reset strategy from production migration strategy.
- Respect forbidden paths unless Prisma v7 migration requirements force minimal targeted changes.

---

## Exact files to inspect

Required inspection set:

1. `package.json`
2. `pnpm-lock.yaml`
3. `prisma/schema.prisma`
4. `prisma/migrations/**`
5. `prisma/seed.js`
6. `apps/api/src/**`
7. `packages/module-engine/**`
8. `apps/api/src/services/module-metadata-service.js`
9. `apps/api/src/services/module-migration-service.js`

Recommended additional inspection during execution:

1. `apps/api/package.json` (if Prisma dependencies are declared there)
2. `prisma/migrations/migration_lock.toml`
3. process list for Node locks before `db:generate`

---

## Exact files allowed to change

Allowed without additional approval:

1. `package.json`
2. `pnpm-lock.yaml`
3. `prisma/schema.prisma` (only if Prisma 7 requires generator/datasource changes)
4. `prisma/seed.js` (only if Prisma v7 generation/import path breaks seed)
5. `apps/api/src/index.js` (only if Prisma Client import/instantiation changes are required)
6. `prisma.config.ts` (new file, only if required by Prisma v7 CLI/env behavior)

Conditional allowed files (only if they currently import Prisma Client directly and require path/instantiation updates):

1. additional files under `apps/api/src/**` that contain direct Prisma Client imports/creation.

Rule:
- If any file outside this list must change, stop and update this plan first before editing.

---

## Forbidden files (unless required by Prisma v7 migration)

1. `apps/desktop/**`
2. `packages/maps/**`
3. `modules/custom/custom.fleet/**`
4. `packages/module-engine/**`

Hard rules:
- Do not edit historical files under `prisma/migrations/**/migration.sql`.
- Do not modify AME3 metadata migration history (`prisma/migrations/20260510051619_ame3_metadata_orm_core/**`).

---

## Upgrade commands

Use `pnpm.cmd`/`npm.cmd` on Windows when script policy blocks `.ps1` wrappers.

1. Baseline check:

```bash
node -v
pnpm -v
pnpm.cmd -v
pnpm.cmd list prisma @prisma/client
pnpm.cmd outdated prisma @prisma/client
npm.cmd view prisma version
```

2. Upgrade Prisma packages (workspace root):

```bash
pnpm.cmd add -D prisma@^7 @prisma/client@^7
pnpm.cmd install
```

3. If workspace package manifests also pin Prisma separately, align them to `^7` and reinstall:

```bash
pnpm.cmd install
```

4. If Prisma v7 requires migration to new generator/provider path, apply schema and import changes per official docs before generation.

---

## Validation commands

Preflight + package/version validation:

```bash
node -v
pnpm -v
pnpm.cmd -v
pnpm.cmd list prisma @prisma/client
pnpm.cmd outdated prisma @prisma/client
npm.cmd view prisma version
pnpm.cmd install
```

Prisma/schema/migrations/seed validation:

```bash
pnpm.cmd prisma validate
pnpm.cmd db:generate
pnpm.cmd prisma migrate status
pnpm.cmd db:migrate
# or if needed:
pnpm.cmd prisma migrate dev
pnpm.cmd db:seed
```

AME3 safety validation:

```bash
node --check apps/api/src/services/module-metadata-service.js
node --check apps/api/src/services/module-migration-service.js
node --test packages/module-engine/src/__tests__/*.test.js
```

Functional validation:

1. Run API and call `POST /modules/sync`.
2. Verify `custom.fleet` sync result is successful.
3. Open Prisma Studio and confirm tables:
- `AtlasModel`
- `AtlasField`
- `AtlasView`
- `ModuleMigration`

---

## Local reset commands (development only)

Use only for local repair/testing:

```bash
pnpm.cmd prisma migrate reset --force
pnpm.cmd db:seed
# then trigger module sync again
# POST /modules/sync
```

Production note:
- Never use `migrate reset` in production.

---

## Expected outputs

Pre-upgrade baseline expected:

1. Prisma currently `6.19.3` for both CLI and client.
2. `prisma migrate status` reports database schema up to date.

Post-upgrade expected:

1. `pnpm.cmd list prisma @prisma/client` shows v7 for both.
2. `prisma validate` passes.
3. `db:generate` passes.
4. `prisma migrate status` remains in sync.
5. `db:seed` passes (or approved seed fix documented and validated).
6. AME3 metadata service syntax checks pass.
7. Module-engine tests pass.
8. `/modules/sync` works and `custom.fleet` metadata persists.

---

## Troubleshooting notes

1. Windows execution policy blocks `pnpm`/`npm`:
- Use `pnpm.cmd` and `npm.cmd`.

2. `db:generate` fails with `EPERM` rename on `query_engine-windows.dll.node`:
- Stop API/dev Node processes, then rerun generation.

3. Prisma v7 env loading/config issues:
- Add/adjust `prisma.config.ts` with explicit dotenv loading per official docs.

4. Import path/runtime break after generator/provider switch:
- Update all Prisma Client imports to generated output path consistently.

5. SSL/access issues against self-hosted Supabase PostgreSQL:
- Validate adapter/SSL options according to Prisma v7 guidance before production rollout.

6. Migration drift detected:
- Do not edit old migration SQL; resolve with forward migration or metadata reconciliation.

---

## Execution tasks and checkpoints

### Task 1 - Baseline and preflight

- [ ] Capture version baseline and current status outputs.
- [ ] Confirm clean understanding of Prisma import points and AME3 touchpoints.

Checkpoint output:
- Baseline log attached to PR/notes.

### Task 2 - Dependency upgrade

- [ ] Update Prisma dependencies to v7.
- [ ] Update lockfile via install.

Checkpoint output:
- `package.json` + `pnpm-lock.yaml` updated to v7.

### Task 3 - Schema/config compatibility

- [ ] Apply required v7 schema/config changes only if needed.
- [ ] Update runtime/seed imports only if required.

Checkpoint output:
- `prisma validate` passes.

### Task 4 - Generate/migrate/seed validation

- [ ] Run generate, migrate status, migrate dev/db:migrate, seed.
- [ ] Resolve Windows lock issue if it appears.

Checkpoint output:
- Validation command set passes.

### Task 5 - AME3 regression validation

- [ ] Syntax check AME3 services.
- [ ] Run module-engine tests.
- [ ] Validate `/modules/sync` and Prisma Studio visibility for AME3 tables.

Checkpoint output:
- No AME3 discovery/module-engine regressions.

---

## Commit checkpoint

After all validations pass:

```bash
git add package.json pnpm-lock.yaml prisma/schema.prisma prisma/seed.js apps/api/src prisma.config.ts
git commit -m "chore(prisma): upgrade prisma and @prisma/client to v7 for AME3 readiness"
```

If only dependency files changed, commit only those files.

---

## Official guidance references

1. https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7
2. https://docs.prisma.io/docs/v6/orm/more/upgrades/to-v7
3. https://www.prisma.io/docs/orm/v6/prisma-schema/overview/generators
