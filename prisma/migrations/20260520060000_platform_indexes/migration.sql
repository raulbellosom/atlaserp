-- Performance indexes: hot query paths for Membership and Contact
-- Membership: (userId, enabled) is the hot path for getUserContextByAuthId on every auth cache miss
CREATE INDEX IF NOT EXISTS "Membership_userId_enabled_idx" ON "Membership"("userId", "enabled");
-- Membership: companyId for company-scoped membership queries
CREATE INDEX IF NOT EXISTS "Membership_companyId_idx" ON "Membership"("companyId");
-- Contact: (companyId, enabled) for all contact list queries scoped by company
CREATE INDEX IF NOT EXISTS "Contact_companyId_enabled_idx" ON "Contact"("companyId", "enabled");
