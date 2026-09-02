# Module Audit Backlog — 2026-08-30

Living tracker for the module-by-module audit campaign. Work items are grouped and
IDed so they can be picked off one at a time. Check the box and add
`Done: YYYY-MM-DD (commit)` when closed.

**Done so far:** `atlas.ledger` (2026-08-30, pre-campaign), `atlas.fleet`,
`atlas.inventory`, `atlas.notes`, RBAC catalog gaps (`calendar.*` + `catalog.*`).

**Test baseline:** at `5de2f769` the API test dirs were 646 pass / 26 fail. After
the fleet+inventory+notes+rbac work: 749 pass / 16 fail (+103 tests, -10 net
failures; no new failures introduced). The 16 remaining are all pre-existing —
tracked in section **B**.

---

## A. Security / correctness bugs (confirmed, actionable)

- [x] **A1 — `atlas.calendar` cross-tenant calendar sharing.** `shareCalendar`
  checks owner + blocks self-invite, but does **not** verify the invitee
  (`userId`) shares a company with the owner → a user can share a calendar (and
  its events) with someone in another company. Same class as the notes
  `shareNote` bug fixed on 2026-08-30. Fix: add a `membership`-join guard like
  `shares-service._assertShareableTarget`.
  `apps/api/src/routes/calendar/calendar-service.js:104` — _high_
  `Done: 2026-08-30` — added `assertShareableTarget(ownerId, targetUserId)`
  (membership same-company check, 403); 3 new tests in `calendar-service.test.js`.

- [ ] **A2 — run `pnpm db:seed`.** The 2026-08-30 work added 47 permission keys to
  `PERMISSION_CATALOG` (`inventory.*` 10, `notes.*` 17, `calendar.*` 10,
  `catalog.*` 10). Without the seed the new `Permission` rows don't exist, so
  non-admin roles can't be granted those granular permissions. — _blocker (user
  action)_ — `Done: ` ___

---

## B. Pre-existing failing tests

**CLOSED 2026-08-30.** All 26 pre-existing failing API tests are green.
Real bugs found + fixed: PWA per-module `scope` (B5), `getPublicProductBySlug`
(caught via D1), `atlas.projects` missing per-project authz (B1/B2/B3 → D4).
The rest was test-mock rot (services gained `$transaction` / `notificationPreference`
/ `calendarEvent.updateMany` / `fileAsset.groupBy` and mocks lagged) + a stale
SDK path (B6) + dead `tasks-service.createComment` test blocks (removed).
**Full API test dirs: 781 pass / 0 fail** (baseline `5de2f769` was 646 / 26).

- [ ] **B1 — `projects/tasks-service-v2.test.js` (7 fail).** `svc.createComment
  is not a function` — the "V2.1 service functions" (`createComment`,
  `updateComment`, `listTasks includeSubtasks` with `parent` field) are asserted
  by the test but not exported by the service. **Real feature/test mismatch, not
  a mock gap** — resolve inside the `atlas.projects` audit (D4): implement the
  functions or delete the dead tests.
  `apps/api/src/routes/projects/__tests__/tasks-service-v2.test.js`
- [ ] **B2 — `projects/tasks-service.test.js` (2 fail).** Same family as B1 —
  fold into D4. `apps/api/src/routes/projects/__tests__/tasks-service.test.js`
- [x] **B3 — `projects/projects-calendar-bridge.test.js` (1 fail).**
  `grantMemberCalendarAccess` — "creates a CalendarShare". Stale mock: the
  service gained a `calendarCalendar.findFirst` owner lookup; the test's
  `calendarCalendar` mock had no `findFirst`. `Done: 2026-08-30` (added `findFirst`
  to the test mock).
- [x] **B4 — `calendar/calendar-service.test.js` (1 fail).** `deleteCalendar`
  "soft-deletes non-default calendar". Stale mock: needed `calendarEvent.updateMany`.
  `Done: 2026-08-30` (fixed while adding the A1 mocks).
- [x] **B5 — `routes/__tests__/pwa.test.js` (2 fail).** Real bug: `pwa.js`
  `buildWebManifest` hardcoded `scope: '/'`; per-module PWAs must be scoped to
  `/app/m/<key>/` or they collide. `Done: 2026-08-30` (`pwa.js:76`).
- [x] **B6 — `services/__tests__/dist-serve-service.test.js` (1 fail).** Stale
  test: expected `/atlas-sdk.js`, source serves `/public/site/atlas-sdk.js`
  (the real path; nginx rewrites `/atlas-sdk.js` → `/public/site$uri`).
  `Done: 2026-08-30` (updated the test expectation).
- [x] **B7 — `services/__tests__/notification-publisher.test.js` (2 fail).**
  Stale mock: `notification-service.publish` gained a
  `tx.notificationPreference.findFirst` per-recipient channel filter; the test's
  `$transaction` mock had no `notificationPreference`. `Done: 2026-08-30`.

---

## C. Follow-ups from completed audits (deferred, in the specs)

### atlas.fleet
- [ ] **C-F1** — Browser responsive QA at 390 / 1440 for `ReportFormPage` (8
  collapsible sections + parts editor), vehicles detail, catalogs. 14-aspect
  checklist. — _medium_
- [ ] **C-F2** — Verify the "Desactivar" row action on `ReportsScreen` actually
  soft-deletes (no explicit `onDelete` passed to `AtlasTable`; may rely on
  `apiPath + /:id/enabled`). — _low_
- [ ] **C-F3** — Vehicle inspection / "verificación" expiry is not modeled (only
  insurance + driver-licence have computed status). — _low / product_
- [ ] **C-F4** — `ReportsScreen` tab bar uses bare `<button>` (no `role="tab"` /
  `aria-selected`). — _low_

### atlas.inventory
- [ ] **C-I1** — Browser responsive QA (`InventoryItemForm` 541, `InventoryCatalogsScreen` 568). — _medium_
- [ ] **C-I2** — `InventoryAssignmentsScreen` + `InventoryGroupedView` still
  hand-roll a `<table>`. Migrate to `@atlas/ui` `DataTable` — needs an
  `onRowClick` prop added to `DataTable` first. — _low_
- [ ] **C-I3** — `InventoryStatusBadge` uses inline `style` hex colors from
  `ITEM_STATUSES` (deliberate palette, not theme tokens). — _low_
- [ ] **C-I4** — Dead code: `inventory-service.js` still exports
  `listComments/createComment/updateComment/deleteComment/toggleReaction`, unused
  by routes (routes use the shared `commentsService`); kept only for the unit
  tests. Remove or wire. — _low_
- [ ] **C-I5** — Comments/reactions gated by `inventory.item.update` — a viewer
  can't comment. Decide: keep, or add a lighter grant. — _product_

### atlas.notes
- [ ] **C-N1** — Browser responsive QA of the 3-pane `NotesScreen` + editor
  toolbars in dark mode. — _medium_
- [ ] **C-N2** — `note_ydoc_state` vs `notes.content`/`content_text`: two sources
  of truth, no server-side reconciliation. Design review. — _medium_
- [ ] **C-N3** — FTS still computes `to_tsvector` over a CTE alias in `listNotes`
  (config now matches the index, but a stored `tsvector` column would guarantee
  index use). — _low / perf_
- [ ] **C-N4** — `updateFolder` doesn't validate `parentFolderId` ownership or
  prevent cycles. — _low_
- [ ] **C-N5** — Vestigial `deleted_at` column (never set; `permanentDelete` is a
  hard delete). The `deleted_at IS NULL` clauses are always-true. Remove or start
  using it for a soft-delete window. — _low_
- [ ] **C-N6** — A few primary actions are raw `<button className="bg-amber-500
  text-white">` instead of `@atlas/ui` `Button` (`NoteToolbar`, `NoteShareModal`,
  `NotesScreen`, `NoteSettingsPanel`). Visually fine in both themes. — _low_

---

## D. Modules not yet audited at ledger/fleet rigor

Each = Phase 1 audit (chat report) → Phase 2 fixes → tests + current-state spec +
memory. Priority order:

- [~] **D1 — `atlas.catalog`.** Phase 1 audit done 2026-08-30. Company scoping in
  `catalog-product-service` is the most consistent of any module audited (every
  query `company_id`-scoped), `recordStockMovement` already transactional.
  **Fixed 2026-08-30:** C1 `getPublicProductBySlug` now projects explicit
  shopper-facing columns (was `SELECT p.*` leaking `company_id`/`meta_*`/`sku`/
  `barcode` on the public storefront endpoint) + variants sub-query now
  company-scoped; C2 `assertRowInCompany` guards `parent_id` (create/update
  category) and `category_id` (create/update product) against cross-company refs,
  + self-parent check; C3 `recordStockMovement` 404s when the product/variant is
  not in the company (was inserting a movement row against a foreign product id
  and returning 201); catch blocks in all 4 catalog route files now honour
  `err.status < 500`. New `catalog-tenant.test.js` (7). RBAC + `catalog.inventory.adjust`
  wiring done earlier this session.
  **Still open:**
  - [ ] **D1-a** — `deleteCategory` / `deleteProduct` have no in-use check
    (soft-delete leaves dangling `category_id` on products). — _low_
  - [ ] **D1-b** — `createPublicCatalogRouter.getActiveCompanyId()` = first
    enabled company. Public catalog is effectively single-tenant. Confirm that's
    intended, or thread the company from the request host/site. — _low / arch_
  - [ ] **D1-c** — `resolveImageUrls` fetches `file_asset` by id with no
    `company_id` filter (transitively safe — ids come from company-scoped rows).
    — _low_
  - [ ] **D1-d** — UI: `VariantMatrix.jsx` hand-rolled `<table>` → `DataTable`;
    stock-movement badges in `CatalogProductDetailScreen.jsx:562`
    (`bg-red-100 text-red-600` / `bg-emerald-100`) need `dark:` variants;
    `CatalogProductDetailScreen.jsx` = 657 lines (watch). — _low_
  - [ ] **D1-e** — current-state spec + memory.
- [~] **D2 — `atlas.calendar`.** Phase 1 audit done 2026-08-30. Event access
  control + Google OAuth (AES-256-GCM tokens, HMAC-signed CSRF state) are solid.
  **Fixed 2026-08-30:** A1 (share cross-tenant); F2 `addAttendee` now rejects
  out-of-company users (`filterCompanyPeers`); F3 `normalizeRecurrenceRule` —
  validates/clamps `freq`/`interval`/`count`/`until` on create+update and
  hard-caps `expandRecurrence` at 366 instances (was an unbounded per-listEvents
  DoS on a client-controlled JSON field); F4 `createEvent` now writes
  event+attendees+reminders in one `$transaction`. 8 new tests.
  **Still open:**
  - [ ] **D2-a** — `calendar-routes.js` is 1010 lines (> CLAUDE.md limit). Split
    into calendars / shares / events / google / reminders sub-routers.
  - [ ] **D2-b** — `CalendarShareModal` populates its user picker via
    `atlas.identity.listUsers` (needs `identity.users.read`). A user with only
    `calendar.share.manage` gets an empty picker. Use a lightweight company-member
    picker endpoint. (Same smell likely in notes `NoteShareModal`.)
  - [ ] **D2-c** — one-time cleanup: delete `calendarShare` / `note_shares` rows
    where the two users share no company (rows created before A1). Run as a
    script against prod after review.
  - [ ] **D2-d** — `/calendar/internal/process-reminders` only checks
    `x-internal-secret` when `NODE_ENV==='production'` (open in staging/dev).
    App-wide pattern; decide whether to tighten globally. — _low_
  - [ ] **D2-e** — current-state spec + memory for atlas.calendar.
- [x] **D3 — `atlas.growth`.** Audited 2026-08-30 — **no code changes needed.**
  Best-shape module of the campaign: thorough `companyId` scoping,
  `assertAssignee`/`resolveSite` cross-ref guards, `convertLead` in a
  `$transaction` with optimistic concurrency (`assertVersion` + conditional
  `updateMany` → 409 conflict), deliberate permission mapping incl. inline
  sub-permission checks (`assigneeUserId`→`growth.leads.assign`, convert
  mode→`contacts.*`), theme-aware `@atlas/ui` `Badge` from the start, 29/29 tests.
  Spec: `2026-08-30-atlas-growth-current-state.md`. Only nits: `GET .../assignees`
  behind `growth.leads.assign`; analytics subqueries rely on transitively-safe
  `site_keys` scoping; a couple of files to watch for size.
- [x] **D4 — `atlas.projects`.** Audited + fixed 2026-08-30.
  **Headline bug:** no per-project membership enforcement — only `GET/PATCH/DELETE
  /projects/:id` checked; all task/status/member/field/dependency/comment/
  attachment routes trusted the company-wide RBAC grant + the URL `projectId`,
  allowing cross-project (and cross-company, by guessing an id) reads/writes, and
  `addMember` let any grant-holder add themselves to any project.
  **Fixed:** `requireProjectAccess(minRole)` middleware on all 40 `/projects/:id/*`
  routes — verifies `ProjectMember` (or owner) **and** `project.companyId ===
  callerCompanyId`, gated VIEWER < MEMBER < OWNER; `addMember` now checks the
  invitee shares the project's company; `createProject` writes project + statuses
  + owner-membership in one `$transaction`. All 26 pre-existing failing API
  tests (B1–B7) now pass; new `project-access.test.js` (5). Full API suite:
  781 pass / 0 fail.
  **Still open:**
  - [ ] **D4-a** — `getProject` still re-implements its own membership check
    (now redundant with the middleware). Harmless; could simplify.
  - [ ] **D4-b** — `updateProject`/`archiveProject` return 403 (leak existence)
    where `getProject` returns 404 — the middleware now 404s first, so this is
    mostly moot, but the service messages are inconsistent.
  - [ ] **D4-c** — current-state spec + memory.
- [x] **D5 — `atlas.documents`.** Audited 2026-08-30 — **no code changes needed.**
  Whitelist-based `{{a.b}}` template interpolation (no eval/Function/template
  engine; `__proto__` blocked by regex), no SSRF/LFI (pdfkit server-draw, no
  HTML→browser), thorough `companyId` scoping, `$transaction` on template ops,
  shared `resolveCompanyBranding`, and the provider registry enforces each data
  source's own `permissionKey` (cross-module authz). 35/35 tests. Spec:
  `2026-08-30-atlas-documents-current-state.md`.
- [x] **D6 — `atlas.pos`.** Audited + fixed 2026-08-30. Base solid (companyId
  guard on every method, 67/67 routes permission-gated, 22 granular keys,
  `$transaction` on order create/lines/floor/kitchen/reservation).
  **Money bug fixed:** `addPayment` was 4 non-atomic writes with no concurrency
  guard → partial failure made a payment re-payable (double charge), concurrent
  calls could overpay. Now one `$transaction` with a conditional
  `posOrder.updateMany` CAS on `paidAmount` → 409 on concurrent change.
  `closeSession` likewise made a conditional close. 66/66 tests (+1 concurrency
  test). Spec: `2026-08-30-atlas-pos-current-state.md`.
  **Still open:** POS2 — cancelling a partially-paid order doesn't reverse
  captured payments and there's **no refund flow** (`REFUNDED` never set); POS5 —
  `pos-routes.js` 806 lines, split by domain; browser QA of split-bill/waiter/caja.
- [x] **D7 — `atlas.chat`.** Done: 2026-08-30. Access control was already
  excellent (`assertMember`/`assertChannelPermission` on every mutating path;
  reply/thread/attachment reads fold membership into the same query for a
  non-leaking 404 — spec Section 12 convention). Found and fixed the one real
  gap: **`createConversation`/`addMembers` inserted a client-supplied
  `user_profile` id into `chat_conversation_members` with zero validation
  that it belonged to the caller's company** — a caller could add an
  arbitrary user from a different company into a private direct/group/channel
  conversation (same bug class as calendar's `shareCalendar` and projects'
  `addMember`). Fixed with a `filterCompanyPeers()` guard (same pattern as
  `calendar-event-service.js`'s attendee guard) applied to both functions,
  403 on a foreign-company id, checked before any write. New
  `chat-tenant.test.js` (4 tests) proves the guard rejects cross-company ids
  and still fires even when `assertChannelPermission` grants the action.
  File-size remediation: `index.js` was 1122 lines (over the CLAUDE.md
  1000-line limit, explicitly named in CLAUDE.md) → extracted
  `moderation-routes.js` (mute/block/reports) and `template-routes.js`
  (message templates) → now 948 lines. `chat-service.js` was 1370 lines →
  extracted the presign/sign/delete attachment trio into
  `chat-attachments-service.js` → now 1304 lines (still over 1000, see D7-a).
  RBAC catalog already complete (`rbac-granular-contract.test.js` 6/6, no new
  keys needed). No native dialogs, no raw `<select>`/`<textarea>` in the
  internal app (the one raw `<textarea>` is in `ExternalChatWidget.jsx`, a
  standalone embeddable script for third-party websites with no `@atlas/ui`
  dependency by design — correct exception, not a violation). 183/183 chat
  tests pass (was 179, +4 new). Spec:
  `docs/superpowers/specs/2026-08-30-atlas-chat-current-state.md`.
  **Still open:**
  - [ ] **D7-a** — `chat-service.js` still 1304 lines (over the 1000-line soft
    limit, under the 1500 hard ceiling). Further extraction (e.g. `sendMessage`
    at ~288 lines) is riskier — deeply coupled to mentions/entityRefs/
    notifications/broadcaster — left for a dedicated pass rather than forced
    through this session, same call as `pos-routes.js` (POS5) and
    `calendar-routes.js` (D2-a). — _low_
  - [ ] **D7-b** — Guest widget `listGuestMessages` returns the raw
    `object_key` for attachments, but there is no guest-facing signed-URL
    route to actually view them (only the internal `getAttachmentSignedUrl`
    exists, member-only) — guests can attach files but apparently can't view
    attachments back. Functional gap, not a security issue (no way to turn a
    bare `object_key` into a working URL without hitting a signing endpoint
    that doesn't exist for guests) — needs product decision on whether guest
    attachment viewing is in scope. — _low_
- [x] **D8 — Core modules** (`atlas.core`, `atlas.identity`, `atlas.files`,
  `atlas.company`, `atlas.contacts`, `atlas.hr`). Done: 2026-08-30. **Found and
  fixed the single most severe bug of the entire campaign: a privilege-
  escalation path in `PATCH /identity/users/:id`.** The membership/role
  reassignment sub-block (gated only by `identity.users.update`) trusted a
  client-supplied `{ membershipId, roleId }` pair with zero validation — no
  check that `membershipId` belonged to the `:id` in the URL, and no check
  against protected role keys — so a caller holding only
  `identity.users.update` (never any `identity.roles.*` permission) could
  grant **themselves the `atlas.admin`/`system.admin` role** via
  `PATCH /identity/users/<own id>`. Fixed with an ownership check
  (`membershipId`'s `userId` must equal `:id`) plus a protected-role guard
  (assigning `atlas.admin`/`system.admin` now additionally requires
  `identity.roles.update` or admin, checked via the already-resolved
  `userContext`). Also added the disable-lockout guard `DELETE` already had
  but `PATCH` was missing (`enabled: false` on a protected admin now 400s).
  Also fixed the same PDF-branding bug the original ledger audit found:
  `/contacts/export/pdf` and `/hr/employees/export/pdf` resolved company via
  `membership.findFirst({ where: { userId: authUserId } })` — `authUserId` is
  the Supabase auth id, not a `Membership.userId` (= `userProfile.id`), so the
  lookup always missed and branding always fell back to generic "Atlas ERP" —
  now uses `c.get("companyId")`, already correctly resolved by
  `requirePermission()`. Confirmed `atlas.identity`'s instance-wide (not
  company-scoped) design is intentional — do not "fix" it. Service-layer audit
  (contacts/files/hr/company) found **no other issues** — `hr-service.js` in
  particular is the most thorough tenant-isolation of any module in this
  campaign (guards on every FK: department/job title/supervisor/profile
  image/user-link/hierarchy-cycle). UI-first/dark-mode clean. Spec:
  `docs/superpowers/specs/2026-08-30-atlas-core-modules-current-state.md`.
  **Still open:**
  - [ ] **C8-a** — the privilege-escalation fix has no automated regression
    test: `index.js` connects to live Postgres/Supabase at import time, so no
    test in this repo imports it (pre-existing convention, not new). Extract
    `/identity/*` (and `/company/*`, `/files/*`, `/contacts/*`, `/hr/*`) into
    dedicated `routes/<module>/` routers — shrinks `index.js` (E1) and makes
    this testable. — _medium, do before considering the fix fully closed_
  - [ ] **D8-a** — `HrEmployeeDetail.jsx` (1196, already CLAUDE.md-named) and
    `HrEmployeeForm.jsx` (1048, newly over 1000) need decomposition — deferred,
    same call as other large-file splits this campaign. — _low_
- [x] **D9 — `atlas.calls` / `atlas.storefront` / `atlas.website`.** Done:
  2026-08-30. `atlas.calls` is clean — the best-engineered module in the whole
  campaign (deadlock-avoiding locked transactions for simultaneous calls,
  race-free busy-detection, membership-scoped LiveKit tokens). `atlas.storefront`
  clean (self-registration role is allowlist-checked against instance config).
  **Found and fixed a real-money bug in `atlas.website`:** `POST
  /public/checkout` built Stripe line items straight from client-supplied
  `item.price`/`currency`/`name` with zero server-side re-validation — a
  tampered request could buy anything for any price (this route has no
  first-party caller in the repo — `packages/storefront-sdk` has no checkout
  support yet — so it looks like it was built ahead of its own cart UI, but
  the bug is real regardless of caller). Fixed: the route now only trusts
  `{productId, variantId?, qty}` per line and re-derives price/currency/name
  server-side from `catalog_product`/`catalog_product_variant` (raw
  `$queryRaw` — confirmed these AME3-managed tables have no
  `prisma.<model>` accessor on the generated client despite a `model
  CatalogProduct` block existing in `schema.prisma`), scoped to the site's own
  company and `published`/`enabled`. Added `StripeImpl`/`decryptPasswordImpl`
  injection points (same pattern as `call-service.js`) so this is now
  unit-tested: new `checkout-routes.test.js` (7 tests) proves a `price: 0.01`
  attempt against a 500.00 catalog item still charges 500.00.
  `website-service.js` (878 lines, ~60 functions) otherwise clean — every
  function company-scoped with ownership checks before every write. Spec:
  `docs/superpowers/specs/2026-08-30-atlas-calls-storefront-website-current-state.md`.
- [x] **F1 — `atlas.calls`: mid-call audio→video upgrade + full-scale screen
  share + draggable/hideable camera PIP (requested by user 2026-08-30).**
  Done: 2026-08-30, frontend-only. Spec:
  `docs/superpowers/specs/2026-08-30-atlas-calls-video-upgrade-and-pip-design.md`.
  - Dropped the `session.call.kind === "VIDEO"` gate on the camera /
    screen-share buttons in `CallRoomLayout.jsx` — always rendered now.
  - `CallRoom.jsx` derives `isVideoActive` (kind==VIDEO || local camera/screen
    on || any remote video track) and drives `isDirectVideo` + the header
    badge off it, so a call started as voice flips to the video/focus layout
    the moment anyone turns on a camera.
  - New `screenShareEntry` derivation → when any participant is sharing, a new
    layout branch makes the shared screen fill the full viewport
    (`object-contain`, black ground, no cropped content) and floats every
    camera feed over it.
  - New `calls/DraggablePip.jsx` — pointer-events drag (mouse+touch), clamped
    to the call `<main>`, with a collapse-to-pill / tap-to-restore toggle.
    Used for the screen-share camera bubbles AND the 2-person focus-layout
    self-view (which was a fixed, non-hideable box before).
  - Verified: `pnpm --filter @atlas/desktop build:web` clean; calls+chat
    backend suites 195/195 (no backend change).
  - [ ] **F1-a** — persist the upgrade to the DB `Call.kind` (+ tweak the
    incoming-call notification wording) so call *history* shows "Videollamada"
    when a voice call became a video call. Purely cosmetic for history — needs
    a `call-service.js` mutation + route + a `chat.call.kind_changed`
    broadcast. — _low_

---

## E. Cross-cutting technical debt

- [ ] **E1 — `apps/api/src/index.js` still 4755 lines** (down from 5220 after
  ledger/fleet/inventory router extraction). Still over the CLAUDE.md 1000-line
  limit; other modules' route blocks remain inline. Extract per-module routers as
  each module is audited. — _medium_
- [ ] **E2 — Other CLAUDE.md file-size violators** (not touched): `FinanceScreen.jsx`
  (4462), `FormFields.jsx` (2153), `HrEmployeeDetail.jsx` (1704),
  `finance-documents-service.js`, `finance-service.js`, `ModuleCatalog.jsx`. — _medium_
- [ ] **E3 — `requireModuleAccess(moduleKey)` is defined in `index.js` but used
  by no module.** Every `*.access` permission (fleet/inventory/catalog/calendar/
  notes/…) is nav-gated only. Decide: wire it as a router-level guard everywhere,
  or delete it and document that `*.access` is nav-only. — _low_
- [ ] **E4 — An auto-commit + push hook is active** (commits like "feat: update
  documentation…" appear without an explicit `git commit`; `origin/main` is kept
  in sync). Be aware: uncommitted-diff comparisons are unreliable; work is
  checkpointed automatically. — _info_

---

## G. Dependencies / secrets / shared infrastructure (2026-08-30, post-campaign)

Done: `pnpm audit --prod` 51 → 9 advisories (hono, @hono/node-server,
react-router-dom, sharp bumped directly; ws + dompurify + tmp + js-yaml +
brace-expansion + nanoid pinned via `pnpm.overrides` since they're transitive
through real runtime deps — supabase-realtime, atlas-web-builder, exceljs,
mdxeditor). Secrets scan clean (no committed .env, ever, in git history; no
hardcoded keys in source). `module-lifecycle-service.js` / `-migration-`
confirmed safe (table names/migration SQL both allowlist-gated before any
raw-SQL interpolation). `apps/worker` is no longer a stub (242-line
multi-job cron runner) — spot-checked, no HTTP surface, growth aggregation
correctly company-attributed. Spec:
`docs/superpowers/specs/2026-08-30-dependencies-secrets-shared-infra-audit.md`.

- [ ] **G1 — bump `nodemailer` 8→9** (fixes a high-severity SSRF/arbitrary-file-read
  CVE via the message-level `raw` option — confirmed unused in
  `smtp-service.js`, so not currently exploitable, but the dependency itself
  stays flagged). Needs a dedicated pass with a live-SMTP send test before
  merging, not a blind bump. — _medium_
- [ ] **G2 — `uuid@8.3.2`** (transitive via `exceljs`) has a CVE in
  `v3()/v5()/v6()` + a custom `buf` argument; exceljs only calls `v4()` with
  no `buf`, so this is not currently exploitable through our usage. No action
  needed unless that changes. — _informational_

---

## Suggested order

1. **A1** (calendar cross-tenant) — quick, security.
2. **A2** (`db:seed`) — user runs it.
3. **D1 + D2** (catalog + calendar full audits) — calendar audit absorbs A1, B3,
   B4; projects audit (D4) absorbs B1, B2.
4. **B5–B7** (pwa / dist-serve / notification-publisher) — standalone triage.
5. **D3 → D9**, then **C** follow-ups and **E** debt.

---

## atlas.pfm — Phase 1 UI deferred refinements (added 2026-08-31)

Non-blocking polish tracked during the Phase 1 build of `atlas.pfm` (Finanzas
personales). Spec: `docs/superpowers/specs/2026-08-31-atlas-pfm-design.md`.

- [x] **PFM-1 — Ledger-account picker** in `WalletFormSheet` so a wallet can be
  linked to an `atlas.ledger` account (`ledgerAccountId`). Backend already
  supports it end-to-end (read-only mirror); only the create/edit UI control is
  missing. `Done: 2026-09-02 (e8e697fa)` — `useLedgerAccounts` hook + optional
  "Cuenta bancaria enlazada" `SelectField` (hidden when the user has no ledger
  read access); supports link and unlink.
- [x] **PFM-2 — Inline "+ Crear «X»" category creation** from
  `QuickAddMovementSheet` — swap `ComboboxField` back to `CreatableComboboxField`
  and wire `onCreate` to `useCreatePfmCategory` (hook already exists) with an
  optimistic select. `Done: 2026-09-02 (e8e697fa)` — done for both
  `QuickAddMovementSheet` and `ReceiptReviewSheet`; new category `kind` follows
  the current direction; fails soft without `pfm.categories.manage`.
- [ ] **PFM-3 — Company-member picker** in `WalletMembersDialog` (replace the raw
  user-id `TextField`; reuse the `ContactPicker` pattern) and resolve member
  `userId` to a display name in the dialog and in `MovementRow`. **Blocked on a
  small backend addition:** there is no non-privileged "list my company's
  members" endpoint — `GET /identity/users` needs `identity.users.read`, which a
  regular pfm user should not need just to share a wallet. Needs a lightweight
  company-directory endpoint (id + display name + avatar) first.
- [x] **PFM-4 — Editable confirm amount** for variable pending charges (matters
  once Phase 2 recurring rules land — API `confirmMovement` already accepts an
  `amount` override). `Done: 2026-09-02 (e8e697fa)` — new `ConfirmChargeDialog`
  (amount field, sends the override only when changed) replaces the plain
  `ConfirmDialog` in `WalletDetailScreen` and `UpcomingChargesCard`.
- [ ] **PFM-5 — Browser QA at 390px + 1440px** with the 14-aspect checklist —
  could not run during the build (Playwright MCP bridge extension not connected).

### atlas.pfm — Phases 2-4 UI browser QA (added 2026-08-31)

- [ ] **PFM-6 — Full browser QA of every atlas.pfm screen at 390px + 1440px**
  (Resumen, Carteras, detalle de cartera, alta rapida, Recurrencias,
  cargo-recurrente sheet, Tickets + review sheet, Presupuestos y metas,
  panel de tarjeta de credito). 14-aspect checklist. All phases 1-4 code is
  merged + unit-tested + live-DB verified, but zero interactive browser QA ran
  this session (Playwright MCP bridge extension not connected).
- [ ] **PFM-7 — Live Groq OCR end-to-end** once `GROQ_API_KEY` is in `.env`:
  upload a real receipt photo, confirm PARSED → confirm → POSTED movement with
  the image attached. The adapter + state machine are unit-tested with mocked
  network; the real call has never run.

### atlas.pfm — assistant sidebar (added 2026-09-02, shipped)

Spec `docs/superpowers/specs/2026-09-02-pfm-assistant-design.md`, plans
`docs/superpowers/plans/2026-09-02-pfm-assistant-plan-{a-api,b-ui}.md`. Backend +
UI merged, unit-tested (Groq stubbed), migration applied to the live DB, manifest
v0.5.0, `pnpm db:seed` run.

- [ ] **PFM-8 — Browser QA of the assistant sidebar** at 390px + 1440px:
  collapse/expand tab, ask a question, thread switching, delete (`ConfirmDialog`),
  and the propose-movement confirm card (Registrar goes through the normal
  movement endpoint). Needs `GROQ_API_KEY` in the env for a live run.
- [ ] **PFM-9 — Live Groq tool-loop end-to-end** once `GROQ_API_KEY` is set:
  verify "cuanto tengo en total" / "resumen del mes" call the right tools and the
  numbers match the module, and that "apunta $X" produces a proposal (never an
  auto-write). Only the stubbed loop has run.
