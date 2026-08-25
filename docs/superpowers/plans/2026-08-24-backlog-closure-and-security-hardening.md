# Backlog Closure & Security Hardening — Execution Plan

Status: **Active — I am executing this directly, no approval checkpoints.** Each section is a self-contained unit of work with its own acceptance criteria. Checkboxes are updated as work lands; `docs/TASKS.md` gets the canonical `Verified:` line per project convention when a section closes.

Origin: (1) a full module-by-module reorientation after a ~3-week pause, and (2) a user report that `atlas.ledger` accounts were visible across users, which turned out to be a real, confirmed multi-layer authorization bug — not a one-off.

---

## 0. Priority order and why

1. **Security hardening (atlas.ledger)** — real financial-data exposure, live in the dev company which now has a second real admin user. Highest severity, smallest blast radius to fix. **Done in this pass**, see §1.
2. **atlas-notes bucket** — looked like the same class of issue at first glance; turned out to be a deliberate past tradeoff, not a bug. Recorded for awareness, not acted on. §2.
3. **POS backlog** — largest volume of small, independent items; no security implications, safe to batch. §3.
4. **atlas.chat / atlas.notes remaining pendings** — small, isolated. §4.
5. **Growth / Documents live QA** — requires a running app + browser session, not a code change; scheduled last because it's verification work, not implementation. §5.
6. **Broader data-isolation sweep** — the user's underlying worry ("is this happening everywhere?"). A scoped answer already exists (§6) from auditing the modules most likely to share the ledger's ownership pattern; recorded here so it isn't re-litigated from scratch later.

---

## 1. Security: atlas.ledger account isolation — COMPLETE

Full detail in `docs/TASKS.md` → "Security fix — atlas.ledger account isolation". Summary:

- Removed the `owner_id IS NULL` → "visible to everyone" fallback from every read/write path in `ledger-service.js` and `collaboration-service.js` (it was a documented migration-era compat shim from 2026-06-05 that was never followed up with a real ownership backfill).
- Closed a **separate** bug: 5 route handlers (`PATCH .../enabled`, `PATCH .../transactions/:txId`, `PATCH .../transactions/:txId/enabled`, `GET .../transactions`, `GET .../summary`, `POST .../import/commit`) never checked account ownership at all — only the company-wide base permission gated them.
- Closed a **third** bug, most likely the actual mechanism the user saw in the UI: `sync-service.js`'s offline-sync handler for `atlas.ledger` used the generic company-wide fetch (no ownership filter) — meaning the desktop app's offline SQLite cache (Phase 5) downloaded every account and transaction in the company to every user's device, and the Ledger screens read from that cache. Fixed with an accessible-account-id pre-query.
- Forward migration backfilled the one pre-existing orphaned account to the company's earliest admin and enforced `owner_id NOT NULL` at the DB level going forward — this can't silently regress.
- 18 + 23 regression tests added/updated; both explicitly assert the old vulnerable behavior can't come back.

- [x] Root-cause identified across all 3 layers (data / API / sync)
- [x] Fixed and migrated on the live dev database
- [x] Regression tests added
- [x] Desktop build verified clean
- [x] `docs/TASKS.md` updated with verification evidence

## 2. atlas-notes bucket is public — deliberate past tradeoff, not a bug, flagging for a conscious revisit

Found while closing the "confirm/create Storage bucket" pendings: `atlas-notes` already exists (contradicts the old TASKS.md wording "create it"), `public: true`. Initial read was "this looks like the same class of bug as the ledger issue" — **it is not**. Project memory confirms this was made public **on purpose, by explicit user choice, on 2026-08-03**, specifically to get permanent embedded-image URLs instead of expiring signed URLs (same tradeoff already made for `atlas-files` per the org-wide pattern in `project_atlas_files_public_bucket` memory: "default to public buckets for this kind of use case unless a bucket clearly needs access control").

So this is **not being changed**. It's recorded here only because it's the one place in the app where "shared by default" is real and adjacent to what triggered this whole review — worth being aware of, not worth undoing unilaterally. The actual tradeoff: a private note's inline images are reachable by anyone with the exact URL (object keys are UUID-based, not guessable/enumerable, so this is closer to "unlisted" than "public" in practice) even though the note *text* stays properly access-controlled through the API. If that tradeoff stops being acceptable now that there's a second real user in the company, that's a product call for the user to make explicitly, not something to reverse as a side effect of a security sweep.

- [x] Investigated — confirmed deliberate, not a bug. No code change made.

## 3. atlas.pos backlog

All items are independent; no ordering dependency between them.

- [ ] Wire guest/seat management UI in the classic terminal (`PosTerminalScreen`): add a control to set `guestCount` on order creation and assign lines to `guestSeatId`. Backend + `SplitBillDialog` already support this — today only the mobile Comandero flow and reservations (`partySize`) reach it.
- [ ] `SplitBillDialog.handleChargeSeat`: disable the charge button with a hint instead of silently no-op-ing when no payment method is configured.
- [ ] Mis-mesas filter mode: tables filtered out of the response currently fall back to a pale "Disponible" ghost state in the canvas instead of their real status — either include true status in the filtered response or have the canvas fetch it separately.
- [ ] Cerrar Caja dialog: "Efectivo esperado" preview shows $0.00 — it isn't querying the real expected total (server-side close calculation is already correct); wire the preview to the same calculation.
- [ ] Resumed legacy order on an AVAILABLE table doesn't re-occupy/re-claim it (only order *creation* sets OCCUPIED + waiterId today).
- [ ] `helperText` prop leak to the DOM in `PosSettingsScreen` tax field (pre-existing React console warning, cosmetic).
- [ ] Retail/Mostrador mode QA: needs a RETAIL-mode outlet in dev seed data before it's browser-testable.
- [ ] Watch item, no fix yet possible: `AtlasModule.manifest` navigation for `atlas.pos` was once seen reverted to a stale 7-entry version during QA; `pnpm db:seed` fixed it but the trigger was never identified. If it recurs, audit every writer of `AtlasModule.manifest`, not just the seed script.
- [ ] Not started (post-rework backlog, larger scope, own spec needed before implementation per SDD): kitchen ticket printing, tiempos, kiosko autoservicio, cut CSV/X-Z reports, retiring the global `PosSettings.mode` flag now superseded by per-outlet mode.

## 4. atlas.chat / atlas.notes remaining pendings

- [x] `atlas-chat` bucket existence — confirmed, closed (see §1 area, TASKS.md updated directly).
- [ ] atlas.chat: message search — not started, needs its own small design pass (full-text index choice, UI entry point).
- [ ] atlas.chat: unread badge in topbar — not started; `ActivityBellTrigger` in `Topbar` is the existing pattern to extend from, not a new mechanism.
- [ ] atlas.notes: live two-session collaborative-editing QA (Yjs via `SupabaseYjsProvider`) and public route `/p/notes/:slug` QA — verification work, needs two browser sessions; bundle with §2's public-note read-path testing since they overlap.

## 5. Live browser QA debt (no code changes expected, verification only)

- [ ] Atlas Growth: capture v1 on Builder/`dist` domains, authenticated RBAC + notifications + attachments + both lead-conversion modes, event ingestion/aggregation/retention under real load — all implemented and unit/integration-tested, none browser-verified against a live install.
- [ ] Atlas Documents: template lifecycle, every block type, provider RBAC, storage/download, history, Growth-generation flow — same situation, code-complete, browser-unverified.

These are scheduled after §2–4 because they're pure verification passes best done together in one focused QA session rather than interleaved with feature work.

## 6. Data-isolation sweep — scoped answer to "is this happening everywhere?"

The user's concern was general ("no individual division of user profiles, everything seems shared by default"). I checked every module in this codebase that has an explicit per-user ownership or sharing concept (the only place company-wide-by-default would actually be *wrong*, since most ERP modules — Contacts, Finance chart of accounts, HR, Fleet — are correctly company-wide by design and gated by role permissions, not per-record ownership):

| Module | Ownership model | Result |
|---|---|---|
| `atlas.ledger` accounts/transactions | owner + explicit member/group sharing | **Broken — fixed in §1** (3 separate bugs: data fallback, missing route checks, sync leak) |
| `atlas.ledger` categories | system (owner NULL, intentional) + personal | Correct as designed — read gated properly, write always requires `owner_id = actorId` |
| `atlas.ledger` groups | creator + explicit member | Correct — `listGroups` properly scoped |
| `atlas.notes` | owner + explicit `note_shares` | Correct at the API/data layer — storage bucket is public but that's a deliberate 2026-08-03 tradeoff, not a bug, see §2 |
| `atlas.calendar` (via sync-service) | `ownerId` | Correct — already the reference pattern the ledger sync handler should have copied |

No other module in the current codebase implements a per-user ownership model at all — the rest are intentionally company-wide with role-based permission gates, which is the correct ERP default and not a bug. **Conclusion: this was not a systemic pattern across the whole app — it was concentrated in the one module (`atlas.ledger`) that has an ownership model, plus its storage-adjacent module (`atlas.notes` bucket). Both are now tracked to closure.** If a future module introduces per-user ownership (anything modeled after "personal" data rather than "company" data), copy the `atlas.calendar` sync pattern and the now-fixed `atlas.ledger` API pattern, not the old generic company-wide default.
