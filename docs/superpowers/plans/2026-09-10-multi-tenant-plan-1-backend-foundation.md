# Multi-Tenant Plan 1 — Tenant Context Foundation (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `memberships?.[0]?.companyId` / permission-union bug with a real, validated `activeCompanyId` resolved per-request from an `X-Atlas-Company-Id` header, and thread it through the core RBAC middleware (`requirePermission`, `requireAnyPermission`, `requireModuleAccess`) and the SDK, so that a request's effective permissions are a pure function of `(user, activeCompanyId)` and never a union across every company a user belongs to.

**Architecture:** A new pure, unit-testable module (`apps/api/src/lib/tenant-context.js`) implements the resolution/permission-scoping algorithm with no DB or Hono dependency. `apps/api/src/index.js` wires it in: `_loadUserContext` gains two additive fields (`company.enabled`, `grantsByCompany`), and a new `resolveTenantContext(c, context, options)` wrapper calls the pure functions and sets `c.set("companyId", ...)` / `c.set("tenantContext", ...)`. Two resolution modes exist — **strict** (used by `requirePermission`/`requireAnyPermission`, the gate for actual business data: 400 if a multi-company user sends no header) and **non-strict** (used by `requireModuleAccess`, `/runtime/modules`, `/blueprints`, `/user/me` — endpoints called during app bootstrap, before the frontend has necessarily chosen a company yet: ambiguity resolves to "no active company" rather than erroring). The SDK (`packages/sdk/src/index.js`) gains an optional `getActiveCompanyId` callback threaded through the existing `withAuthHeaders` chokepoint, so every one of its ~250 domain methods emits the header with zero per-method changes.

**Tech Stack:** Node.js, Hono, Prisma 7, `node-cache` (existing `apps/api/src/lib/cache.js`), Node built-in test runner (`node --test`).

**Important scope correction found during detailed design (bigger win than the spec's audit assumed):** a repo check while writing this plan found that `c.get("companyId")` is already read directly by 23 route files beyond `index.js` — `routes/website/*`, `routes/catalog/*`, `routes/chat/*`, `routes/inventory/index.js`, `routes/projects/projects-routes.js`, `routes/calendar/calendar-routes.js`, `routes/growth/*`, `routes/documents/*` — all wired through the *same* `requirePermission`/`requireAnyPermission` functions this plan fixes (injected via a `createXxxRouter({ requirePermission })` factory pattern, e.g. `apps/api/src/routes/website/pages-routes.js:6,9-10`). This means Task 4 alone corrects `companyId` resolution for all of these modules too, not just the routes defined directly in `index.js` — no Plan 4 sweep needed for any route that already uses `c.get("companyId")` correctly. Plan 4's sweep is only for the smaller remaining set that independently re-derives a company via their own `membership.findFirst()`/`memberships[0]` query instead of reading `c.get("companyId")` (e.g. `apps/api/src/routes/ledger/service-helpers.js`, `services/hr-service.js`, `services/sync-service.js`, `services/contacts-service.js`, `services/files-service.js`, `services/activity-service.js`, `services/notification-service.js`, `routes/chat/*-service.js`, `routes/calls/*-service.js`, `routes/fleet/*-routes.js`, `routes/pfm/service-helpers.js`, `routes/pos/service-helpers.js` — confirmed in the original audit).

**Deferred to later plans (explicitly, not silently):** the smaller remaining set of service/route files described just above that independently derive `companyId` via `memberships[0]` or `membership.findFirst({ orderBy: 'createdAt desc' })` instead of reading `c.get("companyId")` (Plan 4); `Role.companyId` / `CompanyModule` schema migrations (Plan 3); `GET/PUT /identity/users/:id/permission-grants`, which authorize via `canManageUserGrants(context)` against the raw unscoped context and independently compute a company via `adminMs ?? activeMs[0]` in `loadUserGrantContext` (`apps/api/src/index.js:2911-2954`) — left untouched in this plan because fixing it correctly means changing its route contract (requiring `X-Atlas-Company-Id` + wrapping with `requirePermission`), which is a Plan 3/4-sized change, not a Plan 1 one; the frontend `ActiveCompanyProvider`/`CompanySwitcher` wiring (Plan 2).

---

## File Structure

- **Create:** `apps/api/src/lib/tenant-context.js` — pure resolution/permission-scoping functions + the one Prisma/cache-touching helper (`createPermissionKeysCache`), isolated exactly like the existing `apps/api/src/lib/permission-grants.js`.
- **Create:** `apps/api/src/lib/__tests__/tenant-context.test.js` — unit tests for every exported function, no DB.
- **Modify:** `apps/api/src/index.js` — `_loadUserContext` (additive fields), `requirePermission`, `requireAnyPermission`, `requireModuleAccess`, `GET /user/me`, `GET /runtime/modules`, `GET /blueprints`, CORS `allowHeaders`/`exposeHeaders`.
- **Modify:** `packages/sdk/src/index.js` — `createAtlasClient` gains `getActiveCompanyId`, `withAuthHeaders` injects `X-Atlas-Company-Id`.
- **Create:** `packages/sdk/src/__tests__/active-company-header.test.js` — SDK unit test for the header injection.
- **Modify:** `apps/desktop/src/lib/atlas.js` — module-level `setActiveCompanyId`/`getActiveCompanyId` pair wired into `createAtlasClient`, so Plan 2's `ActiveCompanyProvider` has something to call.

---

### Task 1: Pure tenant-resolution helpers

**Files:**
- Create: `apps/api/src/lib/tenant-context.js`
- Test: `apps/api/src/lib/__tests__/tenant-context.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// apps/api/src/lib/__tests__/tenant-context.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveActiveMembership,
  computeScopedPermissions,
  isSystemAdminMembership,
  TENANT_ERROR,
  COMPANY_ADMIN_ROLE_KEYS,
  SYSTEM_ADMIN_ROLE_KEYS,
} from "../tenant-context.js";

function membership({ companyId, roleKey, permissions = [], companyEnabled = true }) {
  return {
    companyId,
    company: { id: companyId, enabled: companyEnabled },
    role: {
      key: roleKey,
      permissions: permissions.map((key) => ({ permission: { key } })),
    },
  };
}

describe("resolveActiveMembership", () => {
  it("auto-activates the only membership when no header is sent", () => {
    const m = membership({ companyId: "A", roleKey: "viewer" });
    const result = resolveActiveMembership({ memberships: [m], requestedCompanyId: null });
    assert.equal(result.ok, true);
    assert.equal(result.membership.companyId, "A");
  });

  it("returns membership: null (not an error) for a user with zero memberships", () => {
    const result = resolveActiveMembership({ memberships: [], requestedCompanyId: null });
    assert.equal(result.ok, true);
    assert.equal(result.membership, null);
  });

  it("strict mode: 400 company_required when multiple memberships and no header", () => {
    const a = membership({ companyId: "A", roleKey: "viewer" });
    const b = membership({ companyId: "B", roleKey: "viewer" });
    const result = resolveActiveMembership({ memberships: [a, b], requestedCompanyId: null });
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(result.code, TENANT_ERROR.COMPANY_REQUIRED);
  });

  it("non-strict mode: resolves to membership: null instead of erroring when ambiguous", () => {
    const a = membership({ companyId: "A", roleKey: "viewer" });
    const b = membership({ companyId: "B", roleKey: "viewer" });
    const result = resolveActiveMembership({
      memberships: [a, b],
      requestedCompanyId: null,
      strict: false,
    });
    assert.equal(result.ok, true);
    assert.equal(result.membership, null);
  });

  it("activates the requested company when the header matches an enabled membership", () => {
    const a = membership({ companyId: "A", roleKey: "atlas.admin" });
    const b = membership({ companyId: "B", roleKey: "viewer" });
    const result = resolveActiveMembership({ memberships: [a, b], requestedCompanyId: "B" });
    assert.equal(result.ok, true);
    assert.equal(result.membership.companyId, "B");
  });

  it("403 company_not_member when the header names a company the user is not in", () => {
    const a = membership({ companyId: "A", roleKey: "viewer" });
    const result = resolveActiveMembership({ memberships: [a], requestedCompanyId: "ghost" });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
    assert.equal(result.code, TENANT_ERROR.NOT_MEMBER);
  });

  it("403 when the header matches a companyId but that company is disabled", () => {
    const a = membership({ companyId: "A", roleKey: "viewer", companyEnabled: false });
    const result = resolveActiveMembership({ memberships: [a], requestedCompanyId: "A" });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
    assert.equal(result.code, TENANT_ERROR.NOT_MEMBER);
  });
});

describe("computeScopedPermissions", () => {
  it("scopes permissions to ONLY the active membership's role — no cross-company union", () => {
    // Regression test for the exact bug this migration fixes: admin in Company A,
    // viewer in Company B — activating B must not carry A's admin permissions.
    const activeMembership = membership({
      companyId: "B",
      roleKey: "viewer",
      permissions: ["hr.employee.read"],
    });
    const { permissionSet, isCompanyAdmin } = computeScopedPermissions({
      activeMembership,
      grantKeysForCompany: [],
      allPermissionKeys: ["hr.employee.read", "hr.employee.delete", "finance.close.period"],
      basePermissionKeys: ["profile.self.read"],
      isSystemAdmin: false,
    });
    assert.equal(isCompanyAdmin, false);
    assert.deepEqual(
      [...permissionSet].sort(),
      ["hr.employee.read", "profile.self.read"],
    );
  });

  it("company admin gets every provided permission key, scoped to the active company only", () => {
    const activeMembership = membership({ companyId: "A", roleKey: "atlas.admin", permissions: [] });
    const { permissionSet, isCompanyAdmin } = computeScopedPermissions({
      activeMembership,
      grantKeysForCompany: [],
      allPermissionKeys: ["hr.employee.read", "hr.employee.delete"],
      basePermissionKeys: ["profile.self.read"],
      isSystemAdmin: false,
    });
    assert.equal(isCompanyAdmin, true);
    assert.deepEqual(
      [...permissionSet].sort(),
      ["hr.employee.delete", "hr.employee.read", "profile.self.read"],
    );
  });

  it("merges per-company UserPermissionGrant keys additively", () => {
    const activeMembership = membership({ companyId: "A", roleKey: "viewer", permissions: [] });
    const { permissionSet } = computeScopedPermissions({
      activeMembership,
      grantKeysForCompany: ["finance.export.run"],
      allPermissionKeys: [],
      basePermissionKeys: [],
      isSystemAdmin: false,
    });
    assert.ok(permissionSet.has("finance.export.run"));
  });

  it("with no active membership, returns only the base permission keys", () => {
    const { permissionSet, isCompanyAdmin } = computeScopedPermissions({
      activeMembership: null,
      grantKeysForCompany: [],
      allPermissionKeys: ["hr.employee.read"],
      basePermissionKeys: ["profile.self.read"],
      isSystemAdmin: false,
    });
    assert.equal(isCompanyAdmin, false);
    assert.deepEqual([...permissionSet], ["profile.self.read"]);
  });
});

describe("isSystemAdminMembership", () => {
  it("is true if ANY membership has the system.admin role, regardless of active company", () => {
    const a = membership({ companyId: "A", roleKey: "viewer" });
    const b = membership({ companyId: "B", roleKey: "system.admin" });
    assert.equal(isSystemAdminMembership([a, b]), true);
  });

  it("is false when no membership has system.admin", () => {
    const a = membership({ companyId: "A", roleKey: "atlas.admin" });
    assert.equal(isSystemAdminMembership([a]), false);
  });
});

describe("role key sets", () => {
  it("atlas.admin is a company-admin key, not a system-admin key", () => {
    assert.equal(COMPANY_ADMIN_ROLE_KEYS.has("atlas.admin"), true);
    assert.equal(SYSTEM_ADMIN_ROLE_KEYS.has("atlas.admin"), false);
  });
  it("system.admin is a system-admin key, not a company-admin key", () => {
    assert.equal(SYSTEM_ADMIN_ROLE_KEYS.has("system.admin"), true);
    assert.equal(COMPANY_ADMIN_ROLE_KEYS.has("system.admin"), false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail with "module not found"**

Run: `node --test apps/api/src/lib/__tests__/tenant-context.test.js`
Expected: FAIL — `Cannot find module '../tenant-context.js'`

- [ ] **Step 3: Write the implementation**

```javascript
// apps/api/src/lib/tenant-context.js
// Resolves which single company a request operates on (the "active tenant"),
// and computes permissions scoped to ONLY that company's membership — never a
// union across every company the user belongs to.
//
// Kept side-effect-free (resolveActiveMembership / computeScopedPermissions /
// isSystemAdminMembership take already-loaded data) so it can be unit-tested
// with node --test without a database, matching the pattern already used by
// apps/api/src/lib/permission-grants.js.
//
// Spec: docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md

export const COMPANY_ADMIN_ROLE_KEYS = new Set(["atlas.admin"]);
export const SYSTEM_ADMIN_ROLE_KEYS = new Set(["system.admin"]);

export const TENANT_ERROR = {
  NOT_MEMBER: "company_not_member",
  COMPANY_REQUIRED: "company_required",
};

// memberships: the ACTIVE (role.enabled) memberships already loaded by
// _loadUserContext, each shaped like
//   { companyId, company: { id, enabled }, role: { key, permissions: [{ permission: { key } }] } }
// requestedCompanyId: value of the X-Atlas-Company-Id header, or null.
// strict: when true (the default — used for actual business-data routes),
//   multiple memberships with no header is a 400. When false (used for
//   bootstrap endpoints called before the frontend may have chosen a company
//   yet — /user/me, /runtime/modules, /blueprints, requireModuleAccess),
//   the same situation resolves to membership: null instead of erroring.
//
// Returns { ok: true, membership } or { ok: false, status, code, message }.
export function resolveActiveMembership({ memberships, requestedCompanyId, strict = true }) {
  const list = Array.isArray(memberships) ? memberships : [];

  if (requestedCompanyId) {
    const match = list.find(
      (m) => m.companyId === requestedCompanyId && m.company?.enabled !== false,
    );
    if (!match) {
      return {
        ok: false,
        status: 403,
        code: TENANT_ERROR.NOT_MEMBER,
        message: "No perteneces a esta empresa o no está activa.",
      };
    }
    return { ok: true, membership: match };
  }

  if (list.length === 1) {
    return { ok: true, membership: list[0] };
  }

  if (list.length === 0) {
    return { ok: true, membership: null };
  }

  if (strict) {
    return {
      ok: false,
      status: 400,
      code: TENANT_ERROR.COMPANY_REQUIRED,
      message: "Selecciona una empresa activa.",
    };
  }

  return { ok: true, membership: null };
}

// activeMembership: result of resolveActiveMembership (or null).
// grantKeysForCompany: string[] of UserPermissionGrant keys already scoped to
//   activeMembership.companyId (never mix in another company's grants).
// allPermissionKeys: string[] of every active Permission.key in the instance —
//   only actually merged in when the active membership is a company admin, or
//   isSystemAdmin is true.
export function computeScopedPermissions({
  activeMembership,
  grantKeysForCompany = [],
  allPermissionKeys = [],
  basePermissionKeys = [],
  isSystemAdmin = false,
}) {
  const permissionSet = new Set(basePermissionKeys);
  const roleKey = activeMembership?.role?.key ?? null;
  const isCompanyAdmin = Boolean(roleKey && COMPANY_ADMIN_ROLE_KEYS.has(roleKey));

  if (activeMembership) {
    for (const rolePermission of activeMembership.role?.permissions ?? []) {
      const key = rolePermission?.permission?.key;
      if (key) permissionSet.add(key);
    }
    for (const key of grantKeysForCompany) {
      if (key) permissionSet.add(key);
    }
  }

  if (isCompanyAdmin || isSystemAdmin) {
    for (const key of allPermissionKeys) permissionSet.add(key);
  }

  return { permissionSet, isCompanyAdmin, roleKey };
}

// True if ANY of the user's memberships (not just the active one) carries
// system.admin — deliberately NOT scoped to activeCompanyId, since system
// admin is an instance-wide platform role by design (spec §5.3/§9).
export function isSystemAdminMembership(memberships) {
  return (memberships ?? []).some((m) => SYSTEM_ADMIN_ROLE_KEYS.has(m?.role?.key));
}

// The one function here that touches Prisma/cache: a cached lookup of every
// active Permission.key, needed only when expanding a company/system admin's
// permissionSet. Returns an async getter closed over the given deps so
// callers don't need to pass prisma/cache on every call.
export function createPermissionKeysCache({ prisma, cacheGet, cacheSet, ttlSeconds }) {
  const CACHE_KEY = "permissions:all-active";
  return async function getAllActivePermissionKeys() {
    const cached = cacheGet(CACHE_KEY);
    if (cached) return cached;
    const rows = await prisma.permission.findMany({
      where: { active: true },
      select: { key: true },
      take: 1000,
    });
    const keys = rows.map((row) => row.key);
    cacheSet(CACHE_KEY, keys, ttlSeconds);
    return keys;
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test apps/api/src/lib/__tests__/tenant-context.test.js`
Expected: PASS — all `describe` blocks green, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/tenant-context.js apps/api/src/lib/__tests__/tenant-context.test.js
git commit -m "feat(api): add pure tenant-resolution and permission-scoping helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Load per-company grants and company.enabled in `_loadUserContext`

**Files:**
- Modify: `apps/api/src/index.js:295-382`

- [ ] **Step 1: Replace `_loadUserContext` with the additive version**

Current code (`apps/api/src/index.js:295-382`) is being replaced in place — no test file for this step (it's glue code exercised end-to-end by Task 4's wiring; the pure logic it feeds is already covered by Task 1's tests). Replace the whole function body:

```javascript
async function _loadUserContext(authUserId, cacheKey) {

  const profile = await prisma.userProfile.findUnique({
    where: { authUserId },
  });
  if (!profile) return null;
  const memberships = await prisma.membership.findMany({
    where: { userId: profile.id, enabled: true },
    include: {
      company: { select: { id: true, name: true, slug: true, enabled: true } },
      role: {
        include: {
          permissions: {
            where: { permission: { active: true } },
            include: {
              permission: {
                select: { key: true },
              },
            },
          },
        },
      },
    },
  });

  const activeMemberships = memberships.filter((membership) =>
    Boolean(membership?.role?.enabled),
  );
  const adminMembership = activeMemberships.find((membership) =>
    ADMIN_ROLE_KEYS.has(membership?.role?.key),
  );
  const roleKey =
    adminMembership?.role?.key ?? activeMemberships[0]?.role?.key ?? null;
  const isAdmin = ADMIN_ROLE_KEYS.has(roleKey);
  const permissionSet = new Set(BASE_PERMISSION_KEYS);
  const roleKeySet = new Set();
  for (const membership of activeMemberships) {
    for (const rolePermission of membership.role?.permissions ?? []) {
      const key = rolePermission?.permission?.key;
      if (key) { permissionSet.add(key); roleKeySet.add(key); }
    }
  }

  // Additive per-user grants (ALLOW-only). Union with the role's permissions;
  // never subtracts. Scoped to the companies of the active memberships, active
  // permissions only. See
  // docs/superpowers/specs/2026-09-08-per-user-permission-grants.md
  //
  // grantsByCompany additionally keeps the SAME rows broken out per company
  // (not merged), so a per-request tenant resolution (see resolveTenantContext,
  // apps/api/src/lib/tenant-context.js) can apply only the active company's
  // grants instead of this file's own legacy cross-company union below.
  // See docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md
  const grantKeySet = new Set();
  const grantsByCompany = new Map();
  const grantCompanyIds = [...new Set(activeMemberships.map((m) => m.companyId).filter(Boolean))];
  if (grantCompanyIds.length) {
    const grants = await prisma.userPermissionGrant.findMany({
      where: {
        userId: profile.id,
        companyId: { in: grantCompanyIds },
        permission: { active: true },
      },
      include: { permission: { select: { key: true } } },
    });
    for (const g of grants) {
      const key = g.permission?.key;
      if (!key) continue;
      permissionSet.add(key);
      grantKeySet.add(key);
      if (!grantsByCompany.has(g.companyId)) grantsByCompany.set(g.companyId, new Set());
      grantsByCompany.get(g.companyId).add(key);
    }
  }

  if (isAdmin) {
    const allPermissions = await prisma.permission.findMany({
      where: { active: true },
      select: { key: true },
      take: 1000,
    });
    for (const permission of allPermissions) {
      permissionSet.add(permission.key);
    }
  }

  const context = {
    profile,
    memberships: activeMemberships,
    grantsByCompany,
    roleKey,
    isAdmin,
    permissions: [...permissionSet].sort(),
    permissionSet,
    roleKeys: [...roleKeySet].sort(),
    grantKeys: [...grantKeySet].sort(),
  };
  cacheSet(cacheKey, context, TTL.USER_CONTEXT);
  return context;
}
```

Note what changed vs. what didn't: `company` select gains `enabled: true`; a `grantsByCompany` `Map<companyId, Set<permissionKey>>` is built alongside the existing flat `grantKeySet`; the returned `context` gains one new field, `grantsByCompany`. Every existing field (`profile`, `memberships`, `roleKey`, `isAdmin`, `permissions`, `permissionSet`, `roleKeys`, `grantKeys`) is untouched — this keeps every one of the ~35 not-yet-migrated call sites (Plan 4 scope) working exactly as before.

- [ ] **Step 2: Syntax-check the file**

Run: `node --check apps/api/src/index.js`
Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(api): load company.enabled and per-company grant keys in user context

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `resolveTenantContext` wrapper + CORS header

**Files:**
- Modify: `apps/api/src/index.js` (imports near top, new function near `requirePermission`, CORS block at `:835,837`)

- [ ] **Step 1: Import the new helpers**

Add to the import block at the top of `apps/api/src/index.js`, alongside the existing `permission-catalog.js` import (`apps/api/src/index.js:33-36`):

```javascript
import {
  resolveActiveMembership,
  computeScopedPermissions,
  isSystemAdminMembership,
  createPermissionKeysCache,
  COMPANY_ADMIN_ROLE_KEYS,
} from "./lib/tenant-context.js";
```

- [ ] **Step 2: Instantiate the cached permission-keys getter**

Immediately after the existing `const prisma = new PrismaClient({ adapter: prismaAdapter });` line (`apps/api/src/index.js:147`), add:

```javascript
const getAllActivePermissionKeys = createPermissionKeysCache({
  prisma,
  cacheGet,
  cacheSet,
  ttlSeconds: TTL.PERMISSIONS,
});
```

(`TTL.PERMISSIONS` already exists in `apps/api/src/lib/cache.js:9` — it was defined but unused until now.)

- [ ] **Step 3: Add `resolveTenantContext`**

Insert immediately after `getOrLoadUserContext` (`apps/api/src/index.js:384-399`, right before `function forbiddenMessage`):

```javascript
// Resolves the single active company for THIS request from the
// X-Atlas-Company-Id header, validated against the caller's own memberships,
// and computes permissions scoped to only that company. See
// docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §5.
//
// strict=true (default): ambiguous multi-company requests with no header are
// a 400 — used by requirePermission/requireAnyPermission, the gate in front
// of actual tenant-scoped business data.
// strict=false: ambiguous resolves to "no active company" instead of erroring
// — used by bootstrap-time endpoints (requireModuleAccess, /runtime/modules,
// /blueprints, /user/me) that must stay reachable before the frontend has
// necessarily chosen a company yet.
async function resolveTenantContext(c, context, { strict = true } = {}) {
  const requestedCompanyId = c.req.header("X-Atlas-Company-Id") || null;
  const result = resolveActiveMembership({
    memberships: context.memberships,
    requestedCompanyId,
    strict,
  });
  if (!result.ok) {
    return {
      ok: false,
      response: c.json({ error: result.code, message: result.message }, result.status),
    };
  }

  const activeMembership = result.membership;
  const isSystemAdmin = isSystemAdminMembership(context.memberships);
  const roleKey = activeMembership?.role?.key ?? null;
  const isCompanyAdminRole = Boolean(roleKey && COMPANY_ADMIN_ROLE_KEYS.has(roleKey));

  let grantKeysForCompany = [];
  if (activeMembership) {
    const set = context.grantsByCompany?.get(activeMembership.companyId);
    if (set) grantKeysForCompany = [...set];
  }

  const allPermissionKeys =
    isSystemAdmin || isCompanyAdminRole ? await getAllActivePermissionKeys() : [];

  const { permissionSet, isCompanyAdmin } = computeScopedPermissions({
    activeMembership,
    grantKeysForCompany,
    allPermissionKeys,
    basePermissionKeys: [...BASE_PERMISSION_KEYS],
    isSystemAdmin,
  });

  return {
    ok: true,
    tenant: {
      companyId: activeMembership?.companyId ?? null,
      membership: activeMembership,
      role: activeMembership?.role ?? null,
      permissionSet,
      isCompanyAdmin,
      isSystemAdmin,
      // Deprecated alias kept for the Plan 1/2 migration window — every
      // function that still reads context.isAdmin for an authorization
      // decision (userCanAccessModule, filterModuleNavigation) accepts this
      // same shape. See spec §5.2.
      isAdmin: isCompanyAdmin || isSystemAdmin,
    },
  };
}
```

- [ ] **Step 4: Add `X-Atlas-Company-Id` to CORS**

Modify `apps/api/src/index.js:830-839`:

```javascript
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Atlas-Company", "X-Atlas-Company-Id"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["X-Atlas-Company", "X-Atlas-Company-Id"],
  }),
);
```

Note: this widens the CORS allow-list only — it does not touch route registration order, and does not add, remove, or reorder any `app.use("*", ...)` auth guard, so it is not the kind of root-route change that requires a separate check-in.

- [ ] **Step 5: Syntax-check**

Run: `node --check apps/api/src/index.js`
Expected: no output (exit code 0).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(api): add resolveTenantContext wrapper and X-Atlas-Company-Id CORS header

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire `resolveTenantContext` into `requirePermission` / `requireAnyPermission` (strict)

**Files:**
- Modify: `apps/api/src/index.js:407-448`

- [ ] **Step 1: Replace both functions**

```javascript
function requirePermission(permissionKey) {
  return async (c, next) => {
    const context = await getOrLoadUserContext(c);
    if (!context?.profile) {
      return c.json(
        { error: "No autorizado. Perfil de usuario no encontrado." },
        401,
      );
    }
    const resolved = await resolveTenantContext(c, context);
    if (!resolved.ok) return resolved.response;
    const { tenant } = resolved;
    c.set("companyId", tenant.companyId);
    c.set("tenantContext", tenant);
    c.set("userId", context.profile.id);
    if (tenant.isAdmin || tenant.permissionSet.has(permissionKey)) {
      await next();
      return;
    }
    return c.json({ error: forbiddenMessage(permissionKey) }, 403);
  };
}

function requireAnyPermission(permissionKeys = []) {
  return async (c, next) => {
    const context = await getOrLoadUserContext(c);
    if (!context?.profile) {
      return c.json(
        { error: "No autorizado. Perfil de usuario no encontrado." },
        401,
      );
    }
    const resolved = await resolveTenantContext(c, context);
    if (!resolved.ok) return resolved.response;
    const { tenant } = resolved;
    c.set("companyId", tenant.companyId);
    c.set("tenantContext", tenant);
    c.set("userId", context.profile.id);
    if (tenant.isAdmin) {
      await next();
      return;
    }
    const keys = Array.isArray(permissionKeys) ? permissionKeys : [];
    const allowed = keys.some((key) => tenant.permissionSet.has(key));
    if (!allowed) {
      return c.json({ error: forbiddenMessage(keys.join(" o ")) }, 403);
    }
    await next();
  };
}
```

This is the fix for the core bug: `c.set("companyId", ...)` is now the validated result of `resolveTenantContext`, never `context.memberships?.[0]?.companyId`, and the permission check reads `tenant.permissionSet` (scoped to the one active membership) instead of `context.permissionSet` (unioned across every company).

- [ ] **Step 2: Syntax-check**

Run: `node --check apps/api/src/index.js`
Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.js
git commit -m "fix(api): scope requirePermission/requireAnyPermission to the active company only

Fixes the core multi-tenant bug: a user's effective permissions for a
request were unioned across every company they belong to. Now they are a
pure function of (user, activeCompanyId), resolved from a validated
X-Atlas-Company-Id header instead of memberships[0].

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire `resolveTenantContext` into module-access endpoints (non-strict)

**Files:**
- Modify: `apps/api/src/index.js:484-513` (`requireModuleAccess`)
- Modify: `apps/api/src/index.js:3085-3126` (`GET /runtime/modules`)
- Modify: `apps/api/src/index.js:3128-3214` (`GET /blueprints`)

- [ ] **Step 1: Update `requireModuleAccess`**

Replace `apps/api/src/index.js:484-513`:

```javascript
function requireModuleAccess(moduleKey) {
  return async (c, next) => {
    const context = await getOrLoadUserContext(c);
    if (!context?.profile) {
      return c.json(
        { error: "No autorizado. Perfil de usuario no encontrado." },
        401,
      );
    }
    const resolved = await resolveTenantContext(c, context, { strict: false });
    if (!resolved.ok) return resolved.response;
    const { tenant } = resolved;
    c.set("companyId", tenant.companyId);
    c.set("tenantContext", tenant);
    const moduleRow = await prisma.atlasModule.findUnique({
      where: { key: moduleKey },
      select: {
        key: true,
        status: true,
        enabled: true,
        manifest: true,
      },
    });
    if (!moduleRow) {
      return c.json({ error: "Modulo no encontrado." }, 404);
    }
    if (!userCanAccessModule(tenant, moduleRow)) {
      return c.json(
        { error: `No tienes permisos para acceder al modulo ${moduleKey}.` },
        403,
      );
    }
    await next();
  };
}
```

`userCanAccessModule(context, moduleRow)` (`apps/api/src/index.js:476-482`) only reads `.isAdmin` and `.permissionSet` off whatever object it's given — `tenant` already has both (the `isAdmin` field is the deprecated alias from Task 3), so this call site needed no change to `userCanAccessModule` itself, only to what gets passed in.

- [ ] **Step 2: Update `GET /runtime/modules`**

In `apps/api/src/index.js:3085-3126`, insert tenant resolution right after the existing profile check, and pass `tenant` instead of `context` into `serializeModulesForResponse`:

```javascript
app.get("/runtime/modules", authMiddleware, async (c) => {
  const context = await getOrLoadUserContext(c);
  if (!context?.profile) {
    return c.json(
      { error: "No autorizado. Perfil de usuario no encontrado." },
      401,
    );
  }
  const resolved = await resolveTenantContext(c, context, { strict: false });
  if (!resolved.ok) return resolved.response;
  const { tenant } = resolved;

  // Cache raw DB data — the per-user access filter is applied below on each request.
  // Invalidated by module lifecycle events (same points as blueprints:raw).
  let modulesRaw = cacheGet("runtime:modules:raw");
  if (!modulesRaw) {
    modulesRaw = await prisma.atlasModule.findMany({
      orderBy: [{ core: "desc" }, { name: "asc" }],
      include: {
        dependencies: {
          include: {
            dependency: {
              select: {
                id: true,
                key: true,
                name: true,
                status: true,
                enabled: true,
                version: true,
              },
            },
          },
        },
      },
    });
    cacheSet("runtime:modules:raw", modulesRaw, TTL.BLUEPRINTS);
  }

  return c.json({
    data: serializeModulesForResponse(modulesRaw, tenant, {
      filterByPermission: true,
      filterNavigation: true,
    }),
  });
});
```

- [ ] **Step 3: Update `GET /blueprints`**

In `apps/api/src/index.js:3128-3214`, insert the same tenant resolution after the profile check, and swap `context` for `tenant` at both `userCanAccessModule` call sites (originally lines 3176 and 3192):

```javascript
app.get("/blueprints", authMiddleware, async (c) => {
  const context = await getOrLoadUserContext(c);
  if (!context?.profile) {
    return c.json(
      { error: "No autorizado. Perfil de usuario no encontrado." },
      401,
    );
  }
  const resolved = await resolveTenantContext(c, context, { strict: false });
  if (!resolved.ok) return resolved.response;
  const { tenant } = resolved;

  // Cache raw DB data — the per-user access filter is applied below on each request.
  // Invalidated by module lifecycle events (install/enable/disable/uninstall/sync/reset).
  let blueprintRaw = cacheGet("blueprints:raw");
  if (!blueprintRaw) {
    const [blueprints, installedModuleRows] = await Promise.all([
      prisma.blueprint.findMany({
        where: { enabled: true },
        include: { module: true },
      }),
      prisma.atlasModule.findMany({
        where: { status: "INSTALLED", enabled: true },
        select: {
          key: true,
          name: true,
          status: true,
          enabled: true,
          version: true,
          manifest: true,
          hasBundle: true,
        },
      }),
    ]);
    const atlasViews = await prisma.atlasView.findMany({
      where: {
        enabled: true,
        moduleKey: { in: installedModuleRows.map((row) => row.key) },
      },
    });
    blueprintRaw = { blueprints, installedModuleRows, atlasViews };
    cacheSet("blueprints:raw", blueprintRaw, TTL.BLUEPRINTS);
  }

  const { blueprints, installedModuleRows, atlasViews } = blueprintRaw;
  const moduleRowsByKey = new Map(
    installedModuleRows.map((row) => [row.key, row]),
  );
  const mergedByKey = new Map();

  for (const blueprint of blueprints) {
    if (!userCanAccessModule(tenant, blueprint.module)) continue;
    mergedByKey.set(blueprint.key, {
      ...blueprint,
      source: "blueprint",
      module: blueprint.module
        ? {
            ...blueprint.module,
            has_bundle: blueprint.module.hasBundle ?? false,
          }
        : blueprint.module,
    });
  }

  for (const view of atlasViews) {
    const moduleRow = moduleRowsByKey.get(view.moduleKey);
    if (!moduleRow) continue;
    if (!userCanAccessModule(tenant, moduleRow)) continue;

    mergedByKey.set(view.key, {
      id: view.id,
      key: view.key,
      moduleKey: view.moduleKey,
      kind: view.type,
      version: moduleRow.version ?? "0.1.0",
      schema: view.schema,
      enabled: view.enabled,
      source: "atlas-view",
      module: {
        key: moduleRow.key,
        name: moduleRow.name,
        status: moduleRow.status,
        enabled: moduleRow.enabled,
        has_bundle: moduleRow.hasBundle ?? false,
      },
    });
  }

  return c.json({ data: [...mergedByKey.values()] });
});
```

- [ ] **Step 4: Syntax-check**

Run: `node --check apps/api/src/index.js`
Expected: no output (exit code 0).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.js
git commit -m "fix(api): resolve tenant context (non-strict) before module/blueprint access checks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `GET /user/me` uses the resolved tenant instead of `memberships[0]`

**Files:**
- Modify: `apps/api/src/index.js:1166-1192`

- [ ] **Step 1: Replace the handler**

```javascript
app.get("/user/me", authMiddleware, async (c) => {
  const authUserId = c.get("authUserId");
  try {
    const context = await getOrLoadUserContext(c);
    if (!context?.profile) return c.json({ error: "Profile not found" }, 404);
    const resolved = await resolveTenantContext(c, context, { strict: false });
    if (!resolved.ok) return resolved.response;
    const { tenant } = resolved;
    const avatarUrl = await getSignedUrlByFileId(
      context.profile.avatarFileId,
      "card",
    );
    return c.json({
      id: context.profile.id,
      firstName: context.profile.firstName,
      lastName: context.profile.lastName,
      displayName: context.profile.displayName,
      email: context.profile.email,
      avatarUrl,
      role: tenant.role?.key ?? null,
      isAdmin: tenant.isAdmin,
      permissions: [...tenant.permissionSet].sort(),
      colony: context.profile.colony,
      companyId: tenant.companyId,
      availableForChat: context.profile.availableForChat ?? false,
    });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
});
```

`authUserId` stays read (unused by the body beyond what it already wasn't used for — kept for parity with the original, harmless) — actually, it is unused in both the old and new version except as a leftover local; leave it as-is, do not remove it in this task (out of scope, zero behavior impact either way, and removing unrelated dead code is not this task's job).

This is the endpoint the frontend calls immediately after login (`atlas.auth.me`, `AuthProvider.jsx`), before the user has necessarily picked a company — hence `strict: false`. For today's overwhelmingly common single-membership case, behavior is unchanged (`companyId`/`isAdmin` resolve exactly as before, just via the validated path instead of `memberships[0]`). For a multi-membership user with no header yet, `companyId` now correctly comes back `null` (honest "no company chosen") instead of an arbitrary DB-order-dependent id — and per the frontend audit, nothing currently reads this field back to drive behavior, so this is a safe, non-breaking correctness fix.

- [ ] **Step 2: Syntax-check**

Run: `node --check apps/api/src/index.js`
Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.js
git commit -m "fix(api): GET /user/me resolves companyId via tenant context, not memberships[0]

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: SDK — `getActiveCompanyId` and the `X-Atlas-Company-Id` header

**Files:**
- Modify: `packages/sdk/src/index.js:7-13`
- Test: `packages/sdk/src/__tests__/active-company-header.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// packages/sdk/src/__tests__/active-company-header.test.js
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

function makeFetch(status = 200) {
  return mock.fn(async (url) => ({
    ok: status < 400,
    status,
    json: async () => ({ url }),
    text: async () => String(status),
  }));
}

describe("atlas SDK — active company header", () => {
  it("sends X-Atlas-Company-Id when getActiveCompanyId returns an id", async () => {
    const fetchMock = makeFetch();
    const { createAtlasClient } = await import("../index.js");
    const client = createAtlasClient({
      baseUrl: "http://api",
      getActiveCompanyId: () => "company-a",
    });
    globalThis.fetch = fetchMock;
    await client.profile.me("tok");
    const [, opts] = fetchMock.mock.calls[0].arguments;
    assert.equal(opts.headers.Authorization, "Bearer tok");
    assert.equal(opts.headers["X-Atlas-Company-Id"], "company-a");
    fetchMock.mock.restore();
  });

  it("omits the header when getActiveCompanyId returns null", async () => {
    const fetchMock = makeFetch();
    const { createAtlasClient } = await import("../index.js");
    const client = createAtlasClient({
      baseUrl: "http://api",
      getActiveCompanyId: () => null,
    });
    globalThis.fetch = fetchMock;
    await client.profile.me("tok");
    const [, opts] = fetchMock.mock.calls[0].arguments;
    assert.equal("X-Atlas-Company-Id" in opts.headers, false);
    fetchMock.mock.restore();
  });

  it("omits the header when getActiveCompanyId is not provided at all", async () => {
    const fetchMock = makeFetch();
    const { createAtlasClient } = await import("../index.js");
    const client = createAtlasClient({ baseUrl: "http://api" });
    globalThis.fetch = fetchMock;
    await client.profile.me("tok");
    const [, opts] = fetchMock.mock.calls[0].arguments;
    assert.equal("X-Atlas-Company-Id" in opts.headers, false);
    fetchMock.mock.restore();
  });

  it("reads the callback fresh on every call — switching company mid-session takes effect immediately", async () => {
    const fetchMock = makeFetch();
    const { createAtlasClient } = await import("../index.js");
    let current = "company-a";
    const client = createAtlasClient({
      baseUrl: "http://api",
      getActiveCompanyId: () => current,
    });
    globalThis.fetch = fetchMock;
    await client.profile.me("tok");
    current = "company-b";
    await client.profile.me("tok");
    const [, firstOpts] = fetchMock.mock.calls[0].arguments;
    const [, secondOpts] = fetchMock.mock.calls[1].arguments;
    assert.equal(firstOpts.headers["X-Atlas-Company-Id"], "company-a");
    assert.equal(secondOpts.headers["X-Atlas-Company-Id"], "company-b");
    fetchMock.mock.restore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test packages/sdk/src/__tests__/active-company-header.test.js`
Expected: FAIL — `opts.headers["X-Atlas-Company-Id"]` is `undefined` where the test expects `"company-a"`.

- [ ] **Step 3: Implement — thread `getActiveCompanyId` through `withAuthHeaders`**

Modify `packages/sdk/src/index.js:7-13`:

```javascript
export function createAtlasClient({ baseUrl, getActiveCompanyId } = {}) {
  let _offlineTransport = null;

  function withAuthHeaders(token, headers = {}) {
    const merged = token ? { ...headers, Authorization: `Bearer ${token}` } : { ...headers };
    const companyId = typeof getActiveCompanyId === "function" ? getActiveCompanyId() : null;
    if (companyId) merged["X-Atlas-Company-Id"] = companyId;
    return merged;
  }
```

`getActiveCompanyId` is a callback, not a static value passed once — it is re-invoked on every single request (see the fourth test above), so switching the active company mid-session takes effect on the very next API call with zero need to recreate the client. Every one of the ~250 existing `withAuthHeaders(token)` call sites across the file needs no change: they call `withAuthHeaders` with exactly the same one argument as before, and the header injection happens inside the shared function.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test packages/sdk/src/__tests__/active-company-header.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full existing SDK test suite to confirm no regression**

Run: `node --test packages/sdk/src/__tests__/`
Expected: PASS — every pre-existing SDK test (calendar, calls, fleet, website-domain, documents, growth, office) still green, since `withAuthHeaders(token)` called with one argument behaves identically to before whenever `getActiveCompanyId` is absent (this is exactly what the third new test above pins down).

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src/index.js packages/sdk/src/__tests__/active-company-header.test.js
git commit -m "feat(sdk): thread active-company header through the shared withAuthHeaders chokepoint

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Wire the desktop app's SDK singleton to a settable active-company id

**Files:**
- Modify: `apps/desktop/src/lib/atlas.js`

- [ ] **Step 1: Add a module-level ref and setter, and pass `getActiveCompanyId` at both `createAtlasClient` call sites**

```javascript
import { createAtlasClient } from '@atlas/sdk'
import { getApiUrl, setApiUrl } from './runtimeConfig.js'

let currentAtlasClient = null

// Module-level ref, not React state: the SDK client is a plain singleton
// created outside any component, so it needs a stable getter it can call on
// every request rather than a value baked in at construction time. Plan 2's
// ActiveCompanyProvider calls setActiveCompanyId() whenever the user switches
// companies; this file has no React/company-list knowledge of its own.
// See docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §6.1
let _activeCompanyId = null

export function setActiveCompanyId(companyId) {
  _activeCompanyId = companyId || null
}

export function getActiveCompanyId() {
  return _activeCompanyId
}

export function initAtlasClient(url) {
  if (url) {
    setApiUrl(url)
  }
  currentAtlasClient = createAtlasClient({ baseUrl: getApiUrl(), getActiveCompanyId })
  return currentAtlasClient
}

export function getAtlasClient() {
  if (!currentAtlasClient) {
    currentAtlasClient = createAtlasClient({ baseUrl: getApiUrl(), getActiveCompanyId })
  }
  return currentAtlasClient
}

export const atlas = new Proxy(
  {},
  {
    get(_target, prop) {
      return Reflect.get(getAtlasClient(), prop)
    },
  },
)
```

`getActiveCompanyId` (the exported function) is passed by reference into `createAtlasClient`, which is exactly the callback shape Task 7 built — the SDK will call this function fresh on every request, so it always sees whatever `_activeCompanyId` was most recently set to via `setActiveCompanyId`, regardless of when `initAtlasClient`/`getAtlasClient` originally constructed the client.

- [ ] **Step 2: Syntax-check**

Run: `node --check apps/desktop/src/lib/atlas.js`
Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/atlas.js
git commit -m "feat(desktop): expose setActiveCompanyId for the SDK client singleton

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

No consumer calls `setActiveCompanyId` yet — that is Plan 2's `ActiveCompanyProvider`. Until Plan 2 lands, `_activeCompanyId` stays `null` for every session, so the SDK never sends the header and every request falls back to strict-mode's single-membership auto-activation (Task 1) — i.e., zero behavior change for today's installation, which has exactly one company.

---

## Verification

- [ ] **Full lib + SDK test suite**

Run: `node --test apps/api/src/lib/__tests__/ && node --test packages/sdk/src/__tests__/`
Expected: PASS, 0 failures.

- [ ] **Full existing API service test suite (regression check — nothing in Task 2's `_loadUserContext` change should break unrelated service tests)**

Run: `node --test apps/api/src/services/__tests__/`
Expected: PASS, same pass/fail counts as on `main` before this plan (some pre-existing failures unrelated to this change, e.g. tests requiring a live DB connection, are expected and are not a regression — compare the failure list, not just the exit code).

- [ ] **Lint**

Run: `pnpm lint`
Expected: no new errors introduced by the files this plan touches (`apps/api/src/index.js`, `apps/api/src/lib/tenant-context.js`, `packages/sdk/src/index.js`, `apps/desktop/src/lib/atlas.js`).

- [ ] **API boots cleanly**

Run: `pnpm dev:api` (or `node --check apps/api/src/index.js` if a live DB connection isn't available in this environment), confirm no import/syntax errors on startup, then stop it.

- [ ] **Known limitation, stated explicitly rather than silently skipped:** this plan does not add a live end-to-end integration test that sends real HTTP requests through the full Hono `app` with a real Supabase JWT and a seeded two-company database (Plan 4's cross-tenant security-test suite, spec §13, is where that lives, once more of the surface area — HR, Finance/Ledger, Files — is migrated off `memberships[0]` in Plan 4 so there's a meaningful cross-tenant scenario to test end-to-end). What Task 1's unit tests do verify, with full confidence and no DB required, is the exact scoping algorithm itself: given two memberships with different roles in different companies, activating one must never leak the other's permissions — which is the specific bug this plan exists to fix.
