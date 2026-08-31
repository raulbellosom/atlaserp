# Core modules (`atlas.core` / `identity` / `files` / `company` / `contacts` / `hr`) — Current State Spec

**Date:** 2026-08-30
**Modules:** `atlas.identity`, `atlas.files`, `atlas.company`, `atlas.contacts`,
`atlas.hr` (all CORE, `uninstallable: false`). All routes are inline in
`apps/api/src/index.js` — none of these have a dedicated `routes/<module>/`
directory yet (tracked as backlog E1).
**Status:** Post-audit reference (2026-08-30 pass, same rigor as `atlas.ledger`).

---

## 1. Layout

```
apps/api/src/index.js  (4739 lines — E1, over CLAUDE.md's limit; every core
  module's routes are inline here)
  /company/*     ~190 lines   uses services/company-service.js (281)
  /files/*       ~350 lines   uses services/files-service.js (719)
  /identity/*    ~950 lines   permissions, roles, users — no dedicated service,
                              logic lives directly in the route handlers
  /contacts/*    ~475 lines   uses services/contacts-service.js (227)
  /hr/*          ~675 lines   uses services/hr-service.js (879) +
                              services/hr-export-service.js (126)
apps/desktop/src/modules/
  atlas.hr/screens/       HrEmployeeDetail.jsx (1196), HrEmployeeForm.jsx (1048)
  atlas.files/            AdvancedFileViewer.jsx (856), FilesScreen.jsx (773)
  atlas.identity/         UserEditorScreen.jsx (746), RolesScreen.jsx (716)
  atlas.company/          CompanyProfile.jsx (570), CompanyBranding.jsx (568)
  atlas.contacts/         ContactsScreen.jsx (396)
```

## 2. Architecture note: `atlas.identity` is intentionally instance-wide, not company-scoped

Unlike every other module audited in this campaign, `atlas.identity`'s
`Role`/`Permission` tables have **no `companyId` column** (confirmed in
`prisma/schema.prisma`), and `permission-catalog.js`'s own descriptions say so
explicitly — e.g. `identity.users.read`: *"Permite consultar usuarios **de la
instancia**."* This is deliberate: `atlas.identity` is the platform-level user
and RBAC admin surface for the whole Atlas deployment, distinct from the
company-scoped business modules (contacts, HR, ledger, etc.) that make up the
rest of the campaign. **Do not company-scope `/identity/users` or
`/identity/roles` — that would be a regression, not a fix.**
`atlas.company`'s profile/address/branding routes are similarly correct as
singleton (they read/write the one `Company` row referenced by
`InstanceConfig.company_id` — this instance's own company record).

## 3. Security finding — privilege escalation via `PATCH /identity/users/:id` (fixed)

**The most severe finding of the whole module-audit campaign.** The
membership/role-reassignment block of `PATCH /identity/users/:id` — gated only
by `identity.users.update`, a permission with no stated role-management intent
(`descriptionEs: "Permite actualizar datos y estado de usuarios."`) — trusted
the client-supplied `{ membershipId, roleId }` pair with **zero validation**:

```js
// before
if (body.membershipId && body.roleId) {
  await prisma.membership.update({ where: { id: body.membershipId }, data: { roleId: body.roleId } });
}
```

Two independent gaps combined into a full escalation path:

1. **`membershipId` was never checked against the `:id` in the URL.** A caller
   could pass their *own* membership id while the URL named someone else (or
   vice versa) — the id in the path was purely decorative for this
   sub-operation.
2. **`roleId` was never checked against protected role keys.** Any role,
   including `atlas.admin` / `system.admin`, could be assigned.

Net effect: **a user holding only `identity.users.update` (not any
`identity.roles.*` permission) could call `PATCH /identity/users/<their own
id>` with `{ membershipId: <their own membership>, roleId: <atlas.admin's
role id> }` and grant themselves the system administrator role**, bypassing
the entire `identity.roles.*` permission tier that role management is
supposed to require.

**Fix:**
- `membershipId` is now resolved and its `userId` compared against the URL's
  `:id` — mismatch → `400`.
- The target role's `key` is checked against `PROTECTED_IDENTITY_ROLE_KEYS`
  (`atlas.admin`, `system.admin`). If protected, the caller must additionally
  hold `identity.roles.update` (or be an admin already) — checked via
  `c.get("userContext")`'s `permissionSet`/`isAdmin` (already computed by
  `requirePermission()`, no extra query) — else `403`.
- Also added the disable-lockout guard the `DELETE` routes already had but
  `PATCH` was missing: `body.enabled === false` on a user currently holding a
  protected admin role is now rejected `400`, matching the existing
  "no se puede eliminar/deshabilitar un usuario con rol Atlas Admin o System
  Admin" pattern used by `DELETE /identity/users/:id` and
  `DELETE /identity/users/bulk`.

**Verification:** manually traced both the attack path (now blocked, `403`)
and the legitimate-admin path (an `atlas.admin`/`system.admin` caller, or
anyone else who separately holds `identity.roles.update`, can still assign the
protected role — no regression) against the actual `requirePermission()`
middleware source and the `Membership`/`Role` Prisma schema. **Not covered by
an automated test** — `index.js` connects to a live Postgres/Supabase client
at import time, so no test in this repo imports it directly (existing,
pre-session convention; every route inline in `index.js` is currently
untested this way). Tracked as follow-up C8-a: extract `/identity/*` into a
dedicated `routes/identity/` router (mirroring how ledger/fleet/inventory/pos
etc. were extracted) so this logic becomes unit-testable, and add regression
tests for both the escalation path and the legitimate-admin path.

## 4. PDF export branding bug (fixed) — same class as the original ledger audit

`POST /contacts/export/pdf` and `GET /hr/employees/export/pdf` both resolved
the exporting user's company with:

```js
const membership = await prisma.membership.findFirst({ where: { userId: authUserId } });
```

`authUserId` is the Supabase auth user id (`c.get("authUserId")`), but
`Membership.userId` is a foreign key to `UserProfile.id` — a different UUID
space entirely. This lookup **always returned `null`**, so `companyId` was
always empty, and `resolveCompanyBranding()` always fell back to its default
(`companyName: "Atlas ERP"`, no logo) instead of the real company's branding —
the exact bug class the original `atlas.ledger` audit fixed for that module's
exports. Fixed by using `c.get("companyId")`, which `requirePermission()`
already resolves correctly and sets on the request context before the handler
runs (the identity users export routes already did this right, via
`c.get("userId")`/a correctly-scoped lookup — only contacts and HR had the
bug).

## 5. Service-layer audit (no changes needed)

- **`contacts-service.js`** (227) — every method resolves `companyId` via
  `getCompanyContext(authUserId)` and every mutation goes through
  `assertContactOwnership`. Clean.
- **`files-service.js`** (719) — `FileAsset.entityId` is always set
  server-side to the uploader's own `companyId` at upload time (never
  client-controlled, even though a `fields.entityId` is accepted — that value
  is only ever stored under `metadata.sourceEntityId` for filtering, never
  used as the tenant-scoping column). `ensureFileBelongsToCompany` gates every
  read/delete. Clean.
- **`hr-service.js`** (879) — the most thorough tenant-isolation of any
  module in this campaign: `assertEmployee`, `assertDepartment`,
  `assertJobTitle`, `assertSupervisor`, `assertProfileImage`,
  `assertUserLinkEligibility`, and `assertNoHierarchyCycle` guard every
  FK reference on create/update. Clean — no changes needed, same tier as
  `atlas.growth`/`atlas.documents` earlier in this campaign.
- **`company-service.js`** (281) — correctly singleton-scoped (see Section 2).
  `updateBranding`'s logo-ownership check validates the `FileAsset` belongs to
  this company or module before accepting it. Clean.

## 6. UI-first / dark mode

No `window.confirm/alert/prompt`, no raw `<select>` found across
`atlas.hr`, `atlas.contacts`, `atlas.identity`, `atlas.company`,
`atlas.files` desktop screens. The one `bg-red-100`/`bg-emerald-100` hit
(`HrCatalogsScreen.jsx`) already pairs each with a `dark:` variant — not a
violation.

## 7. Known gaps / follow-ups (backlog)

- **D8-a** — `HrEmployeeDetail.jsx` (1196 lines, already named in CLAUDE.md's
  known-violators list) and `HrEmployeeForm.jsx` (1048, newly over the
  1000-line limit) need decomposition — deferred, a UI refactor of this size
  needs its own pass with responsive re-verification, not forced through here.
- **C8-a** — extract `/identity/*` (and `/company/*`, `/files/*`,
  `/contacts/*`, `/hr/*`) out of `index.js` into dedicated `routes/<module>/`
  routers, both to shrink `index.js` (E1) and to make the privilege-escalation
  fix in Section 3 unit-testable.
- No responsive/browser QA performed this session (no live browser tooling
  used); recommend the standard 390px/1440px pass.

## 8. Verification (2026-08-30)

- `node --check apps/api/src/index.js` — pass.
- `node --test "apps/api/src/**/__tests__/*.test.js"` — 817/817 (unchanged —
  no existing test exercises the changed inline routes; see Section 3 for why,
  and C8-a for the follow-up).
- `pnpm --filter @atlas/desktop build:web` — clean build, no new warnings.
