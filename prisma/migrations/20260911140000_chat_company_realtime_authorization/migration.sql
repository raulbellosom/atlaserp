-- Extends Realtime Authorization (spec §10, see
-- docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md) from
-- notes to the chat/company broadcast+presence channels that don't already
-- go through a source-table postgres_changes subscription:
--   user:<profileId>:events        (self-only; API pushes via service_role)
--   chat:presence:<conversationId> (typing + presence; client sends+receives)
--   chat:company:<companyId>       (external-support inbox; operator receive-only)
--   company:<companyId>:presence   (org-wide presence; client sends+receives)
--   company:<companyId>:events     (org-wide broadcast; client receive-only)
--
-- realtime.messages already has RLS enabled (from the notes migration) — this
-- only adds policies for these additional topic prefixes.
--
-- Reuses the existing public.chat_is_member(uuid) SECURITY DEFINER function
-- (already backing chat_messages/chat_conversations/call RLS since the
-- original atlas.chat build) for the conversation-scoped policy, and adds a
-- new public.company_is_member(uuid) of the same shape for company-scoped
-- ones, plus public.current_profile_id() as a small shared helper.
--
-- Deliberately NOT covered here: chat:conv:<conversationId>. Both the
-- authenticated operator (chat_is_member) AND the anonymous storefront guest
-- widget (packages/storefront-sdk/guestChat.js, no Supabase Auth session at
-- all — pure anon key) subscribe to this exact topic to RECEIVE messages;
-- every guest WRITE already goes through session-token-checked REST
-- endpoints (guest-service.js), never a direct client-side channel.send(), so
-- there is no send-side gap. But there is no guest-side identity to check on
-- receive either — `private: true` would gain nothing over the current
-- unguessable-conversationId model without a real guest Realtime auth
-- mechanism (e.g. minted per-session guest JWTs), which is a separate,
-- larger piece of work. Left as a tracked, explicit gap, not silently closed.

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.user_profile WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.company_is_member(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membership m
    WHERE m.company_id = p_company_id
      AND m.user_id = public.current_profile_id()
      AND m.enabled = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.current_profile_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.company_is_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.company_is_member(uuid) TO authenticated, anon;

-- user:<uuid>:events — receive-only, self.
CREATE POLICY "user_events_receive" ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^user:[0-9a-fA-F-]{36}:events$'
  AND substring(realtime.topic() FROM 6 FOR 36)::uuid = public.current_profile_id()
);

-- chat:presence:<uuid> — typing + online presence, conversation members only.
CREATE POLICY "chat_presence_receive" ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^chat:presence:[0-9a-fA-F-]{36}$'
  AND public.chat_is_member(substring(realtime.topic() FROM 15)::uuid)
);

CREATE POLICY "chat_presence_send" ON "realtime"."messages"
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() ~ '^chat:presence:[0-9a-fA-F-]{36}$'
  AND public.chat_is_member(substring(realtime.topic() FROM 15)::uuid)
);

-- chat:company:<uuid> — external-support inbox, operator receive-only.
CREATE POLICY "chat_company_receive" ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^chat:company:[0-9a-fA-F-]{36}$'
  AND public.company_is_member(substring(realtime.topic() FROM 14)::uuid)
);

-- company:<uuid>:presence — org-wide online presence.
CREATE POLICY "company_presence_receive" ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^company:[0-9a-fA-F-]{36}:presence$'
  AND public.company_is_member(substring(realtime.topic() FROM 9 FOR 36)::uuid)
);

CREATE POLICY "company_presence_send" ON "realtime"."messages"
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() ~ '^company:[0-9a-fA-F-]{36}:presence$'
  AND public.company_is_member(substring(realtime.topic() FROM 9 FOR 36)::uuid)
);

-- company:<uuid>:events — org-wide broadcast (POS/Calendar/etc.), receive-only.
CREATE POLICY "company_events_receive" ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^company:[0-9a-fA-F-]{36}:events$'
  AND public.company_is_member(substring(realtime.topic() FROM 9 FOR 36)::uuid)
);
