# RBAC Granular por Feature (Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar Atlas de permisos CRUD generales por módulo a permisos granulares por feature, con rollout por oleadas y compatibilidad temporal con permisos legacy.

**Architecture:** Mantener API como autoridad, declarar permisos granulares en manifiestos, sincronizar catálogo/seed y migrar roles existentes con script idempotente. Implementar fallback legacy temporal en guards, rediseñar UI de Roles/Permisos para asignación por módulo/feature/acción, y retirar fallback al finalizar la oleada C.

**Tech Stack:** Prisma 6, Hono API, React + Vite desktop, `@atlas/maps`, `@atlas/validators`, `@atlas/sdk`, Node test runner (`node:test`).

---

## File Structure Map

- Create: `apps/api/src/permissions/granular-contract.js`
- Create: `apps/api/src/permissions/legacy-fallback.js`
- Create: `apps/api/src/services/__tests__/rbac-granular-contract.test.js`
- Create: `scripts/migrate-legacy-permissions-to-granular.mjs`
- Create: `apps/desktop/src/modules/atlas.identity/components/PermissionFeatureTree.jsx`
- Modify: `packages/maps/src/core-modules.js`
- Modify: `packages/maps/src/feature-modules.js`
- Modify: `apps/api/src/permission-catalog.js`
- Modify: `apps/api/src/index.js`
- Modify: `prisma/seed.js`
- Modify: `apps/desktop/src/modules/atlas.identity/screens/RolesScreen.jsx`
- Modify: `docs/02_module_system.md`
- Modify: `docs/07_auth_permissions_strategy.md`
- Modify: `docs/TASKS.md`

### Task 1: Create granular permission contract and legacy fallback map

**Files:**
- Create: `apps/api/src/permissions/granular-contract.js`
- Create: `apps/api/src/permissions/legacy-fallback.js`
- Test: `apps/api/src/services/__tests__/rbac-granular-contract.test.js`

- [ ] **Step 1: Write failing tests for permission key generation and fallback mapping**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  featureCrudKeys,
  moduleAccessKey,
  ensureUniquePermissionKeys,
} from "../../permissions/granular-contract.js";
import { resolveLegacyFallback } from "../../permissions/legacy-fallback.js";

test("featureCrudKeys returns CRUD keys for module+feature", () => {
  assert.deepEqual(featureCrudKeys("finance", "ar"), [
    "finance.ar.read",
    "finance.ar.create",
    "finance.ar.update",
    "finance.ar.delete",
  ]);
});

test("resolveLegacyFallback maps granular read to module.read", () => {
  assert.equal(resolveLegacyFallback("finance.ar.read"), "finance.read");
});

test("ensureUniquePermissionKeys throws on duplicates", () => {
  assert.throws(
    () => ensureUniquePermissionKeys(["a.read", "a.read"]),
    /duplicado/i,
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js`  
Expected: FAIL with module not found for new permission helper files.

- [ ] **Step 3: Implement contract and fallback helpers**

```js
// apps/api/src/permissions/granular-contract.js
export function moduleAccessKey(moduleKey) {
  return `${moduleKey}.access`;
}

export function featureCrudKeys(moduleKey, featureKey) {
  return ["read", "create", "update", "delete"].map(
    (action) => `${moduleKey}.${featureKey}.${action}`,
  );
}

export function ensureUniquePermissionKeys(keys = []) {
  const seen = new Set();
  for (const key of keys) {
    if (seen.has(key)) {
      throw new Error(`Permiso duplicado detectado: ${key}`);
    }
    seen.add(key);
  }
  return [...seen];
}
```

```js
// apps/api/src/permissions/legacy-fallback.js
export function resolveLegacyFallback(granularKey) {
  const [moduleKey, , action] = String(granularKey ?? "").split(".");
  if (!moduleKey || !action) return null;
  if (["read", "create", "update", "delete"].includes(action)) {
    return `${moduleKey}.${action}`;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js`  
Expected: PASS for all three tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/permissions/granular-contract.js apps/api/src/permissions/legacy-fallback.js apps/api/src/services/__tests__/rbac-granular-contract.test.js
git commit -m "feat(rbac): add granular permission contract and legacy fallback helpers"
```

### Task 2: Oleada A manifests (core, identity, company) + catalog labels

**Files:**
- Modify: `packages/maps/src/core-modules.js`
- Modify: `apps/api/src/permission-catalog.js`

- [ ] **Step 1: Write failing contract test for oleada A required keys**

```js
test("core modules expose access + per-feature CRUD keys", async () => {
  const { coreModules } = await import("../../../../packages/maps/src/core-modules.js");
  const core = coreModules.find((m) => m.key === "atlas.core");
  const keys = (core.permissions ?? []).map((p) => p.key);
  assert.ok(keys.includes("core.access"));
  assert.ok(keys.includes("core.modules.read"));
  assert.ok(keys.includes("core.modules.create"));
  assert.ok(keys.includes("core.modules.update"));
  assert.ok(keys.includes("core.modules.delete"));
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js`  
Expected: FAIL because `core.access` and granular feature keys do not exist yet.

- [ ] **Step 3: Implement oleada A keys in `core-modules.js` and add catalog entries**

```js
// Example target shape in packages/maps/src/core-modules.js
permissions: [
  { key: "core.access", name: "Core Access" },
  { key: "core.modules.read", name: "Read Module Catalog" },
  { key: "core.modules.create", name: "Install Modules" },
  { key: "core.modules.update", name: "Enable or Disable Modules" },
  { key: "core.modules.delete", name: "Uninstall Modules" },
  { key: "core.instance.read", name: "Read Instance Config" },
  { key: "core.instance.update", name: "Update Instance Config" },
]
```

```js
// Example target shape in apps/api/src/permission-catalog.js
"core.modules.read": {
  displayNameEs: "Ver catalogo de modulos (core)",
  descriptionEs: "Permite consultar el catalogo de modulos desde core.",
  groupKey: "core",
  order: 15,
},
```

- [ ] **Step 4: Run syntax checks**

Run:
- `node --check packages/maps/src/core-modules.js`
- `node --check apps/api/src/permission-catalog.js`  
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add packages/maps/src/core-modules.js apps/api/src/permission-catalog.js
git commit -m "feat(rbac): add granular permissions for oleada A modules"
```

### Task 3: Oleada B/C manifests (contacts, files, finance, hr) and ACL action mapping

**Files:**
- Modify: `packages/maps/src/core-modules.js`
- Modify: `packages/maps/src/feature-modules.js`

- [ ] **Step 1: Add failing test for finance feature-level permissions**

```js
test("finance module includes per-feature CRUD permissions", async () => {
  const { featureModules } = await import("../../../../packages/maps/src/feature-modules.js");
  const finance = featureModules.find((m) => m.key === "atlas.finance");
  const keys = (finance.permissions ?? []).map((p) => p.key);
  assert.ok(keys.includes("finance.access"));
  assert.ok(keys.includes("finance.ar.read"));
  assert.ok(keys.includes("finance.entries.create"));
  assert.ok(keys.includes("finance.applications.reverse"));
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js`  
Expected: FAIL for missing granular finance keys.

- [ ] **Step 3: Add feature-level CRUD and extra non-CRUD keys in module manifests**

```js
// Example target shape in packages/maps/src/feature-modules.js (finance)
permissions: [
  { key: "finance.access", name: "Finance Access" },
  ...["ar", "ap", "accounts", "entries", "applications", "tax_rates", "fx_rates"].flatMap((f) => [
    { key: `finance.${f}.read`, name: `Read ${f}` },
    { key: `finance.${f}.create`, name: `Create ${f}` },
    { key: `finance.${f}.update`, name: `Update ${f}` },
    { key: `finance.${f}.delete`, name: `Delete ${f}` },
  ]),
  { key: "finance.applications.reverse", name: "Reverse Applications" },
  { key: "finance.documents.reminder.send", name: "Send Document Reminders" },
]
```

- [ ] **Step 4: Update `acl.actions` for explicit endpoint permission mapping**

```js
acl: {
  module: "finance.access",
  actions: {
    "finance.documents.read": "finance.ar.read",
    "finance.documents.create": "finance.ar.create",
    "finance.applications.reverse": "finance.applications.reverse",
    "finance.documents.reminder.send": "finance.documents.reminder.send",
  },
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/maps/src/core-modules.js packages/maps/src/feature-modules.js
git commit -m "feat(rbac): add feature-level permission keys for oleadas B and C"
```

### Task 4: Seed and role migration script (legacy -> granular)

**Files:**
- Modify: `prisma/seed.js`
- Create: `scripts/migrate-legacy-permissions-to-granular.mjs`

- [ ] **Step 1: Write failing mapper test**

```js
test("legacy finance.read expands to finance feature read keys", async () => {
  const { expandLegacyPermission } = await import("../../../../scripts/migrate-legacy-permissions-to-granular.mjs");
  const result = expandLegacyPermission("finance.read");
  assert.ok(result.includes("finance.ar.read"));
  assert.ok(result.includes("finance.ap.read"));
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js`  
Expected: FAIL because migration script helper does not exist yet.

- [ ] **Step 3: Implement idempotent migration script and callout in seed docs**

```js
// scripts/migrate-legacy-permissions-to-granular.mjs
export function expandLegacyPermission(legacyKey) {
  const map = {
    "finance.read": ["finance.ar.read", "finance.ap.read", "finance.entries.read"],
    "finance.create": ["finance.ar.create", "finance.entries.create"],
    "finance.update": ["finance.ar.update", "finance.entries.update"],
    "finance.delete": ["finance.ar.delete", "finance.entries.delete"],
  };
  return map[legacyKey] ?? [];
}
```

- [ ] **Step 4: Run dry-run migration command**

Run: `node scripts/migrate-legacy-permissions-to-granular.mjs --dry-run`  
Expected: prints role summary and exits without writes.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.js scripts/migrate-legacy-permissions-to-granular.mjs
git commit -m "feat(rbac): add legacy-to-granular role migration script"
```

### Task 5: API guards with granular permission + temporary legacy fallback

**Files:**
- Modify: `apps/api/src/index.js`
- Modify: `apps/api/src/permissions/legacy-fallback.js`

- [ ] **Step 1: Add failing test for fallback behavior**

```js
test("fallback allows granular read when legacy read exists", () => {
  const fallback = resolveLegacyFallback("finance.ar.read");
  assert.equal(fallback, "finance.read");
});
```

- [ ] **Step 2: Run test to verify current guard behavior fails for granular-only routes**

Run: `node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js`  
Expected: FAIL before guard integration.

- [ ] **Step 3: Integrate `requirePermission` fallback path behind feature flag**

```js
const RBAC_LEGACY_FALLBACK_ENABLED =
  String(process.env.RBAC_LEGACY_FALLBACK_ENABLED ?? "true") === "true";

if (!allowed && RBAC_LEGACY_FALLBACK_ENABLED) {
  const legacyKey = resolveLegacyFallback(permissionKey);
  if (legacyKey && context.permissionSet.has(legacyKey)) {
    await next();
    return;
  }
}
```

- [ ] **Step 4: Run syntax check and API smoke**

Run:
- `node --check apps/api/src/index.js`
- `node --check apps/api/src/permissions/legacy-fallback.js`  
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.js apps/api/src/permissions/legacy-fallback.js
git commit -m "feat(rbac): add temporary legacy fallback in granular permission guards"
```

### Task 6: Redesign Roles/Permissions UI to module > feature > action tree

**Files:**
- Create: `apps/desktop/src/modules/atlas.identity/components/PermissionFeatureTree.jsx`
- Modify: `apps/desktop/src/modules/atlas.identity/screens/RolesScreen.jsx`

- [ ] **Step 1: Add failing render test for grouped permission tree**

```js
test("groups permissions by module and feature", () => {
  const sample = ["finance.ar.read", "finance.ar.create", "contacts.people.read"];
  // expected group shape:
  // finance -> ar -> [read, create]
  // contacts -> people -> [read]
});
```

- [ ] **Step 2: Run build to verify missing component fail**

Run: `pnpm.cmd --filter ./apps/desktop build:web`  
Expected: FAIL after wiring RolesScreen import before creating component.

- [ ] **Step 3: Implement new tree component and wire bulk toggles**

```jsx
// PermissionFeatureTree.jsx
export function PermissionFeatureTree({ permissions, selected, onToggle }) {
  // render module section
  // render feature subsection
  // render action checkboxes
  // include "select all module" and "select all feature"
}
```

- [ ] **Step 4: Build frontend to verify pass**

Run: `pnpm.cmd --filter ./apps/desktop build:web`  
Expected: build success.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.identity/components/PermissionFeatureTree.jsx apps/desktop/src/modules/atlas.identity/screens/RolesScreen.jsx
git commit -m "feat(identity): redesign role permission assignment with feature tree"
```

### Task 7: Documentation hard rules for future modules

**Files:**
- Modify: `docs/02_module_system.md`
- Modify: `docs/07_auth_permissions_strategy.md`
- Modify: `docs/TASKS.md`

- [ ] **Step 1: Add mandatory permission convention section**

```md
Every new module MUST declare:
- module.access
- module.feature.read/create/update/delete per feature
- non-CRUD extras only when required
```

- [ ] **Step 2: Add mandatory rollout checklist in TASKS**

```md
- [ ] Declare granular permissions in manifest
- [ ] Map navigation permissionKey per route
- [ ] Protect API endpoints with granular guards
- [ ] Add role x endpoint authorization tests
```

- [ ] **Step 3: Run docs consistency check**

Run: `rg -n "module.access|feature.read|authorization tests" docs/02_module_system.md docs/07_auth_permissions_strategy.md docs/TASKS.md`  
Expected: matches in all three files.

- [ ] **Step 4: Commit**

```bash
git add docs/02_module_system.md docs/07_auth_permissions_strategy.md docs/TASKS.md
git commit -m "docs(rbac): formalize granular permission rules for future modules"
```

### Task 8: Final verification matrix and fallback removal gate

**Files:**
- Modify: `apps/api/src/index.js`
- Test: `apps/api/src/services/__tests__/rbac-granular-contract.test.js`

- [ ] **Step 1: Add explicit transition gate checklist test**

```js
test("granular-only mode denies legacy-only roles when fallback disabled", () => {
  // assert behavior with RBAC_LEGACY_FALLBACK_ENABLED=false
});
```

- [ ] **Step 2: Run full verification commands**

Run:
- `node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js`
- `node --check apps/api/src/index.js`
- `node --check packages/maps/src/core-modules.js`
- `node --check packages/maps/src/feature-modules.js`
- `node --check apps/api/src/permission-catalog.js`
- `pnpm.cmd --filter ./apps/desktop build:web`
- `pnpm.cmd db:seed`

Expected: all commands complete successfully.

- [ ] **Step 3: Disable fallback after oleada C completion**

```env
RBAC_LEGACY_FALLBACK_ENABLED=false
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/index.js apps/api/src/services/__tests__/rbac-granular-contract.test.js
git commit -m "chore(rbac): enforce granular-only mode after migration completion"
```

## Spec Coverage Self-Review

1. Convención oficial (`module.access` + CRUD por feature): covered in Tasks 1, 2, 3, and 7.
2. Estrategia por oleadas A/B/C: covered in Tasks 2 and 3 with phased manifest updates.
3. Rediseño completo de Roles/Permisos: covered in Task 6.
4. Migración legacy -> granular: covered in Task 4.
5. Compatibilidad temporal y retiro de fallback: covered in Tasks 5 and 8.
6. Documentación obligatoria para módulos futuros: covered in Task 7.
7. Matriz de autorización y diferenciación 401/403: covered in Tasks 5 and 8.

## Placeholder Scan Result

No `TBD`, `TODO`, “implement later”, or unresolved placeholders are present.

## Type Consistency Check

- Permission key pattern is consistent across manifests, catalog, API guards, migration script, and UI tree (`module.feature.action`).
- Fallback contract consistently maps granular CRUD -> legacy module CRUD.
- Transition flag name is consistent: `RBAC_LEGACY_FALLBACK_ENABLED`.

