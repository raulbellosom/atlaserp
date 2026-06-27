-- atlas.notes fixes migration
-- Fix 1: Change shared_by_user_id FK to ON DELETE CASCADE (was RESTRICT by default)
ALTER TABLE note_shares
  DROP CONSTRAINT note_shares_shared_by_user_id_fkey;

ALTER TABLE note_shares
  ADD CONSTRAINT note_shares_shared_by_user_id_fkey
  FOREIGN KEY (shared_by_user_id) REFERENCES user_profile(id) ON DELETE CASCADE;

-- Fix 2: Add CHECK constraint to enforce soft-delete consistency between is_trashed and deleted_at
ALTER TABLE notes
  ADD CONSTRAINT chk_notes_delete_consistency
  CHECK (deleted_at IS NULL OR is_trashed = false);

-- Fix 3: Drop redundant indexes covered by existing unique/PK indexes
-- note_shares_note_idx is covered by UNIQUE(note_id, shared_with_user_id)
-- note_tag_assignments_note_idx is covered by PK(note_id, tag_id)
DROP INDEX IF EXISTS note_shares_note_idx;
DROP INDEX IF EXISTS note_tag_assignments_note_idx;

-- Fix 4: Rebuild FTS index using 'simple' dictionary instead of 'spanish'
-- 'spanish' stemmer breaks recall for non-Spanish content
DROP INDEX IF EXISTS notes_fts_idx;
CREATE INDEX notes_fts_idx ON notes
  USING gin(to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content_text, '')));
