-- MeridIAn (atlas.chat AI assistant) — Spec 1.
-- atlas.chat is a raw-SQL module; its system tables live in the Prisma schema
-- but its runtime rows are written with $queryRaw. RLS policies on
-- chat_messages that require sender_type='user' on INSERT do NOT apply here:
-- the API writes with the service role, which bypasses RLS. The CHECK below is
-- widened so an 'assistant' row is legal for any writer.

-- 1. Bot flag on user_profile.
ALTER TABLE "user_profile"
  ADD COLUMN IF NOT EXISTS "is_bot" BOOLEAN NOT NULL DEFAULT false;

-- 2. One MeridIAn profile per company. company_id may not exist on user_profile
--    on this DB (migration drift) — guard with a DO block so this migration is
--    safe either way. When company_id is absent we rely on membership instead
--    and skip the unique index (email uniqueness already prevents duplicates).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profile' AND column_name = 'company_id'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "user_profile_meridian_bot_per_company_idx"
             ON "user_profile" ("company_id") WHERE "is_bot" = true';
  END IF;
END $$;

-- 3. Allow the 'meridian' conversation type.
ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_type_check";
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_type_check"
  CHECK ("type" IN ('direct', 'group', 'channel', 'external_support', 'meridian'));

-- 4. Allow 'assistant' as a message sender_type.
ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_sender_type_check";
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_type_check"
  CHECK ("sender_type" IN ('user', 'guest', 'system', 'assistant'));

-- 5. Lightweight per-turn audit / cost visibility. No message content here
--    (that lives in chat_messages) — just metadata about each LLM turn.
CREATE TABLE IF NOT EXISTS "chat_meridian_run" (
  "id"                 UUID PRIMARY KEY DEFAULT uuidv7(),
  "company_id"         UUID,
  "conversation_id"    UUID NOT NULL,
  "actor_profile_id"   UUID NOT NULL,
  "trigger_message_id" UUID,
  "model"              TEXT,
  "tool_calls"         JSONB,
  "iterations"         SMALLINT,
  "latency_ms"         INTEGER,
  "error"              TEXT,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "chat_meridian_run_company_created_idx"
  ON "chat_meridian_run" ("company_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "chat_meridian_run_conversation_idx"
  ON "chat_meridian_run" ("conversation_id");
