# atlas.notes — editor lifecycle, realtime, image toolbar & cover fixes

Date: 2026-08-30
Status: code complete — browser QA pending
Owner: Raul / Claude

## Problem (reported by user, root-caused)

1. **Switching notes shows stale content.** `NoteEditor` renders `<EditorProvider>`
   which calls TipTap `useEditor(opts, deps=[])`. With empty deps the installed
   `@tiptap/react@3.27.1` **never recreates the editor** — it only runs
   `editor.setOptions()`, which merges new `content`/`extensions` without
   re-parsing the document or swapping ProseMirror plugins. No `key={note.id}`
   remount either. Result: the ProseMirror doc stays on the previously-selected
   note.

2. **Realtime collaboration is dead code.** `immediatelyRender` defaults to true,
   so the editor is constructed on the first render — *before* the `useEffect`
   that builds the `Y.Doc` + `SupabaseYjsProvider` has run. `buildExtensions`
   therefore gets `ydoc: null`, `Collaboration` / cursor extensions are omitted,
   and the later re-render can't attach plugins to a live editor. Yjs never
   binds. `handleUpdate` still calls `saveYDoc` with an essentially-empty doc,
   slowly overwriting persisted server Yjs state.

3. **`@tiptap/extension-collaboration-cursor` is a v2 package (`^2.26.2`) on v3
   core.** In TipTap v3 it was renamed to `@tiptap/extension-collaboration-caret`
   (`3.27.1` available, matches core).

4. **Duplicate extension `trailingNode`.** StarterKit v3 bundles its own
   `TrailingNode`; `buildExtensions` adds the custom one too and never disables
   StarterKit's → console warning "Duplicate extension names found:
   ['trailingNode']".

5. **Image annotation toolbar clipped.** `ImageAnnotationOverlay` toolbar is
   `flex-nowrap overflow-x-auto`, width-constrained to the image; on narrow /
   portrait images the controls (Recortar, Listo, grip…) scroll out of view with
   no affordance. View-mode "Editar imagen" / drag buttons sit at
   `bottom-2 right-2`; user wants them at the top.

6. **Cover image not rendering.** `NoteCoverBanner` shows `withImageVariant(url,
   'banner')` → Supabase `/render/image/public/` transform with
   `width=1600&height=400&resize=cover`. Body images (`content` variant, width
   only) work, so the transform service + bucket are fine — the `banner` preset
   (forced height + `resize=cover`) is the suspect. Needs a live network status
   check to confirm; apply a graceful fallback regardless.

## Decision

User chose: **properly wire live co-editing** (not remove Yjs). Keep the custom
`SupabaseYjsProvider` (Supabase Realtime broadcast) — the library was never the
problem; the editor was just built before the provider existed.

## Tasks

- [x] **T1 — deps**: dropped `@tiptap/extension-collaboration-cursor@^2.26.2`,
  added `@tiptap/extension-collaboration-caret@3.27.1` (pinned exact to match
  core — `^` floats to 3.30.x and breaks peers); `pnpm install` clean, no peer
  warnings.
- [x] **T2 — `editor-extensions.js`**: import `CollaborationCaret`;
  `StarterKit.configure({ ..., trailingNode: false })`.
- [x] **T3 — `SupabaseYjsProvider.js`**: `hadServerState` flag + `_destroyed`
  guard so an async `_init` that finishes after unmount can't leak a channel /
  doc listeners (provider is now created & torn down per note switch).
- [x] **T4 — `NoteEditor.jsx` lifecycle rewrite**:
  - Split into `NoteEditor` (engine owner) + `NoteEditorSurface` (everything that
    renders the editor), the surface keyed `key={note.id}`.
  - `collabEnabled = !readOnly && !!token && !!note?.id`.
  - When `collabEnabled`: build `{ ydoc, provider }` in an effect keyed on
    `note.id`; hold it in **state**; render a lightweight skeleton until the
    engine for the current note exists AND has loaded server state
    (`onSynced`). Only then mount `NoteEditorSurface` with the engine, so the
    editor is created with `Collaboration` + `CollaborationCaret` bound to the
    right doc.
  - When not `collabEnabled` (public share, trash): mount `NoteEditorSurface`
    immediately with `engine=null` — plain editor from `note.content` (preserves
    `PublicNoteScreen` behaviour, which has no session/token).
  - Legacy seed: on surface mount, if `engine.hadServerState === false` and
    `ydoc.getXmlFragment('default').length === 0` and `note.content` is
    non-empty → `editor.commands.setContent(note.content, false)` once.
  - Autosave: compute `{ content, title }` synchronously on each `onUpdate` into
    a ref + `dirtyRef`; debounce only the network send. On unmount, if dirty,
    flush `atlas.notes.update` + `saveYDoc` fire-and-forget (noteId is stable per
    keyed surface).
  - Drop the `content` prop from `<EditorProvider>` when `engine` is present
    (Yjs is the source of truth) to avoid double-seeding.
- [x] **T5 — `ImageAnnotationOverlay.jsx`**: toolbar `flex flex-wrap items-center
  gap-x-1 gap-y-1` (dropped `flex-nowrap overflow-x-auto`); view-mode edit/drag
  cluster moved `bottom-2` → `top-2`. Resize dot stays `bottom-0 right-0`.
- [x] **T6 — cover fallback**: `NoteCoverBanner` `<img onError>` → falls back
  from the `banner`-transform URL to the raw `coverUrl`, keyed per URL so a new
  cover retries the transform. **Still need** the user's Network-tab status for
  the failing `render/image/public` request to confirm root cause / decide
  whether to change the `banner` preset.
- [x] **T7 — static verification**: `node --check` (plain JS) pass; notes lib
  unit tests 39/39; `notes-access.test.js` 11/11; full `pnpm --filter
  @atlas/desktop build` (Vite + Tauri) green — the caret import resolves.
- [ ] **T7b — browser QA** at 390 / 1440 (needs dev server + auth): switch
  between 3+ notes (content follows selection), two-tab live edit + carets,
  legacy-note seed still shows old content, image-annotate toolbar fully visible
  on a portrait image, cover upload renders, console has no "Duplicate extension
  names" warning.

## Out of scope / follow-up

- Server-side reconciliation of `note_ydoc_state` vs `notes.content` (long-known
  design gap — tracked in the current-state spec §10).
- Broad `@tiptap/*` 3.27 → 3.30 bump.
