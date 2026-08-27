-- =============================================================================
-- Atlas ERP — Chat Conversation ↔ External Entity Link (e.g. atlas.projects)
-- Migration: 20260828020000_chat_conversation_link
-- =============================================================================

ALTER TABLE "chat_conversations"
  ADD COLUMN IF NOT EXISTS "linked_module" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "linked_entity_id" UUID;

-- At most one channel per (module, entity) — e.g. one channel per project.
-- Partial index (WHERE linked_module IS NOT NULL) so any number of
-- conversations with no link can coexist.
CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_linked_entity_unique"
  ON "chat_conversations" ("linked_module", "linked_entity_id")
  WHERE "linked_module" IS NOT NULL;
