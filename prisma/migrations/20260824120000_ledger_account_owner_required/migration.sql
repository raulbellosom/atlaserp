-- Security fix: atlas.ledger accounts must always have an owner.
--
-- Migration 20260605000000_add_ledger_collaboration_tables introduced owner_id
-- as nullable, explicitly documenting "owner_id = NULL means legacy account
-- visible to all company members" as a migration-compat bridge. That bridge
-- was never followed up with an ownership backfill, so any account left with
-- owner_id IS NULL is READABLE AND WRITABLE by every member of the company
-- (see ledger-service.js listAccounts/getAccount/canWriteAccount, all of which
-- OR owner_id IS NULL into their access check). This is a real data-exposure
-- bug for a personal/shared financial ledger, not an intended feature — the
-- module already has explicit sharing via ledger_account_member and
-- ledger_group_member, so an implicit "shared with everyone" fallback is
-- both redundant and unsafe.
--
-- Fix: backfill any remaining owner_id IS NULL rows to the earliest active
-- atlas.admin member of that company (deterministic, no data guessing), fall
-- back to the earliest active member of any role if no admin exists, then
-- enforce NOT NULL going forward. The application-layer fallback clauses are
-- removed in the same change (see apps/api/src/routes/ledger/ledger-service.js).

UPDATE "ledger_account" a
SET "owner_id" = (
  SELECT m."user_id"
  FROM "membership" m
  JOIN "role" r ON r."id" = m."role_id"
  WHERE m."company_id" = a."company_id"
    AND m."enabled" = true
    AND r."key" = 'atlas.admin'
  ORDER BY m."created_at" ASC
  LIMIT 1
)
WHERE a."owner_id" IS NULL;

UPDATE "ledger_account" a
SET "owner_id" = (
  SELECT m."user_id"
  FROM "membership" m
  WHERE m."company_id" = a."company_id"
    AND m."enabled" = true
  ORDER BY m."created_at" ASC
  LIMIT 1
)
WHERE a."owner_id" IS NULL;

-- Obsolete now that owner_id can never be NULL again.
DROP INDEX IF EXISTS "ledger_account_legacy_name_key";

ALTER TABLE "ledger_account"
  ALTER COLUMN "owner_id" SET NOT NULL;
