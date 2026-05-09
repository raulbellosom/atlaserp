-- Baseline: AddForeignKey
-- This FK was applied to the database as part of the atlas_ledger migration
-- but was removed from that migration file after application.
-- This migration records it formally in the migration history.

ALTER TABLE "HrEmployee" ADD CONSTRAINT "HrEmployee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
