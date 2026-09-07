-- =============================================================================
-- Atlas ERP — Chat: per-member conversation pin & hide
-- Migration: 20260907000000_chat_conversation_pin_hide
-- =============================================================================
-- pinned_at: conversation pinned to the top of THIS member's list (WhatsApp
--            "Fijar chat"). Per-member, same shape as archived_at / muted_at.
-- hidden_at: direct chat "deleted" from THIS member's list. Cleared again the
--            moment a new message lands in the conversation, so the chat
--            resurfaces (WhatsApp behaviour). Only ever set for type='direct'.

ALTER TABLE "chat_conversation_members"
  ADD COLUMN IF NOT EXISTS "pinned_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "chat_ccm_user_pinned_idx"
  ON "chat_conversation_members" ("user_id", "pinned_at" DESC)
  WHERE "user_id" IS NOT NULL AND "pinned_at" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "chat_ccm_user_hidden_idx"
  ON "chat_conversation_members" ("user_id", "hidden_at")
  WHERE "user_id" IS NOT NULL AND "hidden_at" IS NOT NULL;
