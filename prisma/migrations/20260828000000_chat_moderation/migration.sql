-- =============================================================================
-- Atlas ERP — Chat Moderation (mute, block, report)
-- Migration: 20260828000000_chat_moderation
-- =============================================================================

-- Per-member mute flag, same shape as the existing archived_at column
ALTER TABLE "chat_conversation_members"
  ADD COLUMN IF NOT EXISTS "muted_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "chat_conversation_members_muted_idx"
  ON "chat_conversation_members" ("user_id", "muted_at")
  WHERE "user_id" IS NOT NULL AND "muted_at" IS NOT NULL;

-- Blocks are between two users, not conversation-scoped
CREATE TABLE IF NOT EXISTS "chat_blocks" (
  "id"                UUID        NOT NULL DEFAULT uuidv7(),
  "blocker_user_id"   UUID        NOT NULL,
  "blocked_user_id"   UUID        NOT NULL,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_blocks_blocker_fkey" FOREIGN KEY ("blocker_user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_blocks_blocked_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_blocks_blocker_blocked_idx"
  ON "chat_blocks" ("blocker_user_id", "blocked_user_id");

CREATE INDEX IF NOT EXISTS "chat_blocks_blocked_user_idx"
  ON "chat_blocks" ("blocked_user_id");

-- Reports filed against a user, optionally referencing the conversation they
-- originated from
CREATE TABLE IF NOT EXISTS "chat_reports" (
  "id"                    UUID        NOT NULL DEFAULT uuidv7(),
  "reporter_user_id"      UUID        NOT NULL,
  "reported_user_id"      UUID        NOT NULL,
  "conversation_id"       UUID,
  "reason"                TEXT        NOT NULL,
  "note"                  TEXT,
  "status"                TEXT        NOT NULL DEFAULT 'open',
  "reviewed_by_user_id"   UUID,
  "reviewed_at"           TIMESTAMPTZ,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_reports_reporter_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_reports_reported_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_reports_reason_check" CHECK ("reason" IN ('spam', 'abuse', 'inappropriate', 'other')),
  CONSTRAINT "chat_reports_status_check" CHECK ("status" IN ('open', 'dismissed', 'user_disabled'))
);

CREATE INDEX IF NOT EXISTS "chat_reports_status_idx"
  ON "chat_reports" ("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "chat_reports_reported_user_idx"
  ON "chat_reports" ("reported_user_id");
