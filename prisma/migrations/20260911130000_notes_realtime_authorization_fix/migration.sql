-- Forward fix for 20260911120000_notes_realtime_authorization: the policies
-- there queried public.notes / public.user_profile / public.note_shares
-- directly, but the `authenticated`/`anon` Postgres roles (the ones Realtime
-- evaluates RLS as) have no GRANTs on those tables — this app deliberately
-- keeps them inaccessible via PostgREST, routing all access through the
-- privileged API connection instead. Under RLS, "no grant" means the
-- subquery itself errors ("permission denied for schema public"), so every
-- private-channel join would have failed outright, not just been correctly
-- gated. Granting raw SELECT to authenticated/anon to fix that would newly
-- expose those tables to any PostgREST caller, which is worse than the gap
-- this was meant to close.
--
-- Fix: replace the inline joins with SECURITY DEFINER helper functions.
-- Each function only returns a boolean — the caller (authenticated/anon)
-- never gets table access, only the yes/no answer, evaluated with the
-- function owner's (superuser) privileges.

CREATE OR REPLACE FUNCTION public.notes_realtime_can_access(p_note_id uuid, p_require_edit boolean)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notes n
    JOIN public.user_profile up ON up.auth_user_id = auth.uid()
    WHERE n.id = p_note_id
      AND (
        n.owner_user_id = up.id
        OR EXISTS (
          SELECT 1 FROM public.note_shares ns
          WHERE ns.note_id = n.id
            AND ns.shared_with_user_id = up.id
            AND (NOT p_require_edit OR ns.permission = 'edit')
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.notes_realtime_is_public(p_note_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.notes WHERE id = p_note_id AND is_public = true);
$$;

REVOKE EXECUTE ON FUNCTION public.notes_realtime_can_access(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notes_realtime_is_public(uuid) FROM PUBLIC;
-- Both granted to `anon` too: Postgres does not guarantee left-to-right
-- short-circuit evaluation of the OR in note_canvas_receive below, so a
-- missing grant on either function could intermittently deny an anon caller
-- with a "permission denied for function" error instead of a clean false.
-- notes_realtime_can_access is safe for anon to call: auth.uid() resolves to
-- NULL for an anon connection, so the user_profile join never matches and it
-- always returns false — no data exposure, just a boolean no.
GRANT EXECUTE ON FUNCTION public.notes_realtime_can_access(uuid, boolean) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.notes_realtime_is_public(uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "note_ydoc_receive" ON "realtime"."messages";
DROP POLICY IF EXISTS "note_ydoc_send" ON "realtime"."messages";
DROP POLICY IF EXISTS "note_canvas_receive" ON "realtime"."messages";
DROP POLICY IF EXISTS "note_canvas_send" ON "realtime"."messages";

CREATE POLICY "note_ydoc_receive" ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^note:ydoc:[0-9a-fA-F-]{36}$'
  AND public.notes_realtime_can_access(substring(realtime.topic() FROM 11)::uuid, false)
);

CREATE POLICY "note_ydoc_send" ON "realtime"."messages"
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() ~ '^note:ydoc:[0-9a-fA-F-]{36}$'
  AND public.notes_realtime_can_access(substring(realtime.topic() FROM 11)::uuid, true)
);

CREATE POLICY "note_canvas_receive" ON "realtime"."messages"
FOR SELECT
TO anon, authenticated
USING (
  realtime.topic() ~ '^note:canvas:[0-9a-fA-F-]{36}$'
  AND (
    public.notes_realtime_is_public(substring(realtime.topic() FROM 13)::uuid)
    OR (
      auth.role() = 'authenticated'
      AND public.notes_realtime_can_access(substring(realtime.topic() FROM 13)::uuid, false)
    )
  )
);

CREATE POLICY "note_canvas_send" ON "realtime"."messages"
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() ~ '^note:canvas:[0-9a-fA-F-]{36}$'
  AND public.notes_realtime_can_access(substring(realtime.topic() FROM 13)::uuid, true)
);
