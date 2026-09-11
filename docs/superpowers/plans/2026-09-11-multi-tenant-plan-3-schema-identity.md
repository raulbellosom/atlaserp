# Multi-Tenant Plan 3 — Schema Hardening + CompanyModule + Identity Tenant Scoping

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the schema changes the spec identified as required (`Role.companyId`, `CompanyModule`, the `HrEmployee`/`PfmBudget`/`AuditLog` constraint fixes), wire `CompanyModule` into module visibility, and close the identity-module cross-tenant gaps found while researching this plan: `/identity/users` (list, create, bulk-enable, bulk-delete, by-id get/update/delete, avatar) and `/identity/roles` (list, create, update, enable-toggle, permissions, delete) currently have **no company-membership check at all** on top of `requirePermission` — a caller with `identity.users.*`/`identity.roles.*` in Company A can read, disable, or delete a user or role belonging only to Company B, or edit a system role's permission set, as long as they know (or guess) its UUID.

**Architecture:** One migration adds `company_id` to `role` (nullable — `NULL` means a system/template role shared by every company, matching the already-seeded `atlas.admin`/`system.admin`/`storefront_client`/`storefront_vendor`) with a composite unique for company-scoped roles plus a partial unique index for system roles; a new `company_module` join table; and constraint widenings on `hr_employee`/`pfm_budget` plus a nullable `audit_log.company_id`. `Role.companyId` requires updating every `where: { key }` Prisma call (Prisma's generated compound selector becomes `companyId_key`) — there are exactly 4, found by repo-wide search. `HrEmployee.userProfileId` losing its plain `@unique` changes `UserProfile`'s reverse relation from "at most one employee record" to "one per company" — confirmed unused anywhere in application code, so the rename is risk-free. Every identity endpoint gets one of two small shared helpers (`loadCompanyEditableRole` for roles, `assertUserInCompany`/`filterUserIdsInCompany` for users) rather than repeating the same membership check inline ten times.

**Tech Stack:** Prisma 7 (hand-written forward-only SQL migrations, matching this repo's established pattern — this team does not run `prisma migrate dev` against the shared Supabase instance), Node test runner.

**Depends on:** Plan 1 (tenant context middleware — `c.get("tenantContext")`/`c.get("companyId")` must already be correct) and Plan 2. Both are implemented and committed on `main`.

**Deferred to Plan 4 (explicitly, not silently):** `FileAsset.companyId` (the audit flagged this as needing a real backfill migration — joining back through many different `moduleKey`/`entityType` shapes to recover the right company for existing rows — too risky to rush here); `GET/PUT /identity/users/:id/permission-grants` (still has its own route-contract problem, unchanged from Plan 1's write-up); populating `AuditLog.companyId` on the ~20 existing write call sites (the column is added nullable and safe to leave `NULL` for now — this plan only adds the column + index, not the write-site sweep); a company-admin self-service UI/endpoint to toggle `CompanyModule.enabled` for their own company (this plan gates the toggle at `isSystemAdmin` only — see Task 6).

---

## File Structure

- **Create:** `prisma/migrations/20260911000000_multi_tenant_schema_hardening/migration.sql`
- **Modify:** `prisma/schema.prisma` (`Role`, `Company`, `UserProfile`, `HrEmployee`, `PfmBudget`, `AuditLog`, new `CompanyModule`)
- **Modify:** `prisma/seed.js` (3 `role.upsert` call sites)
- **Create:** `apps/api/src/services/company-module-service.js` + `apps/api/src/services/__tests__/company-module-service.test.js`
- **Modify:** `apps/api/src/index.js` — `ensureSetupAdminRole`, `/identity/roles*` (5 routes), `/identity/users*` (10 routes), `/runtime/modules`, `/blueprints`, plus two new admin routes for `CompanyModule`
- **Modify:** `apps/api/src/services/hr-service.js` — `assertUserLinkEligibility`

---

### Task 1: Schema migration

**Files:** `prisma/migrations/20260911000000_multi_tenant_schema_hardening/migration.sql`, `prisma/schema.prisma`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Multi-tenant schema hardening: Role becomes company-scoped (NULL = system
-- role shared by every company), CompanyModule enables/disables an installed
-- module per company, and three constraints that were global but should be
-- company-scoped are widened (never narrowed — every existing row stays
-- valid, no backfill needed).
-- Spec: docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §9, §15

-- ── Role.companyId ──────────────────────────────────────────────────────────
ALTER TABLE "role" ADD COLUMN "company_id" UUID;

DROP INDEX "role_key_key";

-- Company-scoped roles: unique key per company. Postgres unique indexes treat
-- each NULL as distinct from every other NULL, so this alone does not stop
-- two system roles (company_id IS NULL) from sharing a key -- that's what the
-- partial index right below is for.
CREATE UNIQUE INDEX "role_company_id_key_key" ON "role"("company_id", "key");

-- System/template roles (company_id IS NULL) still need a globally unique key.
CREATE UNIQUE INDEX "role_system_key_key" ON "role"("key") WHERE "company_id" IS NULL;

CREATE INDEX "role_company_id_enabled_idx" ON "role"("company_id", "enabled");

ALTER TABLE "role" ADD CONSTRAINT "role_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CompanyModule: per-company module enablement ────────────────────────────
-- AtlasModule stays the instance-wide "is this module installed on this
-- deployment at all" catalog (unchanged). CompanyModule adds the missing
-- per-tenant dimension on top of it.
CREATE TABLE "company_module" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_module_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_module_company_id_module_id_key" ON "company_module"("company_id", "module_id");
CREATE INDEX "company_module_company_id_enabled_idx" ON "company_module"("company_id", "enabled");

ALTER TABLE "company_module" ADD CONSTRAINT "company_module_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_module" ADD CONSTRAINT "company_module_module_id_fkey"
  FOREIGN KEY ("module_id") REFERENCES "atlas_module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_module" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "company_module" FROM anon, authenticated;

-- Backfill: every existing company gets an enabled row for every currently
-- INSTALLED module, so nothing changes behaviorally the moment this migration
-- lands -- a module only stops appearing for a company once an admin
-- explicitly disables it via the new CompanyModule endpoints (Task 6).
INSERT INTO "company_module" ("id", "company_id", "module_id", "enabled", "created_at", "updated_at")
SELECT uuidv7(), c.id, m.id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "company" c
CROSS JOIN "atlas_module" m
WHERE m.status = 'INSTALLED'
ON CONFLICT ("company_id", "module_id") DO NOTHING;

-- ── HrEmployee.userProfileId: was globally unique, now unique per company ──
-- A UserProfile could only ever be linked to ONE HrEmployee row in the WHOLE
-- INSTANCE. Loosened so the same person can be an employee of two different
-- companies in this instance.
DROP INDEX "hr_employee_user_profile_id_key";
CREATE UNIQUE INDEX "hr_employee_company_id_user_profile_id_key" ON "hr_employee"("company_id", "user_profile_id");

-- ── PfmBudget: add company_id to the composite unique, matching every other
-- Pfm model's pattern (categoryId/walletId are already company-owned, so this
-- is a low-risk consistency fix, not a bug with observed real-world impact).
DROP INDEX "pfm_budget_owner_id_category_id_wallet_id_period_key";
CREATE UNIQUE INDEX "pfm_budget_company_id_owner_id_category_id_wallet_id_period_key"
  ON "pfm_budget"("company_id", "owner_id", "category_id", "wallet_id", "period");

-- ── AuditLog.companyId: nullable, no FK (matches the Activity table's
-- existing pattern -- a plain scalar column, no relation object, to avoid FK
-- overhead on a high-volume append-only log table). NULL stays valid for
-- system-level entries and for existing historical rows; this migration does
-- not populate it on any existing row.
ALTER TABLE "audit_log" ADD COLUMN "company_id" UUID;
CREATE INDEX "audit_log_company_id_created_at_idx" ON "audit_log"("company_id", "created_at" DESC);
```

- [ ] **Step 2: Update `prisma/schema.prisma`**

Replace the `Role` model (`prisma/schema.prisma:439-452`):

```prisma
model Role {
  id String @id @default(uuid(7)) @db.Uuid
  companyId String? @db.Uuid @map("company_id")
  key         String
  name        String
  description String?
  system      Boolean @default(false)
  enabled     Boolean @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  company     Company? @relation(fields: [companyId], references: [id], onDelete: Cascade)
  memberships Membership[]
  permissions RolePermission[]

  @@unique([companyId, key])
  @@index([companyId, enabled])
  @@map("role")
}
```

(The partial unique index for `companyId IS NULL` from the migration has no DSL equivalent in Prisma and is intentionally not declared here — this repo already has an established precedent for hand-written partial indexes the schema file doesn't fully mirror, e.g. `chat_conversations_one_meridian_per_user_idx`. `prisma migrate deploy` applies the raw SQL regardless of what `schema.prisma` can express.)

Add `roles Role[]` to the `Company` model's relation list (`prisma/schema.prisma:320`, alongside `memberships`):

```prisma
  memberships    Membership[]
  roles          Role[]
  brandingConfig BrandingConfig?
```

Add a new `CompanyModule` model (anywhere near `AtlasModule`, e.g. right after `ModuleMigration` at `prisma/schema.prisma:292`):

```prisma
model CompanyModule {
  id String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  companyId String @db.Uuid @map("company_id")
  moduleId String @db.Uuid @map("module_id")
  enabled   Boolean @default(true)
  config    Json?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  company Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  module  AtlasModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  @@unique([companyId, moduleId])
  @@index([companyId, enabled])
  @@map("company_module")
}
```

Add the two reverse relations this needs: `companyModules CompanyModule[]` on `Company` (next to `roles`) and `companyModules CompanyModule[]` on `AtlasModule` (`prisma/schema.prisma:183-186`, alongside `dependencies`/`blueprints`/`permissions`).

Modify `HrEmployee.userProfileId` (`prisma/schema.prisma:643`) — drop `@unique`:

```prisma
  userProfileId String? @db.Uuid @map("user_profile_id")
```

Add `@@unique([companyId, userProfileId])` to `HrEmployee`'s index block (`prisma/schema.prisma:680`, alongside the existing `@@index` lines).

Change `UserProfile.hrEmployee HrEmployee?` (`prisma/schema.prisma:370`) to a list — confirmed unused as a Prisma `include`/`select` anywhere in the codebase, so this is a risk-free rename:

```prisma
  hrEmployees HrEmployee[]
```

Modify `PfmBudget` (`prisma/schema.prisma:3398`):

```prisma
  @@unique([companyId, ownerId, categoryId, walletId, period])
```

Modify `AuditLog` (`prisma/schema.prisma:577-594`) — add the nullable scalar column (no relation object, matching `Activity`'s pattern) and its index:

```prisma
model AuditLog {
  id String @id @default(uuid(7)) @db.Uuid
  companyId String? @db.Uuid @map("company_id")
  actorId String? @db.Uuid @map("actor_id")
  moduleKey String? @map("module_key")
  entityType String? @map("entity_type")
  entityId String? @db.Uuid @map("entity_id")
  action      String
  before      Json?
  after       Json?
  metadata    Json?
  createdAt DateTime @default(now()) @map("created_at")

  actor       UserProfile? @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@index([moduleKey, entityType, entityId])
  @@index([createdAt])
  @@index([companyId, createdAt(sort: Desc)])
  @@map("audit_log")
}
```

- [ ] **Step 3: Apply the migration against the live Supabase database**

This modifies shared infrastructure — confirm before running if there is any doubt. The migration is additive/constraint-widening only (no `DROP TABLE`, no `NOT NULL` tightening, no data deletion), matches this repo's forward-only-migration rule, and `prisma migrate deploy` only applies migrations not yet recorded as applied — it will not touch any of the 89 already-applied migrations.

Run: `pnpm db:migrate`
Expected output ends with: `The following migration(s) have been applied: ... 20260911000000_multi_tenant_schema_hardening` and `Generated Prisma Client`.

- [ ] **Step 4: Verify with a read-only status check**

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!`

- [ ] **Step 5: Update the 3 `role.upsert({ where: { key } })` call sites in `prisma/seed.js`**

`Role.key` is no longer a standalone unique field. The obvious fix — Prisma's generated compound selector `companyId_key` — does **not** work here: Prisma 7 rejects `null` inside a compound-unique `where` (`{ companyId_key: { companyId: null, key } }`) with `Argument companyId must not be null`, even though the column is nullable at the DB level (confirmed by actually running it against the live instance). System-role upserts (`companyId IS NULL`) are done by hand instead, via `findFirst` (which has no unique-constraint restriction) + `create`/`update` by `id`:

```javascript
async function upsertSystemRole({ key, name, description, system = true, enabled = true }) {
  const existing = await prisma.role.findFirst({ where: { companyId: null, key } })
  if (existing) {
    return prisma.role.update({
      where: { id: existing.id },
      data: { name, description, enabled },
    })
  }
  return prisma.role.create({ data: { key, name, description, system, enabled } })
}

  await upsertSystemRole({
    key: 'atlas.admin',
    name: 'Atlas Admin',
    description: 'Full system access',
    system: true,
    enabled: true,
  })

  await upsertSystemRole({
    key: 'system.admin',
    name: 'System Admin',
    description: 'Full system access',
    system: true,
    enabled: true,
  })
```

and, in the loop over `storefront_client`/`storefront_vendor`:

```javascript
    await upsertSystemRole(roleData)
```

- [ ] **Step 6: Run the seed script to confirm it still runs cleanly against the now-migrated schema**

Run: `pnpm db:seed`
Expected: completes without error (idempotent — all four roles already exist from the live instance's history, so this exercises the `update` branch of each upsert, proving the new `where` selector resolves correctly against real data).

- [ ] **Step 7: Commit**

```bash
git add prisma/migrations/20260911000000_multi_tenant_schema_hardening prisma/schema.prisma prisma/seed.js
git commit -m "feat(db): multi-tenant schema hardening — Role.companyId, CompanyModule, constraint fixes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Fix `ensureSetupAdminRole` for the new Role selector

**Files:** `apps/api/src/index.js:647-649` (the one remaining `role.upsert({ where: { key } })` outside seed.js)

- [ ] **Step 1: Update the selector**

Same Prisma limitation as Task 1 Step 5 (`null` is rejected inside a compound-unique `where`) — use `findFirst` + `create`/`update` by `id`:

```javascript
async function ensureSetupAdminRole(db) {
  const existing = await db.role.findFirst({ where: { companyId: null, key: "atlas.admin" } });
  const data = {
    enabled: true,
    system: true,
    name: "Atlas Admin",
    description: "Acceso total del sistema",
  };
  if (existing) {
    return db.role.update({ where: { id: existing.id }, data });
  }
  return db.role.create({ data: { key: "atlas.admin", ...data } });
}
```

- [ ] **Step 2: Syntax-check and commit**

Run: `node --check apps/api/src/index.js`

```bash
git add apps/api/src/index.js
git commit -m "fix(api): ensureSetupAdminRole uses the new Role companyId_key selector

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `assertUserLinkEligibility` scopes the employee-link check by company

**Files:** `apps/api/src/services/hr-service.js:234-240`

This is the application-level enforcement that made `HrEmployee.userProfileId` behave as globally unique even before the DB constraint said so — the DB fix from Task 1 does nothing unless this query is also scoped.

- [ ] **Step 1: Write the failing test**

Check for an existing hr-service test file first:

Run: `ls apps/api/src/services/__tests__/ | grep hr-service`

If `hr-service.test.js` doesn't exist, create it; if it does, add this test to it. Either way, the test needs a minimal prisma mock — model after the shape used in `apps/api/src/services/__tests__/inventory-service.test.js` (confirmed by this plan's earlier research to already mock `hrEmployee.findFirst`). Add:

```javascript
// apps/api/src/services/__tests__/hr-service-cross-tenant.test.js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHrService } from '../hr-service.js'

describe('assertUserLinkEligibility (via createEmployee) — company scoping', () => {
  it('allows linking a UserProfile that is already an HrEmployee in a DIFFERENT company', async () => {
    // Regression test for the exact bug the schema audit found: the pre-fix
    // query had no companyId filter, so a UserProfile already linked as an
    // employee in Company A could never become an employee in Company B —
    // even though HrEmployee.userProfileId is now unique PER COMPANY, not
    // globally.
    let capturedWhere = null
    const prisma = {
      userProfile: { findUnique: async () => ({ id: 'auth-user-profile' }) },
      membership: { findFirst: async () => ({ id: 'm1' }) },
      hrEmployee: {
        findFirst: async (args) => {
          capturedWhere = args.where
          return null // no conflict in Company B
        },
        create: async ({ data }) => ({ id: 'emp-1', ...data }),
      },
      hrDepartment: { findFirst: async () => null },
      hrJobTitle: { findFirst: async () => null },
      fileAsset: { findUnique: async () => null },
      $transaction: async (fns) => Promise.all(fns.map((f) => (typeof f === 'function' ? f(prisma) : f))),
    }
    const service = createHrService({ prisma })
    await service.createEmployee({
      authUserId: 'auth-1',
      payload: {
        firstName: 'Ana',
        lastName: 'Lopez',
        userProfileId: 'profile-linked-elsewhere',
      },
    })
    assert.ok(capturedWhere, 'expected the conflict check to run')
    assert.equal(capturedWhere.companyId, 'company-b')
  })
})
```

Note: this test's exact shape depends on `createHrService`'s real `getUserContext` resolution path — if `authUserId: 'auth-1'` does not resolve to `companyId: 'company-b'` through the mocked `prisma`, adjust the mock to match however `getUserContext` in `hr-service.js` actually resolves company (read the top of the file first). The assertion that matters is `capturedWhere.companyId` being present and non-null — that is what proves the fix.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test apps/api/src/services/__tests__/hr-service-cross-tenant.test.js`
Expected: FAIL — `capturedWhere.companyId` is `undefined` (today's query has no `companyId` key at all).

- [ ] **Step 3: Fix the query**

```javascript
    const linked = await prisma.hrEmployee.findFirst({
      where: {
        companyId,
        userProfileId,
        ...(currentEmployeeId ? { id: { not: currentEmployeeId } } : {}),
      },
      select: { id: true },
    });
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test apps/api/src/services/__tests__/hr-service-cross-tenant.test.js`

- [ ] **Step 5: Run the full existing HR test coverage for regressions**

Run: `node --test apps/api/src/services/__tests__/*.test.js 2>&1 | tail -20` and confirm the pass/fail counts match the pre-Task-3 baseline (322/324 known-good from Plan 1/2's verification, plus this new test).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/hr-service.js apps/api/src/services/__tests__/hr-service-cross-tenant.test.js
git commit -m "fix(hr): scope the employee-user-link uniqueness check by company

Without this, HrEmployee.userProfileId behaved as globally unique at the
application level even after the DB constraint became per-company — a
person could still never be linked as an employee in a second company.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `CompanyModule` service

**Files:** `apps/api/src/services/company-module-service.js`, `apps/api/src/services/__tests__/company-module-service.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// apps/api/src/services/__tests__/company-module-service.test.js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createCompanyModuleService } from '../company-module-service.js'

function makePrisma({ rows = [] } = {}) {
  return {
    companyModule: {
      findMany: async ({ where }) => rows.filter((r) => r.companyId === where.companyId),
      upsert: async ({ where, update, create }) => {
        const existing = rows.find(
          (r) => r.companyId === where.companyId_moduleId.companyId && r.moduleId === where.companyId_moduleId.moduleId,
        )
        if (existing) {
          Object.assign(existing, update)
          return existing
        }
        const created = { ...create }
        rows.push(created)
        return created
      },
    },
  }
}

describe('company-module-service', () => {
  it('listEnabledModuleIds returns only the enabled module ids for a company', async () => {
    const prisma = makePrisma({
      rows: [
        { companyId: 'c1', moduleId: 'm1', enabled: true },
        { companyId: 'c1', moduleId: 'm2', enabled: false },
        { companyId: 'c2', moduleId: 'm1', enabled: true },
      ],
    })
    const service = createCompanyModuleService({ prisma })
    const ids = await service.listEnabledModuleIds('c1')
    assert.deepEqual([...ids].sort(), ['m1'])
  })

  it('isModuleEnabledForCompany defaults to true when no CompanyModule row exists yet', async () => {
    // Backfill covers every company that existed when the migration ran; a
    // company created afterward with a module installed afterward has no row
    // yet -- absence must mean "enabled", not "disabled", so nothing regresses.
    const prisma = makePrisma({ rows: [] })
    const service = createCompanyModuleService({ prisma })
    assert.equal(await service.isModuleEnabledForCompany({ companyId: 'c1', moduleId: 'm9' }), true)
  })

  it('isModuleEnabledForCompany returns false when explicitly disabled', async () => {
    const prisma = makePrisma({ rows: [{ companyId: 'c1', moduleId: 'm1', enabled: false }] })
    const service = createCompanyModuleService({ prisma })
    assert.equal(await service.isModuleEnabledForCompany({ companyId: 'c1', moduleId: 'm1' }), false)
  })

  it('setEnabled upserts the row for that exact (company, module) pair', async () => {
    const prisma = makePrisma({ rows: [] })
    const service = createCompanyModuleService({ prisma })
    await service.setEnabled({ companyId: 'c1', moduleId: 'm1', enabled: false })
    assert.equal(await service.isModuleEnabledForCompany({ companyId: 'c1', moduleId: 'm1' }), false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test apps/api/src/services/__tests__/company-module-service.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```javascript
// apps/api/src/services/company-module-service.js
// Per-company module enablement. AtlasModule stays the instance-wide "is this
// module installed on this deployment" catalog; CompanyModule adds the
// missing per-tenant dimension: a company only sees a module in
// /runtime/modules and /blueprints when it's both globally INSTALLED and
// (enabled here OR has no CompanyModule row at all -- absence defaults to
// enabled, matching the backfill migration's intent that nothing regresses
// for companies/modules that existed before this feature).
// Spec: docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §9.4

export function createCompanyModuleService({ prisma }) {
  async function listEnabledModuleIds(companyId) {
    const rows = await prisma.companyModule.findMany({
      where: { companyId, enabled: true },
      select: { moduleId: true },
    })
    return new Set(rows.map((r) => r.moduleId))
  }

  async function listDisabledModuleIds(companyId) {
    const rows = await prisma.companyModule.findMany({
      where: { companyId, enabled: false },
      select: { moduleId: true },
    })
    return new Set(rows.map((r) => r.moduleId))
  }

  async function isModuleEnabledForCompany({ companyId, moduleId }) {
    const disabled = await listDisabledModuleIds(companyId)
    return !disabled.has(moduleId)
  }

  async function setEnabled({ companyId, moduleId, enabled }) {
    return prisma.companyModule.upsert({
      where: { companyId_moduleId: { companyId, moduleId } },
      update: { enabled },
      create: { companyId, moduleId, enabled },
    })
  }

  async function listForCompany(companyId) {
    return prisma.companyModule.findMany({ where: { companyId } })
  }

  return { listEnabledModuleIds, listDisabledModuleIds, isModuleEnabledForCompany, setEnabled, listForCompany }
}
```

Note: `isModuleEnabledForCompany` is written against `listDisabledModuleIds` (not `listEnabledModuleIds`) specifically so the default-enabled behavior in test 2 holds without needing every module pre-seeded — filtering the small "explicitly disabled" set scales better than needing a `listEnabledModuleIds` call to already contain every module that was ever installed.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test apps/api/src/services/__tests__/company-module-service.test.js`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/company-module-service.js apps/api/src/services/__tests__/company-module-service.test.js
git commit -m "feat(api): add company-module-service for per-company module enablement

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire `CompanyModule` into `/runtime/modules` and `/blueprints`

**Files:** `apps/api/src/index.js`

- [ ] **Step 1: Instantiate the service**

Near the other service instantiations in `apps/api/src/index.js` (alongside where `createCompanyService`/`createHrService` etc. are imported/constructed — search for `createHrService({` to find the right spot), add:

```javascript
import { createCompanyModuleService } from "./services/company-module-service.js";
```

and, alongside the other `const xxxService = createXxxService({ prisma })` lines:

```javascript
const companyModuleService = createCompanyModuleService({ prisma });
```

- [ ] **Step 2: Filter `/runtime/modules` by company**

In the handler (already resolves `tenant` via Task 5 of Plan 1), after `modulesRaw` is loaded and before building the response:

```javascript
  let visibleModules = modulesRaw;
  if (tenant.companyId) {
    const disabledIds = await companyModuleService.listDisabledModuleIds(tenant.companyId);
    visibleModules = modulesRaw.filter((m) => m.core || !disabledIds.has(m.id));
  }

  return c.json({
    data: serializeModulesForResponse(visibleModules, tenant, {
      filterByPermission: true,
      filterNavigation: true,
    }),
  });
```

Core modules (`m.core`) are never company-disableable — matches the existing `AtlasModule.core`/`uninstallable` semantics (core modules can't even be uninstalled instance-wide; disabling them per-company would be the same class of footgun).

- [ ] **Step 3: Filter `/blueprints` by company**

The `/blueprints` handler already resolves `tenant`. Right after loading `blueprintRaw`, compute the disabled set once and check it alongside the existing `userCanAccessModule` calls:

```javascript
  const { blueprints, installedModuleRows, atlasViews } = blueprintRaw;
  const moduleRowsByKey = new Map(
    installedModuleRows.map((row) => [row.key, row]),
  );
  const disabledModuleIds = tenant.companyId
    ? await companyModuleService.listDisabledModuleIds(tenant.companyId)
    : new Set();
  const mergedByKey = new Map();

  for (const blueprint of blueprints) {
    if (!userCanAccessModule(tenant, blueprint.module)) continue;
    if (blueprint.module && !blueprint.module.core && disabledModuleIds.has(blueprint.module.id)) continue;
    mergedByKey.set(blueprint.key, {
```

and, in the `atlasViews` loop:

```javascript
  for (const view of atlasViews) {
    const moduleRow = moduleRowsByKey.get(view.moduleKey);
    if (!moduleRow) continue;
    if (!userCanAccessModule(tenant, moduleRow)) continue;
    if (!moduleRow.core && disabledModuleIds.has(moduleRow.id)) continue;
```

(`installedModuleRows`'s `select` in the cached query already includes `key, name, status, enabled, version, manifest, hasBundle` but not `id`/`core` — check the exact `select` block a few lines above and add `id: true, core: true` to it if missing, since both are now needed here.)

- [ ] **Step 4: Add admin endpoints to list/toggle a company's modules**

Add near the other `/identity/*` or `/modules` routes:

```javascript
app.get(
  "/companies/:companyId/modules",
  authMiddleware,
  requireAnyPermission(["core.modules.read"]),
  async (c) => {
    const tenant = c.get("tenantContext");
    const companyId = c.req.param("companyId");
    if (!tenant.isSystemAdmin && companyId !== tenant.companyId) {
      return c.json({ error: "No autorizado." }, 403);
    }
    const [modules, companyModules] = await Promise.all([
      prisma.atlasModule.findMany({ where: { status: "INSTALLED" }, select: { id: true, key: true, name: true, core: true } }),
      companyModuleService.listForCompany(companyId),
    ]);
    const byModuleId = new Map(companyModules.map((cm) => [cm.moduleId, cm]));
    return c.json({
      data: modules.map((m) => ({
        moduleId: m.id,
        key: m.key,
        name: m.name,
        core: m.core,
        enabled: m.core ? true : (byModuleId.get(m.id)?.enabled ?? true),
      })),
    });
  },
);

app.patch(
  "/companies/:companyId/modules/:moduleId",
  authMiddleware,
  requirePermission("core.modules.manage"),
  async (c) => {
    const tenant = c.get("tenantContext");
    if (!tenant.isSystemAdmin) {
      return c.json({ error: "Solo un administrador de plataforma puede cambiar los modulos de una empresa." }, 403);
    }
    const companyId = c.req.param("companyId");
    const moduleId = c.req.param("moduleId");
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.enabled !== "boolean") {
      return c.json({ error: "El campo enabled es obligatorio." }, 422);
    }
    const moduleRow = await prisma.atlasModule.findUnique({ where: { id: moduleId }, select: { core: true } });
    if (!moduleRow) return c.json({ error: "Modulo no encontrado." }, 404);
    if (moduleRow.core && !body.enabled) {
      return c.json({ error: "Los modulos core no se pueden deshabilitar por empresa." }, 400);
    }
    const result = await companyModuleService.setEnabled({ companyId, moduleId, enabled: body.enabled });
    cacheDelByPrefix("runtime:modules:raw");
    cacheDelByPrefix("blueprints:raw");
    return c.json({ data: result });
  },
);
```

`core.modules.manage` does not exist yet in `apps/api/src/permission-catalog.js` (only `core.modules.read` was confirmed to exist in Plan 1's research) — check the catalog file and add it if missing, following the existing entries' shape exactly (same file, alongside `core.modules.read`):

```javascript
"core.modules.manage": {
  displayNameEs: "Administrar modulos por empresa",
  descriptionEs: "Permite habilitar o deshabilitar modulos instalados para una empresa especifica.",
  groupKey: "core",
  order: 41,
},
```

This also needs seeding into the `Permission` table — check `prisma/seed.js` for how `core.modules.read` (or a similarly-shaped existing key) gets seeded and add `core.modules.manage` the same way, then re-run `pnpm db:seed` (idempotent, safe to re-run).

The toggle is gated at `isSystemAdmin` only (not company-admin self-service) — deliberately, per this plan's stated scope: which modules a company is *entitled to* is a platform-level decision for now, consistent with the spec's SaaS-readiness framing (plans/billing will eventually govern this; building a separate "entitled vs. self-toggled" distinction now would be speculative).

- [ ] **Step 5: Syntax-check**

Run: `node --check apps/api/src/index.js`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/index.js apps/api/src/permission-catalog.js prisma/seed.js
git commit -m "feat(api): wire CompanyModule into runtime/modules, blueprints, and a system-admin toggle

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Identity roles — tenant scoping (5 routes)

**Files:** `apps/api/src/index.js` (roles routes, `apps/api/src/index.js:2036-2248` before this task's edits)

- [ ] **Step 1: Add the shared guard**

Immediately before `app.get("/identity/roles", ...)`:

```javascript
// A role is editable/deletable/listable-in-detail by: (a) a system admin, for
// any role, or (b) a company-scoped caller, only for a role that belongs to
// THEIR OWN company. System roles (companyId === null, e.g.
// atlas.admin/system.admin) are never touchable by a company-scoped caller,
// even one holding identity.roles.*/identity.permissions.* -- those
// permissions govern a company's own custom roles, not the platform's shared
// catalog. Returns null (→ 404 at the call site) rather than throwing, so
// existence is never confirmed/denied differently for an out-of-scope role.
async function loadCompanyEditableRole(id, tenant) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return null;
  if (tenant?.isSystemAdmin) return role;
  if (role.companyId && role.companyId === tenant?.companyId) return role;
  return null;
}
```

- [ ] **Step 2: `GET /identity/roles`** — list system roles + the caller's own company roles

```javascript
app.get(
  "/identity/roles",
  authMiddleware,
  requirePermission("identity.roles.read"),
  async (c) => {
    try {
      const tenant = c.get("tenantContext");
      const roles = await prisma.role.findMany({
        where: tenant.isSystemAdmin
          ? {}
          : { OR: [{ companyId: null }, { companyId: tenant.companyId }] },
        include: {
          permissions: {
            select: {
              permission: {
                select: { id: true, key: true, name: true, moduleId: true },
              },
            },
          },
          _count: { select: { memberships: { where: { enabled: true } } } },
        },
        orderBy: { name: "asc" },
      });
      return c.json({
        data: roles.map((role) => ({
          ...role,
          permissionKeys: role.permissions.map((p) => p.permission.key),
          memberCount: role._count.memberships,
        })),
      });
    } catch {
      return c.json({ error: "No se pudieron cargar los roles." }, 500);
    }
  },
);
```

- [ ] **Step 3: `POST /identity/roles`** — create as a company-scoped role

```javascript
app.post(
  "/identity/roles",
  authMiddleware,
  requirePermission("identity.roles.create"),
  async (c) => {
    try {
      const tenant = c.get("tenantContext");
      if (!tenant.companyId) {
        return c.json({ error: "Selecciona una empresa activa para crear un rol." }, 400);
      }
      const body = await c.req.json();
      const key = String(body.key ?? "").trim();
      const name = String(body.name ?? "").trim();
      const description = String(body.description ?? "").trim() || null;
      if (!key || !name)
        return c.json({ error: "key y name son obligatorios." }, 400);
      const role = await prisma.role.create({
        data: { key, name, description, system: false, enabled: true, companyId: tenant.companyId },
      });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "identity.role.create",
        severity: "success",
        entityType: "Role",
        entityId: role.id,
        summary: `${actorName} creó el rol "${role.name}"`,
      });
      return c.json({ data: role }, 201);
    } catch {
      return c.json({ error: "No se pudo crear el rol." }, 500);
    }
  },
);
```

(The old `if (["atlas.admin", "system.admin"].includes(role.key)) syncAdminRolesPermissions(...)` branch is removed — a company-scoped role can never collide with those keys now that they live under a different `(companyId, key)` tuple, and this endpoint no longer creates system roles at all.)

- [ ] **Step 4: `PUT /identity/roles/:id`, `PATCH /identity/roles/:id/enabled`, `PATCH /identity/roles/:id/permissions`** — same guard, same shape, apply to each

```javascript
app.put(
  "/identity/roles/:id",
  authMiddleware,
  requirePermission("identity.roles.update"),
  async (c) => {
    try {
      const tenant = c.get("tenantContext");
      const id = c.req.param("id");
      const existing = await loadCompanyEditableRole(id, tenant);
      if (!existing) return c.json({ error: "Rol no encontrado." }, 404);
      const body = await c.req.json();
      const name = String(body.name ?? "").trim();
      const description = String(body.description ?? "").trim() || null;
      if (!name) return c.json({ error: "name es obligatorio." }, 400);
      const role = await prisma.role.update({
        where: { id },
        data: { name, description },
      });
      cacheDelByPrefix("user_ctx:");
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "identity.role.update",
        severity: "info",
        entityType: "Role",
        entityId: id,
        summary: `${actorName} actualizó el rol "${role.name}"`,
      });
      return c.json({ data: role });
    } catch {
      return c.json({ error: "No se pudo actualizar el rol." }, 500);
    }
  },
);

app.patch(
  "/identity/roles/:id/enabled",
  authMiddleware,
  requirePermission("identity.roles.update"),
  async (c) => {
    try {
      const tenant = c.get("tenantContext");
      const id = c.req.param("id");
      const existing = await loadCompanyEditableRole(id, tenant);
      if (!existing) return c.json({ error: "Rol no encontrado." }, 404);
      const body = await c.req.json();
      const enabled = Boolean(body.enabled);
      const role = await prisma.role.update({
        where: { id },
        data: { enabled },
      });
      cacheDelByPrefix("user_ctx:");
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: role.enabled ? "identity.role.enable" : "identity.role.disable",
        severity: role.enabled ? "info" : "warning",
        entityType: "Role",
        entityId: id,
        summary: `${actorName} ${role.enabled ? "habilitó" : "deshabilitó"} el rol "${role.name}"`,
      });
      return c.json({ data: role });
    } catch {
      return c.json({ error: "No se pudo actualizar el estado del rol." }, 500);
    }
  },
);

app.patch(
  "/identity/roles/:id/permissions",
  authMiddleware,
  requirePermission("identity.permissions.update"),
  async (c) => {
    try {
      const tenant = c.get("tenantContext");
      const id = c.req.param("id");
      const existing = await loadCompanyEditableRole(id, tenant);
      if (!existing) return c.json({ error: "Rol no encontrado." }, 404);
      const body = await c.req.json();
      const permissionKeys = Array.isArray(body.permissionKeys)
        ? body.permissionKeys
        : [];
      const permissions = await prisma.permission.findMany({
        where: { key: { in: permissionKeys }, active: true },
        select: { id: true },
      });
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: id } }),
        ...(permissions.length
          ? [
              prisma.rolePermission.createMany({
                data: permissions.map((permission) => ({
                  roleId: id,
                  permissionId: permission.id,
                })),
              }),
            ]
          : []),
      ]);
      cacheDelByPrefix("user_ctx:");
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "identity.role.permissions.update",
        severity: "info",
        entityType: "Role",
        entityId: id,
        summary: `${actorName} actualizó los permisos del rol (${permissions.length})`,
      });
      return c.json({
        data: { roleId: id, permissionCount: permissions.length },
      });
    } catch {
      return c.json(
        { error: "No se pudieron actualizar los permisos del rol." },
        500,
      );
    }
  },
);
```

- [ ] **Step 5: `DELETE /identity/roles/:id`** — reuse the guard instead of its own `findUnique`, keep the existing system-role block as an extra layer

```javascript
app.delete(
  "/identity/roles/:id",
  authMiddleware,
  requirePermission("identity.roles.delete"),
  async (c) => {
    try {
      const tenant = c.get("tenantContext");
      const id = c.req.param("id");
      const role = await loadCompanyEditableRole(id, tenant);
      if (!role) return c.json({ error: "Rol no encontrado." }, 404);
      if (role.system || ADMIN_ROLE_KEYS.has(role.key)) {
        return c.json(
          { error: "No se puede eliminar un rol del sistema." },
          403,
        );
      }
      await prisma.role.delete({ where: { id } });
      cacheDelByPrefix("user_ctx:");
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "identity.role.delete",
        severity: "critical",
        entityType: "Role",
        entityId: id,
        summary: `${actorName} eliminó el rol "${role.key}"`,
      });
      return c.json({ ok: true });
    } catch {
      return c.json({ error: "No se pudo eliminar el rol." }, 500);
    }
  },
);
```

- [ ] **Step 6: Syntax-check and commit**

Run: `node --check apps/api/src/index.js`

```bash
git add apps/api/src/index.js
git commit -m "fix(identity): scope role list/create/update/enable/permissions/delete by company

Every /identity/roles/:id route previously had no check that the target
role belonged to the caller's active company (or was a system role only a
system admin may touch) — a company-scoped identity.roles.* holder could
edit or delete another company's custom role, or reconfigure atlas.admin's
own permission set.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Identity users — tenant scoping (10 routes)

**Files:** `apps/api/src/index.js`

- [ ] **Step 1: Add the shared helpers**

Immediately before `function buildIdentityUsersWhere` (`apps/api/src/index.js:751` before this task):

```javascript
// Returns true only if `id` names a UserProfile with an enabled Membership
// in `companyId`. Every /identity/users/:id* route must call this before
// reading or mutating a specific user — without it, a caller with
// identity.users.* in Company A could act on any user UUID in the instance.
async function assertUserInCompany(id, companyId) {
  if (!companyId || !id) return false;
  const row = await prisma.userProfile.findFirst({
    where: { id, memberships: { some: { enabled: true, companyId } } },
    select: { id: true },
  });
  return Boolean(row);
}

// Same check, batched: returns only the subset of `ids` that belong to
// companyId. Used by the bulk endpoints instead of erroring one at a time.
async function filterUserIdsInCompany(ids, companyId) {
  if (!ids.length || !companyId) return [];
  const rows = await prisma.userProfile.findMany({
    where: { id: { in: ids }, memberships: { some: { enabled: true, companyId } } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
```

- [ ] **Step 2: `buildIdentityUsersWhere` gains company scoping**

```javascript
function buildIdentityUsersWhere({ search, enabled, companyId }) {
  // Bot profiles (e.g. the per-company MeridIAn assistant, is_bot = true) have no
  // login and are not administrable users — never list them in the users screen
  // or in any user picker that reads this endpoint (chat "Anadir miembros",
  // CreateChatModal, etc.).
  const where = {
    isBot: false,
    memberships: { some: { enabled: true, companyId } },
  };
  if (typeof enabled === "boolean") {
    where.enabled = enabled;
  }
  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      {
        memberships: {
          some: {
            enabled: true,
            companyId,
            role: { name: { contains: search, mode: "insensitive" } },
          },
        },
      },
    ];
  }
  return where;
}
```

When `companyId` is `null` (the zero-membership edge case — an admin account with no company membership at all), `memberships.some({ companyId: null })` can never match any row, since `Membership.companyId` is `NOT NULL` — the query safely returns zero users rather than erroring or (worse) returning every instance user. A genuine "browse every user across every company" platform view for a companyId-less system admin is explicitly out of scope for this plan (see header).

- [ ] **Step 3: Update the 3 call sites** (`GET /identity/users`, `POST .../export/excel`, `POST .../export/pdf`) to pass `companyId`

At each of the three `buildIdentityUsersWhere(normalizedQuery)` call sites, change to:

```javascript
      const tenant = c.get("tenantContext");
      const where = buildIdentityUsersWhere({ ...normalizedQuery, companyId: tenant.companyId });
```

- [ ] **Step 4: `POST /identity/users`** — create uses the resolved `companyId`, and validates `roleId` belongs to the company (or is a system role)

```javascript
      const authUserId = authData.user.id;

      const tenant = c.get("tenantContext");
      const companyId = tenant.companyId;
      if (!companyId) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        return c.json(
          { error: "No se pudo determinar la empresa activa." },
          400,
        );
      }

      if (fields.roleId) {
        const role = await prisma.role.findUnique({ where: { id: fields.roleId }, select: { companyId: true } });
        if (!role || (role.companyId !== null && role.companyId !== companyId)) {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
          return c.json({ error: "El rol seleccionado no pertenece a esta empresa." }, 400);
        }
      }
```

(Everything after this — the `prisma.$transaction` creating the profile + membership — is unchanged, it already reads the same `companyId` local variable.)

- [ ] **Step 5: `PATCH /identity/users/bulk/enabled`** — filter to company members, reject if any requested id doesn't belong

```javascript
app.patch(
  "/identity/users/bulk/enabled",
  authMiddleware,
  requirePermission("identity.users.update"),
  async (c) => {
    try {
      const tenant = c.get("tenantContext");
      const body = await c.req.json();
      const ids = parseIdentityUserIds(body?.ids);
      const enabled = body?.enabled;
      if (!ids.length) {
        return c.json(
          { error: "Debes enviar al menos un usuario valido." },
          400,
        );
      }
      if (typeof enabled !== "boolean") {
        return c.json({ error: "El campo enabled es obligatorio." }, 400);
      }
      const validIds = await filterUserIdsInCompany(ids, tenant.companyId);
      if (validIds.length !== ids.length) {
        return c.json({ error: "Uno o mas usuarios no pertenecen a tu empresa." }, 403);
      }
      const result = await prisma.userProfile.updateMany({
        where: { id: { in: validIds } },
        data: { enabled },
      });
      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: enabled
          ? "identity.user.bulk_enable"
          : "identity.user.bulk_disable",
        severity: enabled ? "info" : "warning",
        entityType: "UserProfile",
        summary: `${actorName} ${enabled ? "habilitó" : "deshabilitó"} ${result.count} usuario(s)`,
      });
      return c.json({ data: { count: result.count, enabled } });
    } catch {
      return c.json(
        { error: "No se pudo actualizar el estado de los usuarios." },
        500,
      );
    }
  },
);
```

- [ ] **Step 6: `DELETE /identity/users/bulk`** — same pattern

```javascript
app.delete(
  "/identity/users/bulk",
  authMiddleware,
  requirePermission("identity.users.delete"),
  async (c) => {
    try {
      const tenant = c.get("tenantContext");
      const body = await c.req.json();
      const ids = parseIdentityUserIds(body?.ids);
      if (!ids.length) {
        return c.json(
          { error: "Debes enviar al menos un usuario valido." },
          400,
        );
      }

      const context = c.get("userContext");
      if (ids.includes(context?.profile?.id)) {
        return c.json({ error: "No puedes eliminar tu propia cuenta." }, 400);
      }

      const validIds = await filterUserIdsInCompany(ids, tenant.companyId);
      if (validIds.length !== ids.length) {
        return c.json({ error: "Uno o mas usuarios no pertenecen a tu empresa." }, 403);
      }

      const users = await prisma.userProfile.findMany({
        where: { id: { in: validIds } },
        select: {
          id: true,
          authUserId: true,
          memberships: {
            where: { enabled: true },
            select: {
              enabled: true,
              role: { select: { key: true } },
            },
          },
        },
      });
      if (!users.length) {
        return c.json({ data: { count: 0 } });
      }
      if (users.some(hasProtectedIdentityAdminRole)) {
        return c.json(
          {
            error:
              "No se pueden eliminar usuarios con rol Atlas Admin o System Admin.",
          },
          400,
        );
      }

      for (const user of users) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(
          user.authUserId,
        );
        if (error) {
          return c.json(
            { error: "No se pudo eliminar uno o mas usuarios en Auth." },
            500,
          );
        }
      }

      const deleted = await prisma.userProfile.deleteMany({
        where: { id: { in: users.map((user) => user.id) } },
      });
      for (const user of users) {
        cacheDel(`user_ctx:${user.authUserId}`);
      }

      const { actorName } = getActivityContext(c);
      await publishActivityFromContext(prisma, c, {
        type: "identity.user.bulk_delete",
        severity: "critical",
        entityType: "UserProfile",
        summary: `${actorName} eliminó ${deleted.count} usuario(s)`,
      });

      return c.json({ data: { count: deleted.count } });
    } catch {
      return c.json({ error: "No se pudieron eliminar los usuarios." }, 500);
    }
  },
);
```

- [ ] **Step 7: `DELETE /identity/users/:id` and `PATCH /identity/users/:id`** — add the single-id guard right after resolving `id`

For `DELETE /identity/users/:id`, immediately after `const id = c.req.param("id");` and the existing self-delete check:

```javascript
      const tenant = c.get("tenantContext");
      if (!(await assertUserInCompany(id, tenant.companyId))) {
        return c.json({ error: "Usuario no encontrado." }, 404);
      }
```

For `PATCH /identity/users/:id`, immediately after `const id = c.req.param("id");`:

```javascript
      const tenant = c.get("tenantContext");
      if (!(await assertUserInCompany(id, tenant.companyId))) {
        return c.json({ error: "Usuario no encontrado." }, 404);
      }
```

- [ ] **Step 8: `POST /identity/users/:id/avatar` and `GET /identity/users/:id/avatar/signed-url`** — same guard, replacing the existing `findUnique` existence check

```javascript
app.post(
  "/identity/users/:id/avatar",
  authMiddleware,
  requirePermission("identity.users.update"),
  async (c) => {
    try {
      const tenant = c.get("tenantContext");
      const id = c.req.param("id");
      const target = await prisma.userProfile.findFirst({
        where: { id, memberships: { some: { enabled: true, companyId: tenant.companyId } } },
        select: { id: true, authUserId: true },
      });
      if (!target) return c.json({ error: "Usuario no encontrado." }, 404);

      const body = await c.req.parseBody();
      const file = body.avatar;
      if (!(file instanceof File) || file.size <= 0) {
        return c.json({ error: "Selecciona una imagen valida." }, 400);
      }
      if (file.size > 10 * 1024 * 1024) {
        return c.json({ error: "La imagen no puede superar 10 MB." }, 400);
      }
      if (!file.type.startsWith("image/")) {
        return c.json({ error: "Solo se permiten imagenes." }, 400);
      }

      const asset = await uploadIdentityAvatar({ profileId: target.id, file });
      cacheDel(`user_ctx:${target.authUserId}`);
      const avatarUrl = await getSignedUrlByFileId(asset.id, "card");
      return c.json({ data: { avatarUrl, avatarFileId: asset.id } });
    } catch {
      return c.json(
        { error: "No se pudo actualizar el avatar del usuario." },
        500,
      );
    }
  },
);

app.get(
  "/identity/users/:id/avatar/signed-url",
  authMiddleware,
  requirePermission("identity.users.read"),
  async (c) => {
    try {
      const tenant = c.get("tenantContext");
      const id = c.req.param("id");
      const target = await prisma.userProfile.findFirst({
        where: { id, memberships: { some: { enabled: true, companyId: tenant.companyId } } },
        select: { avatarFileId: true },
      });
      if (!target) return c.json({ error: "Usuario no encontrado." }, 404);
      const variant = c.req.query("variant") || "full";
      const signedUrl = await getSignedUrlByFileId(target.avatarFileId, variant);
      return c.json({ data: { signedUrl } });
    } catch {
      return c.json(
        { error: "No se pudo generar el enlace del avatar." },
        500,
      );
    }
  },
);
```

- [ ] **Step 9: Syntax-check**

Run: `node --check apps/api/src/index.js`

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/index.js
git commit -m "fix(identity): scope every /identity/users route by the active company

GET/POST/bulk-enable/bulk-delete/:id GET-DELETE-PATCH/avatar routes had no
company-membership check at all beyond the caller's own permission —
identity.users.* in Company A could read, disable, delete, or reassign the
avatar of any user in the entire instance. Also fixes the chat 'add
member' picker's cross-tenant user-enumeration leak found during the
Plan 1 audit, since it reuses GET /identity/users.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Verification

- [ ] **New/changed unit test suites**

Run: `node --test apps/api/src/services/__tests__/company-module-service.test.js apps/api/src/services/__tests__/hr-service-cross-tenant.test.js`
Expected: PASS, 0 failures.

- [ ] **Full API service regression suite**

Run: `node --test apps/api/src/services/__tests__/*.test.js`
Expected: same pass/fail baseline as after Plan 1/2 (322 pass / 2 pre-existing skip), plus the new tests from this plan.

- [ ] **`node --check` every touched file**

Run: `node --check apps/api/src/index.js && node --check apps/api/src/services/hr-service.js && node --check apps/api/src/services/company-module-service.js && node --check prisma/seed.js`

- [ ] **Lint**

Run: `pnpm lint`

- [ ] **API boots cleanly against the migrated schema**

Run `pnpm dev:api` briefly and confirm `Atlas API running on http://localhost:4010` prints with no uncaught exceptions before stopping it (port conflicts with an already-running dev server are expected and not a failure of this check, per Plan 1's same verification step).

- [ ] **Manual/DB-level spot check (no browser needed)**

Run: `npx prisma migrate status` (expect up to date) and, via `pnpm db:studio` or a one-off `node -e` script using `PrismaClient`, confirm: `role` table has exactly the 4 pre-existing rows all with `company_id = NULL`; `company_module` has one row per `(existing company, installed module)` pair with `enabled = true`.

- [ ] **Known limitation, stated explicitly:** no live end-to-end HTTP test (real JWT, seeded two-company DB) exists yet for any of these routes — that is Plan 4's mandatory cross-tenant security-test suite, which should specifically target the endpoints this plan touches (`/identity/users/:id`, `/identity/roles/:id`, the bulk endpoints) since they are exactly the "GET/UPDATE/DELETE by known id" pattern the suite is required to cover.
