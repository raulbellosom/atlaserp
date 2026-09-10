-- atlas.notes: collaborative canvas note type
-- Adds notes.note_type and the 1:1 note_canvas_scene table.

ALTER TABLE notes
  ADD COLUMN note_type TEXT NOT NULL DEFAULT 'document';

ALTER TABLE notes
  ADD CONSTRAINT chk_notes_note_type CHECK (note_type IN ('document', 'canvas'));

CREATE TABLE note_canvas_scene (
  note_id     UUID PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
  elements    JSONB NOT NULL DEFAULT '[]'::jsonb,
  app_state   JSONB NOT NULL DEFAULT '{}'::jsonb,
  layers      JSONB NOT NULL DEFAULT '[]'::jsonb,
  files       JSONB NOT NULL DEFAULT '{}'::jsonb,
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES user_profile(id) ON DELETE SET NULL
);

CREATE INDEX notes_canvas_type_idx ON notes(note_type) WHERE note_type = 'canvas';
