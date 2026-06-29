-- Add flag to prevent duplicate expiry emails to guests
ALTER TABLE chat_guest_sessions
  ADD COLUMN IF NOT EXISTS expiry_email_sent BOOLEAN NOT NULL DEFAULT false;
