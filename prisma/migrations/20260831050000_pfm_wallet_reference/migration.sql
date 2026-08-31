-- atlas.pfm: optional wallet reference (last 4 digits / a nickname).
ALTER TABLE "pfm_wallet" ADD COLUMN "reference" VARCHAR(40);
