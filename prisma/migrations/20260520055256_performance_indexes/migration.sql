-- Performance indexes: reduce sequential scans on hot query paths
-- Blueprint: moduleId and enabled are filtered on every /blueprints request
CREATE INDEX IF NOT EXISTS "Blueprint_moduleId_idx" ON "Blueprint"("moduleId");
CREATE INDEX IF NOT EXISTS "Blueprint_enabled_idx" ON "Blueprint"("enabled");

-- AtlasModule: (status, enabled) is filtered by route-loader and /blueprints on every boot/request
CREATE INDEX IF NOT EXISTS "AtlasModule_status_enabled_idx" ON "AtlasModule"("status", "enabled");

-- Permission: moduleId queried in permission catalog listing; active filtered in auth middleware
CREATE INDEX IF NOT EXISTS "Permission_moduleId_idx" ON "Permission"("moduleId");
CREATE INDEX IF NOT EXISTS "Permission_active_idx" ON "Permission"("active");
