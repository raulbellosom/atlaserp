-- Add hosted build columns to website_site
ALTER TABLE website_site
  ADD COLUMN IF NOT EXISTS source_type        TEXT        NOT NULL DEFAULT 'builder',
  ADD COLUMN IF NOT EXISTS dist_uploaded_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dist_file_count    INTEGER,
  ADD COLUMN IF NOT EXISTS dist_has_prerender BOOLEAN,
  ADD COLUMN IF NOT EXISTS dist_manifest      JSONB;
