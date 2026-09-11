# Multi-Tenant Architecture — Design Spec

Date: 2026-09-10
Status: Approved (self-reviewed per user authorization — see "Approval" section)
Author: Claude Code, with Raul Belloso

## 1. Problem statement

Atlas ERP already has the *data model* for multi-tenancy (`Company`, `UserProfile`, `Membership`, `Role`, `Permission`, `UserPermissionGrant`, and `companyId` columns on most business tables), but it does not have a real *tenant resolution* mechanism. A full repository audit (methodology and evidence in §2) confirmed:

- The backend picks "the current company" for a request from `context.memberships?.[0]?.companyId` — the first row of an **unordered** Prisma query — inside the two core RBAC middlewares (`requirePermission`, `requireAnyPermission`). Roughly 15 other services independently run a **different** query (`membership.findFirst({ orderBy: { createdAt: 'desc' } })`) to answer the same question. These two mechanisms can disagree within a single user session, so "which company" is arbitrary and inconsistent, not deliberately chosen.
- Permissions are **unioned across every company** a user belongs to into one flat `permissionSet`/`isAdmin` flag, with no company key attached to any individual permission. A user with `atlas.admin` in Company A gets full instance-wide admin rights in Company B too.
- `Role` has no `companyId` — it is a single, flat, instance-wide catalog shared by every company.
- `CompanySwitcher.jsx` writes the chosen company to `localStorage["atlas-active-company"]`; nothing else in the codebase reads that key. It has zero effect on API behavior today.
- The SDK (`packages/sdk/src/index.js`) has no per-request tenant header/param mechanism at all.
- `AtlasModule` (module install/enable status) is one global row per module key — there is no per-company module enablement, and none is scaffolded.
- `InstanceConfig.primary_company_id` is a literal "this instance serves exactly one company" pointer, consumed directly by the public website/storefront HTML server and by generic "get the active company" helpers.
- `GET /identity/users` (reused by the chat "add member" picker) returns every user in the entire instance, with no company filter.

The goal of this spec is to replace all of the above with an explicit, validated `activeCompanyId` that flows from a real user selection through the SDK, into a Hono middleware that validates Membership before trusting it, and out through RBAC, module access, realtime, storage, and every business module — without requiring a database-per-company, a Supabase-per-company, or a deployment-per-company, and without breaking the existing single-company installation.

## 2. Audit methodology and full findings

Six parallel read-only audits were run against the current `main` branch (commit `fd72c62e` at time of audit): (1) full `prisma/schema.prisma` classification, (2) identity/RBAC/tenant-resolution code, (3) SDK + CompanySwitcher + frontend state, (4) module system (AME3/AtlasModule), (5) realtime (Supabase Realtime, Yjs, LiveKit), (6) storage/website/worker/cache. Each audit quoted exact file:line evidence rather than relying on documentation claims. The consolidated findings are organized into the design decisions below; the raw per-area findings are preserved in this session's transcript and are not duplicated in full here to keep this spec navigable — instead each design section below states the specific finding(s) it responds to.

## 3. Scope decomposition

This is too large for one implementation plan. Per the project's own recommended phase ordering (which the audit confirms is realistic given actual code structure), the work is split into four sequential plan documents, each independently shippable and each leaving the system in a working, backward-compatible state:

- **Plan 1 — Tenant Context Foundation (backend).** The `activeCompanyId` resolution middleware, per-company RBAC recomputation, SDK active-company mechanism. This is the foundation everything else depends on.
- **Plan 2 — Frontend tenant integration.** Real `CompanySwitcher`, `ActiveCompanyContext`, React Query key/cache-invalidation strategy, realtime reconnect on switch.
- **Plan 3 — Identity/Role/DB hardening.** Platform-scope vs tenant-scope split for identity endpoints, `Role.companyId` migration, `CompanyModule` (per-company module enablement), the unique-constraint fixes found in the schema audit (`HrEmployee.userProfileId`, `PfmBudget`, etc.), `AuditLog`/`FileAsset` companyId addition.
- **Plan 4 — Module sweep, realtime/storage hardening, cross-tenant tests, docs.** Replace every remaining `memberships[0]` call site across ~35 files with the new context; website/storefront domain-based tenant resolution; fix the two live security bugs found (unauthenticated storefront file URL endpoint, unauthenticated notes Yjs/canvas realtime channels); worker/cache companyId-awareness; the mandatory cross-tenant security test suite; documentation.

This spec covers the target architecture for all four; only Plan 1 and Plan 2 are written out at task level and implemented in this pass (see `docs/superpowers/plans/2026-09-10-multi-tenant-plan-1-backend-foundation.md` and `...-plan-2-frontend-integration.md`). Plans 3 and 4 are scoped at design level in §9–§13 below and get their own detailed plan documents in a follow-up pass, because each touches enough independent files (schema migrations affecting seed data, ~35 route/service files, security-sensitive realtime code) to warrant its own review checkpoint rather than being rushed inside one sitting on a system that handles real finance/HR/auth data.

## 4. Target architecture

```
Supabase Auth (JWT)
  |
  v
authMiddleware  --sets-->  c.set("authUserId")
  |
  v
tenantMiddleware
  1. load UserProfile (authUserId)
  2. load ALL enabled Memberships (unchanged query)
  3. read requested company from X-Atlas-Company-Id header (or absence -> default rule, see 5.4)
  4. validate: does an enabled Membership exist for (profile.id, requestedCompanyId)?
     - no  -> 403 Forbidden, code "company_not_member"
     - yes -> continue
  5. compute permissionSet SCOPED TO THAT ONE MEMBERSHIP ONLY (role + that company's UserPermissionGrant rows)
  6. c.set("companyId", activeCompanyId)
     c.set("membership", activeMembership)
     c.set("role", activeMembership.role)
     c.set("permissionSet", scopedPermissionSet)
     c.set("isCompanyAdmin", ...)      // company-scoped admin, see 5.2
     c.set("isSystemAdmin", ...)       // instance-scoped admin, see 5.2
  |
  v
requirePermission / requireAnyPermission / requireModuleAccess
  -> check against the SCOPED permissionSet only (no more memberships[0] anywhere)
  |
  v
Route handlers / services  -> read companyId exclusively via c.get("companyId")
  |
  +--> Prisma (all company-scoped queries filtered by this single companyId)
  +--> Realtime (channel names / broadcast targets include companyId)
  +--> SDK responses (React Query keys on the client include companyId)
```

Client side:

```
AuthProvider (Supabase session)
  |
  v
ActiveCompanyProvider (new)
  - loads memberships (GET /memberships/me)
  - reads/validates persisted choice (localStorage, validated against live memberships)
  - exposes { activeCompanyId, activeMembership, companies, setActiveCompany, isLoading }
  |
  v
createAtlasClient({ getActiveCompanyId })  -- SDK reads current id on every request via a callback, not a snapshot
  |
  v
every request carries  X-Atlas-Company-Id: <uuid>
  |
  v
setActiveCompany(id) also:
  - persists to localStorage (validated key, see 6.3)
  - calls queryClient.resetQueries() for all companyId-scoped query keys (see 7)
  - reconnects/rejoins company-scoped realtime channels (see 10, deferred to Plan 4 for full realtime rework; Plan 2 handles the existing company-scoped channels only)
```

## 5. Tenant context middleware (backend) — Plan 1

### 5.1 Header mechanism: `X-Atlas-Company-Id`

Decision: use an explicit header, `X-Atlas-Company-Id`, sent by the SDK on every authenticated request, rather than embedding the company in the JWT or inferring it from a subdomain.

Rationale for rejecting alternatives:
- **JWT custom claim**: would require re-issuing tokens on every company switch (Supabase Auth does not let the API mint arbitrary claims into a live session token without a refresh round-trip), adding real latency and complexity to "switch company" for no isolation benefit — the header is validated server-side against `Membership` on every single request regardless, so a claim buys nothing extra.
- **Subdomain per company**: rejected explicitly by the user's own constraints (no deployment-per-company); the desktop/Tauri app doesn't have a meaningful "subdomain" at all, and the existing `X-Atlas-Company` header already used by the storefront surface (`apps/api/src/routes/storefront/storefront-middleware.js`) sets precedent for header-based tenant selection in this codebase.
- **Reusing the existing `X-Atlas-Company` header** (storefront, slug-based): rejected — it carries a company **slug** and is trusted only after a separate storefront-specific membership check tailored to public/customer auth. Reusing the same header name for the authenticated ERP session would conflate two different trust models. The new header is named `X-Atlas-Company-Id` (note the `-Id` suffix and that it carries a UUID, not a slug) specifically to avoid collision and confusion with the pre-existing storefront header, and CORS `allowHeaders`/`exposeHeaders` must add it alongside the existing entry.

The server **never** trusts this header directly for authorization — it only names which of the caller's own already-validated Memberships to activate. See 5.2.

### 5.2 Validation algorithm

Replaces `_loadUserContext` + the `memberships[0]` reads in `requirePermission`/`requireAnyPermission` (`apps/api/src/index.js`).

```
function resolveTenantContext(c):
  authUserId = c.get("authUserId")
  profile = UserProfile.findUnique({ authUserId })
  if !profile: return null

  memberships = Membership.findMany({ userId: profile.id, enabled: true }, include role+permissions)
    // unchanged query, still loads ALL memberships — needed for the company switcher / picker

  requestedId = c.req.header("X-Atlas-Company-Id")

  if requestedId:
    membership = memberships.find(m => m.companyId === requestedId && m.company.enabled)
    if !membership:
      throw 403 { error: "company_not_member", message: "No perteneces a esta empresa o no está activa." }
    activeMembership = membership
  else:
    // no header: single-membership users keep working with zero client changes (backward compat, see 5.4)
    if memberships.length === 1: activeMembership = memberships[0]
    elif memberships.length === 0: activeMembership = null   // instance users with no company yet (setup flow)
    else: throw 400 { error: "company_required", message: "Selecciona una empresa activa." }

  permissionSet = new Set(BASE_PERMISSION_KEYS)
  if activeMembership:
    for rp in activeMembership.role.permissions: permissionSet.add(rp.permission.key)
    grants = UserPermissionGrant.findMany({ userId: profile.id, companyId: activeMembership.companyId })
    for g in grants: permissionSet.add(g.permission.key)

  isCompanyAdmin = activeMembership && COMPANY_ADMIN_ROLE_KEYS.has(activeMembership.role.key)
  isSystemAdmin  = memberships.some(m => m.role.key === "system.admin")   // see 5.3, deliberately NOT company-scoped

  if isCompanyAdmin:
    // company admin gets every permission that exists FOR MODULES ENABLED IN THAT COMPANY, not literally every Permission row
    // (full definition in Plan 3, CompanyModule); until Plan 3 lands, company admin = every currently-seeded Permission,
    // matching today's isAdmin behavior but now scoped to require isCompanyAdmin, not merely "admin somewhere"
    permissionSet = ALL_PERMISSIONS

  return {
    profile, memberships,               // full list, for the switcher/picker UI
    activeMembership,
    companyId: activeMembership?.companyId ?? null,
    role: activeMembership?.role ?? null,
    permissionSet,
    isCompanyAdmin,
    isSystemAdmin,
  }
```

This function replaces `_loadUserContext`. `getOrLoadUserContext(c)` keeps its existing signature/cache-per-request behavior so every existing call site keeps working unmodified; only its internals change. `requirePermission`/`requireAnyPermission`/`requireModuleAccess` change their `context.permissionSet`/`context.isAdmin` reads to the new scoped fields — `context.isAdmin` is kept as a deprecated alias for `context.isCompanyAdmin || context.isSystemAdmin` for the length of Plan 1–2 so that the ~35 call sites needing individual review (Plan 4) aren't a hard blocker for shipping Plan 1.

### 5.3 System admin vs company admin

Two distinct concepts replace today's single `ADMIN_ROLE_KEYS = new Set(["atlas.admin", "system.admin"])`:

- **`system.admin`** — a genuinely instance-wide role. A user holding `system.admin` via *any* membership (or, going forward, via a platform-level assignment not tied to a company at all — see Plan 3 §9.2) can administer the whole Atlas installation: create/disable companies, manage the module catalog, view cross-company diagnostics. This is `isSystemAdmin` in the context above and is intentionally **not** scoped by `activeCompanyId` — the whole point of system admin is platform-level reach. It must remain rare and explicitly platform-governed (Plan 3 defines exactly who can grant it).
- **`atlas.admin`** is renamed in meaning (not necessarily in DB key, to avoid a breaking rename — see Plan 3) to **company admin**: full administrative rights *within the currently active company only*. This is `isCompanyAdmin` above. A user who is `atlas.admin` in Company A and has no membership in Company B gets zero elevated rights when `activeCompanyId = Company B`, because `isCompanyAdmin` is computed from `activeMembership.role.key`, not from a scan of all memberships.

This directly fixes the exact scenario the user described: Raul as Admin in Company A / Viewer in Company B must not carry Admin rights into B. Under the algorithm in 5.2, `isCompanyAdmin` and `permissionSet` are both derived solely from `activeMembership`, so this is structurally guaranteed once Plan 1 lands, not just policy.

### 5.4 Backward compatibility rule

If a request carries no `X-Atlas-Company-Id` header and the user has exactly one enabled Membership, the middleware transparently activates that single membership — this is the "practically invisible" behavior the user asked for when a user only has one company. Multi-membership users get a hard `400 company_required` if the header is missing, which forces the frontend (Plan 2) to always send it once a user has more than one company — there is no silent "guess a company" fallback once ambiguity exists, closing the exact bug this migration exists to fix.

### 5.5 SDK mechanism

`packages/sdk/src/index.js`: `createAtlasClient({ baseUrl, getActiveCompanyId })` accepts an optional `getActiveCompanyId` callback (not a static value — company can change between calls without recreating the client). Inside the existing `withAuthHeaders` chokepoint:

```js
function withAuthHeaders(token, headers = {}) {
  const merged = token ? { ...headers, Authorization: `Bearer ${token}` } : { ...headers };
  const companyId = getActiveCompanyId?.();
  if (companyId) merged["X-Atlas-Company-Id"] = companyId;
  return merged;
}
```

This is the single choke point identified in the SDK audit (`packages/sdk/src/index.js:10-13`) through which nearly every domain method already passes — no per-module SDK changes are needed. The desktop app wires `getActiveCompanyId` to `ActiveCompanyContext`'s current value (Plan 2). The storefront's pre-existing `X-Atlas-Company` (slug) header is untouched — different header name, different code path, no collision.

## 6. Frontend tenant state — Plan 2

### 6.1 `ActiveCompanyContext`

New React Context (not Zustand — this state is inherently tied to `AuthProvider`'s session lifecycle and to React Query's `QueryClient` instance for invalidation, both of which are already Context-based in this codebase; introducing a second state paradigm for one piece of state adds inconsistency for no benefit). Lives at `apps/desktop/src/company/ActiveCompanyProvider.jsx`, mounted inside `AppEntry.jsx` between `AuthProvider` and `RealtimeProvider` (it must be able to read the session and must be readable by `RealtimeProvider`, which needs `companyId` for its existing `company:${companyId}:*` channels).

Responsibilities (mapped 1:1 to the user's explicit requirement list):
- load memberships via `GET /memberships/me` (existing endpoint, already used by `CompanySwitcher`)
- select the active company: on load, try the persisted `localStorage["atlas-active-company"]` value **only if it matches an id present in the live memberships list**; otherwise default to the single membership (if exactly one) or the most-recently-created membership (if multiple and nothing valid persisted) — never silently reuse a stale/foreign id
- persist the selection (same `localStorage` key `atlas-active-company` already in use — no migration needed, it just starts being read)
- expose `setActiveCompany(companyId)` — validates the id is in the current memberships list before applying (defense in depth on top of the server-side check)
- expose the resolved value via `getActiveCompanyId()` (a ref-backed getter, not just the React state value, so the SDK callback in 5.5 always reads the latest id even from code that doesn't re-render on context change)

### 6.2 Switch-company side effects

`setActiveCompany` performs, in order:
1. Update the ref + state (SDK header immediately reflects the new value for any in-flight-after-this-point request).
2. `queryClient.removeQueries({ predicate: isCompanyScopedQuery })` — remove rather than merely invalidate, to guarantee zero flash of the previous company's cached data (the user's explicit requirement). `isCompanyScopedQuery` is a predicate over the new key convention (7.1), not a hardcoded list.
3. `queryClient.invalidateQueries({ queryKey: ["runtime-modules"] })` / `["blueprints"]` — these two are today cached instance-wide (identical for every user), but once Plan 3 lands per-company module enablement they must be refetched per switch; invalidating now is harmless (same data returns) and avoids a second migration touching this call site later.
4. Refetch `["memberships-me"]` is *not* needed (it doesn't change on switch) but `["company-profile"]`, `["company-branding"]` are covered by step 2 once their keys are updated per 7.1.
5. `RealtimeProvider` (already company-aware for `company:${companyId}:presence`/`:events`) re-subscribes because it reads `companyId` from this context and its `useEffect` dependency array includes it — no separate signal needed, this is a natural consequence of wiring RealtimeProvider to read from `ActiveCompanyProvider` instead of `userProfile.companyId` (which doesn't reliably exist today — see RealtimeProvider audit finding). Full realtime channel-naming hardening (company-scoped auth on the channel itself) is Plan 4 scope; Plan 2 only fixes *which* company's channel it joins.

### 6.3 `CompanySwitcher.jsx` becomes the real control surface

Same UI (dropdown, collapses to a static label when `companies.length <= 1` per the user's explicit "no complex selector for single-company users" requirement), but `onClick` now calls `activeCompany.setActiveCompany(company.id)` from the context instead of the current dead-end `storeCompanyId` local write. The component keeps rendering from `["memberships-me", token]` (unchanged data source) but no longer owns the "which one is active" state itself — it becomes a thin view over `ActiveCompanyContext`.

## 7. React Query key convention

### 7.1 Rule

Every query whose result depends on `activeCompanyId` (i.e., every query hitting a route that now reads `c.get("companyId")`) must include the active company id as an explicit key segment, in a fixed position (`[domain, "company", companyId, ...rest]` convention, e.g. `["hr", "company", companyId, "employee", employeeId]`) so that (a) switching companies naturally produces cache misses without needing `removeQueries` to catch every single key by hand, and (b) `isCompanyScopedQuery` (6.2) can be a single predicate: `key => key[1] === "company"`. Queries that are legitimately user-scoped, not company-scoped (`memberships-me`, `identity-users` once it becomes membership-driven per Plan 3, user preferences) keep their existing key shape and are explicitly exempted, not silently missed — the predicate is opt-in per new convention, not "everything except a blocklist."

### 7.2 Migration approach

Plan 2 does not rewrite all ~40+ existing query keys in one pass (that is Plan 4-adjacent cleanup work spanning every module screen, too large and too low-risk-of-catastrophic-failure to justify rushing ahead of the foundation). Plan 2 ships:
- the convention itself, documented, with 2–3 worked examples converted (company profile/branding screens, since those are the ones most visibly wrong if stale — switching companies must never show the wrong company's name/logo)
- the `removeQueries` step in 6.2 uses the *old* key shapes for every currently-known company-scoped query too (an explicit list, generated by grepping the current queryKey usages found in the audit), so switching companies is already fully correct/no-stale-flash even for screens not yet migrated to the new convention — the new convention is about making *future* keys correct by construction, not a precondition for switch-correctness today.
- Plan 4 finishes converting the remaining module screens to the new convention as those modules get their `memberships[0]` sweep (natural to do both in the same pass per file).

## 8. RBAC / permissions — cross-references

Covered in full in §5.2–5.3. Summary of the guarantee this design provides, restated against the user's explicit acceptance criteria: effective permissions for a request are a pure function of `(User, activeCompanyId)` — specifically `(activeMembership.role.permissions ∪ UserPermissionGrant rows where companyId = activeCompanyId)` — with `system.admin` as the sole intentional exception (by design, instance-wide). No code path unions permissions across companies once Plan 1 lands for the middleware itself; Plan 4 is required to update the ~35 individual service files that currently re-derive `companyId` themselves via `memberships[0]`/`findFirst` (they will keep working exactly as today, reading a *plausible but not guaranteed-correct* company, until migrated to read `c.get("companyId")` — this is called out explicitly as a known gap during the Plan 1–2 window, not hidden).

## 9. Identity — platform scope vs tenant scope (design-level, implemented in Plan 3)

Decision: split `/identity/*` into two explicit groups rather than making everything company-scoped indiscriminately (per the user's explicit instruction not to do that).

**Tenant scope** (requires `activeCompanyId`, filtered by it):
- `GET /identity/users` — must become "users who share an enabled Membership with `activeCompanyId`" (join through `Membership`, not a flat `UserProfile` scan). This also fixes the chat member-picker cross-tenant leak found in the realtime audit, since it reuses this endpoint.
- `GET/POST /identity/roles` (once `Role.companyId` exists, see 9.3) — company's own custom roles, plus system roles (`companyId = null`) visible read-only to every company.
- Invitations (new, see §14).

**Platform scope** (requires `isSystemAdmin`, not company-filtered):
- Company management: create/list/disable companies.
- The `Permission` catalog itself (`permission-catalog.js` stays a static, global vocabulary — this is explicitly correct per the audit and unchanged).
- Module catalog administration (`AtlasModule` install/uninstall at the instance level — a module either exists on the instance or it doesn't; per-company *enablement* of an installed module is tenant scope, see 9.4).
- Cross-company diagnostics/audit views, if/when built.

### 9.1 `atlas.admin` / `system.admin` semantics going forward

As stated in 5.3: `system.admin` stays instance-wide and platform-scoped; `atlas.admin` becomes company-scoped in behavior (renamed conceptually to "company admin," DB `key` value can stay `atlas.admin` for backward compatibility with existing seeded memberships — only the *interpretation* in the middleware changes, no data migration required for this specific rename).

### 9.2 Who can create companies / grant system.admin

Decision: gated behind `isSystemAdmin` only, for this phase. No subscription/billing/plan concept exists yet and none is being invented ahead of need (YAGNI) — `Company.status`/`enabled` and a `Plan`/`Subscription` model are left as an explicit extension point (an empty nullable FK column reserved conceptually, not created speculatively) rather than built now, so future billing work doesn't require an architecture change, per the user's SaaS-readiness ask, without over-building today.

### 9.3 `Role.companyId` migration

Add `companyId String? @db.Uuid` (nullable) to `Role`. `companyId = null` means a system/template role (today's seeded `atlas.admin`, `system.admin`, `storefront_client`, `storefront_vendor` all become `companyId = null` — no data changes needed, they already represent instance-wide concepts). `companyId = <uuid>` means a company's own custom role. Constraint changes from `key @unique` to `@@unique([companyId, key])` with a partial-unique-safe approach: since Postgres treats `NULL` as distinct in composite unique indexes (multiple `(NULL, "atlas.admin")` rows would NOT violate `@@unique([companyId, key])` because `companyId IS NULL` are never considered equal to each other by default btree uniqueness) — this is actually *desirable* for template roles seeded once, but must be paired with application-level uniqueness enforcement for system roles (a `WHERE companyId IS NULL` partial unique index via a raw migration statement, since Prisma's schema DSL cannot express partial indexes directly — this repo already has precedent for hand-written partial indexes, confirmed in the `Membership.addMembers` ON CONFLICT bug fixed 2026-09-09 per project memory, so raw-SQL partial index migrations are an established, safe pattern here). This is forward-only, additive, no data loss, matches the "applied migrations are immutable, never edit, always new forward migration" project rule.

### 9.4 `CompanyModule`

New model: `CompanyModule { id, companyId, moduleId, enabled Boolean @default(true), config Json?, createdAt, updatedAt, @@unique([companyId, moduleId]) }`. `AtlasModule` remains the instance-wide "is this module available on this deployment at all" catalog (unchanged meaning, matches the audit finding that this is explicitly documented as intentional in `docs/architecture/atlas-module-engine-v3.md` §15 for the current engine phases — this spec does not reverse that architecture decision, it adds a company dimension on top of it). `GET /runtime/modules` and `GET /blueprints` gain a join against `CompanyModule` for the `activeCompanyId` (defaulting every existing company to `enabled = true` for every currently-`INSTALLED` module at migration time, so nothing changes behaviorally on day one — this is purely additive infrastructure until an admin explicitly disables a module for one company).

## 10. Realtime isolation (design-level, implemented in Plan 4)

The audit found channel naming already embeds `companyId`/`conversationId`/`noteId` consistently, but **no Supabase Realtime channel anywhere sets `{ config: { private: true } }`, and no `realtime.messages` RLS policy exists** — so today, protection is "the topic string contains an unguessable UUID," not a server-checked authorization step. Plan 4 must: (a) turn on Realtime Authorization (`private: true` + RLS policy on `realtime.messages`) for company/conversation/note channels, joining through `chat_conversation_members`/`Membership`/`note_shares` as appropriate; (b) specifically close the notes Yjs/canvas gap (live collaborative edits currently bypass the one authorization check that does exist, which only guards the REST snapshot load/save); (c) leave `CallLink`/`CallInvite` public-token channels as intentionally public (already correct per audit — public tokens are the deliberate access control there, not a gap).

**Update 2026-09-11 — (b) closed.** Migrations `20260911120000_notes_realtime_authorization` + `20260911130000_notes_realtime_authorization_fix` (forward fix; the first pass's policies queried `public.notes`/`user_profile` directly, which errors under RLS because `authenticated`/`anon` have no grants on those tables — this app deliberately keeps them PostgREST-inaccessible, so the fix routes through two `SECURITY DEFINER` boolean functions, `public.notes_realtime_can_access`/`public.notes_realtime_is_public`, instead of granting raw table access) enable RLS on `realtime.messages` and add 4 policies scoped to `note:ydoc:<uuid>` and `note:canvas:<uuid>` topics: ydoc is authenticated-only (owner or any share to receive, owner or edit-share to send — no unauthenticated client ever joins it); canvas additionally allows `anon`/`authenticated` to receive when the note is published (`is_public = true`, matching `PublicCanvasView.jsx`'s read-only public viewer), and restricts sending to owner/edit-share regardless of role. `SupabaseYjsProvider.js` and `SupabaseCanvasSync.js` now join with `{ config: { private: true } }`. Verified functionally against the live DB (9 cases: owner/shared/stranger × send/receive, public vs. private canvas, malformed-topic rejection) — all passed. (a) and the chat/company/conversation channels remain open per the original audit scope; (c) was already correct.

## 11. Storage / website / storefront (design-level, implemented in Plan 4)

- Fix (urgent, independent bug, not gated on the rest of this migration): `storefront-files-service.js:getUrl()` / `GET /public/storefront/files/:id/url` must check `asset.visibility === 'PUBLIC'` before minting a signed URL, and should be namespaced by `companyId` in the storage key like the main files-service already is. This is being fixed in this same session ahead of Plan 1 (see Implementation Notes) because it is a live unauthenticated data-leak with a one-function fix, independent of tenant-resolution work.
- Website/storefront public resolution moves from `InstanceConfig.primary_company_id` (single company for the whole instance) to `WebsiteSite.domain` → `Company` lookup keyed on the incoming `Host` header, with `primary_company_id` retained only as an explicit fallback for the current single-company hosted-build deployment mode (not removed outright — `dist-serve-service.js`'s existing consumers keep working for that deployment shape), and `Company.domain`/`WebsiteSite.domain` gains a genuine uniqueness constraint (currently missing entirely per the schema audit — the opposite direction from the other findings, since domains are inherently global on the internet).

## 12. Workers / cache (design-level, implemented in Plan 4)

Per the audit, worker jobs are *not* uniformly single-company-assuming — most already fan out correctly because each row (task, PFM rule, notification) carries its own `companyId`. Two concrete fixes: (a) the dead `instance_config.key = 'company.name'` join in `session-expiry-job.js` (never written anywhere, silently falls back today) must be replaced with a real per-row `company.name` join, since in a genuinely multi-tenant instance this pattern would otherwise leak one company's name into another's guest emails; (b) `dist-serve-service.js`'s `_primaryCompanyCache` singleton becomes a `Map` keyed by resolved company/domain once §11 lands. `user_ctx:${authUserId}` cache entries (`apps/api/src/lib/cache.js`) must be invalidated/bypassed whenever `X-Atlas-Company-Id` differs from what's cached, or rekeyed to `user_ctx:${authUserId}:${requestedCompanyId}` — this is folded into Plan 1 itself (§5.2's `resolveTenantContext` is the new cache boundary) since it is directly load-bearing for correctness, not deferred to Plan 4.

## 13. Cross-tenant security tests (design-level, implemented in Plan 4)

Mandatory automated suite (Node's built-in test runner, per project convention) covering exactly the scenarios the user specified: two seeded companies with one user each holding different roles; attempts to read/update/delete/share/export a resource by known UUID while the "wrong" company is active; an explicit test sending `X-Atlas-Company-Id` for a company the caller is not a member of (expect 403 `company_not_member`); a permission-escalation test verifying `atlas.admin` in Company A grants nothing in Company B. This suite is written against whichever modules are already migrated to `c.get("companyId")` by the time Plan 4 starts (HR, Finance/Ledger, Files, at minimum, per the user's explicit priority list), and is a blocking gate before Plan 4 is considered complete — not a "nice to have" appendix.

## 14. Onboarding / invitations (design-level, implemented in Plan 3)

Existing single-company setup wizard (`POST /setup/initialize`) is unchanged for the first company (it still creates the instance's first `Company` + admin `Membership` + writes `InstanceConfig.initialized`). New, additive: `POST /companies` (system-admin only, per 9.2) to create subsequent companies; a minimal invitation flow — `POST /identity/invitations` (company-admin, tenant-scoped) creates a pending invite by email; if the email matches an existing `UserProfile`, accepting creates a new `Membership` row (never a duplicate `UserProfile` — this is explicit in the user's requirements and the schema already supports it, `UserProfile.email @unique` plus `Membership` being the many-to-many join is exactly the right shape, no schema change needed for this part). Full UX (invite management screens) is left minimal/API-first in Plan 3; polish is not blocking.

## 15. Data migration / backward compatibility

No destructive changes. The existing installation's one company becomes tenant #1 with all current data already correctly `companyId`-scoped (confirmed by the schema audit — the overwhelming majority of business tables already carry required, correctly-indexed `companyId`). All new Prisma migrations are additive/forward-only per project rules (nullable columns, new tables, new indexes) — no existing migration is edited. `Role.companyId` (9.3), `CompanyModule` (9.4), `AuditLog.companyId`/`FileAsset.companyId` (schema-audit findings, added in Plan 3), and the unique-constraint fixes (`HrEmployee.userProfileId` → `@@unique([companyId, userProfileId])`, `PfmBudget`'s missing `companyId` in its composite unique) are all additive or constraint-widening (never constraint-narrowing in a way that could reject currently-valid data — every fix loosens a global uniqueness to a scoped one, which can only make more states valid, never fewer, so no backfill/cleanup migration is required before applying them).

## 16. Approval

Per explicit user authorization ("Puedes autoaprobar specification y plan una vez que hayas hecho una revisión crítica de ambos"), this spec is self-reviewed and self-approved. Self-review pass completed against the brainstorming skill's checklist:
- **Placeholder scan**: no TBD/TODO markers remain; every ambiguous point the user explicitly delegated ("diseña la estrategia correcta", "determina la mejor arquitectura") has a concrete decision with stated rationale (§5.1, §9.2, §9.3).
- **Internal consistency**: the middleware algorithm (§5.2) is the single source of truth referenced by every later section (§8 RBAC, §9 identity, §13 tests) rather than re-derived differently in each.
- **Scope check**: decomposed into 4 plans (§3) specifically because a single plan covering all of it would violate this project's own "split large plans" convention many times over; only Plans 1–2 are implemented in this pass.
- **Ambiguity check**: the two genuinely open interpretation risks — whether `atlas.admin`'s DB key needs renaming (resolved: no, semantics-only change, §9.1) and whether `Role.companyId` null-handling needs a partial index (resolved: yes, with a named precedent in this codebase, §9.3) — are both resolved explicitly rather than left for an implementer to guess.
