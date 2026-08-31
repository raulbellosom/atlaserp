-- atlas.pfm: investment wallet fields + yield movement flag.
ALTER TABLE "pfm_wallet" ADD COLUMN "expected_rate" DECIMAL(6,4);
ALTER TABLE "pfm_wallet" ADD COLUMN "last_accrued_on" DATE;
ALTER TABLE "pfm_movement" ADD COLUMN "is_yield" BOOLEAN NOT NULL DEFAULT false;
