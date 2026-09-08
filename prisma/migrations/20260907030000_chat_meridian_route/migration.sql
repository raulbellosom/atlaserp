-- MeridIAn Spec 4: record which route a turn took and how long classification cost.
ALTER TABLE "chat_meridian_run"
  ADD COLUMN IF NOT EXISTS "route"     TEXT,
  ADD COLUMN IF NOT EXISTS "router_ms" INTEGER;
