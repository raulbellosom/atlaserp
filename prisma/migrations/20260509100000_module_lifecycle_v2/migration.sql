-- Migration: module_lifecycle_v2
-- Adds active + moduleKey to Permission, lifecycleConfig to AtlasModule

ALTER TABLE "Permission" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Permission" ADD COLUMN "moduleKey" TEXT;
ALTER TABLE "AtlasModule" ADD COLUMN "lifecycleConfig" JSONB;
