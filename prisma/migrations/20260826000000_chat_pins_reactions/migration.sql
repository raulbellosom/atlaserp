-- =============================================================================
-- Atlas ERP — Chat Pinned Messages & Reactions (Phase D)
-- Migration: 20260826000000_chat_pins_reactions
-- =============================================================================

ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "pinned_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pinned_by_user_id" UUID;

CREATE INDEX "chat_messages_pinned_idx"
  ON "chat_messages" ("conversation_id", "pinned_at" DESC)
  WHERE "pinned_at" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- chat_message_reactions — mirrors the Prisma-modeled EntityCommentReaction
-- shape (generic comments feature) for consistency; raw-SQL here since chat
-- tables aren't Prisma-modeled.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
  "id"         UUID        NOT NULL DEFAULT uuidv7(),
  "message_id" UUID        NOT NULL,
  "user_id"    UUID        NOT NULL,
  "emoji"      TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "chat_message_reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_message_reactions_message_fkey"
    FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_message_reactions_unique" UNIQUE ("message_id", "user_id", "emoji")
);

CREATE INDEX "chat_message_reactions_message_id_idx"
  ON "chat_message_reactions" ("message_id");

ALTER TABLE "chat_message_reactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_message_reactions_select" ON "chat_message_reactions"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_messages m
      WHERE m.id = message_id AND chat_is_member(m.conversation_id)
    )
  );

CREATE POLICY "chat_message_reactions_service_all" ON "chat_message_reactions"
  FOR ALL USING (auth.role() = 'service_role');

ALTER PUBLICATION supabase_realtime ADD TABLE "chat_message_reactions";
