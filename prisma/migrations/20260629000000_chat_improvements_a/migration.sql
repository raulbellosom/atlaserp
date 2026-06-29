-- =============================================================================
-- Atlas ERP — Chat Improvements A
-- Migration: 20260629000000_chat_improvements_a
-- =============================================================================

-- A1: Agent assignment on conversations
ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID;

CREATE INDEX IF NOT EXISTS chat_conversations_assigned_user_idx
  ON chat_conversations (assigned_user_id)
  WHERE deleted_at IS NULL;

-- A4: Idle + absolute expiry on guest sessions
ALTER TABLE chat_guest_sessions
  ADD COLUMN IF NOT EXISTS idle_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  ADD COLUMN IF NOT EXISTS absolute_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  ADD COLUMN IF NOT EXISTS resume_token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS chat_guest_sessions_resume_token_idx
  ON chat_guest_sessions (resume_token_hash)
  WHERE resume_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS chat_guest_sessions_email_expiry_idx
  ON chat_guest_sessions (email, idle_expires_at, absolute_expires_at)
  WHERE email IS NOT NULL AND closed_at IS NULL;

-- A5: Message templates
CREATE TABLE IF NOT EXISTS chat_message_templates (
  id           UUID        NOT NULL DEFAULT uuidv7() PRIMARY KEY,
  company_id   UUID        NOT NULL,
  created_by   UUID,
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  tags         TEXT[]      NOT NULL DEFAULT '{}',
  usage_count  INT         NOT NULL DEFAULT 0,
  enabled      BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_message_templates_company_idx
  ON chat_message_templates (company_id)
  WHERE enabled = true;
