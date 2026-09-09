-- =============================================================================
-- Atlas ERP — Chat attachment duration
-- Migration: 20260908150000_chat_attachment_duration
-- Stores the length (ms) of a voice note, measured client-side at record time,
-- so AudioCard never has to probe a MediaRecorder blob. webm/opus from
-- MediaRecorder carries no Duration element; the previous workaround
-- (audio.currentTime = 1e101 to force the browser to resolve it) wedged
-- playback on mobile Safari — the player showed "0:0" and only a corrupted
-- fraction of a second played back.
-- Nullable: legacy rows and non-audio attachments leave it NULL, and the
-- player falls back to AudioContext.decodeAudioData for those.
-- =============================================================================

ALTER TABLE "chat_attachments"
  ADD COLUMN IF NOT EXISTS "duration_ms" integer;
