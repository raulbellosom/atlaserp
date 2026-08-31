-- atlas.pfm: mark reconciliation ("Ajustar saldo") movements so summary
-- aggregates can exclude them while balances still count them.
ALTER TABLE "pfm_movement" ADD COLUMN "is_adjustment" BOOLEAN NOT NULL DEFAULT false;
