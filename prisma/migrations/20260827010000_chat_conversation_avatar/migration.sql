-- =============================================================================
-- Atlas ERP — Chat Conversation Custom Avatar (image or emoji)
-- Migration: 20260827010000_chat_conversation_avatar
-- =============================================================================

ALTER TABLE "chat_conversations"
  ADD COLUMN IF NOT EXISTS "avatar_file_id" UUID,
  ADD COLUMN IF NOT EXISTS "avatar_emoji" TEXT;
