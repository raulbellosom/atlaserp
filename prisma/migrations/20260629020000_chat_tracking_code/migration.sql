-- Tracking code for guest chat conversations (visible to both guest and operator)
ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS tracking_code TEXT;

-- Sequential per company: CHAT-000001, CHAT-000002, ...
-- We generate this in application code using a per-company counter.
CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_tracking_code_idx
  ON chat_conversations (tracking_code)
  WHERE tracking_code IS NOT NULL;

-- Fast lookup by code from the public API
CREATE INDEX IF NOT EXISTS chat_conversations_tracking_code_search_idx
  ON chat_conversations (LOWER(tracking_code))
  WHERE tracking_code IS NOT NULL;
