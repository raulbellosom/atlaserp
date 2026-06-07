# Ledger Screens + modules/official Cleanup — Plan B

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missing CategoriesScreen and TypesScreen to atlas.ledger, then erase `modules/official/` entirely from the repo, seed logic, runtime glob, and documentation.

**Architecture:** CategoriesScreen and TypesScreen use inline blueprint constants + `AtlasCrudView` (same pattern as Plan A fleet screens). After the screens work, `modules/official/` directory is deleted, `prisma/seed.js` is stripped of its AtlasView seeding, `runtimeModules.js` loses the `modules/official/` glob, and all doc/CLAUDE.md references are cleaned up.

**Tech Stack:** React, React Router v6, `@atlas/ui` (`AtlasCrudView`), `useParams`/`useNavigate`, `useAuth`, PowerShell `Remove-Item` for deletion

**Dependency:** Execute Plan A (fleet screens) before Task 3 of this plan, so the `modules/official/` directory is no longer needed by any screen. Tasks 1-2 can be done independently of Plan A.

---

## File Map

| Status | Path | Responsibility |
|---|---|---|
| Create | `apps/desktop/src/modules/atlas.ledger/screens/CategoriesScreen.jsx` | Ledger categories list + form sheet + detail |
| Create | `apps/desktop/src/modules/atlas.ledger/screens/TypesScreen.jsx` | Ledger transaction types list + form sheet + detail |
| Modify | `apps/desktop/src/app/ModuleOutlet.jsx` | Add categories/types entries to SCREEN_MAP + fix ledger resolveScreen |
| Modify | `prisma/seed.js` | Remove modules/official/ imports, OFFICIAL_MODULE_VIEWS const, seedAtlasViews function + call |
| Modify | `apps/desktop/src/lib/runtimeModules.js` | Remove `modules/official/` glob entry |
| Modify | `CLAUDE.md` | Remove two references to `modules/official/` |
| Delete | `modules/official/` | Entire directory — no longer needed |
| Delete | `apps/api/bundles/atlas.ledger.js` | Compiled bundle referencing deleted modules/official paths |

---

## Task 1: CategoriesScreen.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.ledger/screens/CategoriesScreen.jsx`

- [ ] **Step 1: Create the screen file**

The schemas below are copied verbatim from `modules/official/atlas.ledger/views/ledger-views.js` (categoriesTable, categoriesForm, categoriesDetail).

```jsx
// apps/desktop/src/modules/atlas.ledger/screens/CategoriesScreen.jsx
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasCrudView } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'
const BASE_PATH = '/app/m/atlas.ledger/categories'

const CATEGORIES_TABLE = {
  key: 'ledger.categories.table',
  kind: 'TABLE',
  schema: {
    entity: 'category',
    component: 'AtlasTable',
    apiPath: '/ledger/categories',
    description: 'Agrupa movimientos por naturaleza: ingresos, egresos o ambos. Usadas para clasificar transacciones y analizarlas en el resumen de cuenta.',
    primaryField: 'name',
    searchable: false,
    columns: [
      { field: 'color', label: 'Color',  sortable: false, type: 'color' },
      { field: 'name',  label: 'Nombre', sortable: true,  link: true },
      {
        field: 'kind', label: 'Tipo', sortable: true, type: 'select',
        options: [
          { value: 'income',  label: 'Ingreso' },
          { value: 'expense', label: 'Egreso'  },
          { value: 'both',    label: 'Ambos'   },
        ],
      },
    ],
    actions: [{ label: 'Nueva categoria', permission: 'ledger.categories.manage', variant: 'primary' }],
    rowActions: [
      { label: 'Editar',     permission: 'ledger.categories.manage' },
      { label: 'Desactivar', permission: 'ledger.categories.manage' },
    ],
    emptyState: { message: 'No hay categorias registradas.' },
  },
}

const CATEGORIES_FORM = {
  key: 'ledger.categories.form',
  kind: 'FORM',
  schema: {
    entity: 'category',
    component: 'AtlasForm',
    apiPath: '/ledger/categories',
    sections: [
      {
        fields: [
          { name: 'name',  label: 'Nombre', type: 'text',   required: true },
          { name: 'color', label: 'Color',  type: 'color' },
          {
            name: 'kind', label: 'Tipo', type: 'select', required: true,
            options: [
              { value: 'income',  label: 'Ingreso' },
              { value: 'expense', label: 'Egreso'  },
              { value: 'both',    label: 'Ambos'   },
            ],
          },
        ],
      },
    ],
  },
}

const CATEGORIES_DETAIL = {
  key: 'ledger.categories.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'category',
    apiPath: '/ledger/categories',
    sections: [
      {
        title: 'Informacion',
        fields: [
          { name: 'name',  label: 'Nombre', type: 'text' },
          { name: 'kind',  label: 'Tipo',   type: 'text' },
          { name: 'color', label: 'Color',  type: 'color' },
        ],
      },
    ],
  },
}

function parseModeAndId(wildcard) {
  const segs = String(wildcard ?? '').replace(/^\/+/, '').replace(/^categories\/?/, '').split('/').filter(Boolean)
  if (segs[0] === 'new') return { initialMode: 'create', recordId: null }
  if (segs[1] === 'edit') return { initialMode: 'edit', recordId: segs[0] }
  if (segs[0]) return { initialMode: 'detail', recordId: segs[0] }
  return { initialMode: 'list', recordId: null }
}

export default function CategoriesScreen() {
  const { '*': wildcard } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const { initialMode, recordId } = useMemo(() => parseModeAndId(wildcard), [wildcard])

  const handleNavigate = useCallback(({ mode, recordId }) => {
    const path =
      mode === 'create' ? `${BASE_PATH}/new` :
      mode === 'detail' && recordId ? `${BASE_PATH}/${recordId}` :
      mode === 'edit' && recordId ? `${BASE_PATH}/${recordId}/edit` :
      BASE_PATH
    navigate(path, { replace: true })
  }, [navigate])

  return (
    <AtlasCrudView
      tableBlueprint={CATEGORIES_TABLE}
      formBlueprint={CATEGORIES_FORM}
      detailBlueprint={CATEGORIES_DETAIL}
      token={token}
      apiBaseUrl={API_BASE}
      initialMode={initialMode}
      recordId={recordId}
      onNavigate={handleNavigate}
    />
  )
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.ledger/screens/CategoriesScreen.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.ledger/screens/CategoriesScreen.jsx
git commit -m "feat(ledger): add CategoriesScreen with inline blueprint schemas"
```

---

## Task 2: TypesScreen.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.ledger/screens/TypesScreen.jsx`

- [ ] **Step 1: Create the screen file**

Schemas copied from `modules/official/atlas.ledger/views/ledger-views.js` (typesTable, typesForm, typesDetail).

```jsx
// apps/desktop/src/modules/atlas.ledger/screens/TypesScreen.jsx
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasCrudView } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'
const BASE_PATH = '/app/m/atlas.ledger/types'

const TYPES_TABLE = {
  key: 'ledger.types.table',
  kind: 'TABLE',
  schema: {
    entity: 'transaction_type',
    component: 'AtlasTable',
    apiPath: '/ledger/types',
    description: 'Codigos de operacion bancaria (DEP, CHQ, TRANSF, etc.). Identifican el instrumento de cada movimiento y permiten filtrar el registro por tipo.',
    primaryField: 'code',
    searchable: false,
    columns: [
      { field: 'code', label: 'Codigo', sortable: true, link: true },
      { field: 'name', label: 'Nombre', sortable: true },
    ],
    actions: [{ label: 'Nuevo tipo', permission: 'ledger.types.manage', variant: 'primary' }],
    rowActions: [
      { label: 'Editar',     permission: 'ledger.types.manage' },
      { label: 'Desactivar', permission: 'ledger.types.manage' },
    ],
    emptyState: { message: 'No hay tipos de movimiento registrados.' },
  },
}

const TYPES_FORM = {
  key: 'ledger.types.form',
  kind: 'FORM',
  schema: {
    entity: 'transaction_type',
    component: 'AtlasForm',
    apiPath: '/ledger/types',
    sections: [
      {
        fields: [
          { name: 'code', label: 'Codigo', type: 'text', required: true },
          { name: 'name', label: 'Nombre', type: 'text', required: true },
        ],
      },
    ],
  },
}

const TYPES_DETAIL = {
  key: 'ledger.types.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'transaction_type',
    apiPath: '/ledger/types',
    sections: [
      {
        title: 'Informacion',
        fields: [
          { name: 'code', label: 'Codigo', type: 'text' },
          { name: 'name', label: 'Nombre', type: 'text' },
        ],
      },
    ],
  },
}

function parseModeAndId(wildcard) {
  const segs = String(wildcard ?? '').replace(/^\/+/, '').replace(/^types\/?/, '').split('/').filter(Boolean)
  if (segs[0] === 'new') return { initialMode: 'create', recordId: null }
  if (segs[1] === 'edit') return { initialMode: 'edit', recordId: segs[0] }
  if (segs[0]) return { initialMode: 'detail', recordId: segs[0] }
  return { initialMode: 'list', recordId: null }
}

export default function TypesScreen() {
  const { '*': wildcard } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const { initialMode, recordId } = useMemo(() => parseModeAndId(wildcard), [wildcard])

  const handleNavigate = useCallback(({ mode, recordId }) => {
    const path =
      mode === 'create' ? `${BASE_PATH}/new` :
      mode === 'detail' && recordId ? `${BASE_PATH}/${recordId}` :
      mode === 'edit' && recordId ? `${BASE_PATH}/${recordId}/edit` :
      BASE_PATH
    navigate(path, { replace: true })
  }, [navigate])

  return (
    <AtlasCrudView
      tableBlueprint={TYPES_TABLE}
      formBlueprint={TYPES_FORM}
      detailBlueprint={TYPES_DETAIL}
      token={token}
      apiBaseUrl={API_BASE}
      initialMode={initialMode}
      recordId={recordId}
      onNavigate={handleNavigate}
    />
  )
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.ledger/screens/TypesScreen.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.ledger/screens/TypesScreen.jsx
git commit -m "feat(ledger): add TypesScreen with inline blueprint schemas"
```

---

## Task 3: Wire categories/types in ModuleOutlet.jsx

**Files:**
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`

- [ ] **Step 1: Add SCREEN_MAP entries**

In `ModuleOutlet.jsx`, add to the `SCREEN_MAP` object immediately after the existing `atlas.ledger` entries:

```js
"atlas.ledger:/categories": lazy(() => import("../modules/atlas.ledger/screens/CategoriesScreen.jsx")),
"atlas.ledger:/categories/:id": lazy(() => import("../modules/atlas.ledger/screens/CategoriesScreen.jsx")),
"atlas.ledger:/types": lazy(() => import("../modules/atlas.ledger/screens/TypesScreen.jsx")),
"atlas.ledger:/types/:id": lazy(() => import("../modules/atlas.ledger/screens/TypesScreen.jsx")),
```

- [ ] **Step 2: Update the ledger resolveScreen block**

Find the existing `if (moduleKey === "atlas.ledger")` block. It currently ends with `return BlueprintCrudScreen` for categories and types paths. Replace the entire block with:

```js
if (moduleKey === "atlas.ledger") {
  if (subPath === "/accounts" || subPath === "/accounts/new") return SCREEN_MAP["atlas.ledger:/accounts"] ?? null
  if (subPath.endsWith("/import")) return SCREEN_MAP["atlas.ledger:/accounts/:id/import"] ?? null
  if (subPath.startsWith("/accounts/") && !subPath.endsWith("/new")) return SCREEN_MAP["atlas.ledger:/accounts/:id"] ?? null
  if (subPath === "/categories" || subPath === "/categories/new") return SCREEN_MAP["atlas.ledger:/categories"] ?? null
  if (subPath.startsWith("/categories/")) return SCREEN_MAP["atlas.ledger:/categories/:id"] ?? null
  if (subPath === "/types" || subPath === "/types/new") return SCREEN_MAP["atlas.ledger:/types"] ?? null
  if (subPath.startsWith("/types/")) return SCREEN_MAP["atlas.ledger:/types/:id"] ?? null
  return null
}
```

The key change: `return BlueprintCrudScreen` is removed from the end; categories and types now route to the new screen components.

- [ ] **Step 3: Syntax check**

```bash
node --check apps/desktop/src/app/ModuleOutlet.jsx
```

Expected: no output.

- [ ] **Step 4: Verify in browser**

Start dev server:
```bash
pnpm dev:frontend
```

Navigate to:
- `http://localhost:5173/app/m/atlas.ledger/categories` — should show categories table (AtlasCrudView), not BlueprintCrudScreen
- `http://localhost:5173/app/m/atlas.ledger/types` — should show types table

Verify no console errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "feat(ledger): wire CategoriesScreen and TypesScreen into resolveScreen"
```

---

## Task 4: Strip modules/official from prisma/seed.js

> **Prerequisite:** Tasks 1-3 from Plan A must be complete so no screen depends on modules/official/ at runtime. The seed.js imports are only used during `pnpm db:seed`; the dev server does not need them.

**Files:**
- Modify: `prisma/seed.js`

- [ ] **Step 1: Remove imports and OFFICIAL_MODULE_VIEWS**

In `prisma/seed.js`, delete lines 7-15 (the three `import * as ...` statements and the `OFFICIAL_MODULE_VIEWS` const):

Remove:
```js
import * as fleetViews from '../modules/official/atlas.fleet/views/fleet-views.js'
import * as fleetCatalogs from '../modules/official/atlas.fleet/views/fleet-catalogs.js'
import * as ledgerViews from '../modules/official/atlas.ledger/views/ledger-views.js'

const OFFICIAL_MODULE_VIEWS = [
  { moduleKey: 'atlas.fleet',  views: Object.values(fleetViews) },
  { moduleKey: 'atlas.fleet',  views: Object.values(fleetCatalogs) },
  { moduleKey: 'atlas.ledger', views: Object.values(ledgerViews) },
]
```

- [ ] **Step 2: Remove the seedAtlasViews function**

Delete the entire `seedAtlasViews` function (lines 54-81):

```js
async function seedAtlasViews() {
  let count = 0
  for (const { moduleKey, views } of OFFICIAL_MODULE_VIEWS) {
    for (const view of views) {
      if (!view || typeof view !== 'object' || !view.key || !view.kind) continue
      await prisma.atlasView.upsert({
        where: { key: view.key },
        update: {
          moduleKey,
          type: view.kind,
          title: view.schema?.title ?? null,
          schema: view.schema,
          enabled: true,
        },
        create: {
          moduleKey,
          key: view.key,
          type: view.kind,
          title: view.schema?.title ?? null,
          schema: view.schema,
          enabled: true,
        },
      })
      count++
    }
  }
  return count
}
```

- [ ] **Step 3: Update the main() function call**

In `main()`, replace:

```js
const viewCount = await seedAtlasViews()
console.log(`Atlas modules seeded (${officialModuleManifests.length}), views seeded (${viewCount})`)
```

With:

```js
console.log(`Atlas modules seeded (${officialModuleManifests.length})`)
```

- [ ] **Step 4: Syntax check**

```bash
node --check prisma/seed.js
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.js
git commit -m "chore(seed): remove modules/official AtlasView seeding"
```

---

## Task 5: Remove modules/official/ glob from runtimeModules.js

**Files:**
- Modify: `apps/desktop/src/lib/runtimeModules.js`

- [ ] **Step 1: Remove the modules/official glob entry**

In `apps/desktop/src/lib/runtimeModules.js`, the `import.meta.glob` call is on lines 4-10. Replace:

```js
const _ame3ModuleFiles = import.meta.glob(
  [
    "../../../../modules/custom/*/module.manifest.js",
    "../../../../modules/official/*/module.manifest.js",
  ],
  { eager: true },
);
```

With:

```js
const _ame3ModuleFiles = import.meta.glob(
  "../../../../modules/custom/*/module.manifest.js",
  { eager: true },
);
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/lib/runtimeModules.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/runtimeModules.js
git commit -m "chore(runtime): remove modules/official/ manifest glob"
```

---

## Task 6: Delete modules/official/ and the ledger bundle

> **Prerequisite:** All Plan A tasks and Tasks 1-5 of this plan must be complete before deleting.

**Files:**
- Delete: `modules/official/` (entire directory tree)
- Delete: `apps/api/bundles/atlas.ledger.js`

- [ ] **Step 1: Delete modules/official/**

```bash
rm -rf modules/official/
```

Verify deletion:
```bash
ls modules/
```

Expected: only `custom/` (and possibly `official/` being absent) in the listing.

- [ ] **Step 2: Delete the stale ledger bundle**

```bash
rm apps/api/bundles/atlas.ledger.js
```

- [ ] **Step 3: Verify no remaining imports**

```bash
grep -r "modules/official" apps/ packages/ prisma/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"
```

Expected: zero matches.

- [ ] **Step 4: Syntax check of key files**

```bash
node --check prisma/seed.js
node --check apps/desktop/src/lib/runtimeModules.js
node --check apps/desktop/src/app/ModuleOutlet.jsx
```

All expected: no output.

- [ ] **Step 5: Commit**

```bash
git add -A modules/official/ apps/api/bundles/atlas.ledger.js
git commit -m "chore: delete modules/official/ directory and stale ledger bundle"
```

---

## Task 7: Update CLAUDE.md and documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: all docs files matching `grep -r "modules/official" docs/ --include="*.md" -l`

- [ ] **Step 1: Fix CLAUDE.md line 102**

Find and replace in `CLAUDE.md`:

Old:
```
AME3 modules are declared under `modules/custom/` (and optionally `modules/official/`).
```

New:
```
AME3 modules are declared under `modules/custom/`.
```

- [ ] **Step 2: Fix CLAUDE.md line 147**

Find and replace in `CLAUDE.md`:

Old:
```
Route Loader behavior: on API boot, `route-loader-service.js` reads all `INSTALLED` + `enabled` modules from DB, looks for `modules/custom/<moduleKey>/api/index.js` (or `modules/official/`), imports it as a Hono router factory, and delegates matching requests at runtime.
```

New:
```
Route Loader behavior: on API boot, `route-loader-service.js` reads all `INSTALLED` + `enabled` modules from DB, looks for `modules/custom/<moduleKey>/api/index.js`, imports it as a Hono router factory, and delegates matching requests at runtime.
```

- [ ] **Step 3: Identify docs files with modules/official references**

```bash
grep -r "modules/official" docs/ --include="*.md" -l
```

For each file listed, replace every occurrence of `modules/official/` with `modules/custom/` where appropriate, or remove the reference entirely if it describes a path that no longer exists. Key files to check:

- `docs/01_erp_architecture.md` — update monorepo structure description (remove `modules/official/` from structure diagram)
- `docs/02_module_system.md` — remove any mention of `modules/official/` as a valid path
- `docs/architecture/atlas-module-engine-v3.md` — update Route Loader section
- `docs/TASKS.md` — update AME3 phase descriptions if they reference `modules/official/`
- Any files in `docs/superpowers/specs/` or `docs/superpowers/plans/` — update or annotate as superseded

Rule: If the reference is part of a historical plan or spec describing past work, add a note `<!-- modules/official/ was removed 2026-06-06 -->` rather than rewriting history.

- [ ] **Step 4: Verify CLAUDE.md syntax**

```bash
node --check CLAUDE.md 2>/dev/null; echo "CLAUDE.md is not JS — manual review sufficient"
```

Review CLAUDE.md and confirm both references on lines 102 and 147 are updated.

- [ ] **Step 5: Final grep — confirm zero references remain**

```bash
grep -r "modules/official" . --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" --include="*.md" --exclude-dir=".git" --exclude-dir="node_modules"
```

Expected: zero matches (any remaining matches in historical plan files are acceptable if annotated).

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/
git commit -m "docs: remove all modules/official references from CLAUDE.md and docs"
```
