-- =============================================================================
-- Atlas ERP — Chat Threads (Phase E)
-- Migration: 20260827000000_chat_threads
-- =============================================================================

ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "thread_root_id" UUID,
  ADD COLUMN IF NOT EXISTS "thread_reply_count" INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "thread_last_reply_at" TIMESTAMPTZ;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_thread_root_fkey"
    FOREIGN KEY ("thread_root_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE;

CREATE INDEX "chat_messages_thread_root_id_idx"
  ON "chat_messages" ("thread_root_id", "created_at" ASC)
  WHERE "thread_root_id" IS NOT NULL;
