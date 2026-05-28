ALTER TABLE "atlas_module" ADD COLUMN "has_bundle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "atlas_module" ADD COLUMN "bundle_hash" TEXT;
