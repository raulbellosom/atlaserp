# Post-Pause Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-17-post-pause-stabilization-design.md`

**Goal:** Leave the repo in a known-good state after the July pause: clean working tree, verified migrations, verified POS waiter/split-bill features, and a TASKS.md that reflects the June module inventory.

**Architecture:** No new architecture. This plan sequences verification, small corrective edits, logically scoped commits of existing uncommitted work, and documentation realignment. DB tasks run first because the `.catch()` removal in Task 2 depends on migration state.

**Tech Stack:** Prisma CLI (migrate status), Node built-in test runner, Vite build, git.

**Working conventions (from memory):** commit directly to `main` — no branches or worktrees. All commit messages end with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer when authored by the agent.

---

## File Structure Map

- Modify (revert one hunk): `apps/api/src/routes/pos/pos-order-service.js` (line ~47)
- Commit as-is: `apps/desktop/src/modules/atlas.chat/components/ForwardMessageModal.jsx`
- Commit as-is: `apps/desktop/src/modules/atlas.chat/screens/ChatTemplatesScreen.jsx`
- Commit as-is: `packages/ui/src/components/Dialog.jsx`
- Commit as-is: `packages/ui/src/components/Sheet.jsx`
- Commit as-is: `apps/desktop/src/modules/atlas.pos/screens/PosOrdersScreen.jsx`
- Commit after smoke test: `apps/desktop/src/modules/atlas.pos/components/FloorOperationalCanvas.jsx`
- Modify: `docs/TASKS.md` (add four new sections near the top, after the task completion policy)

---

### Task 1: Verify database migration state

**Files:** none (read-only against live DB).

- [ ] **Step 1: Check connectivity and migration status**

```bash
pnpm.cmd exec prisma migrate status
```

Expected (good case): output ends with `Database schema is up to date!` and lists migrations through `20260629130000_chat_archive`.

- [ ] **Step 2 (only if Step 1 reports pending migrations): apply them**

```bash
pnpm.cmd db:migrate
```

Expected: pending migrations (any of `20260622*`, `20260625*`, `20260626*`, `20260627*`, `20260628*`, `20260629*`) apply without error. If the command fails, STOP — do not edit applied migrations; report the error to the user before continuing (fix must be a new forward migration).

- [ ] **Step 3 (only if DB is unreachable):** note "DB unreachable from current network (IP allowlist)" and continue with Tasks 3–6 and 10 only. Tasks 2, 7, 8, 9 are blocked until connectivity is restored.

---

### Task 2: Remove the error-swallowing workaround in order hydration

**Files:**
- Modify: `apps/api/src/routes/pos/pos-order-service.js:47`

Precondition: Task 1 confirmed `20260629120000_pos_waiter_split_bill` is applied (the `pos_guest_seat` table exists).

- [ ] **Step 1: Revert the uncommitted hunk**

The only uncommitted change in this file is the workaround, so restore the committed version:

```bash
git checkout -- apps/api/src/routes/pos/pos-order-service.js
```

- [ ] **Step 2: Verify the catch is gone and the file line reads as committed**

```bash
grep -n "posGuestSeat.findMany" apps/api/src/routes/pos/pos-order-service.js
```

Expected: exactly one match, with NO `.catch(() => [])`:

```js
db.posGuestSeat.findMany({ where: { orderId: id }, orderBy: { position: "asc" } }),
```

- [ ] **Step 3: Syntax check**

```bash
node --check apps/api/src/routes/pos/pos-order-service.js
```

Expected: no output (OK). No commit needed — this file returns to its committed state.

---

### Task 3: Commit chat dialog accessibility fixes

**Files:**
- Commit: `apps/desktop/src/modules/atlas.chat/components/ForwardMessageModal.jsx`
- Commit: `apps/desktop/src/modules/atlas.chat/screens/ChatTemplatesScreen.jsx`

Both changes add `aria-describedby={undefined}` to `DialogContent` for dialogs that have no description, suppressing the Radix console warning. This is intentional — do not replace with a `DialogDescription`.

- [ ] **Step 1: Review the diff one last time**

```bash
git diff apps/desktop/src/modules/atlas.chat
```

Expected: exactly two one-line changes adding `aria-describedby={undefined}`.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.chat/components/ForwardMessageModal.jsx apps/desktop/src/modules/atlas.chat/screens/ChatTemplatesScreen.jsx
git commit -m "fix(chat): suppress Radix aria-describedby warning on description-less dialogs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Commit shared UI drag-handle restyle

**Files:**
- Commit: `packages/ui/src/components/Dialog.jsx`
- Commit: `packages/ui/src/components/Sheet.jsx`

Both changes restyle the mobile drag handle: `w-12 → w-16`, `bg-[hsl(var(--muted-foreground))]/50 → bg-foreground/25`, and Sheet spacing `mb-2 → mb-3`.

- [ ] **Step 1: Review the diff**

```bash
git diff packages/ui/src/components/Dialog.jsx packages/ui/src/components/Sheet.jsx
```

Expected: one className-only line changed per file (the drag-handle `<div>`).

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/Dialog.jsx packages/ui/src/components/Sheet.jsx
git commit -m "style(ui): widen and soften mobile drag handle in Dialog and Sheet

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Commit PosOrdersScreen aria cleanup

**Files:**
- Commit: `apps/desktop/src/modules/atlas.pos/screens/PosOrdersScreen.jsx`

The change removes the hand-wired `aria-describedby="order-detail-desc"` / `id="order-detail-desc"` pair from both the desktop `DialogContent` and mobile `SheetContent` branches, letting Radix wire description IDs automatically.

- [ ] **Step 1: Review the diff**

```bash
git diff apps/desktop/src/modules/atlas.pos/screens/PosOrdersScreen.jsx
```

Expected: 4 changed lines (2 per branch), removals of the explicit id/aria-describedby only.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.pos/screens/PosOrdersScreen.jsx
git commit -m "fix(pos): let Radix auto-wire dialog description ids in order detail panel

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Smoke-test and commit the FloorOperationalCanvas refactor

**Files:**
- Commit: `apps/desktop/src/modules/atlas.pos/components/FloorOperationalCanvas.jsx` (145 insertions / 148 deletions)

The refactor replaces scroll-container pan/zoom with transform-based pan/zoom: `containerRef` + `stateRef {zoom, panX, panY}` + pointer map for pinch, default canvas 1400×900 (was 2000×1400), fit-to-content on mount via `requestAnimationFrame`.

- [ ] **Step 1: Build check**

```bash
pnpm.cmd --filter @atlas/desktop build:web
```

Expected: `✓ built` with no errors.

- [ ] **Step 2: Manual smoke of the floor screen**

Run `pnpm dev`, open `http://localhost:5173`, go to atlas.pos → Mesas (vista plano). Verify, and note results:

1. Floor renders with all tables visible (fit-to-content centers the layout on load).
2. Mouse wheel zooms toward the cursor; drag pans; pinch works in responsive/touch emulation.
3. A floor saved with the old 2000×1400 default still shows all its tables (Edge case 2 in the spec).
4. No console errors.

- [ ] **Step 3: Commit (only if Step 2 passes)**

```bash
git add apps/desktop/src/modules/atlas.pos/components/FloorOperationalCanvas.jsx
git commit -m "refactor(pos): transform-based pan/zoom with pointer-map pinch in FloorOperationalCanvas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

If Step 2 fails: STOP, report the specific broken behavior to the user, and decide together whether to fix (small bug: fix within this task with its own commit) or revert (`git checkout -- <file>`).

- [ ] **Step 4: Confirm clean tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

---

### Task 7: Run the POS backend test suite

**Files:** none.

- [ ] **Step 1: Run the suite**

```bash
node --test apps/api/src/routes/pos/__tests__/
```

Expected: all tests pass (suites cover waiter assignment, seat totals, mis-mesas filter, auto-claim, 404 on unknown waiter, per recent commits `fe8fb15`, `10860b9`).

- [ ] **Step 2: If any test fails**

Diagnose with superpowers:systematic-debugging before touching code. A failure here most likely indicates environment (DB URL / migrations), not logic — check Task 1 output first.

---

### Task 8: Manual QA — waiter assignment and mis-mesas

**Files:** none. Requires `pnpm dev` running and a logged-in user with POS permissions.

These are the unchecked verification steps from `docs/superpowers/plans/2026-06-29-pos-waiter-plan-b-ui.md`.

- [ ] **Step 1:** Open a dine-in order on an available table as the logged-in user. Confirm the table now shows a waiter chip with your initials.
- [ ] **Step 2:** Mark that table `AVAILABLE` again (dirty/clean flow or close the order) and confirm the chip disappears.
- [ ] **Step 3:** Toggle "Mis mesas" on. Confirm only your assigned tables stay interactive/full-opacity; others dim.
- [ ] **Step 4:** Call the reassignment endpoint with a different waiter and confirm clicking that table opens the "Asignar mesa a mí" panel instead of jumping to the order:

```bash
curl -X PATCH http://localhost:4010/pos/tables/<TABLE_ID>/waiter -H "Authorization: Bearer $ATLAS_TOKEN" -H "Content-Type: application/json" -d '{"waiterId":"<OTHER_USER_ID>"}'
```

(Use a placeholder token from your session; never paste a real token into the chat.)

- [ ] **Step 5:** Record pass/fail per step — these results feed the TASKS.md `Verified:` line in Task 10.

---

### Task 9: Manual QA — split bill per seat

**Files:** none. Continues from Task 8's session.

- [ ] **Step 1:** Create an order with at least 2 guests and add lines to different guest seats via the terminal screen's guest/seat UI.
- [ ] **Step 2:** Open `PaymentDialog`, switch to "Dividir cuenta", and confirm each seat card shows the correct total (lines assigned to that seat; "sin asignar" seat sorted last).
- [ ] **Step 3:** Click "Cobrar esta cuenta" on one seat and confirm `remaining` updates without a full reload.
- [ ] **Step 4:** Pay off all seats and confirm the dialog closes automatically and the order status updates (paid/closed) in the floor view.
- [ ] **Step 5:** Record pass/fail per step for Task 10.

---

### Task 10: Realign docs/TASKS.md with the June module inventory

**Files:**
- Modify: `docs/TASKS.md` (insert the four sections below immediately after the `## Task completion policy` section, keeping newest-first ordering)

- [ ] **Step 1: Insert the following sections**

Adjust the two POS checkboxes marked `(from Task 8/9)` to `[x]` only if the corresponding manual QA passed, and write the real date and evidence in the `Verified:` lines. Leave items `[ ]` where evidence is missing.

```markdown
## atlas.pos — Restaurant POS

Specs: `docs/superpowers/specs/2026-06-21-atlas-pos-core-design.md`, `2026-06-29-pos-waiter-split-bill.md`
Plans: `docs/superpowers/plans/2026-06-21-atlas-pos-plan-a-core-backend.md`, `...-plan-b-ui.md`, `...-plan-c-floor-planner.md`, `2026-06-22-pos-reservations.md`, `2026-06-29-pos-waiter-plan-a-backend.md`, `...-plan-b-ui.md`

- [x] Core backend: sessions, stations, tables, orders, payments (`apps/api/src/routes/pos/`)
- [x] Screens: `PosFloorPlannerScreen`, `PosOrdersScreen`, `PosSessionsScreen`, `PosSettingsScreen`, `PosStationsScreen`, `PosTablesScreen`, `PosTerminalScreen`
- [x] Reservations (`20260622100000_pos_reservations`, `pos-reservation-service.js`, `usePosReservation`)
- [x] Waiter assignment: auto-claim on order open, auto-clear on AVAILABLE, mis-mesas filter, waiter chip (`20260629120000_pos_waiter_split_bill`)
- [x] Split bill: per-seat totals, `SplitBillDialog`, mesa-completa/dividir-cuenta toggle in `PaymentDialog`
- [x] Backend tests: waiter assignment, seat totals, mis-mesas, auto-claim, 404 unknown waiter
- [ ] Manual QA: waiter chip + mis-mesas flow in browser (from Task 8)
- [ ] Manual QA: split-bill payment flow in browser (from Task 9)
- [ ] Full restaurant-flow QA (session → table → order → kitchen → payment → close)

Verified: (pending — fill from post-pause stabilization Tasks 7–9)

## atlas.chat — Realtime Chat

Specs: `docs/superpowers/specs/CHAT_SPEC.md`, `2026-06-28-chat-improvements-a-backend.md`, `...-b-frontend.md`, `2026-06-28-realtime-layer-unificado-design.md`, `2026-06-26-realtime-v2-design.md`
Plans: `docs/superpowers/plans/CHAT_IMPLEMENTATION_PLAN.md`, `2026-06-28-chat-improvements-plan-a.md`, `2026-06-28-realtime-layer-plan-a-api.md`, `...-plan-b-frontend.md`, `2026-06-26-realtime-v2-plan-a-api.md`, `...-plan-b-frontend.md`

- [x] Chat tables + evolution migrations (`20260625000000_add_chat_tables` → `20260629130000_chat_archive`: attachments, tracking code, expiry email flag, archive, available_for_chat)
- [x] Internal chat: `ChatScreen`, conversations, members, typing, presence (Supabase Realtime)
- [x] External guest chat: `ExternalInboxScreen`, `ExternalChatWidget`, storefront-sdk guest flow (v0.5.2)
- [x] Message templates: `ChatTemplatesScreen`; forward message modal
- [x] Unified realtime layer (2026-06-28 plans A/B)
- [ ] Message search
- [ ] Notification integration: unread badge in topbar
- [ ] Confirm `atlas-chat` bucket exists in Supabase Storage

Verified: (pending — no formal verification run recorded; module active in dev use since 2026-06-25)

## atlas.notes — Collaborative Notes

Plans: `docs/superpowers/plans/2026-06-27-atlas-notes-A-backend.md`, `2026-06-27-atlas-notes-B-frontend.md`

- [x] Backend: migrations `20260627120000_atlas_notes_tables` + `20260627130000_atlas_notes_fixes`; services (notes/folders/tags/shares/ydoc); 26-endpoint router; SDK domain; 17 permissions in core manifest
- [x] Frontend: `NotesScreen`, `PublicNoteScreen`, `NoteEditor` (TipTap + Yjs via `SupabaseYjsProvider`), `DrawingCanvas`, `ImageAnnotationOverlay`, `NoteShareModal`, folders/tags sidebar
- [ ] Create `atlas-notes` private bucket in Supabase Storage
- [ ] Live QA: collaborative editing between two sessions; public route `/p/notes/:slug`

Verified: (pending — implementation confirmed by file inventory 2026-07-17; no live QA recorded)

## June 2026 UX/platform small plans

Plans: `docs/superpowers/plans/2026-06-20-ledger-categories-user-scope-a-api.md` + `-b-ui.md`, `2026-06-21-sortable-lists-plan.md`, `2026-06-21-notification-bell-ux-fix.md`, `2026-06-22-calendar-deeplink-loading-state.md`, `2026-06-26-file-viewer-mobile-responsive.md`

- [x] Ledger categories user scope (A: API, B: UI)
- [x] Sortable lists
- [x] Notification bell UX fix
- [x] Calendar deeplink loading state
- [x] File viewer mobile responsive

Verified: (pending — implemented per plan execution in June sessions; re-verify opportunistically when touching these areas)
```

- [ ] **Step 2: Fill in the `Verified:` lines**

Using actual results from Tasks 1, 7, 8, 9, write real evidence, e.g.:

```
Verified: 2026-07-17 (`pnpm.cmd exec prisma migrate status` → up to date; `node --test apps/api/src/routes/pos/__tests__/` → all pass; browser QA: waiter chip + mis-mesas OK, split bill OK)
```

- [ ] **Step 3: Commit**

```bash
git add docs/TASKS.md
git commit -m "docs(tasks): add atlas.pos, atlas.chat, atlas.notes, and June small-plan sections

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Final clean-tree check**

```bash
git status
```

Expected: `nothing to commit, working tree clean`. This satisfies acceptance criterion 1.
