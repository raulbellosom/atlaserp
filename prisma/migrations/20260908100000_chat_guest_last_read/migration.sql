-- Guest-side read receipt: the timestamp the visitor last viewed the conversation.
-- Operator-side last-read is derived from chat_conversation_members.last_read_at (no column needed).
ALTER TABLE "chat_guest_sessions"
  ADD COLUMN IF NOT EXISTS "guest_last_read_at" timestamptz;
