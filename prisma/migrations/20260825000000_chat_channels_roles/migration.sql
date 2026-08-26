-- =============================================================================
-- Atlas ERP — Chat Channels & Roles (Phase A foundation)
-- Migration: 20260825000000_chat_channels_roles
-- =============================================================================

-- ---------------------------------------------------------------------------
-- chat_channel_roles — role definitions scoped to one conversation
-- (applies to type='channel' and type='group'; direct/external_support are
-- untouched and keep using chat_conversation_members.role, the legacy text column)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_channel_roles" (
  "id"              UUID        NOT NULL DEFAULT uuidv7(),
  "conversation_id" UUID        NOT NULL,
  "name"            TEXT        NOT NULL,
  "color"           TEXT,
  "position"        INT         NOT NULL DEFAULT 0,
  "is_system"       BOOLEAN     NOT NULL DEFAULT false,
  "permissions"     JSONB       NOT NULL DEFAULT '{}',
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "chat_channel_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_channel_roles_conversation_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_channel_roles_conversation_name_key" UNIQUE ("conversation_id", "name")
);

CREATE INDEX "chat_channel_roles_conversation_id_idx"
  ON "chat_channel_roles" ("conversation_id");

-- ---------------------------------------------------------------------------
-- chat_conversations — new type, channel metadata
-- ---------------------------------------------------------------------------
ALTER TABLE "chat_conversations" DROP CONSTRAINT "chat_conversations_type_check";
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_type_check"
  CHECK ("type" IN ('direct', 'group', 'channel', 'external_support'));

ALTER TABLE "chat_conversations"
  ADD COLUMN IF NOT EXISTS "is_public"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "slug"        TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT;

CREATE UNIQUE INDEX "chat_conversations_company_slug_idx"
  ON "chat_conversations" ("company_id", "slug")
  WHERE "slug" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- chat_conversation_members — role_id (coexists with legacy `role` text)
-- ---------------------------------------------------------------------------
ALTER TABLE "chat_conversation_members"
  ADD COLUMN IF NOT EXISTS "role_id" UUID
    REFERENCES "chat_channel_roles"("id") ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Backfill: seed the 4 default roles for every existing group conversation
-- and map each member's legacy `role` text to the matching role_id.
--
-- IMPORTANT: the permission keys/values here MUST stay in sync with
-- DEFAULT_CHANNEL_ROLES in apps/api/src/routes/chat/chat-permissions-service.js
-- (that constant is used for every *new* channel/group going forward; this
-- SQL block only ever runs once, for conversations that already existed).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  conv RECORD;
  owner_role_id UUID;
  admin_role_id UUID;
  moderator_role_id UUID;
  member_role_id UUID;
BEGIN
  FOR conv IN SELECT id FROM chat_conversations WHERE type = 'group' LOOP
    INSERT INTO chat_channel_roles (conversation_id, name, position, is_system, permissions)
    VALUES (
      conv.id, 'Owner', 100, true,
      '{"channel.manage":true,"members.manage":true,"roles.manage":true,"messages.send":true,"messages.pin":true,"messages.delete_others":true,"mentions.everyone":true,"mentions.here":true}'::jsonb
    )
    RETURNING id INTO owner_role_id;

    INSERT INTO chat_channel_roles (conversation_id, name, position, is_system, permissions)
    VALUES (
      conv.id, 'Admin', 75, false,
      '{"channel.manage":true,"members.manage":true,"roles.manage":true,"messages.pin":true,"messages.delete_others":true,"mentions.everyone":true,"messages.send":true}'::jsonb
    )
    RETURNING id INTO admin_role_id;

    INSERT INTO chat_channel_roles (conversation_id, name, position, is_system, permissions)
    VALUES (
      conv.id, 'Moderator', 50, false,
      '{"messages.pin":true,"messages.delete_others":true,"mentions.here":true,"messages.send":true}'::jsonb
    )
    RETURNING id INTO moderator_role_id;

    INSERT INTO chat_channel_roles (conversation_id, name, position, is_system, permissions)
    VALUES (
      conv.id, 'Member', 0, false,
      '{"messages.send":true}'::jsonb
    )
    RETURNING id INTO member_role_id;

    UPDATE chat_conversation_members
    SET role_id = CASE
      WHEN role = 'owner' THEN owner_role_id
      WHEN role = 'admin' THEN admin_role_id
      ELSE member_role_id
    END
    WHERE conversation_id = conv.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS + Realtime for chat_channel_roles (mirrors the pattern from
-- 20260625000000_add_chat_tables — chat_is_member() already exists)
-- ---------------------------------------------------------------------------
ALTER TABLE "chat_channel_roles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_channel_roles_select" ON "chat_channel_roles"
  FOR SELECT USING (chat_is_member(conversation_id));

CREATE POLICY "chat_channel_roles_service_all" ON "chat_channel_roles"
  FOR ALL USING (auth.role() = 'service_role');

ALTER PUBLICATION supabase_realtime ADD TABLE "chat_channel_roles";
