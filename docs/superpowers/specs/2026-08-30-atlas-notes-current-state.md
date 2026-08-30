# atlas.notes — Current State Spec

**Date:** 2026-08-30
**Module:** `atlas.notes` (CORE, `core: true`, `uninstallable: false`, version `0.1.0`)
**Status:** Living reference — describes the module after the 2026-08-30 deep audit + fix pass.

---

## 1. Layout

```
apps/api/src/routes/notes/
  index.js            → createNotesRouter(...)  (mounted directly on app; the
                        router applies its own authMiddleware, like atlas.chat)
  notes-service.js    (~455) — notes CRUD, access checks, list/search
  folders-service.js  tags-service.js  shares-service.js  ydoc-service.js
  __tests__/notes-access.test.js   (NEW 2026-08-30)
apps/api/src/index.js
  GET /public/notes/:slug          — unauthenticated public-note read (registered
                                     before auth middleware; uses shares-service)
apps/desktop/src/modules/atlas.notes/
  NotesScreen.jsx (3-pane workspace)  PublicNoteScreen.jsx
  components/  NoteEditor  NoteToolbar  NotesSidebar  NoteShareModal
               NoteSettingsPanel  DrawingCanvas  ImageAnnotationOverlay  …
  lib/  editor-extensions  SupabaseYjsProvider  extensions/{SlashCommand,DrawingBlock,AnnotatableImage}
```

## 2. Data model (raw-SQL migration `20260627120000_atlas_notes_tables`, no Prisma models)

`notes`, `note_folders`, `note_tags`, `note_tag_assignments`, `note_shares`,
`note_ydoc_state`. Ownership by `owner_user_id` (→ `user_profile`). Every table
has a nullable `company_id` **but no code path filters by it** — notes are
strictly per-user; `company_id` is metadata only (used now for the share-scope
check — see §4). FKs: `folder_id` / `parent_folder_id` = `ON DELETE SET NULL`
(deleting a folder unfiles its notes, no data loss); `note_shares` /
`note_tag_assignments` / `note_ydoc_state` = `ON DELETE CASCADE`.

## 3. Access model

- `notes-service.assertAccess(noteId, userId, "read"|"edit")` — grants on
  `owner_user_id === userId` **or** a `note_shares` row (for `edit`, that row
  must have `permission = 'edit'`). Used by `getNote` / `updateNote`.
- `trashNote` / `restoreNote` / `permanentDelete` — owner only.
- `folders-service` / `tags-service` — every op filtered by `owner_user_id`.
  `setNoteTags` / `removeNoteTag` verify edit-access on the note; `setNoteTags`
  now also verifies each `tagId` belongs to the acting user (2026-08-30).
- `ydoc-service.getState` = owner ∪ any sharee; `saveState` = owner ∪ `edit`
  sharee, plus an **8 MiB hard ceiling** on the Yjs blob (413 otherwise) —
  new 2026-08-30.
- All queries are `$queryRaw` tagged templates — parameterized, no
  `$queryRawUnsafe`, no SQL-injection surface.

## 4. Sharing & the public endpoint (hardened 2026-08-30)

- **`shareNote` now validates the target** (`_assertShareableTarget`): rejects
  self-share (400) and any `targetUserId` who shares **no company** with the
  owner (403) — closes cross-tenant note sharing. Previously `targetUserId` was
  inserted unchecked.
- **`getPublicNote` / `GET /public/notes/:slug`** now `SELECT`s an explicit
  render-safe column list (title, content, icon, cover, colors, word_count,
  slug, timestamps, author name+avatar). It no longer returns `notes.*`
  (`company_id`, `owner_user_id`, `folder_id`, workflow flags).
- `listShares` exposes collaborator **email only to the note owner**; other
  collaborators get name + avatar. `public_slug` = 64-bit `randomBytes` — not
  enumerable.
- The `atlas-notes` storage bucket is **public**: note images have permanent
  public URLs regardless of note privacy (keys are unguessable and prefixed with
  the uploader's id). `POST /notes/presign-image` now rejects a `noteId` the
  caller cannot edit.

## 5. Permissions

`notesMap` in `core-modules.js` (17 keys) — and, as of 2026-08-30,
`apps/api/src/permission-catalog.js` (`groupKey: "notes"`; they were missing,
failing the RBAC contract). Nav `permissionKey`s are correct
(`notes.notes.read` / `notes.shares.read`). The manifest has **no `acl` block**
(notes has no blueprint models — acceptable).

## 6. Search / performance

`listNotes` FTS now uses `to_tsvector('spanish', …)` / `plainto_tsquery('spanish', …)`
to **match the `notes_fts_idx` GIN index** (it previously used `'simple'`, so the
index was never used and every search was a seq scan). Follow-up: consider a
stored `tsvector` column so the CTE can't defeat the expression index.

## 7. UI

- No `window.confirm/alert/prompt`; `ConfirmDialog` for trash + permanent delete
  (`NotesScreen`) and folder delete (`NoteSettingsPanel`). Uses `@atlas/ui`
  `Dialog`, `Popover`, `Select`, `TextField`, `CreatableComboboxField`,
  `EmptyState`, `ErrorState`, `Avatar`.
- **Dark mode fixed 2026-08-30** in `NotesSidebar`, `DrawingCanvas`,
  `ImageAnnotationOverlay` (were hardcoded `bg-gray-*/bg-amber-100` with no
  `dark:` variants) and the remaining `bg-amber-50/100` spots in `NotesScreen`.
  `PublicNoteScreen` deliberately forces the light theme (`bg-gray-*` there is
  intentional).
- `NotesScreen` is a full-bleed 3-pane workspace (list / editor / settings) like
  `atlas.chat` — it intentionally does **not** use `PageHeader`.
- Remaining nit: a few primary actions are raw `<button className="bg-amber-500
  text-white">` rather than `@atlas/ui` `Button` (visually fine in both themes;
  amber is the module's brand color).

## 8. Tests

`apps/api/src/routes/notes/__tests__/notes-access.test.js` (NEW) — 11/11:
ownership on read/write, owner-only trash, `shareNote` self + cross-company
rejection + same-company allow, `getPublicNote` SELECT-list projection, Yjs
size ceiling, read-only-collaborator write rejection, `setNoteTags` foreign-tag
rejection.

## 9. Realtime

`broadcaster.broadcastToUsers` / `broadcastToUser` on `updateNote` and
`shareNote`, scoped to collaborator user-ids; failures are `console.warn`-logged,
not fatal. `SupabaseYjsProvider` drives the client editor.

## 10. Known gaps / follow-ups

- In-browser responsive QA (390 / 1440) not run this pass — the 3-pane
  `NotesScreen` and the editor toolbars are the ones to check against
  `docs/ai-context/ui-screen-audit-checklist.md`.
- `note_ydoc_state` and `notes.content` / `content_text` are two sources of
  truth for the same content, without server-side reconciliation (design of the
  Notion redesign).
- Vestigial `deleted_at` column: never set (`permanentDelete` is a hard
  `DELETE FROM`); the `deleted_at IS NULL` clauses are always-true noise. Left
  in place — harmless, and a future soft-delete window could use it.
- `updateFolder` does not validate `parentFolderId` ownership / prevent cycles
  (low impact — folders are a flat-ish per-user tree).
- FTS still computes `to_tsvector` over a CTE alias; a stored column would
  guarantee index use.
- `calendar.*` and `catalog.*` are still missing from `permission-catalog.js`
  (their own audits) — the RBAC contract test stays red for those. **No
  `notes.*` drift.**

## 11. Verification performed (2026-08-30)

- `node --check` on all `routes/notes/*.js`, `permission-catalog.js`, `index.js` — pass.
- `node --test routes/notes/__tests__/notes-access.test.js` — 11/11.
- `node --test rbac-granular-contract` — `notes.*` no longer reported missing.
- `node --test` inventory + fleet suites — still green.
- `pnpm --filter @atlas/desktop build:web` — pass.
