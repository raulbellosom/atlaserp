-- One MeridIAn conversation per user. `ensureMeridianConversation` can be
-- called concurrently from GET /chat/conversations and GET /chat/meridian on
-- first load; without this a race creates two.
CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_one_meridian_per_user_idx"
  ON "chat_conversations" ("created_by_user_id")
  WHERE "type" = 'meridian' AND "deleted_at" IS NULL;
