-- Add owner_id to ledger_category.
-- NULL = system category visible to all users in the company.
-- UUID = personal category scoped to one user.
ALTER TABLE ledger_category
  ADD COLUMN IF NOT EXISTS owner_id UUID NULL
  REFERENCES user_profile(id) ON DELETE SET NULL;

-- Index for user-scoped lookups
CREATE INDEX IF NOT EXISTS idx_ledger_category_owner
  ON ledger_category(owner_id)
  WHERE owner_id IS NOT NULL;

-- Partial unique index so system category names are unique per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_category_system_name
  ON ledger_category(company_id, name)
  WHERE owner_id IS NULL;
