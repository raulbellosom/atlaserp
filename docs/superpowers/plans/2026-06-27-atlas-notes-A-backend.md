# atlas.notes — Plan A: Backend (Database + API + Manifest + SDK)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full backend for `atlas.notes` — a high-quality personal notes module with real-time Y.js collaborative editing, sharing, tags, folders, and public links.

**Architecture:** Raw SQL tables (not in Prisma schema — same pattern as `atlas.chat`). A Hono router factory (`createNotesRouter`) mounted in `apps/api/src/index.js`. Y.js state persisted in `note_ydoc_state` BYTEA column; updates propagated via Supabase Broadcast. Public notes served at `/public/notes/:slug`.

**Tech Stack:** Hono, Prisma (raw `$queryRaw`), Supabase Storage (`atlas-notes` bucket), Supabase Broadcast for Y.js relay, UUID v7

**Prerequisite (manual, before Task 1):** Create `atlas-notes` private bucket in Supabase Studio → Storage → Buckets. Max file size: 20 MB.

---

## File Map

| File | Action |
|---|---|
| `prisma/migrations/20260627120000_atlas_notes_tables/migration.sql` | Create — 6 raw SQL tables |
| `apps/api/src/routes/notes/notes-service.js` | Create — note CRUD + access control |
| `apps/api/src/routes/notes/folders-service.js` | Create — folder CRUD |
| `apps/api/src/routes/notes/tags-service.js` | Create — tag CRUD + assignment |
| `apps/api/src/routes/notes/shares-service.js` | Create — share/publish logic |
| `apps/api/src/routes/notes/ydoc-service.js` | Create — Y.js state persistence |
| `apps/api/src/routes/notes/index.js` | Create — Hono router, all ~24 endpoints |
| `apps/api/src/index.js` | Modify — import + mount `createNotesRouter` |
| `apps/api/src/manifests/official/core-modules.js` | Modify — add `notesMap` manifest |
| `packages/sdk/src/index.js` | Modify — add `notes` domain methods |

---

## Task 1: Database Migration

**Files:**
- Create: `prisma/migrations/20260627120000_atlas_notes_tables/migration.sql`

- [ ] **Step 1: Create the migration directory and file**

```bash
mkdir "prisma/migrations/20260627120000_atlas_notes_tables"
```

- [ ] **Step 2: Write the migration SQL**

```sql
-- prisma/migrations/20260627120000_atlas_notes_tables/migration.sql
-- Atlas Notes module — raw tables (not managed by Prisma schema)

CREATE TABLE note_folders (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  owner_user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  company_id UUID REFERENCES "Company"(id) ON DELETE CASCADE,
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
  owner_user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  company_id UUID REFERENCES "Company"(id) ON DELETE CASCADE,
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
  owner_user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  company_id UUID REFERENCES "Company"(id) ON DELETE CASCADE,
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
  shared_with_user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES user_profile(id),
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

-- Full-text search index
CREATE INDEX notes_fts_idx ON notes
  USING gin(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content_text, '')));
```

> **Note:** Verify that `user_profile` and `"Company"` match the actual Prisma-generated table names by running `\dt` in psql or checking an existing migration that references these tables.

- [ ] **Step 3: Apply migration**

```bash
pnpm db:migrate
```

Expected: Migration `20260627120000_atlas_notes_tables` applied successfully. No Prisma client regeneration needed (tables are raw SQL, not in schema.prisma).

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260627120000_atlas_notes_tables/
git commit -m "feat(notes): add raw SQL migration for atlas.notes tables"
```

---

## Task 2: Notes Service (Core CRUD + Access Control)

**Files:**
- Create: `apps/api/src/routes/notes/notes-service.js`

- [ ] **Step 1: Create the service file**

```javascript
// apps/api/src/routes/notes/notes-service.js

export class NotesServiceError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

export function createNotesService({ prisma, supabaseAdmin, broadcaster }) {
  // Checks ownership OR active share with the given permission level ('read' | 'edit')
  async function assertAccess(noteId, userId, requiredPermission = 'read') {
    const rows = await prisma.$queryRaw`
      SELECT n.id, n.owner_user_id, ns.permission AS share_permission
      FROM notes n
      LEFT JOIN note_shares ns
        ON ns.note_id = n.id AND ns.shared_with_user_id = ${userId}::uuid
      WHERE n.id = ${noteId}::uuid AND n.deleted_at IS NULL
    `
    if (!rows.length) throw new NotesServiceError('Nota no encontrada', 404)
    const note = rows[0]
    const isOwner = note.owner_user_id === userId
    const sharePermission = note.share_permission
    if (requiredPermission === 'read') {
      if (!isOwner && !sharePermission) throw new NotesServiceError('Sin acceso', 403)
    } else {
      // 'edit' required
      if (!isOwner && sharePermission !== 'edit') throw new NotesServiceError('Sin permiso de edicion', 403)
    }
    return { isOwner, sharePermission }
  }

  async function createNote({ userId, companyId, folderId, title, content, icon, backgroundColor }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO notes (owner_user_id, company_id, folder_id, title, content, icon, background_color)
      VALUES (
        ${userId}::uuid,
        ${companyId ?? null}::uuid,
        ${folderId ?? null}::uuid,
        ${title ?? ''},
        ${JSON.stringify(content ?? {})}::jsonb,
        ${icon ?? ''},
        ${backgroundColor ?? null}
      )
      RETURNING *
    `
    return rows[0]
  }

  async function getNote(noteId, userId) {
    await assertAccess(noteId, userId, 'read')
    const rows = await prisma.$queryRaw`
      SELECT
        n.*,
        up.display_name AS owner_name,
        up.avatar_url AS owner_avatar,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', nt.id, 'name', nt.name, 'color', nt.color))
          FILTER (WHERE nt.id IS NOT NULL), '[]'
        ) AS tags,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', ns.id,
            'userId', ns.shared_with_user_id,
            'permission', ns.permission,
            'displayName', su.display_name,
            'avatarUrl', su.avatar_url
          )) FILTER (WHERE ns.id IS NOT NULL), '[]'
        ) AS shares
      FROM notes n
      JOIN user_profile up ON up.id = n.owner_user_id
      LEFT JOIN note_tag_assignments nta ON nta.note_id = n.id
      LEFT JOIN note_tags nt ON nt.id = nta.tag_id
      LEFT JOIN note_shares ns ON ns.note_id = n.id
      LEFT JOIN user_profile su ON su.id = ns.shared_with_user_id
      WHERE n.id = ${noteId}::uuid AND n.deleted_at IS NULL
      GROUP BY n.id, up.display_name, up.avatar_url
    `
    if (!rows.length) throw new NotesServiceError('Nota no encontrada', 404)
    return rows[0]
  }

  async function listNotes({ userId, folderId, tagId, q, archived, trashed, shared, page = 1, pageSize = 50 }) {
    const offset = (page - 1) * pageSize
    const rows = await prisma.$queryRaw`
      SELECT
        n.id, n.title, n.icon, n.background_color, n.cover_url,
        n.is_pinned, n.is_archived, n.is_trashed, n.is_public,
        n.folder_id, n.word_count, n.created_at, n.updated_at,
        n.owner_user_id,
        CASE WHEN n.owner_user_id = ${userId}::uuid THEN true ELSE false END AS is_owner,
        ns_me.permission AS my_share_permission,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', nt.id, 'name', nt.name, 'color', nt.color))
          FILTER (WHERE nt.id IS NOT NULL), '[]'
        ) AS tags
      FROM notes n
      LEFT JOIN note_shares ns_me ON ns_me.note_id = n.id AND ns_me.shared_with_user_id = ${userId}::uuid
      LEFT JOIN note_tag_assignments nta ON nta.note_id = n.id
      LEFT JOIN note_tags nt ON nt.id = nta.tag_id
      WHERE
        n.deleted_at IS NULL
        AND (n.owner_user_id = ${userId}::uuid OR ns_me.id IS NOT NULL)
        AND n.is_trashed = ${trashed ?? false}
        AND n.is_archived = ${archived ?? false}
        AND (${folderId ?? null}::uuid IS NULL OR n.folder_id = ${folderId ?? null}::uuid)
        AND (${tagId ?? null}::uuid IS NULL OR EXISTS (
          SELECT 1 FROM note_tag_assignments nta2
          WHERE nta2.note_id = n.id AND nta2.tag_id = ${tagId ?? null}::uuid
        ))
        AND (${q ?? null} IS NULL OR to_tsvector('spanish', coalesce(n.title,'') || ' ' || coalesce(n.content_text,'')) @@ plainto_tsquery('spanish', ${q ?? null}))
        AND (${shared ?? null}::boolean IS NULL OR (${shared ?? null}::boolean = true AND ns_me.id IS NOT NULL))
      GROUP BY n.id, ns_me.permission
      ORDER BY n.is_pinned DESC, n.updated_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `
    return rows
  }

  async function updateNote(noteId, userId, data) {
    await assertAccess(noteId, userId, 'edit')
    const fields = []
    const values = []

    if (data.title !== undefined) { fields.push('title'); values.push(data.title) }
    if (data.content !== undefined) { fields.push('content'); values.push(JSON.stringify(data.content) + '::jsonb') }
    if (data.contentText !== undefined) { fields.push('content_text'); values.push(data.contentText) }
    if (data.icon !== undefined) { fields.push('icon'); values.push(data.icon) }
    if (data.backgroundColor !== undefined) { fields.push('background_color'); values.push(data.backgroundColor) }
    if (data.backgroundImageUrl !== undefined) { fields.push('background_image_url'); values.push(data.backgroundImageUrl) }
    if (data.coverUrl !== undefined) { fields.push('cover_url'); values.push(data.coverUrl) }
    if (data.folderId !== undefined) { fields.push('folder_id'); values.push(data.folderId) }
    if (data.isPinned !== undefined) { fields.push('is_pinned'); values.push(data.isPinned) }
    if (data.isArchived !== undefined) { fields.push('is_archived'); values.push(data.isArchived) }
    if (data.wordCount !== undefined) { fields.push('word_count'); values.push(data.wordCount) }

    if (!fields.length) return getNote(noteId, userId)

    // Build dynamic update using $executeRaw and string interpolation is unsafe.
    // Use a fixed-structure update with explicit columns to avoid injection.
    const rows = await prisma.$queryRaw`
      UPDATE notes SET
        title = COALESCE(${data.title ?? null}, title),
        content = COALESCE(${data.content ? JSON.stringify(data.content) : null}::jsonb, content),
        content_text = COALESCE(${data.contentText ?? null}, content_text),
        icon = COALESCE(${data.icon ?? null}, icon),
        background_color = ${data.backgroundColor !== undefined ? data.backgroundColor : null},
        background_image_url = ${data.backgroundImageUrl !== undefined ? data.backgroundImageUrl : null},
        cover_url = ${data.coverUrl !== undefined ? data.coverUrl : null},
        folder_id = ${data.folderId !== undefined ? data.folderId : null}::uuid,
        is_pinned = COALESCE(${data.isPinned ?? null}, is_pinned),
        is_archived = COALESCE(${data.isArchived ?? null}, is_archived),
        word_count = COALESCE(${data.wordCount ?? null}, word_count),
        updated_at = now()
      WHERE id = ${noteId}::uuid AND deleted_at IS NULL
      RETURNING *
    `
    // Broadcast update to collaborators
    const sharesRows = await prisma.$queryRaw`
      SELECT shared_with_user_id FROM note_shares WHERE note_id = ${noteId}::uuid
    `
    const collaboratorIds = sharesRows.map(r => r.shared_with_user_id)
    if (collaboratorIds.length) {
      broadcaster.broadcastToUsers(collaboratorIds, 'notes.note.updated', { noteId })
    }
    return rows[0]
  }

  async function trashNote(noteId, userId) {
    await assertAccess(noteId, userId, 'edit')
    const rows = await prisma.$queryRaw`
      UPDATE notes SET is_trashed = true, trashed_at = now(), updated_at = now()
      WHERE id = ${noteId}::uuid AND owner_user_id = ${userId}::uuid
      RETURNING id
    `
    if (!rows.length) throw new NotesServiceError('Solo el propietario puede eliminar esta nota', 403)
    return { ok: true }
  }

  async function restoreNote(noteId, userId) {
    await prisma.$queryRaw`
      UPDATE notes SET is_trashed = false, trashed_at = null, updated_at = now()
      WHERE id = ${noteId}::uuid AND owner_user_id = ${userId}::uuid
    `
    return { ok: true }
  }

  async function permanentDelete(noteId, userId) {
    const rows = await prisma.$queryRaw`
      SELECT id FROM notes WHERE id = ${noteId}::uuid AND owner_user_id = ${userId}::uuid AND is_trashed = true
    `
    if (!rows.length) throw new NotesServiceError('Nota no encontrada en papelera o no eres el propietario', 403)
    await prisma.$queryRaw`DELETE FROM notes WHERE id = ${noteId}::uuid`
    return { ok: true }
  }

  return {
    createNote, getNote, listNotes, updateNote, trashNote, restoreNote,
    permanentDelete, assertAccess,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/notes/notes-service.js
git commit -m "feat(notes): add notes CRUD service with ownership + share access control"
```

---

## Task 3: Folders Service

**Files:**
- Create: `apps/api/src/routes/notes/folders-service.js`

- [ ] **Step 1: Create the file**

```javascript
// apps/api/src/routes/notes/folders-service.js

export class FoldersServiceError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

export function createFoldersService({ prisma }) {
  async function listFolders(userId) {
    return prisma.$queryRaw`
      SELECT f.*,
        (SELECT count(*)::int FROM notes n WHERE n.folder_id = f.id AND n.deleted_at IS NULL AND n.is_trashed = false) AS note_count
      FROM note_folders f
      WHERE f.owner_user_id = ${userId}::uuid
      ORDER BY f.sort_order ASC, f.name ASC
    `
  }

  async function createFolder({ userId, companyId, name, color, icon, parentFolderId }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO note_folders (owner_user_id, company_id, name, color, icon, parent_folder_id)
      VALUES (${userId}::uuid, ${companyId ?? null}::uuid, ${name}, ${color ?? null}, ${icon ?? null}, ${parentFolderId ?? null}::uuid)
      RETURNING *
    `
    return rows[0]
  }

  async function updateFolder(folderId, userId, { name, color, icon, parentFolderId, sortOrder }) {
    const rows = await prisma.$queryRaw`
      UPDATE note_folders SET
        name = COALESCE(${name ?? null}, name),
        color = COALESCE(${color ?? null}, color),
        icon = COALESCE(${icon ?? null}, icon),
        parent_folder_id = ${parentFolderId !== undefined ? parentFolderId : null}::uuid,
        sort_order = COALESCE(${sortOrder ?? null}, sort_order),
        updated_at = now()
      WHERE id = ${folderId}::uuid AND owner_user_id = ${userId}::uuid
      RETURNING *
    `
    if (!rows.length) throw new FoldersServiceError('Carpeta no encontrada', 404)
    return rows[0]
  }

  async function deleteFolder(folderId, userId) {
    // Notes in this folder become un-foldered (ON DELETE SET NULL handles it)
    await prisma.$queryRaw`
      DELETE FROM note_folders WHERE id = ${folderId}::uuid AND owner_user_id = ${userId}::uuid
    `
    return { ok: true }
  }

  return { listFolders, createFolder, updateFolder, deleteFolder }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/notes/folders-service.js
git commit -m "feat(notes): add folders service"
```

---

## Task 4: Tags Service

**Files:**
- Create: `apps/api/src/routes/notes/tags-service.js`

- [ ] **Step 1: Create the file**

```javascript
// apps/api/src/routes/notes/tags-service.js

export class TagsServiceError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

export function createTagsService({ prisma }) {
  async function listTags(userId) {
    return prisma.$queryRaw`
      SELECT t.*,
        (SELECT count(*)::int FROM note_tag_assignments nta JOIN notes n ON n.id = nta.note_id
         WHERE nta.tag_id = t.id AND n.deleted_at IS NULL) AS note_count
      FROM note_tags t
      WHERE t.owner_user_id = ${userId}::uuid
      ORDER BY t.name ASC
    `
  }

  async function createTag({ userId, companyId, name, color }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO note_tags (owner_user_id, company_id, name, color)
      VALUES (${userId}::uuid, ${companyId ?? null}::uuid, ${name}, ${color ?? '#6366f1'})
      ON CONFLICT (owner_user_id, name) DO UPDATE SET color = EXCLUDED.color
      RETURNING *
    `
    return rows[0]
  }

  async function updateTag(tagId, userId, { name, color }) {
    const rows = await prisma.$queryRaw`
      UPDATE note_tags SET
        name = COALESCE(${name ?? null}, name),
        color = COALESCE(${color ?? null}, color)
      WHERE id = ${tagId}::uuid AND owner_user_id = ${userId}::uuid
      RETURNING *
    `
    if (!rows.length) throw new TagsServiceError('Etiqueta no encontrada', 404)
    return rows[0]
  }

  async function deleteTag(tagId, userId) {
    await prisma.$queryRaw`
      DELETE FROM note_tags WHERE id = ${tagId}::uuid AND owner_user_id = ${userId}::uuid
    `
    return { ok: true }
  }

  async function setNoteTags(noteId, tagIds) {
    // Replace all tag assignments for this note
    await prisma.$queryRaw`DELETE FROM note_tag_assignments WHERE note_id = ${noteId}::uuid`
    if (tagIds.length) {
      for (const tagId of tagIds) {
        await prisma.$queryRaw`
          INSERT INTO note_tag_assignments (note_id, tag_id)
          VALUES (${noteId}::uuid, ${tagId}::uuid)
          ON CONFLICT DO NOTHING
        `
      }
    }
    return { ok: true }
  }

  async function removeNoteTag(noteId, tagId) {
    await prisma.$queryRaw`
      DELETE FROM note_tag_assignments WHERE note_id = ${noteId}::uuid AND tag_id = ${tagId}::uuid
    `
    return { ok: true }
  }

  return { listTags, createTag, updateTag, deleteTag, setNoteTags, removeNoteTag }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/notes/tags-service.js
git commit -m "feat(notes): add tags service with note-tag assignment"
```

---

## Task 5: Shares + Publish Service

**Files:**
- Create: `apps/api/src/routes/notes/shares-service.js`

- [ ] **Step 1: Create the file**

```javascript
// apps/api/src/routes/notes/shares-service.js
import { randomBytes } from 'crypto'

export class SharesServiceError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

function generateSlug() {
  return randomBytes(8).toString('base64url')  // ~11 char URL-safe slug
}

export function createSharesService({ prisma, broadcaster }) {
  async function listShares(noteId, requestingUserId) {
    // Only owner can see share list
    const owns = await prisma.$queryRaw`
      SELECT id FROM notes WHERE id = ${noteId}::uuid AND owner_user_id = ${requestingUserId}::uuid AND deleted_at IS NULL
    `
    if (!owns.length) throw new SharesServiceError('Sin acceso', 403)

    return prisma.$queryRaw`
      SELECT ns.*, up.display_name, up.avatar_url, up.email
      FROM note_shares ns
      JOIN user_profile up ON up.id = ns.shared_with_user_id
      WHERE ns.note_id = ${noteId}::uuid
      ORDER BY ns.created_at ASC
    `
  }

  async function shareNote(noteId, requestingUserId, { targetUserId, permission }) {
    const owns = await prisma.$queryRaw`
      SELECT id FROM notes WHERE id = ${noteId}::uuid AND owner_user_id = ${requestingUserId}::uuid AND deleted_at IS NULL
    `
    if (!owns.length) throw new SharesServiceError('Solo el propietario puede compartir la nota', 403)
    if (targetUserId === requestingUserId) throw new SharesServiceError('No puedes compartir contigo mismo', 400)

    const rows = await prisma.$queryRaw`
      INSERT INTO note_shares (note_id, shared_with_user_id, shared_by_user_id, permission)
      VALUES (${noteId}::uuid, ${targetUserId}::uuid, ${requestingUserId}::uuid, ${permission ?? 'read'})
      ON CONFLICT (note_id, shared_with_user_id) DO UPDATE SET permission = EXCLUDED.permission
      RETURNING *
    `
    // Notify recipient
    broadcaster.broadcastToUser(targetUserId, 'notes.note.shared', { noteId, permission })
    return rows[0]
  }

  async function updateShare(shareId, noteId, requestingUserId, { permission }) {
    const owns = await prisma.$queryRaw`
      SELECT id FROM notes WHERE id = ${noteId}::uuid AND owner_user_id = ${requestingUserId}::uuid
    `
    if (!owns.length) throw new SharesServiceError('Sin permiso', 403)
    const rows = await prisma.$queryRaw`
      UPDATE note_shares SET permission = ${permission}
      WHERE id = ${shareId}::uuid AND note_id = ${noteId}::uuid
      RETURNING *
    `
    if (!rows.length) throw new SharesServiceError('Comparticion no encontrada', 404)
    return rows[0]
  }

  async function revokeShare(shareId, noteId, requestingUserId) {
    const owns = await prisma.$queryRaw`
      SELECT id FROM notes WHERE id = ${noteId}::uuid AND owner_user_id = ${requestingUserId}::uuid
    `
    if (!owns.length) throw new SharesServiceError('Sin permiso', 403)
    await prisma.$queryRaw`
      DELETE FROM note_shares WHERE id = ${shareId}::uuid AND note_id = ${noteId}::uuid
    `
    return { ok: true }
  }

  async function publishNote(noteId, requestingUserId) {
    const rows = await prisma.$queryRaw`
      SELECT id, public_slug FROM notes WHERE id = ${noteId}::uuid AND owner_user_id = ${requestingUserId}::uuid AND deleted_at IS NULL
    `
    if (!rows.length) throw new SharesServiceError('Nota no encontrada', 404)
    const note = rows[0]
    const slug = note.public_slug ?? generateSlug()
    const updated = await prisma.$queryRaw`
      UPDATE notes SET is_public = true, public_slug = ${slug} WHERE id = ${noteId}::uuid RETURNING id, public_slug, is_public
    `
    return updated[0]
  }

  async function unpublishNote(noteId, requestingUserId) {
    const rows = await prisma.$queryRaw`
      SELECT id FROM notes WHERE id = ${noteId}::uuid AND owner_user_id = ${requestingUserId}::uuid
    `
    if (!rows.length) throw new SharesServiceError('Nota no encontrada', 404)
    await prisma.$queryRaw`
      UPDATE notes SET is_public = false WHERE id = ${noteId}::uuid
    `
    return { ok: true }
  }

  async function getPublicNote(slug) {
    const rows = await prisma.$queryRaw`
      SELECT n.id, n.title, n.content, n.icon, n.background_color, n.background_image_url,
             n.cover_url, n.word_count, n.updated_at,
             up.display_name AS author_name, up.avatar_url AS author_avatar
      FROM notes n
      JOIN user_profile up ON up.id = n.owner_user_id
      WHERE n.public_slug = ${slug} AND n.is_public = true AND n.deleted_at IS NULL
    `
    if (!rows.length) throw new SharesServiceError('Nota no encontrada o no disponible', 404)
    return rows[0]
  }

  return { listShares, shareNote, updateShare, revokeShare, publishNote, unpublishNote, getPublicNote }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/notes/shares-service.js
git commit -m "feat(notes): add shares and public publish service"
```

---

## Task 6: Y.js State Service

**Files:**
- Create: `apps/api/src/routes/notes/ydoc-service.js`

- [ ] **Step 1: Create the file**

```javascript
// apps/api/src/routes/notes/ydoc-service.js

export function createYDocService({ prisma }) {
  // Returns the persisted Y.js document state as a Buffer (binary).
  // Frontend applies this via Y.applyUpdate(doc, new Uint8Array(state))
  async function getState(noteId, userId) {
    // Access check: user must be owner or share recipient
    const access = await prisma.$queryRaw`
      SELECT n.id FROM notes n
      LEFT JOIN note_shares ns ON ns.note_id = n.id AND ns.shared_with_user_id = ${userId}::uuid
      WHERE n.id = ${noteId}::uuid AND n.deleted_at IS NULL
        AND (n.owner_user_id = ${userId}::uuid OR ns.id IS NOT NULL)
    `
    if (!access.length) return null

    const rows = await prisma.$queryRaw`
      SELECT state FROM note_ydoc_state WHERE note_id = ${noteId}::uuid
    `
    return rows.length ? rows[0].state : null
  }

  // Saves a full Y.js document state snapshot (called periodically by frontend).
  // `stateBuffer` is a Buffer/Uint8Array from Y.encodeStateAsUpdate(doc)
  async function saveState(noteId, userId, stateBuffer) {
    // Edit permission required
    const access = await prisma.$queryRaw`
      SELECT n.id FROM notes n
      LEFT JOIN note_shares ns ON ns.note_id = n.id AND ns.shared_with_user_id = ${userId}::uuid
        AND ns.permission = 'edit'
      WHERE n.id = ${noteId}::uuid AND n.deleted_at IS NULL
        AND (n.owner_user_id = ${userId}::uuid OR ns.id IS NOT NULL)
    `
    if (!access.length) return { ok: false }

    await prisma.$queryRaw`
      INSERT INTO note_ydoc_state (note_id, state, version, updated_at)
      VALUES (${noteId}::uuid, ${stateBuffer}, 1, now())
      ON CONFLICT (note_id) DO UPDATE SET
        state = EXCLUDED.state,
        version = note_ydoc_state.version + 1,
        updated_at = now()
    `
    return { ok: true }
  }

  return { getState, saveState }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/notes/ydoc-service.js
git commit -m "feat(notes): add Y.js document state persistence service"
```

---

## Task 7: Notes Router

**Files:**
- Create: `apps/api/src/routes/notes/index.js`

- [ ] **Step 1: Create the Hono router**

```javascript
// apps/api/src/routes/notes/index.js
import { Hono } from 'hono'
import { createNotesService } from './notes-service.js'
import { createFoldersService } from './folders-service.js'
import { createTagsService } from './tags-service.js'
import { createSharesService } from './shares-service.js'
import { createYDocService } from './ydoc-service.js'

export function createNotesRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, broadcaster }) {
  const app = new Hono()

  const notesService = createNotesService({ prisma, supabaseAdmin, broadcaster })
  const foldersService = createFoldersService({ prisma })
  const tagsService = createTagsService({ prisma })
  const sharesService = createSharesService({ prisma, broadcaster })
  const ydocService = createYDocService({ prisma })

  const handleError = (c, err) => {
    const status = err.status ?? 500
    return c.json({ error: err.message }, status)
  }

  // ── Notes CRUD ──────────────────────────────────────────────────────────────

  app.get('/notes', authMiddleware, requirePermission('notes.notes.read'), async (c) => {
    try {
      const userId = c.get('userId')
      const { folderId, tagId, q, archived, trashed, shared, page, pageSize } = c.req.query()
      const notes = await notesService.listNotes({
        userId, folderId, tagId, q,
        archived: archived === 'true',
        trashed: trashed === 'true',
        shared: shared === 'true' ? true : undefined,
        page: page ? parseInt(page) : 1,
        pageSize: pageSize ? Math.min(parseInt(pageSize), 100) : 50,
      })
      return c.json({ notes })
    } catch (err) { return handleError(c, err) }
  })

  app.post('/notes', authMiddleware, requirePermission('notes.notes.create'), async (c) => {
    try {
      const userId = c.get('userId')
      const companyId = c.get('companyId')
      const body = await c.req.json()
      const note = await notesService.createNote({ userId, companyId, ...body })
      return c.json({ note }, 201)
    } catch (err) { return handleError(c, err) }
  })

  app.get('/notes/:id', authMiddleware, requirePermission('notes.notes.read'), async (c) => {
    try {
      const userId = c.get('userId')
      const note = await notesService.getNote(c.req.param('id'), userId)
      return c.json({ note })
    } catch (err) { return handleError(c, err) }
  })

  app.patch('/notes/:id', authMiddleware, requirePermission('notes.notes.create'), async (c) => {
    try {
      const userId = c.get('userId')
      const body = await c.req.json()
      const note = await notesService.updateNote(c.req.param('id'), userId, body)
      return c.json({ note })
    } catch (err) { return handleError(c, err) }
  })

  app.delete('/notes/:id', authMiddleware, requirePermission('notes.notes.delete'), async (c) => {
    try {
      const userId = c.get('userId')
      await notesService.trashNote(c.req.param('id'), userId)
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err) }
  })

  app.post('/notes/:id/restore', authMiddleware, requirePermission('notes.notes.create'), async (c) => {
    try {
      const userId = c.get('userId')
      await notesService.restoreNote(c.req.param('id'), userId)
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err) }
  })

  app.delete('/notes/:id/permanent', authMiddleware, requirePermission('notes.notes.delete'), async (c) => {
    try {
      const userId = c.get('userId')
      await notesService.permanentDelete(c.req.param('id'), userId)
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err) }
  })

  // ── Y.js State ──────────────────────────────────────────────────────────────

  app.get('/notes/:id/ydoc', authMiddleware, requirePermission('notes.notes.read'), async (c) => {
    try {
      const userId = c.get('userId')
      const state = await ydocService.getState(c.req.param('id'), userId)
      if (!state) return c.json({ state: null })
      // Return as base64 so it's JSON-serializable
      return c.json({ state: Buffer.from(state).toString('base64') })
    } catch (err) { return handleError(c, err) }
  })

  app.post('/notes/:id/ydoc', authMiddleware, requirePermission('notes.notes.create'), async (c) => {
    try {
      const userId = c.get('userId')
      // Expect JSON body: { state: "<base64>" }
      const { state } = await c.req.json()
      const buf = Buffer.from(state, 'base64')
      await ydocService.saveState(c.req.param('id'), userId, buf)
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err) }
  })

  // ── Folders ─────────────────────────────────────────────────────────────────

  app.get('/notes/folders', authMiddleware, requirePermission('notes.notes.read'), async (c) => {
    try {
      const folders = await foldersService.listFolders(c.get('userId'))
      return c.json({ folders })
    } catch (err) { return handleError(c, err) }
  })

  app.post('/notes/folders', authMiddleware, requirePermission('notes.notes.create'), async (c) => {
    try {
      const userId = c.get('userId')
      const companyId = c.get('companyId')
      const body = await c.req.json()
      const folder = await foldersService.createFolder({ userId, companyId, ...body })
      return c.json({ folder }, 201)
    } catch (err) { return handleError(c, err) }
  })

  app.patch('/notes/folders/:id', authMiddleware, requirePermission('notes.notes.create'), async (c) => {
    try {
      const folder = await foldersService.updateFolder(c.req.param('id'), c.get('userId'), await c.req.json())
      return c.json({ folder })
    } catch (err) { return handleError(c, err) }
  })

  app.delete('/notes/folders/:id', authMiddleware, requirePermission('notes.notes.delete'), async (c) => {
    try {
      await foldersService.deleteFolder(c.req.param('id'), c.get('userId'))
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err) }
  })

  // ── Tags ────────────────────────────────────────────────────────────────────

  app.get('/notes/tags', authMiddleware, requirePermission('notes.notes.read'), async (c) => {
    try {
      const tags = await tagsService.listTags(c.get('userId'))
      return c.json({ tags })
    } catch (err) { return handleError(c, err) }
  })

  app.post('/notes/tags', authMiddleware, requirePermission('notes.notes.create'), async (c) => {
    try {
      const userId = c.get('userId')
      const companyId = c.get('companyId')
      const body = await c.req.json()
      const tag = await tagsService.createTag({ userId, companyId, ...body })
      return c.json({ tag }, 201)
    } catch (err) { return handleError(c, err) }
  })

  app.patch('/notes/tags/:id', authMiddleware, requirePermission('notes.notes.create'), async (c) => {
    try {
      const tag = await tagsService.updateTag(c.req.param('id'), c.get('userId'), await c.req.json())
      return c.json({ tag })
    } catch (err) { return handleError(c, err) }
  })

  app.delete('/notes/tags/:id', authMiddleware, requirePermission('notes.notes.delete'), async (c) => {
    try {
      await tagsService.deleteTag(c.req.param('id'), c.get('userId'))
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err) }
  })

  app.post('/notes/:id/tags', authMiddleware, requirePermission('notes.notes.create'), async (c) => {
    try {
      await notesService.assertAccess(c.req.param('id'), c.get('userId'), 'edit')
      const { tagIds } = await c.req.json()
      await tagsService.setNoteTags(c.req.param('id'), tagIds ?? [])
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err) }
  })

  app.delete('/notes/:id/tags/:tagId', authMiddleware, requirePermission('notes.notes.create'), async (c) => {
    try {
      await tagsService.removeNoteTag(c.req.param('id'), c.req.param('tagId'))
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err) }
  })

  // ── Shares ──────────────────────────────────────────────────────────────────

  app.get('/notes/:id/shares', authMiddleware, requirePermission('notes.notes.share'), async (c) => {
    try {
      const shares = await sharesService.listShares(c.req.param('id'), c.get('userId'))
      return c.json({ shares })
    } catch (err) { return handleError(c, err) }
  })

  app.post('/notes/:id/shares', authMiddleware, requirePermission('notes.notes.share'), async (c) => {
    try {
      const share = await sharesService.shareNote(c.req.param('id'), c.get('userId'), await c.req.json())
      return c.json({ share }, 201)
    } catch (err) { return handleError(c, err) }
  })

  app.patch('/notes/:id/shares/:shareId', authMiddleware, requirePermission('notes.notes.share'), async (c) => {
    try {
      const share = await sharesService.updateShare(c.req.param('shareId'), c.req.param('id'), c.get('userId'), await c.req.json())
      return c.json({ share })
    } catch (err) { return handleError(c, err) }
  })

  app.delete('/notes/:id/shares/:shareId', authMiddleware, requirePermission('notes.notes.share'), async (c) => {
    try {
      await sharesService.revokeShare(c.req.param('shareId'), c.req.param('id'), c.get('userId'))
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err) }
  })

  // ── Publish ─────────────────────────────────────────────────────────────────

  app.post('/notes/:id/publish', authMiddleware, requirePermission('notes.notes.publish'), async (c) => {
    try {
      const result = await sharesService.publishNote(c.req.param('id'), c.get('userId'))
      return c.json(result)
    } catch (err) { return handleError(c, err) }
  })

  app.delete('/notes/:id/publish', authMiddleware, requirePermission('notes.notes.publish'), async (c) => {
    try {
      await sharesService.unpublishNote(c.req.param('id'), c.get('userId'))
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err) }
  })

  // ── Image Upload Presign ─────────────────────────────────────────────────────

  app.post('/notes/images/presign', authMiddleware, requirePermission('notes.notes.create'), async (c) => {
    try {
      const { fileName, mimeType, noteId } = await c.req.json()
      const userId = c.get('userId')
      const ext = fileName.split('.').pop()
      const key = `notes/${userId}/${noteId ?? 'draft'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error } = await supabaseAdmin.storage
        .from('atlas-notes')
        .createSignedUploadUrl(key)
      if (error) throw error
      return c.json({ uploadUrl: data.signedUrl, objectKey: key, bucket: 'atlas-notes' })
    } catch (err) { return handleError(c, err) }
  })

  // ── Public Route ─────────────────────────────────────────────────────────────

  app.get('/public/notes/:slug', async (c) => {
    try {
      const note = await sharesService.getPublicNote(c.req.param('slug'))
      return c.json({ note })
    } catch (err) { return handleError(c, err) }
  })

  return app
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/notes/index.js
git commit -m "feat(notes): add Hono notes router with all 24 endpoints"
```

---

## Task 8: Register Router in apps/api/src/index.js

**Files:**
- Modify: `apps/api/src/index.js`

- [ ] **Step 1: Find the chat router import block (around line 50-80) and add notes import after it**

Search for: `import { createChatRouter }` and add below it:
```javascript
import { createNotesRouter } from './routes/notes/index.js'
```

- [ ] **Step 2: Find where `createChatRouter` is mounted (search for `createChatRouter({`) and add notes mount after it**

```javascript
app.route('/', createNotesRouter({
  prisma,
  supabaseAdmin,
  authMiddleware,
  requirePermission,
  broadcaster,
}))
```

- [ ] **Step 3: Verify the API starts without errors**

```bash
pnpm dev:api
```

Expected: Server starts on port 4010, no import errors.

- [ ] **Step 4: Smoke test**

```bash
# Should return 401 (auth required)
curl -s http://localhost:4010/notes | jq .
```

Expected: `{"error":"Unauthorized"}` or similar 401.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(notes): mount notes router in API"
```

---

## Task 9: Notes Manifest in core-modules.js

**Files:**
- Modify: `apps/api/src/manifests/official/core-modules.js`

- [ ] **Step 1: Add `notesMap` manifest**

Find the last manifest definition in the file (e.g., `chatMap`) and add after it:

```javascript
export const notesMap = createModuleManifest({
  key: 'atlas.notes',
  name: 'Notas',
  description: 'Editor de notas enriquecido con colaboracion en tiempo real, markdown, imagenes, tablas y dibujo',
  version: '0.1.0',
  kind: MODULE_KINDS.CORE,
  core: true,
  uninstallable: false,
  icon: 'NotebookPen',
  color: '#f59e0b',
  pwa: { shortName: 'Notas', startPath: '/notes' },
  category: 'productividad',
  summary: 'Notas personales y colaborativas con editor rico',

  dependencies: [
    { key: 'atlas.core' },
    { key: 'atlas.identity' },
  ],
  consumes: ['atlas.files', 'atlas.notifications'],

  lifecycle: {
    installable: false,
    uninstallable: false,
    resettable: false,
    supportsDataPurge: false,
  },

  navigation: [
    {
      label: 'Notas',
      path: '/notes',
      icon: 'NotebookPen',
      layout: 'main',
      permissionKey: 'notes.notes.read',
    },
  ],

  permissions: [
    { key: 'notes.access', name: 'Acceder a Notas' },
    { key: 'notes.notes.read', name: 'Ver notas propias y compartidas' },
    { key: 'notes.notes.create', name: 'Crear y editar notas' },
    { key: 'notes.notes.delete', name: 'Eliminar notas' },
    { key: 'notes.notes.share', name: 'Compartir notas con otros usuarios' },
    { key: 'notes.notes.publish', name: 'Publicar notas con enlace publico' },
  ],

  acl: {
    module: 'notes.access',
    actions: {
      'notes.notes.read': 'notes.notes.read',
      'notes.notes.create': 'notes.notes.create',
      'notes.notes.delete': 'notes.notes.delete',
      'notes.notes.share': 'notes.notes.share',
      'notes.notes.publish': 'notes.notes.publish',
    },
  },
})
```

- [ ] **Step 2: Add `notesMap` to the `coreModules` export array**

Find `export const coreModules = [` and add `...notesMap,` (or `notesMap` depending on how `createModuleManifest` returns data — check if other entries use spread `...chatMap` or direct `chatMap`).

- [ ] **Step 3: Run seed to register the module in DB**

```bash
pnpm db:seed
```

Expected: `atlas.notes` appears in the DB `AtlasModule` table.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/manifests/official/core-modules.js
git commit -m "feat(notes): add atlas.notes core module manifest"
```

---

## Task 10: Notes SDK Domain

**Files:**
- Modify: `packages/sdk/src/index.js`

- [ ] **Step 1: Add the notes domain methods**

Find the section in `packages/sdk/src/index.js` where chat is defined (search for `chat:`) and add a `notes:` domain after the same pattern:

```javascript
notes: {
  list: (params = {}, token) =>
    request(`/notes${toQueryString(params)}`, { headers: withAuthHeaders(token) }),
  create: (data, token) =>
    request('/notes', { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
  get: (id, token) =>
    request(`/notes/${encodeURIComponent(id)}`, { headers: withAuthHeaders(token) }),
  update: (id, data, token) =>
    request(`/notes/${encodeURIComponent(id)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
  trash: (id, token) =>
    request(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
  restore: (id, token) =>
    request(`/notes/${encodeURIComponent(id)}/restore`, { method: 'POST', headers: withAuthHeaders(token) }),
  permanentDelete: (id, token) =>
    request(`/notes/${encodeURIComponent(id)}/permanent`, { method: 'DELETE', headers: withAuthHeaders(token) }),

  // Y.js state
  getYDoc: (id, token) =>
    request(`/notes/${encodeURIComponent(id)}/ydoc`, { headers: withAuthHeaders(token) }),
  saveYDoc: (id, state, token) =>
    request(`/notes/${encodeURIComponent(id)}/ydoc`, { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify({ state }) }),

  // Folders
  listFolders: (token) =>
    request('/notes/folders', { headers: withAuthHeaders(token) }),
  createFolder: (data, token) =>
    request('/notes/folders', { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
  updateFolder: (id, data, token) =>
    request(`/notes/folders/${encodeURIComponent(id)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
  deleteFolder: (id, token) =>
    request(`/notes/folders/${encodeURIComponent(id)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),

  // Tags
  listTags: (token) =>
    request('/notes/tags', { headers: withAuthHeaders(token) }),
  createTag: (data, token) =>
    request('/notes/tags', { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
  updateTag: (id, data, token) =>
    request(`/notes/tags/${encodeURIComponent(id)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
  deleteTag: (id, token) =>
    request(`/notes/tags/${encodeURIComponent(id)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
  setNoteTags: (noteId, tagIds, token) =>
    request(`/notes/${encodeURIComponent(noteId)}/tags`, { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify({ tagIds }) }),

  // Shares
  listShares: (noteId, token) =>
    request(`/notes/${encodeURIComponent(noteId)}/shares`, { headers: withAuthHeaders(token) }),
  shareNote: (noteId, data, token) =>
    request(`/notes/${encodeURIComponent(noteId)}/shares`, { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
  updateShare: (noteId, shareId, data, token) =>
    request(`/notes/${encodeURIComponent(noteId)}/shares/${encodeURIComponent(shareId)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
  revokeShare: (noteId, shareId, token) =>
    request(`/notes/${encodeURIComponent(noteId)}/shares/${encodeURIComponent(shareId)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),

  // Publish
  publish: (noteId, token) =>
    request(`/notes/${encodeURIComponent(noteId)}/publish`, { method: 'POST', headers: withAuthHeaders(token) }),
  unpublish: (noteId, token) =>
    request(`/notes/${encodeURIComponent(noteId)}/publish`, { method: 'DELETE', headers: withAuthHeaders(token) }),

  // Images
  presignImage: (data, token) =>
    request('/notes/images/presign', { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),

  // Public (no auth)
  getPublic: (slug) =>
    request(`/public/notes/${encodeURIComponent(slug)}`),
},
```

- [ ] **Step 2: Verify no lint errors**

```bash
node --check packages/sdk/src/index.js
```

Expected: No syntax errors printed.

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/index.js
git commit -m "feat(notes): add notes domain to Atlas SDK client"
```

---

## Verification

After completing all tasks, verify end-to-end with these curl commands (replace `$TOKEN` with a valid JWT):

```bash
# 1. Create a note
curl -s -X POST http://localhost:4010/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Mi primera nota","content":{"type":"doc","content":[]}}' | jq .

# 2. List notes
curl -s http://localhost:4010/notes \
  -H "Authorization: Bearer $TOKEN" | jq .notes[0].id

# 3. Create a folder
curl -s -X POST http://localhost:4010/notes/folders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Trabajo","color":"#3b82f6"}' | jq .

# 4. Publish note (use the id from step 1)
curl -s -X POST http://localhost:4010/notes/<ID>/publish \
  -H "Authorization: Bearer $TOKEN" | jq .public_slug

# 5. Read public note
curl -s http://localhost:4010/public/notes/<SLUG> | jq .note.title
```

All 5 should succeed. Then proceed to Plan B (Frontend).
