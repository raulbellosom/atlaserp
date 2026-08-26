-- =============================================================================
-- Atlas ERP — Chat Moderation RLS + missing FK (follow-up to 20260828000000)
-- Migration: 20260828010000_chat_moderation_rls
-- =============================================================================

-- chat_blocks / chat_reports: no direct user access — API only (service role
-- bypasses RLS), same pattern as chat_guest_sessions
ALTER TABLE "chat_blocks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_blocks_no_access" ON "chat_blocks"
  FOR ALL USING (false);

CREATE POLICY "chat_blocks_service_all" ON "chat_blocks"
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE "chat_reports" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_reports_no_access" ON "chat_reports"
  FOR ALL USING (false);

CREATE POLICY "chat_reports_service_all" ON "chat_reports"
  FOR ALL USING (auth.role() = 'service_role');

-- chat_reports.reviewed_by_user_id had no referential integrity — add the
-- missing FK. ON DELETE SET NULL: deleting the reviewing admin should clear
-- who resolved the report, not delete the report itself.
ALTER TABLE "chat_reports"
  ADD CONSTRAINT "chat_reports_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "user_profile"("id") ON DELETE SET NULL;
