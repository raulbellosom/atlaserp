# Atlas Notes — Notion Redesign, Plan B (Advanced Interactions + Responsive) — Implementation Plan

Date: 2026-08-03
Spec: docs/superpowers/specs/2026-08-03-atlas-notes-notion-redesign-design.md
Status: Draft

> **For agentic workers:** Declare `Mode: IMPLEMENTATION` before starting. Do not begin coding until the spec is approved and this plan is approved. Depends on Plan A having shipped (or at minimum, the emoji-icon and cover-banner UI existing) so the responsive audit in Task 3 covers the final surface area, not an intermediate one. Use checkbox syntax (`- [ ]`) to track progress. Mark each task completed only after its validation commands pass.

## Goal

Deliver the three remaining, higher-complexity goals from the spec: the "/" slash command menu (Goal 3), the presence indicator (Goal 4), and the full responsive audit across every touched file (Goal 5). Also close out the shortcuts dialog started in Plan A Task 4 by adding the "/" row once the menu exists.

## Architecture summary

Slash menu: adds `@tiptap/suggestion` (new dependency, same major/minor as the rest of the `@tiptap/*` packages already pinned at `^3.27.1`) as a small custom TipTap extension (`lib/extensions/SlashCommand.jsx`) that triggers on `/` at the start of a text block, renders a positioned (not `tippy.js` — manual `getBoundingClientRect`-based fixed positioning, consistent with the drop-indicator approach already used in `ImageAnnotationOverlay.jsx`) floating menu, and runs the matching TipTap command on selection.

Presence: `SupabaseYjsProvider` already maintains a Y.js `Awareness` instance and sets/broadcasts local state — confirmed no local state is currently being set at all (only the `CollaborationCursor` extension consumes awareness for cursor rendering; nothing calls `awareness.setLocalStateField`). This plan adds an explicit local awareness state (userId, name, avatarUrl, color) in `SupabaseYjsProvider`, a `usePresence(provider)` hook that subscribes to `awareness.on('change', ...)` and returns the list of remote states, and a small avatar-stack UI in `NoteEditor.jsx`'s header built from `@atlas/ui`'s existing `Avatar`/`AvatarImage`/`AvatarFallback` (no new avatar component). Also fixes a pre-existing bug found during spec discovery: `NoteEditor.jsx` passes a hardcoded `userColor: '#f59e0b'` for every user, so all collaborator cursors currently render identically — this plan derives a per-user color (hash of `userId` into a small fixed palette) since distinct colors are required for the presence stack to be useful, not just the cursors.

Responsive audit: no new component: runs `docs/ai-context/ui-screen-audit-checklist.md` against every file touched by this feature set (Plan A + Plan B), fixing findings in place.

---

## File Structure Map

### Create

- `apps/desktop/src/modules/atlas.notes/lib/extensions/SlashCommand.jsx` — TipTap extension + `@tiptap/suggestion` wiring
- `apps/desktop/src/modules/atlas.notes/components/SlashCommandMenu.jsx` — floating menu UI
- `apps/desktop/src/modules/atlas.notes/hooks/usePresence.js` — subscribes to Y.js awareness, returns remote user list
- `apps/desktop/src/modules/atlas.notes/components/PresenceStack.jsx` — avatar-stack UI using `@atlas/ui` `Avatar`

### Modify

- `apps/desktop/package.json` — add `@tiptap/suggestion` at the version matching the other `@tiptap/*` packages
- `apps/desktop/src/modules/atlas.notes/lib/editor-extensions.js` — register `SlashCommand`
- `apps/desktop/src/modules/atlas.notes/lib/SupabaseYjsProvider.js` — set local awareness state (userId, name, avatarUrl, color); confirm/ensure `awareness.setLocalState(null)` fires on `destroy()`
- `apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx` — derive per-user color instead of the hardcoded `#f59e0b`; render `PresenceStack`
- `apps/desktop/src/modules/atlas.notes/components/KeyboardShortcutsDialog.jsx` — add the "/" command row (started in Plan A Task 4)
- Responsive fixes (files depend on Task 3 findings; expected candidates based on current known patterns): `NotesScreen.jsx`, `NotesList.jsx`, `NoteCard.jsx`, `NoteEditor.jsx`, `NoteToolbar.jsx`, `NoteSettingsPanel.jsx`, `ImageAnnotationOverlay.jsx`, `NoteCoverBanner.jsx`, `SlashCommandMenu.jsx`, `PresenceStack.jsx`

---

## Task 1 — Slash command menu

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/lib/extensions/SlashCommand.jsx`
- Create: `apps/desktop/src/modules/atlas.notes/components/SlashCommandMenu.jsx`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/src/modules/atlas.notes/lib/editor-extensions.js`

**Changes:**

- [ ] Step 1: Add `@tiptap/suggestion` to `apps/desktop/package.json` pinned to the same version as the other `@tiptap/*` packages (`^3.27.1`); run `pnpm install`.
- [ ] Step 2: `SlashCommand.jsx` — a `Node`-less `Extension` wrapping `@tiptap/suggestion`'s `Plugin`, with `char: '/'`, `startOfLine`-aware matching so it only triggers when `/` is the first character of an empty text block (spec edge case 4 — must NOT trigger mid-word, inside `codeBlock`, or inside a table cell; check `editor.isActive('codeBlock')` / `editor.isActive('table')` in the `allow` callback and return `false` there).
- [ ] Step 3: Command list: Título 1/2/3, Lista con viñetas, Lista numerada, Lista de tareas, Cita, Bloque de código, Tabla, Imagen, Canvas de dibujo — each maps to the same editor command already used by the corresponding `NoteToolbar.jsx` button (reuse those calls, don't duplicate logic). "Imagen" reuses the same presign+upload flow as `NoteToolbar.jsx`'s image button (trigger a hidden file input from the menu item).
- [ ] Step 4: `SlashCommandMenu.jsx` — floating menu positioned via the suggestion plugin's `clientRect`, keyboard-navigable (Up/Down/Enter/Escape wired through the extension's `command`/`onKeyDown` per `@tiptap/suggestion`'s render API), filters the list as the user types after `/`, closes on selection or Escape or losing the `/` prefix.
- [ ] Step 5: Register `SlashCommand` in `buildExtensions()` (`editor-extensions.js`).

**Validation:**

```bash
"./node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/node_modules/.bin/esbuild" \
  apps/desktop/src/modules/atlas.notes/lib/extensions/SlashCommand.jsx \
  apps/desktop/src/modules/atlas.notes/components/SlashCommandMenu.jsx \
  --bundle --format=esm --jsx=automatic --loader:.js=jsx \
  --external:react --external:@tiptap/react --external:@tiptap/suggestion --external:@tiptap/pm \
  --external:lucide-react --outfile=/tmp/_out.js
```

Manual: type `/` at the start of an empty line — menu opens. Type `/tab` — filters to "Tabla". Press Enter — inserts a 3x3 table, menu closes. Type `/` mid-word (e.g. `hola/`) — menu does not open. Type `/` inside a code block and inside a table cell — menu does not open in either case.

---

## Task 2 — Presence indicator

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/hooks/usePresence.js`
- Create: `apps/desktop/src/modules/atlas.notes/components/PresenceStack.jsx`
- Modify: `apps/desktop/src/modules/atlas.notes/lib/SupabaseYjsProvider.js`
- Modify: `apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx`

**Changes:**

- [ ] Step 1: In `SupabaseYjsProvider.js`, after the awareness instance is created, call `this.awareness.setLocalStateField('user', { id: userId, name, avatarUrl, color })` (fields sourced from what `NoteEditor.jsx` already computes for `CollaborationCursor`). Confirm `destroy()` already clears local state before disconnecting the channel (Y.js awareness normally does this on `awareness.destroy()` — verify, and call `this.awareness.setLocalState(null)` explicitly first if not already implied, per spec edge case 5).
- [ ] Step 2: In `NoteEditor.jsx`, replace the hardcoded `userColor: '#f59e0b'` with a small deterministic hash of the user's id/email into a fixed palette (e.g. 6–8 hand-picked colors distinct from the amber brand accent, so collaborator cursors and avatars are visually distinguishable from each other and from UI chrome).
- [ ] Step 3: `usePresence(provider)` — subscribes to `provider.awareness.on('change', ...)`, returns the current list of remote users (excludes the local client id), re-renders on change, unsubscribes on unmount/provider change.
- [ ] Step 4: `PresenceStack.jsx` — renders up to 3–4 overlapping `Avatar`/`AvatarImage`/`AvatarFallback` (from `@atlas/ui`) with a `+N` overflow badge past the cap; renders nothing when the list is empty (spec risk #3). `AvatarFallback` shows initials derived from `name`.
- [ ] Step 5: Render `<PresenceStack users={usePresence(providerRef.current)} />` in `NoteEditor.jsx`'s header area (not inside the sticky toolbar itself — same row as the icon button from Plan A Task 2, or directly adjacent).

**Validation:**

Manual: open the same note in two browser profiles (or one normal + one incognito window, both authenticated as different users). Confirm each sees the other in `PresenceStack` within a couple seconds. Close one window — confirm the other's stack updates (avatar disappears) within a few seconds without a manual refresh. Confirm collaborator cursor colors (from `CollaborationCursor`) now differ between the two sessions.

---

## Task 3 — Responsive audit (390px + 1440px)

**Files:**
- Modify: whichever files fail the checklist among `NotesScreen.jsx`, `NotesList.jsx`, `NoteCard.jsx`, `NoteEditor.jsx`, `NoteToolbar.jsx`, `NoteSettingsPanel.jsx`, `ImageAnnotationOverlay.jsx`, `NoteCoverBanner.jsx`, `SlashCommandMenu.jsx`, `PresenceStack.jsx`, `KeyboardShortcutsDialog.jsx`

**Changes:**

- [ ] Step 1: Run the 14-aspect checklist at `docs/ai-context/ui-screen-audit-checklist.md` against each file above at 390px and 1440px (browser devtools responsive mode against the running dev server, per `docs/ai-context/ui-screen-audit-checklist.md`'s own method — do not rely on code review alone).
- [ ] Step 2: Fix findings in place. Expected likely issues based on code already read during spec discovery: `ImageAnnotationOverlay.jsx`'s annotation toolbar bar (`bg-gray-50`/`text-gray-*`) is hardcoded light-mode-only, unlike the rest of the module's `dark:` variants — confirm whether this is in scope (visual/dark-mode, not strictly "responsive") and note it as a follow-up if it's out of this plan's scope rather than silently expanding scope.
- [ ] Step 3: Verify the slash menu and emoji picker popover both clamp within the viewport at 390px (spec edge case 7) rather than overflowing off-screen.
- [ ] Step 4: Verify the cover banner's "Cambiar/Quitar portada" controls are reachable by tap at 390px (not hover-only).

**Validation:**

Manual: DevTools responsive mode at 390px and 1440px, walking the full checklist per file, screenshotting each per `feedback_responsive_qa` convention (memory: always screenshot both viewports).

---

## Task 4 — Close out shortcuts dialog

**Files:**
- Modify: `apps/desktop/src/modules/atlas.notes/components/KeyboardShortcutsDialog.jsx`

**Changes:**

- [ ] Step 1: Add the "/" slash-menu row now that Task 1 has shipped, removing the `{/* TODO */}` marker left in Plan A Task 4.

**Validation:**

Manual: open the dialog, confirm the "/" row is present and accurate.

---

## Rollback Notes

- Task 1 (slash menu) is isolated to `editor-extensions.js`'s extension list — removing one line disables it without touching the rest of the editor.
- Task 2 (presence) touches `SupabaseYjsProvider.js`, which is shared realtime infrastructure — if the awareness state change causes any regression in the existing `CollaborationCursor` behavior, revert `SupabaseYjsProvider.js` and `NoteEditor.jsx`'s color change together as a unit; `PresenceStack`/`usePresence` are additive and can stay dormant (unrendered) without harm.
- Task 3 (responsive) is CSS-only across existing files — safe to revert file-by-file if a fix regresses desktop layout.

---

## Verification Gate

Before marking any task complete in `docs/TASKS.md`:

- [ ] esbuild bundle-check passes on every modified/created `.jsx` file.
- [ ] All manual validation steps above have been performed and their outcome recorded.
- [ ] Responsive checklist results documented per file (pass/fail per aspect, not just "looks fine").
- [ ] `docs/TASKS.md` updated with `Verified: YYYY-MM-DD (commands/checks executed)`.
