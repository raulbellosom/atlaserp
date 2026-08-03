# Atlas Notes — Notion-Style Redesign (v1)

Date: 2026-08-03
Status: Draft
Author: Claude (agent session)
Spec file: docs/superpowers/specs/2026-08-03-atlas-notes-notion-redesign-design.md
Plan file: docs/superpowers/plans/2026-08-03-atlas-notes-notion-redesign.md (created after spec approval)

---

## 1. Feature title

Atlas Notes — Notion-style redesign: emoji icons, cover banner, slash command menu, presence indicators, and a full responsive pass.

## 2. Status

Draft

## 3. Context

`atlas.notes` (backend + frontend implemented ~2026-06-27, see `docs/superpowers/plans/2026-06-27-atlas-notes-A-backend.md` / `-B-frontend.md`) already has real-time collaborative editing (Y.js CRDT over Supabase Broadcast, with the awareness protocol tracking cursors), folders, tags, sharing, public links, drawing blocks, and image annotation. On 2026-08-03, while fixing reported bugs in the module, it also became clear during discovery that several pieces of infrastructure were built but never finished on the frontend:

- The `note.cover_url` column exists and is already wired through `updateNote` (backend) and `NotesScreen.jsx`'s optimistic-update map (frontend), but there is no UI anywhere to set it or render it — a Notion-style "cover/banner image" was designed but dropped before shipping.
- The `atlas-notes` Storage bucket did not exist at all until this session (now created, public) — image upload was previously completely broken end to end.
- `note.icon` is rendered by looking up a fixed set of ~68 curated Lucide icon names (`noteIcons.jsx`) — there is no way to pick an actual emoji as a note's icon, even though `emoji-picker-react` is already a dependency and already used in `atlas.chat`.
- The rich-text editor (TipTap) has no "/" slash command menu — inserting a heading, image, table, drawing block, or checklist requires the toolbar, which is a materially different interaction model from Notion, Apple Notes, or Google Keep.
- The awareness protocol already broadcasts per-user cursor presence over the realtime channel, but nothing in the UI surfaces it — collaborators have no visual signal that someone else is viewing/editing the same note right now.

The user has explicitly asked for the module to be much closer to Notion (their stated primary reference, ahead of Apple Notes / Google Keep) in note management, keyboard-driven workflow, and visual polish, and has called out responsiveness specifically as a recurring priority (see `feedback_responsive_qa` memory).

## 4. Problem

`atlas.notes` currently reads as a capable but visually and interactionally unfinished rich-text editor: several Notion-defining affordances (page icon as emoji, cover banner, "/" command menu, live presence) are either entirely absent or half-wired (column exists, no UI), and the existing UI has not been audited against small viewports the way other Atlas modules have.

## 5. Goals

1. A note can have an emoji as its icon (in addition to the existing curated Lucide icon set), picked from the same `emoji-picker-react` component already used in `atlas.chat`.
2. A note can have a cover/banner image, uploaded inline (no navigation to atlas.files), rendered at the top of the editor above the title, using the existing `cover_url` column and the `atlas-notes` public bucket.
3. Typing `/` at the start of an empty line in the editor opens a Notion-style command menu to insert: heading 1/2/3, bullet list, numbered list, task list, quote, code block, table, image, drawing canvas.
4. While a note is open, users see a small presence indicator (avatar stack) showing which other users currently have that note open, sourced from the existing awareness channel.
5. `NotesScreen.jsx` and its child components (list, editor, toolbar, settings panel, image overlay) pass a responsive QA pass at 390px and 1440px per `docs/ai-context/ui-screen-audit-checklist.md`.
6. A short in-app reference of keyboard shortcuts is discoverable from the UI (e.g. a "?" affordance or a settings-panel section), documenting both TipTap/StarterKit defaults already active (Ctrl+B/I/U, Ctrl+Z/Y, etc.) and the new "/" menu.

## 6. Non-goals

1. Full Notion-style block drag-and-drop for every block type (headings, paragraphs, lists, tables). Only images have a drag handle as of this spec (shipped 2026-08-03); extending drag-to-reorder to arbitrary blocks is deferred.
2. Nested/sub-page notes (Notion's page-within-page hierarchy). `atlas.notes` keeps its current flat notes + folders model.
3. Version history / time-travel on note content.
4. AI writing assistance (autocomplete, "ask AI to write", summarization).
5. Offline editing support for notes (unlike `atlas.ledger`'s Tier 2.5 offline cache — not requested here).
6. Changing the underlying Y.js/Supabase Broadcast realtime transport. Goal 4 only adds a UI layer on data already broadcast.
7. A general theming/redesign of colors or typography beyond what's needed to support the cover banner and command menu. The existing amber accent and card-based list stay as-is.

## 7. User stories

- As a notes user, I want to pick an emoji for a note's icon so that my notes are visually distinguishable the way they are in Notion.
- As a notes user, I want to add a banner image to a note so that important notes stand out visually at a glance.
- As a notes user, I want to type `/` to insert a heading, image, or table without reaching for the toolbar, so that writing stays keyboard-driven.
- As a notes user collaborating on a shared note, I want to see who else currently has the note open, so I know if I might be editing alongside someone.
- As a mobile user, I want the notes list, editor, toolbar, and image tools to work cleanly on a small screen, so I'm not blocked from using notes on my phone.

## 8. UX requirements

- All new UI text in Spanish, consistent with the rest of the module ("Insertar imagen", "Ajustes de nota", etc.).
- Emoji picker: opened from the existing icon button in `NoteSettingsPanel.jsx` ("Icono" section) via a segmented control or tab inside the same `Popover` — "Iconos" (existing curated set) vs "Emoji" (new, `emoji-picker-react`). Selecting an emoji stores the raw emoji character in `note.icon` (no new column — `NoteIcon` is extended to render `name` literally as text when it is not a recognized Lucide key). Also add a small icon-or-emoji affordance at the top of `NoteEditor.jsx` itself (Notion convention: icon lives above the title, not only in the settings panel), consistent with where the cover banner and title live.
- Cover banner: "Agregar portada" button appears above the title when no `cover_url` is set (visible on hover on desktop, always visible on touch/narrow viewports since hover doesn't exist there). When set, the image renders full-width, fixed aspect ratio (e.g. 3:1, `object-fit: cover`), with a small "Cambiar portada" / "Quitar portada" control on hover/tap. Upload reuses the same presign-image + `atlas-notes` bucket flow built for in-body images (2026-08-03), with `noteId` scoped object keys.
- Slash command menu: typing `/` on an empty paragraph opens a small floating menu anchored at the cursor (TipTap `Suggestion` utility, same pattern family as `@mention` implementations) listing available block types with icon + Spanish label + keyboard-navigable (arrow keys + Enter, Escape to dismiss). Filtering as the user keeps typing after `/`. Must not trigger the menu when `/` is typed mid-word or inside code blocks/tables.
- Presence indicator: small stack of circular avatars (initials or `user_metadata.avatar_url`, falling back to initials like `NoteShareModal`/`ChatComposer` conventions) in the editor's top bar, sourced from `provider.awareness.getStates()`. Cap visible avatars at 3-4 with a "+N" overflow, consistent with existing avatar-stack patterns if any exist in `@atlas/ui` (reuse if present; otherwise a small local component is acceptable since this is note-specific).
- Responsive pass: apply the existing 14-aspect UI checklist (`docs/ai-context/ui-screen-audit-checklist.md`) to `NotesScreen.jsx`, `NotesList.jsx`, `NoteCard.jsx`, `NoteEditor.jsx`, `NoteToolbar.jsx`, `NoteSettingsPanel.jsx`, `ImageAnnotationOverlay.jsx`, and the new command-menu/presence/banner UI. Toolbar must remain usable (no overflow clipping, adequate touch targets) at 390px; the slash menu and emoji picker must not overflow the viewport on narrow screens.
- Keyboard shortcuts reference: a small "Atajos de teclado" entry (e.g. a `?` icon button in the toolbar opening a `Dialog` from `@atlas/ui`) listing existing and new shortcuts in Spanish.

## 9. Routes/screens

No new routes. All work lands inside the existing `atlas.notes` screens/components:

| Route | Screen | Module | Description |
|---|---|---|---|
| /app/m/atlas.notes | NotesScreen | atlas.notes | Existing three-panel layout — gains banner, emoji icon, presence bar, responsive fixes |
| /app/m/atlas.notes (editor) | NoteEditor | atlas.notes | Gains slash command menu, cover banner, presence indicator |
| /app/p/notes/:slug | PublicNoteScreen | atlas.notes | Read-only — should render cover/emoji icon if set, no editing UI (slash menu, presence N/A) |

## 10. Data model

### New models

None.

### Modified models

None — `note.cover_url` and `note.icon` (text) already exist and already support arbitrary string values; no schema change needed. Presence is derived entirely from the existing Y.js awareness channel (no persistence).

## 11. Prisma impact

New models: N/A (note tables are raw SQL, not Prisma-managed — same pattern as `atlas.chat`)
Modified models: N/A
New migration required: No
Migration safety notes: N/A

## 12. API contract

No new endpoints required. Reuses:

- `POST /notes/presign-image` (existing, fixed 2026-08-03) — reused for banner uploads. No request/response shape change needed; the frontend already receives `publicUrl` for the public `atlas-notes` bucket.
- `PATCH /notes/:id` (existing) — reused to persist `cover_url` and `icon` (emoji string). No backend change needed since both columns already accept arbitrary text/URL values.

## 13. SDK contract

No new SDK methods. Reuses `atlas.notes.presignImage` and `atlas.notes.update`, both already present in `packages/sdk/src/index.js`.

## 14. Validator contract

N/A — `atlas.notes` update endpoint does not use a shared Zod schema from `@atlas/validators` (raw body merge in `notes-service.js`); no new fields are introduced that require validation beyond what already exists (`icon` and `cover_url` are already free-text/URL fields).

## 15. Module manifest impact

N/A — no new permissions, navigation, or manifest changes. All work is additive UI inside the existing `atlas.notes` module using permissions already declared (`notes.notes.read`, `notes.notes.update`, `notes.notes.create` for presign-image).

## 16. Navigation impact

N/A — no new navigation items.

## 17. Blueprint impact

N/A — `atlas.notes` is not a blueprint-driven module.

## 18. RBAC/permissions

No new permissions. Existing guards apply:

| Permission key | Guards endpoint(s) | Gates navigation |
|---|---|---|
| notes.notes.update | PATCH /notes/:id (icon, cover_url) | No |
| notes.notes.create | POST /notes/presign-image (banner + body images) | No |
| notes.notes.read | GET /notes/:id (renders icon/cover/presence) | No |

## 19. Multi-company behavior

Unchanged. `atlas.notes` is scoped per-user (`userId`), not per-company (confirmed in `notes-service.js` — notes belong to the authenticated user, with sharing handled via `note_share`). This spec does not change that scoping.

## 20. Files/storage impact

- Bucket: `atlas-notes` (public, created 2026-08-03) — same bucket used for in-body images.
- Object key convention for banners: `notes/<userId>/<noteId>/banner-<timestamp>-<random>.<ext>` (mirrors the existing `notes/<userId>/<noteId ?? 'draft'>/<timestamp>-<random>.<ext>` convention in `POST /notes/presign-image`; banners can reuse the same endpoint unmodified since it does not distinguish body vs. banner images).
- No `FileAsset` row is written — consistent with how in-body note images already work; the URL is stored directly on the note record (`cover_url` for the banner) or embedded in `content` HTML (for in-body images).

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A — `atlas.notes` does not currently write to `AuditLog` for note field updates (confirmed: no `AuditLog` writes in `notes-service.js`), and this spec does not change that. Icon/cover updates go through the existing unaudited `PATCH /notes/:id` path, consistent with title/content/tag changes.

## 23. Edge cases

1. Emoji picked as icon must render correctly in `NotesList`/`NoteCard` (list view), the editor header, `NotesSidebar`, and the public note view — all four call sites that currently call `<NoteIcon name={...} />` must handle a raw emoji string, not just a Lucide key.
2. A note with both a legacy curated icon and a later emoji selection — switching between the two pickers must not require a schema migration; last write wins on the single `icon` column.
3. Cover banner upload failure (network error, file too large) must not corrupt `cover_url` — only call `onUpdate({ coverUrl })` after the upload confirms success, same pattern as the in-body image flow fixed 2026-08-03.
4. Slash menu must not open when `/` appears inside an existing word, inside a code block/inline code, or inside a table cell (would break normal typing of URLs, file paths, fractions, etc.).
5. Presence indicator must gracefully show nobody when the Y.js provider hasn't synced yet, and must remove a user from the stack promptly when they navigate away (existing awareness disconnect behavior — verify it already fires `awareness.setLocalState(null)` on unmount in `SupabaseYjsProvider`, add if missing).
6. Public note view (`PublicNoteScreen.jsx`, read-only, unauthenticated) must render the emoji icon and cover banner if set, but must never show the presence indicator or slash menu (no editor, no awareness channel there).
7. On narrow screens the cover banner's "Cambiar/Quitar portada" controls must be reachable without hover (tap-visible), and the slash menu must reposition/clamp so it never renders off-screen.

## 24. Risks

1. Risk: TipTap's `Suggestion` utility for the slash menu can conflict with the existing `Placeholder` extension's per-node placeholder logic (`editor-extensions.js`) if not scoped carefully. Mitigation: prototype the slash menu against a throwaway note first; verify placeholder text still shows correctly on empty non-first lines.
2. Risk: extending `NoteIcon` to render arbitrary strings as emoji could accidentally render garbage if `icon` ever contains something that's neither a known Lucide key nor a valid emoji (e.g., a future bug elsewhere writing free text). Mitigation: keep the fallback simple (render the string as-is in a `span`) — worst case is unexpected text, not a crash.
3. Risk: presence UI adds visible complexity/noise for the common case of a note nobody else is viewing. Mitigation: render nothing when only the current user is present (no empty avatar stack).
4. Risk: responsive pass across 7 files in one plan item can balloon in scope. Mitigation: scope the audit strictly to the checklist in `docs/ai-context/ui-screen-audit-checklist.md`, not a visual redesign.

## 25. Acceptance criteria

1. Given a note with no icon, when the user picks an emoji from the new emoji tab in the icon popover, then the emoji renders as the note's icon in the list, editor header, sidebar, and public view.
2. Given a note with no cover, when the user uploads a banner image, then it renders full-width above the title, and `GET /notes/:id` returns the same `cover_url` after a page reload.
3. Given the editor cursor on an empty line, when the user types `/`, then a command menu appears; selecting "Tabla" inserts a 3x3 table at the cursor and closes the menu.
4. Given two browser sessions with the same note open, when both are on the note, then each session's presence stack shows the other user; when one closes the note, then that avatar disappears from the other session's stack within a few seconds.
5. Given a 390px viewport, when the user opens a note with an image and opens the settings panel, then no control is clipped or unreachable, and the toolbar's image/drawing/table buttons remain tappable.
6. Given the public note view, when a note with an emoji icon and cover banner is viewed unauthenticated, then both render, and no presence indicator or slash menu affordance is present.

## 26. Verification plan

- `node --check` on every modified `.js` file; esbuild bundle-check (as used in this session) on every modified `.jsx` file, since this repo's `lint` script is a no-op placeholder.
- Manual: create a note, set an emoji icon, reload the page, confirm persistence.
- Manual: upload a banner image, confirm it appears at `<publicUrl>` directly (bucket is public) and persists after reload.
- Manual: type `/` in various positions (start of empty line, mid-word, inside a code block, inside a table cell) and confirm the menu only opens in the intended case.
- Manual: open the same note in two browser profiles/windows, confirm presence avatars appear and disappear correctly.
- Manual: DevTools responsive mode at 390px and 1440px across all touched screens, per the 14-aspect checklist.
- Manual: verify the public note route still renders correctly with no console errors for a note that has an emoji icon and a cover banner.

## 27. Rollback plan

No migrations involved (no schema change), so rollback is a pure code revert. If the slash menu proves unstable, it can be disabled independently by removing its extension from `editor-extensions.js` without affecting the emoji/banner/presence work, since the four goals are independently deliverable and independently revertable.

## 28. Future enhancements

1. Universal block drag-and-drop (beyond images) using the same pointer-based approach built for images (`lib/dragReorder.js`) generalized to any top-level node.
2. Nested/sub-pages.
3. Note version history.
4. AI-assisted writing inside the editor.
5. Offline note editing (Tier 2.5-style local cache, matching `atlas.ledger`'s desktop offline pattern).
6. Command palette (Ctrl+K) for jumping between notes, mirroring Notion's global search — distinct from the in-editor "/" menu scoped here.
