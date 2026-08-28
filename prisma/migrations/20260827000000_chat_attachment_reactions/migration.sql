-- =============================================================================
-- Atlas ERP — Chat Per-Attachment Reactions
-- Migration: 20260827000000_chat_attachment_reactions
-- =============================================================================
-- Additive only: existing chat_message_reactions rows all get
-- attachment_id = NULL, which is exactly their current meaning
-- (a message-level reaction). No backfill needed.

ALTER TABLE "chat_message_reactions"
  ADD COLUMN IF NOT EXISTS "attachment_id" UUID;

ALTER TABLE "chat_message_reactions"
  ADD CONSTRAINT "chat_message_reactions_attachment_fkey"
  FOREIGN KEY ("attachment_id") REFERENCES "chat_attachments"("id") ON DELETE CASCADE;

-- Replace the single UNIQUE(message_id, user_id, emoji) constraint with two
-- partial unique indexes. A plain UNIQUE constraint including attachment_id
-- would NOT work here: Postgres treats every NULL as distinct by default, so
-- multiple message-level (attachment_id IS NULL) reactions from the same user
-- with the same emoji would NOT violate a naive UNIQUE(message_id,
-- attachment_id, user_id, emoji) constraint. NULLS NOT DISTINCT (PG 15+)
-- would fix that in one constraint, but this database's version on the
-- self-hosted VPS isn't guaranteed to be 15+, so two partial indexes are used
-- instead — portable back to any Postgres version this project already runs on.
ALTER TABLE "chat_message_reactions"
  DROP CONSTRAINT IF EXISTS "chat_message_reactions_unique";

CREATE UNIQUE INDEX "chat_message_reactions_message_unique"
  ON "chat_message_reactions" ("message_id", "user_id", "emoji")
  WHERE "attachment_id" IS NULL;

CREATE UNIQUE INDEX "chat_message_reactions_attachment_unique"
  ON "chat_message_reactions" ("message_id", "attachment_id", "user_id", "emoji")
  WHERE "attachment_id" IS NOT NULL;

CREATE INDEX "chat_message_reactions_attachment_id_idx"
  ON "chat_message_reactions" ("attachment_id")
  WHERE "attachment_id" IS NOT NULL;
