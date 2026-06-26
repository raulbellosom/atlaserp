-- =============================================================================
-- Atlas ERP — Chat Module Tables
-- Migration: 20260625000000_add_chat_tables
-- =============================================================================

-- ---------------------------------------------------------------------------
-- chat_conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_conversations" (
  "id"                   UUID        NOT NULL DEFAULT uuidv7(),
  "type"                 TEXT        NOT NULL DEFAULT 'direct',
  "title"                TEXT,
  "avatar_url"           TEXT,
  "created_by_user_id"   UUID,
  "created_by_guest_id"  UUID,
  "website_id"           UUID,
  "company_id"           UUID,
  "status"               TEXT        NOT NULL DEFAULT 'open',
  "last_message_id"      UUID,
  "last_message_at"      TIMESTAMPTZ,
  "metadata"             JSONB       NOT NULL DEFAULT '{}',
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at"           TIMESTAMPTZ,

  CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_conversations_type_check"
    CHECK ("type" IN ('direct', 'group', 'external_support')),
  CONSTRAINT "chat_conversations_status_check"
    CHECK ("status" IN ('open', 'pending', 'closed', 'archived'))
);

CREATE INDEX "chat_conversations_created_by_user_id_idx"
  ON "chat_conversations" ("created_by_user_id")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "chat_conversations_status_idx"
  ON "chat_conversations" ("status")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "chat_conversations_last_message_at_idx"
  ON "chat_conversations" ("last_message_at" DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- chat_guest_sessions  (referenced by conversation members and messages)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_guest_sessions" (
  "id"                   UUID        NOT NULL DEFAULT uuidv7(),
  "session_token_hash"   TEXT        NOT NULL,
  "email"                TEXT,
  "name"                 TEXT,
  "phone"                TEXT,
  "website_id"           UUID,
  "page_url"             TEXT,
  "referrer"             TEXT,
  "user_agent"           TEXT,
  "metadata"             JSONB       NOT NULL DEFAULT '{}',
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "last_seen_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at"           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  "closed_at"            TIMESTAMPTZ,

  CONSTRAINT "chat_guest_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_guest_sessions_token_hash_key" UNIQUE ("session_token_hash")
);

CREATE INDEX "chat_guest_sessions_email_idx"
  ON "chat_guest_sessions" ("email")
  WHERE "email" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- chat_conversation_members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_conversation_members" (
  "id"                   UUID        NOT NULL DEFAULT uuidv7(),
  "conversation_id"      UUID        NOT NULL,
  "user_id"              UUID,
  "guest_session_id"     UUID,
  "role"                 TEXT        NOT NULL DEFAULT 'member',
  "joined_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "left_at"              TIMESTAMPTZ,
  "muted_until"          TIMESTAMPTZ,
  "last_read_at"         TIMESTAMPTZ,
  "last_read_message_id" UUID,
  "metadata"             JSONB       NOT NULL DEFAULT '{}',

  CONSTRAINT "chat_conversation_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_conversation_members_conversation_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_conversation_members_role_check"
    CHECK ("role" IN ('owner', 'admin', 'member', 'operator', 'guest'))
);

CREATE UNIQUE INDEX "chat_conversation_members_user_conv_idx"
  ON "chat_conversation_members" ("conversation_id", "user_id")
  WHERE "user_id" IS NOT NULL AND "left_at" IS NULL;

CREATE UNIQUE INDEX "chat_conversation_members_guest_conv_idx"
  ON "chat_conversation_members" ("conversation_id", "guest_session_id")
  WHERE "guest_session_id" IS NOT NULL AND "left_at" IS NULL;

CREATE INDEX "chat_conversation_members_user_id_idx"
  ON "chat_conversation_members" ("user_id")
  WHERE "user_id" IS NOT NULL AND "left_at" IS NULL;

CREATE INDEX "chat_conversation_members_guest_session_id_idx"
  ON "chat_conversation_members" ("guest_session_id")
  WHERE "guest_session_id" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id"               UUID        NOT NULL DEFAULT uuidv7(),
  "conversation_id"  UUID        NOT NULL,
  "sender_user_id"   UUID,
  "sender_guest_id"  UUID,
  "sender_type"      TEXT        NOT NULL DEFAULT 'user',
  "body"             TEXT        NOT NULL DEFAULT '',
  "message_type"     TEXT        NOT NULL DEFAULT 'text',
  "attachment_count" INT         NOT NULL DEFAULT 0,
  "metadata"         JSONB       NOT NULL DEFAULT '{}',
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "edited_at"        TIMESTAMPTZ,
  "deleted_at"       TIMESTAMPTZ,

  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_messages_conversation_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_messages_sender_type_check"
    CHECK ("sender_type" IN ('user', 'guest', 'system')),
  CONSTRAINT "chat_messages_message_type_check"
    CHECK ("message_type" IN ('text', 'image', 'file', 'system'))
);

CREATE INDEX "chat_messages_conversation_id_created_at_idx"
  ON "chat_messages" ("conversation_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

CREATE INDEX "chat_messages_sender_user_id_idx"
  ON "chat_messages" ("sender_user_id")
  WHERE "sender_user_id" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- chat_message_reads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_message_reads" (
  "id"               UUID        NOT NULL DEFAULT uuidv7(),
  "message_id"       UUID        NOT NULL,
  "conversation_id"  UUID        NOT NULL,
  "user_id"          UUID,
  "guest_session_id" UUID,
  "read_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "chat_message_reads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_message_reads_message_fkey"
    FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "chat_message_reads_user_msg_idx"
  ON "chat_message_reads" ("message_id", "user_id")
  WHERE "user_id" IS NOT NULL;

CREATE UNIQUE INDEX "chat_message_reads_guest_msg_idx"
  ON "chat_message_reads" ("message_id", "guest_session_id")
  WHERE "guest_session_id" IS NOT NULL;

CREATE INDEX "chat_message_reads_conversation_user_idx"
  ON "chat_message_reads" ("conversation_id", "user_id")
  WHERE "user_id" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- chat_attachments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_attachments" (
  "id"                    UUID        NOT NULL DEFAULT uuidv7(),
  "message_id"            UUID        NOT NULL,
  "conversation_id"       UUID        NOT NULL,
  "bucket"                TEXT        NOT NULL DEFAULT 'atlas-chat',
  "object_key"            TEXT        NOT NULL,
  "file_name"             TEXT        NOT NULL,
  "mime_type"             TEXT        NOT NULL,
  "size_bytes"            BIGINT      NOT NULL DEFAULT 0,
  "width"                 INT,
  "height"                INT,
  "uploaded_by_user_id"   UUID,
  "uploaded_by_guest_id"  UUID,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_attachments_message_fkey"
    FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE
);

CREATE INDEX "chat_attachments_message_id_idx"
  ON "chat_attachments" ("message_id");

CREATE INDEX "chat_attachments_conversation_id_idx"
  ON "chat_attachments" ("conversation_id");

-- ---------------------------------------------------------------------------
-- Foreign keys added after both tables exist
-- ---------------------------------------------------------------------------
ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_last_message_id_fkey"
  FOREIGN KEY ("last_message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_created_by_guest_id_fkey"
  FOREIGN KEY ("created_by_guest_id") REFERENCES "chat_guest_sessions"("id") ON DELETE SET NULL;

ALTER TABLE "chat_conversation_members"
  ADD CONSTRAINT "chat_conversation_members_guest_session_fkey"
  FOREIGN KEY ("guest_session_id") REFERENCES "chat_guest_sessions"("id") ON DELETE CASCADE;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_sender_guest_fkey"
  FOREIGN KEY ("sender_guest_id") REFERENCES "chat_guest_sessions"("id") ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Enable Supabase Realtime on chat tables
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE "chat_conversations";
ALTER PUBLICATION supabase_realtime ADD TABLE "chat_messages";
ALTER PUBLICATION supabase_realtime ADD TABLE "chat_conversation_members";

-- ---------------------------------------------------------------------------
-- Row-Level Security — internal users
-- (Requires auth.uid() to map to UserProfile.auth_user_id)
-- ---------------------------------------------------------------------------
ALTER TABLE "chat_conversations"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_conversation_members"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_message_reads"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_attachments"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_guest_sessions"        ENABLE ROW LEVEL SECURITY;

-- Helper: check membership
CREATE OR REPLACE FUNCTION chat_is_member(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.chat_conversation_members ccm
    JOIN public.user_profile up ON up.id = ccm.user_id
    WHERE ccm.conversation_id = p_conversation_id
      AND up.auth_user_id = auth.uid()
      AND ccm.left_at IS NULL
  );
END;
$$;

-- chat_conversations: members can read, no direct insert (API only)
CREATE POLICY "chat_conv_select" ON "chat_conversations"
  FOR SELECT USING (chat_is_member(id));

CREATE POLICY "chat_conv_update" ON "chat_conversations"
  FOR UPDATE USING (chat_is_member(id));

-- chat_conversation_members: members can read their conversation's members
CREATE POLICY "chat_members_select" ON "chat_conversation_members"
  FOR SELECT USING (chat_is_member(conversation_id));

-- chat_messages: members can read and insert
CREATE POLICY "chat_msg_select" ON "chat_messages"
  FOR SELECT USING (
    chat_is_member(conversation_id) AND deleted_at IS NULL
  );

CREATE POLICY "chat_msg_insert" ON "chat_messages"
  FOR INSERT WITH CHECK (
    chat_is_member(conversation_id)
    AND sender_type = 'user'
    AND sender_user_id IN (
      SELECT id FROM public.user_profile WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "chat_msg_update" ON "chat_messages"
  FOR UPDATE USING (
    sender_user_id IN (
      SELECT id FROM public.user_profile WHERE auth_user_id = auth.uid()
    )
  );

-- chat_message_reads: members can read/insert their own reads
CREATE POLICY "chat_reads_select" ON "chat_message_reads"
  FOR SELECT USING (chat_is_member(conversation_id));

CREATE POLICY "chat_reads_insert" ON "chat_message_reads"
  FOR INSERT WITH CHECK (
    chat_is_member(conversation_id)
    AND user_id IN (
      SELECT id FROM public.user_profile WHERE auth_user_id = auth.uid()
    )
  );

-- chat_attachments: members can read
CREATE POLICY "chat_attach_select" ON "chat_attachments"
  FOR SELECT USING (chat_is_member(conversation_id));

-- chat_guest_sessions: no public access — API only (service role bypasses RLS)
CREATE POLICY "chat_guest_no_access" ON "chat_guest_sessions"
  FOR ALL USING (false);

-- Service role bypass for all chat tables (used by Hono API)
CREATE POLICY "chat_conv_service_all"   ON "chat_conversations"        FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "chat_members_service_all" ON "chat_conversation_members" FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "chat_msg_service_all"    ON "chat_messages"             FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "chat_reads_service_all"  ON "chat_message_reads"        FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "chat_attach_service_all" ON "chat_attachments"          FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "chat_guest_service_all"  ON "chat_guest_sessions"       FOR ALL USING (auth.role() = 'service_role');
