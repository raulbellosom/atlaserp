-- =============================================================================
-- Atlas ERP — Chat reply-to-message
-- Migration: 20260828030000_chat_reply_to
-- Adds a nullable self-reference so a message can quote another message in the
-- same conversation. ON DELETE SET NULL: deleting the quoted original leaves
-- the reply intact, its quote just resolves to "message deleted" on read.
-- =============================================================================

ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "reply_to_message_id" UUID;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_reply_to_fkey"
    FOREIGN KEY ("reply_to_message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL;

CREATE INDEX "chat_messages_reply_to_message_id_idx"
  ON "chat_messages" ("reply_to_message_id")
  WHERE "reply_to_message_id" IS NOT NULL;
