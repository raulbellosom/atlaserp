-- The `notification` table had RLS disabled AND no grants to
-- authenticated/anon at all (relacl IS NULL — confirmed empirically:
-- `SET ROLE authenticated; SELECT ... FROM notification` raised "permission
-- denied for schema public"). RealtimeProvider.jsx subscribes to
-- `pg-notifications-<userId>` (postgres_changes, filter user_id=eq.<userId>)
-- to get a live nudge when a new notification arrives — with no grant at
-- all, that subscription has always failed closed (not an active leak, but
-- also simply non-functional; the notification bell falls back entirely to
-- the separate `notification.new` broadcast on `user:<id>:events`, already
-- covered by migration 20260911140000).
--
-- Fix: same shape as the pre-existing chat_messages/call/call_participant
-- policies (SELECT granted to authenticated, RLS restricting to the caller's
-- own rows via current_profile_id() from migration 20260911140000). No
-- INSERT/UPDATE/DELETE grant needed — every write to `notification` goes
-- through the API's own privileged connection (which bypasses RLS as the
-- table owner), never a client-side Supabase call.

ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.notification TO authenticated;

CREATE POLICY "notification_owner_select" ON public.notification
FOR SELECT
TO authenticated
USING (user_id = public.current_profile_id());
