-- ledger collaboration: groups, members, account members
-- Safe to run multiple times thanks to IF NOT EXISTS / IF EXISTS guards.

-- 1. New tables must be created before altering ledger_account (FK target).

CREATE TABLE IF NOT EXISTS "ledger_group" (
  "id"          UUID        NOT NULL DEFAULT uuidv7(),
  "company_id"  UUID        NOT NULL,
  "name"        TEXT        NOT NULL,
  "created_by"  UUID,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enabled"     BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT "ledger_group_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ledger_group_company_id_idx"
  ON "ledger_group"("company_id");

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ledger_group_member" (
  "id"          UUID        NOT NULL DEFAULT uuidv7(),
  "group_id"    UUID        NOT NULL,
  "user_id"     UUID        NOT NULL,
  "role"        TEXT        NOT NULL DEFAULT 'viewer',
  "invited_by"  UUID,
  "invited_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"      TEXT        NOT NULL DEFAULT 'active',
  CONSTRAINT "ledger_group_member_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_group_member_group_user_key" UNIQUE ("group_id", "user_id"),
  CONSTRAINT "ledger_group_member_role_check" CHECK (role IN ('viewer', 'editor', 'admin')),
  CONSTRAINT "ledger_group_member_status_check" CHECK (status IN ('active', 'rejected')),
  CONSTRAINT "ledger_group_member_group_fk" FOREIGN KEY ("group_id")
    REFERENCES "ledger_group"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ledger_group_member_user_id_idx"
  ON "ledger_group_member"("user_id");

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ledger_account_member" (
  "id"          UUID        NOT NULL DEFAULT uuidv7(),
  "account_id"  UUID        NOT NULL,
  "user_id"     UUID        NOT NULL,
  "role"        TEXT        NOT NULL DEFAULT 'viewer',
  "invited_by"  UUID,
  "invited_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"      TEXT        NOT NULL DEFAULT 'active',
  CONSTRAINT "ledger_account_member_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_account_member_account_user_key" UNIQUE ("account_id", "user_id"),
  CONSTRAINT "ledger_account_member_role_check" CHECK (role IN ('viewer', 'editor')),
  CONSTRAINT "ledger_account_member_status_check" CHECK (status IN ('active', 'rejected')),
  CONSTRAINT "ledger_account_member_account_fk" FOREIGN KEY ("account_id")
    REFERENCES "ledger_account"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ledger_account_member_user_id_idx"
  ON "ledger_account_member"("user_id");

-- ──────────────────────────────────────────────────────────────────────────────

-- 2. Add ownership columns to ledger_account.
--    owner_id = NULL means legacy account visible to all company members.
--    group_id = NULL means personal account; non-null = belongs to a group.

ALTER TABLE "ledger_account"
  ADD COLUMN IF NOT EXISTS "owner_id"  UUID,
  ADD COLUMN IF NOT EXISTS "group_id"  UUID;

-- FK from ledger_account.group_id → ledger_group.id (add only if not already there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ledger_account_group_fk'
  ) THEN
    ALTER TABLE "ledger_account"
      ADD CONSTRAINT "ledger_account_group_fk"
      FOREIGN KEY ("group_id") REFERENCES "ledger_group"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Drop the old company-wide unique name constraint; personal accounts from
-- different users can share the same name, so the old constraint is wrong.
DROP INDEX IF EXISTS "ledger_account_company_id_name_key";

-- Partial unique index for legacy accounts (owner_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_account_legacy_name_key"
  ON "ledger_account"("company_id", "name")
  WHERE "owner_id" IS NULL;
