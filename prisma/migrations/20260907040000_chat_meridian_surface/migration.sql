-- MeridIAn Spec 3: which surface a turn came from (direct chat vs channel mention).
ALTER TABLE "chat_meridian_run"
  ADD COLUMN IF NOT EXISTS "surface" TEXT NOT NULL DEFAULT 'direct';
