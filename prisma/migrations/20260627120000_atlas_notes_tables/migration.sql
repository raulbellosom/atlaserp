-- atlas.notes module tables
-- Task 1: Raw SQL migration for all atlas.notes tables

CREATE TABLE note_folders (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  owner_user_id UUID NOT NULL REFERENCES "user_profile"(id) ON DELETE CASCADE,
  company_id UUID REFERENCES "company"(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES note_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  owner_user_id UUID NOT NULL REFERENCES "user_profile"(id) ON DELETE CASCADE,
  company_id UUID REFERENCES "company"(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES note_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL DEFAULT '{}',
  content_text TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  icon TEXT NOT NULL DEFAULT '',
  background_color TEXT,
  background_image_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_trashed BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT false,
  public_slug TEXT UNIQUE,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trashed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE note_tags (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  owner_user_id UUID NOT NULL REFERENCES "user_profile"(id) ON DELETE CASCADE,
  company_id UUID REFERENCES "company"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, name)
);

CREATE TABLE note_tag_assignments (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES note_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE note_shares (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES "user_profile"(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES "user_profile"(id),
  permission TEXT NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (note_id, shared_with_user_id)
);

CREATE TABLE note_ydoc_state (
  note_id UUID PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
  state BYTEA NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX notes_owner_idx ON notes(owner_user_id, deleted_at, is_trashed);
CREATE INDEX notes_folder_idx ON notes(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX notes_slug_idx ON notes(public_slug) WHERE is_public = true AND public_slug IS NOT NULL;
CREATE INDEX notes_company_idx ON notes(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX note_shares_user_idx ON note_shares(shared_with_user_id);
CREATE INDEX note_shares_note_idx ON note_shares(note_id);
CREATE INDEX note_tag_assignments_note_idx ON note_tag_assignments(note_id);
CREATE INDEX note_tag_assignments_tag_idx ON note_tag_assignments(tag_id);
CREATE INDEX note_folders_owner_idx ON note_folders(owner_user_id);
CREATE INDEX note_tags_owner_idx ON note_tags(owner_user_id);
CREATE INDEX notes_fts_idx ON notes
  USING gin(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content_text, '')));
