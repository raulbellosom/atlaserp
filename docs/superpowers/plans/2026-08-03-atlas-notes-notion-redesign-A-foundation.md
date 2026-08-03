# Atlas Notes — Notion Redesign, Plan A (Foundation) — Implementation Plan

Date: 2026-08-03
Spec: docs/superpowers/specs/2026-08-03-atlas-notes-notion-redesign-design.md
Status: Draft

> **For agentic workers:** Declare `Mode: IMPLEMENTATION` before starting. Do not begin coding until the spec is approved and this plan is approved. Use checkbox syntax (`- [ ]`) to track progress. Mark each task completed only after its validation commands pass.

## Goal

Deliver the three lowest-risk goals from the spec that reuse infrastructure already fully in place: emoji icons (Goal 1), the cover/banner image (Goal 2), and a keyboard-shortcuts reference (Goal 6). No backend or schema changes — `note.icon` and `note.cover_url` already accept arbitrary text/URL values, and the `atlas-notes` public bucket + `/notes/presign-image` endpoint already work (fixed 2026-08-03).

Plan B covers the slash command menu, presence indicator, and the cross-file responsive audit (spec Goals 3–5), which are more novel and depend on A's UI (icon/banner) existing first for a coherent responsive pass.

## Architecture summary

Emoji icon: `note.icon` is already a free-text column. `NoteIcon` (spec §23 edge case 1) is extended to render any string not found in `NOTE_ICONS` literally as text (an emoji character renders fine as text). The existing icon `Popover` in `NoteSettingsPanel.jsx` gains a two-tab layout ("Iconos" / "Emoji"), reusing `emoji-picker-react` exactly as `atlas.chat`'s `MessageComposer.jsx` already does. A matching icon-or-emoji button is added directly in `NoteEditor.jsx`'s header (Notion convention: icon lives with the title, not only in settings).

Cover banner: reuses the exact upload flow built 2026-08-03 for in-body images (`atlas.notes.presignImage` + `supabase.storage.uploadToSignedUrl` + public URL), but writes the result to `note.cover_url` via `onUpdate({ coverUrl })` instead of inserting a TipTap node. Rendered as a full-width `object-cover` banner above the title in `NoteEditor.jsx`, with hover/tap-visible "Cambiar/Quitar portada" controls. `PublicNoteScreen.jsx` gets the same read-only rendering.

Shortcuts reference: a static, hand-maintained list (no dynamic introspection of TipTap keymaps) in a new small component, opened from a `?` button in `NoteToolbar.jsx` via `Dialog` from `@atlas/ui`.

---

## File Structure Map

### Create

- `apps/desktop/src/modules/atlas.notes/components/NoteCoverBanner.jsx` — banner render + upload/remove UI, used by both `NoteEditor.jsx` and `PublicNoteScreen.jsx`
- `apps/desktop/src/modules/atlas.notes/components/KeyboardShortcutsDialog.jsx` — static shortcuts reference

### Modify

- `apps/desktop/src/modules/atlas.notes/noteIcons.jsx` — `NoteIcon` renders unrecognized `name` values as literal text (emoji)
- `apps/desktop/src/modules/atlas.notes/components/NoteSettingsPanel.jsx` — icon popover gains "Iconos"/"Emoji" tabs
- `apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx` — renders `NoteCoverBanner`; adds icon-or-emoji button near the title; wires `onUpdate` for `coverUrl`
- `apps/desktop/src/modules/atlas.notes/PublicNoteScreen.jsx` — renders `NoteCoverBanner` (read-only) and emoji-capable icon
- `apps/desktop/src/modules/atlas.notes/components/NoteToolbar.jsx` — adds "?" shortcuts button opening `KeyboardShortcutsDialog`
- `apps/desktop/package.json` — no new dependency needed (`emoji-picker-react` already present)

---

## Task 1 — Emoji-capable `NoteIcon` + emoji tab in the icon picker

**Files:**
- Modify: `apps/desktop/src/modules/atlas.notes/noteIcons.jsx`
- Modify: `apps/desktop/src/modules/atlas.notes/components/NoteSettingsPanel.jsx`

**Changes:**

- [ ] Step 1: In `noteIcons.jsx`, change `NoteIcon` so that when `name` is not a key in `NOTE_ICONS`, it renders `name` inside a `<span>` sized to match the Lucide icon's `size` prop (font-size ≈ `size * 1.1`px), instead of returning `null`. Keep the existing Lucide-icon path unchanged.
- [ ] Step 2: In `NoteSettingsPanel.jsx`, replace the single `PopoverContent` icon grid with a small local tab control (two buttons: "Iconos" / "Emoji", local `useState`). "Iconos" tab keeps the current grid unchanged.
- [ ] Step 3: "Emoji" tab renders `<EmojiPicker onEmojiClick={...} theme={isDark ? 'dark' : 'light'} searchPlaceholder="Buscar emoji..." lazyLoadEmojis skinTonesDisabled autoFocusSearch={false} width={...} height={...} />`, matching `atlas.chat/components/MessageComposer.jsx`'s usage. `onEmojiClick` calls `onUpdate({ icon: emojiData.emoji })` and closes the popover.
- [ ] Step 4: Keep the existing "Sin icono" clear button visible regardless of active tab.

**Validation:**

```bash
node --check apps/desktop/src/modules/atlas.notes/noteIcons.jsx 2>&1 || true  # .jsx — use esbuild instead, see below
"./node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/node_modules/.bin/esbuild" \
  apps/desktop/src/modules/atlas.notes/noteIcons.jsx \
  apps/desktop/src/modules/atlas.notes/components/NoteSettingsPanel.jsx \
  --bundle --format=esm --jsx=automatic --loader:.js=jsx \
  --external:react --external:@tiptap/react --external:lucide-react --external:@atlas/ui \
  --external:emoji-picker-react --outfile=/tmp/_out.js
```

Manual: open a note's settings panel, switch to "Emoji" tab, pick an emoji, confirm it renders as the note icon in the settings button, the editor header, and `NotesList`.

---

## Task 2 — Icon-or-emoji button in the editor header

**Files:**
- Modify: `apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx`

**Changes:**

- [ ] Step 1: Add a small button above the title area (same row as where the cover banner's "Agregar portada" control will sit — see Task 3) showing the current `NoteIcon` or a neutral "add icon" placeholder glyph when none is set.
- [ ] Step 2: Clicking it opens the same icon/emoji `Popover` UI as `NoteSettingsPanel.jsx` — extract the tab content built in Task 1 into a small shared presentational piece if duplication would otherwise exceed ~40 lines; otherwise duplicate the two `PopoverContent` bodies directly to avoid a premature abstraction (call this at implementation time based on actual line count).
- [ ] Step 3: Selecting an icon/emoji calls the existing `handleUpdate`-adjacent update path (reuse the same `atlas.notes.update` call already used for content/title autosave, or expose a small `onUpdate` prop from `NotesScreen.jsx` down to `NoteEditor.jsx` consistent with how `NoteSettingsPanel` already receives `onUpdate`).

**Validation:**

Manual: from the editor (not the settings panel), set an icon/emoji, confirm the note list and editor stay in sync without a manual refresh.

---

## Task 3 — Cover banner (`NoteCoverBanner`)

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/components/NoteCoverBanner.jsx`
- Modify: `apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx`
- Modify: `apps/desktop/src/modules/atlas.notes/PublicNoteScreen.jsx`

**Changes:**

- [ ] Step 1: `NoteCoverBanner` props: `coverUrl`, `editable`, `onChange(url)`, `onRemove()`. When `!coverUrl && !editable`, render nothing. When `!coverUrl && editable`, render a subtle "Agregar portada" button (always visible on touch, hover-revealed on desktop via a `group` wrapper matching existing hover-reveal patterns like `NoteCard`'s trash button).
- [ ] Step 2: When `coverUrl` is set, render `<img>` full width, fixed 3:1 aspect ratio via `aspect-[3/1] object-cover`, with an overlay bar (hover on desktop, always visible on touch — use the same touch-vs-hover distinction as the drag handle from the 2026-08-03 image work) containing "Cambiar portada" and "Quitar portada".
- [ ] Step 3: Upload reuses `atlas.notes.presignImage({ fileName, mimeType, noteId }, token)` + `supabase.storage.from('atlas-notes').uploadToSignedUrl(...)`, then calls `onChange(presign.publicUrl)` only after upload success (spec edge case 3) — do not call `onChange` optimistically before the upload confirms.
- [ ] Step 4: In `NoteEditor.jsx`, render `<NoteCoverBanner coverUrl={note.cover_url} editable={!readOnly} onChange={url => handleUpdate-equivalent({ coverUrl: url })} onRemove={() => .../* coverUrl: null */} />` above the title/icon row, inside the scrollable content area (not the sticky toolbar).
- [ ] Step 5: In `PublicNoteScreen.jsx`, render `<NoteCoverBanner coverUrl={note.cover_url} editable={false} />` in the equivalent position.

**Validation:**

Manual: upload a banner on a note, reload the page, confirm it persists (`GET /notes/:id` returns the same `cover_url`). Confirm "Quitar portada" clears it and the button-to-add-cover reappears. Confirm the public link for that note shows the same banner, read-only.

---

## Task 4 — Keyboard shortcuts reference dialog

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/components/KeyboardShortcutsDialog.jsx`
- Modify: `apps/desktop/src/modules/atlas.notes/components/NoteToolbar.jsx`

**Changes:**

- [ ] Step 1: `KeyboardShortcutsDialog` is a static `Dialog` (from `@atlas/ui`) listing, in Spanish, the shortcuts already active via `StarterKit`/TipTap defaults (Ctrl+B negrita, Ctrl+I cursiva, Ctrl+U subrayado, Ctrl+Z/Ctrl+Y deshacer/rehacer, Ctrl+Shift+7/8 listas, etc. — verify the actual active set against `editor-extensions.js` rather than assuming defaults, since `history: false` is set on StarterKit) plus the new "/" command menu shortcut once Plan B ships (add that row when Plan B lands — leave a `{/* TODO: add after Plan B ships slash menu */}` marker if implementing Plan A first).
- [ ] Step 2: Add a small "?" `ToolbarButton` in `NoteToolbar.jsx` (far right, before/after the table context menu) that opens the dialog.

**Validation:**

Manual: open the dialog from the toolbar, confirm it lists shortcuts that actually work when tried in the editor (spot-check 3–4).

---

## Rollback Notes

- No migrations, no API/manifest changes — every task in this plan is a pure frontend revert if aborted.
- Tasks are independently revertable: Task 1 (emoji) does not depend on Task 3 (banner) or Task 4 (shortcuts). If one task causes issues, the others can ship independently.

---

## Verification Gate

Before marking any task complete in `docs/TASKS.md`:

- [ ] esbuild bundle-check passes on every modified/created `.jsx` file (pattern used throughout the 2026-08-03 session, since `pnpm lint` is a no-op in this repo).
- [ ] All manual validation steps above have been performed and their outcome recorded.
- [ ] `docs/TASKS.md` updated with `Verified: YYYY-MM-DD (commands/checks executed)`.
