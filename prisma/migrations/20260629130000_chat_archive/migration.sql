-- Add per-user archive flag to conversation members
ALTER TABLE "chat_conversation_members"
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ;

-- Index for fast "list archived conversations for user" queries
CREATE INDEX IF NOT EXISTS "chat_conversation_members_archived_idx"
  ON "chat_conversation_members" ("user_id", "archived_at")
  WHERE "user_id" IS NOT NULL AND "archived_at" IS NOT NULL;
