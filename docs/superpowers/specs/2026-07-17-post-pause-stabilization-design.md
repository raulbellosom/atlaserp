# Post-Pause Stabilization — Working Tree Cleanup, POS Verification, and TASKS.md Realignment

## 1. Feature title

Post-Pause Stabilization: working tree cleanup, POS waiter/split-bill verification, and TASKS.md realignment.

## 2. Status

Draft

## 3. Context

Development paused on 2026-06-29 after an intense June cycle that shipped four major untracked work areas: atlas.pos (restaurant POS, 2026-06-21 → 2026-06-29), atlas.chat (realtime chat, 2026-06-25 → 2026-06-29), atlas.notes (collaborative notes, 2026-06-27), and the unified realtime layer (2026-06-28). Work resumed on 2026-07-17 after a ~3-week pause. The repository was left mid-flight: 7 files modified but uncommitted, the manual verification steps of the last executed plan (`2026-06-29-pos-waiter-plan-b-ui.md`) unchecked, and `docs/TASKS.md` stopped receiving entries around 2026-06-14 — it documents none of the June module work.

## 4. Problem

The project cannot safely resume feature development because:

1. The working tree contains uncommitted changes of mixed intent (a large canvas refactor, accessibility fixes, UI restyling, and one suspicious error-swallowing workaround) that will rot or get accidentally discarded.
2. `apps/api/src/routes/pos/pos-order-service.js` contains `.catch(() => [])` on `posGuestSeat.findMany`, which silently swallows database errors — a workaround that only made sense before migration `20260629120000_pos_waiter_split_bill` was applied.
3. There is no evidence of whether the 12 June migrations (POS, chat, notes) are applied to the live database.
4. The waiter-assignment and split-bill features were implemented but never manually verified (plan B verification steps unchecked).
5. `docs/TASKS.md` — the project's single source of truth for phase status — is missing all work from 2026-06-20 onward, violating the SDD maintenance rules.

## 5. Goals

1. Working tree is clean: every uncommitted change is either committed in a logically scoped commit or deliberately reverted.
2. The `.catch(() => [])` error-swallowing workaround is removed and guest seat hydration fails loudly on real errors.
3. Migration state of the live database is verified and documented; any pending migrations are applied.
4. The POS backend test suite passes, and the manual verification steps of `2026-06-29-pos-waiter-plan-b-ui.md` are executed and documented.
5. `docs/TASKS.md` reflects reality: sections exist for atlas.pos, atlas.chat, atlas.notes, and the unified realtime layer, with checkboxes marked `[x]` only where verification evidence exists.

## 6. Non-goals

1. No new features in any module.
2. No refactor of files violating the 1000-line limit (`apps/api/src/index.js`, `FormFields.jsx`, etc.) — tracked separately.
3. No live QA of the Growth/Documents modules (their pending `[ ]` items in TASKS.md remain pending).
4. No chat message search, no unread badge, no notes bucket verification — future work.
5. No Purchases or Reports module work.

## 7. User stories

1. As the project owner, I want the working tree clean and the last sprint's work verified so that I can start the next feature from a known-good baseline.
2. As a future AI agent or developer, I want TASKS.md to reflect the actual module inventory so that I do not re-plan or re-implement existing work.
3. As a restaurant operator (end user of atlas.pos), I want waiter assignment and split-bill to actually work in the live app, not just in unit tests.

## 8. UX requirements

N/A — no new UI. The manual verification exercises existing Spanish-labeled UI ("Mis mesas", "Dividir cuenta", "Cobrar esta cuenta", "Asignar mesa a mí").

## 9. Routes/screens

No new routes. Screens exercised during verification (module `atlas.pos`):

- `/app/m/atlas.pos` → `PosTablesScreen` (waiter chip, mis-mesas toggle)
- `PosTerminalScreen` (guest seats, order lines)
- `PaymentDialog` / `SplitBillDialog` (mesa completa vs. dividir cuenta)
- `PosOrdersScreen` (order detail dialog/sheet)

## 10. Data model

No new entities. Existing models touched by verification: `PosOrder`, `PosTable` (`waiterId` columns), `PosGuestSeat`, `PosPayment`, `PosOrderLine`.

## 11. Prisma impact

No new models, no new migration. Requires confirming that already-authored migrations up to `20260629130000_chat_archive` are applied to the live database via `prisma migrate status`.

## 12. API contract

No new endpoints. One behavioral change: `GET /pos/orders/:id` (order hydration in `pos-order-service.js`) stops swallowing `posGuestSeat.findMany` errors — on a real DB error it now propagates a 500 instead of silently returning `guests: []`.

## 13. SDK contract

N/A — no SDK changes.

## 14. Validator contract

N/A — no validator changes.

## 15. Module manifest impact

N/A — no manifest changes.

## 16. Navigation impact

N/A — no navigation changes.

## 17. Blueprint impact

N/A — no blueprint changes.

## 18. RBAC/permissions

N/A — no permission changes. Existing POS permissions gate the screens exercised during manual verification.

## 19. Multi-company behavior

N/A — no changes to company scoping. Existing POS queries remain company-scoped.

## 20. Files/storage impact

N/A — no storage changes.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A — no new audited actions.

## 23. Edge cases

1. If `prisma migrate status` reports `20260629120000_pos_waiter_split_bill` NOT applied, the `.catch()` removal must wait until after `pnpm db:migrate` succeeds — otherwise order hydration breaks in dev.
2. The `FloorOperationalCanvas` refactor changed canvas defaults (2000×1400 → 1400×900) and moved from scroll-based to transform-based pan/zoom; floors saved with coordinates beyond 1400×900 must still render (the code uses `Math.max(floor?.canvasWidth ?? 1400, 1400)`, so stored larger dimensions win — verify visually).
3. `aria-describedby={undefined}` on chat dialogs is intentional (suppresses the Radix warning for description-less dialogs) — do not "fix" it back.
4. Split-bill verification requires an order with ≥2 guest seats and lines assigned to different seats; without that fixture the flow cannot be exercised.
5. TASKS.md entries for implemented-but-unverified work must use unchecked boxes `[ ]` per the task completion policy — resist marking `[x]` from code presence alone.

## 24. Risks

1. **Risk:** The live DB is missing June migrations and `db:migrate` fails mid-chain. **Mitigation:** run `prisma migrate status` first, read the failure, and resolve forward-only (never edit applied migrations).
2. **Risk:** The canvas refactor has an unnoticed regression (it was left uncommitted, possibly mid-testing). **Mitigation:** manual smoke of the floor screen (zoom, pan, pinch, fit-to-content) before committing; commit it separately so it can be reverted alone.
3. **Risk:** Manual QA reveals a functional bug in waiter/split-bill flows. **Mitigation:** scope allows small bug fixes to POS code with their own commits; anything larger becomes a new spec.
4. **Risk:** VPS/DB unreachable from current network (IP allowlist). **Mitigation:** verify connectivity first; if blocked, complete the local-only tasks (commits, TASKS.md) and leave DB tasks explicitly pending.

## 25. Acceptance criteria

1. Given the repository after this work, when running `git status`, then the working tree is clean (no modified or untracked source files).
2. Given `pos-order-service.js`, when searching for `.catch(() => [])`, then there are zero occurrences.
3. Given the live database, when running `pnpm.cmd exec prisma migrate status`, then output reports all migrations applied ("Database schema is up to date").
4. Given the POS backend suite, when running `node --test apps/api/src/routes/pos/__tests__/`, then all tests pass.
5. Given a dine-in order opened by the logged-in user on an available table, when viewing the floor screen, then the table shows a waiter chip; and when the table returns to `AVAILABLE`, the chip disappears.
6. Given "Mis mesas" toggled on, when viewing the floor, then only tables assigned to the current user render at full opacity/interactive.
7. Given an order with 2+ guest seats with lines, when using "Dividir cuenta" in `PaymentDialog`, then each seat card shows its correct total, paying one seat updates `remaining` without reload, and paying all seats closes the dialog and updates the order status.
8. Given `docs/TASKS.md`, when reading it, then sections exist for atlas.pos, atlas.chat, atlas.notes, and the unified realtime layer, each with `Verified:` evidence lines only on checked items.

## 26. Verification plan

- `git status` → clean tree.
- `pnpm.cmd exec prisma migrate status` → up to date.
- `node --test apps/api/src/routes/pos/__tests__/` → all pass.
- `node --check apps/api/src/routes/pos/pos-order-service.js` → OK.
- `pnpm.cmd --filter @atlas/desktop build:web` → build succeeds.
- Manual browser QA per plan tasks 8–9 (waiter chip, mis-mesas, split bill) with results noted in TASKS.md.
- `rg -n "catch\(\(\) => \[\]\)" apps/api/src/routes/pos/` → no matches.

## 27. Rollback plan

All commits are small and independently revertable via `git revert`. No new migrations are introduced, so no rollback migration is needed. If applying pending June migrations fails, do not roll back applied ones — resolve forward with a new migration per repo policy.

## 28. Future enhancements

1. Chat: message search and topbar unread badge (tracked in memory/chat pending list).
2. Notes: confirm `atlas-notes` bucket and live collab QA.
3. Full restaurant-flow QA for atlas.pos (session → table → order → kitchen → payment → close).
4. Decompose the 1000-line-limit violators listed in CLAUDE.md.
5. Growth/Documents live QA items already tracked as `[ ]` in TASKS.md.
6. Purchases and Reports modules (backlog).
