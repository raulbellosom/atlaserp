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
-- explicitly disables it via the new CompanyModule endpoints.
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
