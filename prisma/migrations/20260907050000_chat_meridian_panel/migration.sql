-- MeridIAn Spec 2: the private per-user assistant panel thread.
CREATE TABLE IF NOT EXISTS "chat_meridian_thread" (
  "id"                   UUID PRIMARY KEY DEFAULT uuidv7(),
  "company_id"           UUID,
  "owner_profile_id"     UUID NOT NULL,
  "host_conversation_id" UUID NOT NULL,
  "enabled"              BOOLEAN NOT NULL DEFAULT true,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "chat_meridian_thread_owner_host_idx"
  ON "chat_meridian_thread" ("owner_profile_id", "host_conversation_id")
  WHERE "enabled" = true;

CREATE TABLE IF NOT EXISTS "chat_meridian_message" (
  "id"         UUID PRIMARY KEY DEFAULT uuidv7(),
  "thread_id"  UUID NOT NULL REFERENCES "chat_meridian_thread"("id") ON DELETE CASCADE,
  "role"       TEXT NOT NULL,
  "content"    TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "chat_meridian_message_thread_idx"
  ON "chat_meridian_message" ("thread_id", "created_at");
