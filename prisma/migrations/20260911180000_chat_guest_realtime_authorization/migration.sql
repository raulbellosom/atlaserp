-- Closes the last deliberately-deferred Realtime Authorization gap from
-- migration 20260911140000_chat_company_realtime_authorization: the
-- chat:conv:<conversationId> channel, received by BOTH the authenticated
-- operator (already covered by chat_is_member) and the anonymous storefront
-- guest widget (packages/storefront-sdk), which has no Supabase Auth session
-- at all.
--
-- Raul's decision (2026-09-11): mint a short-lived, self-signed JWT per
-- guest session (apps/api/src/routes/chat/guest-service.js
-- mintGuestRealtimeToken, same SUPABASE_JWT_SECRET Realtime already trusts),
-- carrying a `guest_session_id` claim, returned alongside the guest's own
-- session token and re-minted on every guest REST call (matching the
-- session's own 30-minute idle-expiry renewal — no separate refresh loop
-- needed). This function checks that claim against chat_conversation_members
-- instead of auth.uid() (which a guest, having no real Supabase Auth
-- session, can never populate meaningfully).
--
-- role: authenticated is safe for this token: every existing authenticated-
-- role policy in this schema keys off auth.uid() resolving to a real
-- user_profile.auth_user_id via current_profile_id()/chat_is_member/
-- company_is_member, and a guest token's `sub` (the guest session id) can
-- never match one — those policies simply evaluate to false for a guest
-- token, same as for any other unrelated authenticated caller.
--
-- Receive-only: the guest widget never sends a broadcast directly (every
-- guest write goes through session-token-checked REST endpoints, which
-- broadcast server-side via service_role, bypassing RLS entirely) — so no
-- INSERT policy is needed here, matching chat:company's shape.

CREATE OR REPLACE FUNCTION public.chat_guest_is_member(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_conversation_members ccm
    JOIN public.chat_guest_sessions cgs ON cgs.id = ccm.guest_session_id
    WHERE ccm.conversation_id = p_conversation_id
      AND ccm.left_at IS NULL
      AND cgs.closed_at IS NULL
      AND cgs.id::text = (current_setting('request.jwt.claims', true)::jsonb ->> 'guest_session_id')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.chat_guest_is_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_guest_is_member(uuid) TO authenticated;

CREATE POLICY "chat_conv_receive" ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^chat:conv:[0-9a-fA-F-]{36}$'
  AND (
    public.chat_is_member(substring(realtime.topic() FROM 11)::uuid)
    OR public.chat_guest_is_member(substring(realtime.topic() FROM 11)::uuid)
  )
);
