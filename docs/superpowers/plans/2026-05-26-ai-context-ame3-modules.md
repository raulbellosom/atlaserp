# AI Context System — AME3 Custom Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a hub document and three spoke files so any AI agent (Claude Code, GitHub Copilot, OpenAI Codex) can correctly create and modify AME3 custom modules without reading five reference files first.

**Architecture:** One authoritative hub at `docs/ai-context/ame3-modules.md` contains all patterns with code examples. Three thin spoke files (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`) include the four critical rules inline and point to the hub for everything else.

**Tech Stack:** Markdown, Node.js, Hono, Prisma (`$queryRaw`), Zod, `@atlas/module-engine` (`defineAtlasModule`, `defineModel`, `defineView`, `definePage`)

**Spec:** `docs/superpowers/specs/2026-05-26-ai-context-ame3-modules-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `docs/ai-context/ame3-modules.md` | Hub — full AME3 pattern guide with code examples |
| Modify | `CLAUDE.md` | Add AME3 section with 4 critical rules + hub pointer |
| Create | `AGENTS.md` | Codex/OpenAI spoke — 4 rules + hub pointer |
| Create | `.github/copilot-instructions.md` | Copilot spoke — 4 rules + hub pointer |

---

## Task 1: Create the hub document

**Files:**
- Create: `docs/ai-context/ame3-modules.md`

- [ ] **Step 1: Create `docs/ai-context/` directory and write the hub**

Write the following content exactly to `docs/ai-context/ame3-modules.md`:

```markdown
# AME3 Custom Modules — AI Reference Guide

This is the single source of truth for creating and modifying custom AME3 modules in Atlas ERP v2.
Read this document before touching any file under `modules/custom/`.

---

## 1. What is AME3

Atlas ERP v2 uses Atlas Module Engine v3 (AME3) for all ERP feature modules. A module is a
self-contained directory under `modules/custom/<moduleKey>/` that declares its own data models,
views, pages, API routes, and permissions. The Atlas Core reads these declarations and drives
all behavior from them.

**The golden rule — a module must never require editing:**
- `prisma/schema.prisma` — AME3 tables are managed by Atlas ORM via `defineModel`
- `apps/api/src/index.js` — routes auto-load via Route Loader at boot
- `apps/desktop/src/main.jsx` — pages are declared inside the module
- `packages/validators/src/index.js` — validators live inside `validators/` in the module

---

## 2. Use the scaffolder for new modules

For a brand-new module, always try the CLI scaffolder first. It generates all files
correctly following the exact fleet reference patterns.

```bash
# Interactive (prompts for all values)
node scripts/scaffold-module.js

# From a JSON config file
node scripts/scaffold-module.js scripts/scaffold-output/my-module.config.json
```

Minimal config JSON:

```json
{
  "key": "custom.crm",
  "name": "CRM",
  "version": "0.1.0",
  "description": "Gestión de relaciones con clientes",
  "entities": [
    {
      "name": "contact",
      "label": "Contacto",
      "labelPlural": "Contactos",
      "fields": [
        { "name": "full_name", "type": "text",   "label": "Nombre completo", "required": true },
        { "name": "email",     "type": "email",  "label": "Correo" },
        { "name": "status",    "type": "select", "label": "Estado",
          "options": ["activo", "inactivo"] }
      ]
    }
  ]
}
```

Use **direct code editing** (not the scaffolder) when:
- Adding a new field to an existing entity
- Adding a new entity to an existing module
- Adding a custom component or CUSTOM view
- Fixing a bug in service logic

---

## 3. Folder structure

Complete module with two entities:

```
modules/custom/custom.crm/
  module.manifest.js             ← defineAtlasModule — metadata, permissions, nav
  models/
    contact.model.js             ← defineModel for crm_contact table
    company.model.js             ← defineModel for crm_company table
  views/
    contact.table.js             ← defineView kind: TABLE
    contact.form.js              ← defineView kind: FORM
    contact.detail.js            ← defineView kind: DETAIL
    contact.page.js              ← definePage — URL path + layout + which view
    company.table.js
    company.form.js
    company.detail.js
    company.page.js
  api/
    index.js                     ← Hono router factory
    contact-routes.js            ← thin Hono routes, no business logic
    contact-service.js           ← business logic, all inside factory closure
    company-routes.js
    company-service.js
    service-helpers.js           ← shared helpers + CrmServiceError class
  validators/
    contact.validators.js        ← Zod schemas for create + update
    company.validators.js
    index.js                     ← barrel: export * from each validators file
  components/                    ← optional: custom React components
    index.js                     ← register(registry) function
    ContactStatusBadge.jsx
```

---

## 4. Critical patterns with code examples

### 4.1 Service factory closure

**All service functions MUST be declared inside `createXxxService({ prisma })`.**
`prisma` is a dependency injected into the factory. Functions at module scope cannot
see it and will throw `ReferenceError: prisma is not defined` at runtime.

```js
// ✅ CORRECT — all functions inside the factory closure
export function createContactService({ prisma }) {
  async function listContacts({ companyId, page, pageSize, search }) {
    // prisma is in scope here
    const rows = await prisma.$queryRaw`
      SELECT * FROM crm_contact
      WHERE company_id = ${companyId} AND enabled = true
    `
    return rows
  }

  async function getContactById({ companyId, id }) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM crm_contact
      WHERE id = ${id} AND company_id = ${companyId}
    `
    if (!rows[0]) throw new CrmServiceError('Contacto no encontrado.', 404)
    return rows[0]
  }

  async function createContact({ companyId, data, actorId }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO crm_contact (company_id, full_name, email, enabled, created_at, updated_at)
      VALUES (${companyId}, ${data.full_name}, ${data.email ?? null}, true, NOW(), NOW())
      RETURNING *
    `
    const created = rows[0]
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'custom.crm',
        entityType: 'crm.contact',
        entityId: created.id,
        action: 'contact.create',
        before: null,
        after: JSON.stringify(created),
        metadata: null,
      },
    })
    return created
  }

  async function updateContact({ companyId, id, data, actorId }) {
    const before = await getContactById({ companyId, id })
    const rows = await prisma.$queryRaw`
      UPDATE crm_contact SET
        full_name  = CASE WHEN ${data.full_name  !== undefined} THEN ${data.full_name  ?? null} ELSE full_name  END,
        email      = CASE WHEN ${data.email      !== undefined} THEN ${data.email      ?? null} ELSE email      END,
        updated_at = NOW()
      WHERE id = ${id} AND company_id = ${companyId}
      RETURNING *
    `
    const updated = rows[0]
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'custom.crm',
        entityType: 'crm.contact',
        entityId: id,
        action: 'contact.update',
        before: JSON.stringify(before),
        after: JSON.stringify(updated),
        metadata: null,
      },
    })
    return updated
  }

  async function setContactEnabled({ companyId, id, enabled, actorId }) {
    const before = await getContactById({ companyId, id })
    await prisma.$queryRaw`
      UPDATE crm_contact
      SET enabled = ${Boolean(enabled)}, updated_at = NOW()
      WHERE id = ${id} AND company_id = ${companyId}
    `
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'custom.crm',
        entityType: 'crm.contact',
        entityId: id,
        action: enabled ? 'contact.enable' : 'contact.disable',
        before: JSON.stringify(before),
        after: JSON.stringify({ ...before, enabled }),
        metadata: null,
      },
    })
    return getContactById({ companyId, id })
  }

  return { listContacts, getContactById, createContact, updateContact, setContactEnabled }
}

// ❌ WRONG — function at module scope, prisma not in scope
async function listContacts({ companyId }) {
  return prisma.$queryRaw`SELECT * FROM crm_contact` // ReferenceError at runtime
}
export function createContactService({ prisma }) {
  return { listContacts }
}
```

### 4.2 `prisma.$queryRaw` — tagged template literal

AME3 module tables do NOT exist in `prisma/schema.prisma`. Prisma model accessors like
`prisma.contact.findMany()` will throw at runtime. Use tagged template literals for
static queries and `$queryRawUnsafe` for dynamic WHERE clauses.

```js
// Static query — tagged template (Prisma parameterizes automatically, SQL-injection safe)
const rows = await prisma.$queryRaw`
  SELECT * FROM crm_contact
  WHERE company_id = ${companyId}
    AND enabled = true
  ORDER BY created_at DESC
  LIMIT ${limit} OFFSET ${offset}
`

// Dynamic WHERE — build params array, use $queryRawUnsafe
const conditions = ['company_id = $1', 'enabled = true']
const params = [companyId]
if (search) {
  params.push(`%${search}%`)
  conditions.push(`full_name ILIKE $${params.length}`)
}
if (status) {
  params.push(status)
  conditions.push(`status = $${params.length}`)
}
const rows = await prisma.$queryRawUnsafe(
  `SELECT * FROM crm_contact WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
  ...params
)

// ❌ WRONG
const rows = await prisma.contact.findMany({ where: { companyId } }) // model doesn't exist
```

### 4.3 Table naming

`moduleSlug` = last segment of `moduleKey`. `tableName = ${moduleSlug}_${entityName}`.

| moduleKey | moduleSlug | entity | tableName |
|---|---|---|---|
| `custom.crm` | `crm` | `contact` | `crm_contact` |
| `custom.fleet` | `fleet` | `vehicle` | `fleet_vehicle` |
| `custom.inventory` | `inventory` | `product` | `inventory_product` |

Never prefix with `atlas_` manually — that was the old convention. Atlas ORM uses
`${slug}_${entity}` directly.

### 4.4 UUID — the database generates it

Every AME3 table's `id` column has `DEFAULT uuidv7()` in PostgreSQL. Never generate
UUIDs in JavaScript. Use `INSERT ... RETURNING *` to get the generated ID.

```js
// ✅ CORRECT — DB generates the ID
const rows = await prisma.$queryRaw`
  INSERT INTO crm_contact (company_id, full_name, enabled, created_at, updated_at)
  VALUES (${companyId}, ${data.full_name}, true, NOW(), NOW())
  RETURNING *
`
const created = rows[0]  // created.id is the DB-generated UUID v7

// ❌ WRONG
import { uuidv7 } from 'uuidv7'
const id = uuidv7()
await prisma.$queryRaw`INSERT INTO crm_contact (id, ...) VALUES (${id}, ...)`
```

### 4.5 Soft delete — `enabled = false`

Never hard-delete records. Toggle the `enabled` column. Expose a `PATCH /:id/enabled`
route. All list queries filter `enabled = true`.

```js
// Route (in contact-routes.js)
app.patch('/crm/contacts/:id/enabled',
  requirePermission('crm.contact.delete'),
  async (c) => {
    const companyId = c.get('userContext')?.memberships?.[0]?.companyId
    const actorId   = c.get('userContext')?.profile?.id
    const body   = await c.req.json()
    const parsed = enabledSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Datos invalidos.' }, 400)
    const updated = await service.setContactEnabled({
      companyId, id: c.req.param('id'), enabled: parsed.data.enabled, actorId,
    })
    return c.json({ data: updated })
  }
)

// Always filter in list queries
const rows = await prisma.$queryRaw`
  SELECT * FROM crm_contact
  WHERE company_id = ${companyId} AND enabled = true
`
```

### 4.6 AuditLog on every mutation

Every `create`, `update`, and `setEnabled` call must write an audit log entry.
`prisma.auditLog` IS a Prisma model (it's a core table, not an AME3 table — this
is the one case where you use a Prisma model accessor).

```js
await prisma.auditLog.create({
  data: {
    actorId:    actorId ?? null,
    moduleKey:  'custom.crm',          // the module key
    entityType: 'crm.contact',         // "<slug>.<entityName>"
    entityId:   record.id,
    action:     'contact.create',      // "<entityName>.<verb>": create | update | enable | disable
    before:     null,                  // null for create; JSON.stringify(beforeState) for update/toggle
    after:      JSON.stringify(record),
    metadata:   null,
  },
})
```

### 4.7 Error class — lives in `service-helpers.js`

Define one error class per module in `api/service-helpers.js`. Import it in both
the service file and the routes file from `service-helpers.js`. Never define it in
the entity service file or re-export it from there.

```js
// api/service-helpers.js
export class CrmServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'CrmServiceError'
    this.status = status
  }
}

// api/contact-service.js
import { CrmServiceError } from './service-helpers.js'   // ← from service-helpers
// ...use inside factory: throw new CrmServiceError('Not found', 404)

// api/contact-routes.js
import { createContactService } from './contact-service.js'
import { CrmServiceError } from './service-helpers.js'   // ← same import, NOT from contact-service
```

### 4.8 Complete `module.manifest.js` example

```js
import { defineAtlasModule } from '@atlas/module-engine'

export default defineAtlasModule({
  key: 'custom.crm',
  name: 'CRM',
  version: '0.1.0',
  kind: 'FEATURE',
  description: 'Gestión de relaciones con clientes.',
  icon: 'Users',
  dependencies: [{ key: 'atlas.core' }],
  models: [
    './models/contact.model.js',
  ],
  views: [
    './views/contact.table.js',
    './views/contact.form.js',
    './views/contact.detail.js',
    './views/contact.page.js',
  ],
  permissions: [
    { key: 'crm.contact.read',   name: 'Ver contactos' },
    { key: 'crm.contact.create', name: 'Crear contactos' },
    { key: 'crm.contact.update', name: 'Editar contactos' },
    { key: 'crm.contact.delete', name: 'Desactivar contactos' },
  ],
  navigation: [
    {
      label: 'Contactos',
      path: '/app/m/custom.crm/crm-contacts',
      icon: 'Users',
      permissionKey: 'crm.contact.read',
    },
  ],
  lifecycle: {
    installable: true,
    uninstallable: true,
    ownedModels: ['contact'],
    ownedTables: ['crm_contact'],
  },
})
```

### 4.9 Complete `models/contact.model.js` example

```js
import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'contact',
  name: 'crm.contact',
  label: 'Contacto',
  tableName: 'crm_contact',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'full_name', type: 'text',   label: 'Nombre completo', required: true, maxLength: 200 },
    { name: 'email',     type: 'email',  label: 'Correo electronico' },
    { name: 'status',    type: 'select', label: 'Estado', required: true,
      options: ['activo', 'inactivo'], default: 'activo' },
    { name: 'company_id_ref', type: 'relation', label: 'Empresa',
      relatedModel: 'crm.company' },
  ],
  indexes: [
    { fields: ['company_id', 'email'], unique: true },
    { fields: ['company_id', 'status'] },
  ],
})
```

### 4.10 Complete `api/index.js` example

```js
import { Hono } from 'hono'
import { createContactRouter } from './contact-routes.js'

export default function createCrmRouter({ prisma, requirePermission, moduleContext }) {
  const app = new Hono()
  app.route('', createContactRouter({ prisma, requirePermission, moduleContext }))
  return app
}
```

---

## 5. Field type reference

Source of truth: `packages/module-engine/src/constants.js` (`FIELD_TYPES` export).

| Type | Zod (required) | Zod (optional) | Notes |
|---|---|---|---|
| `text` | `z.string().min(1)` | `z.string().optional()` | |
| `textarea` | `z.string().min(1)` | `z.string().optional()` | |
| `number` | `z.number().int()` | `z.number().int().optional()` | No `.min(1)` — 0 and negatives are valid |
| `decimal` | `z.number()` | `z.number().optional()` | No `.min(1)` |
| `boolean` | `z.boolean()` | `z.boolean().optional()` | |
| `select` | `z.enum([...options])` | `z.enum([...]).optional()` | Options array required in defineModel |
| `multiselect` | `z.array(z.string())` | `z.array(z.string()).optional()` | |
| `date` | `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` | same `.optional()` | ISO format YYYY-MM-DD |
| `datetime` | `z.string()` | `z.string().optional()` | |
| `email` | `z.string().email().min(1)` | `z.string().email().optional()` | |
| `phone` | `z.string().min(1)` | `z.string().optional()` | |
| `relation` | `z.string().uuid()` | `z.string().uuid().nullable().optional()` | UUID of related record |
| `file` | `z.string().uuid()` | `z.string().uuid().nullable().optional()` | UUID of FileAsset record |
| `json` | `z.record(z.any())` | `z.record(z.any()).optional()` | |
| `markdown` | `z.string().min(1)` | `z.string().optional()` | |
| `color` | `z.string().min(1)` | `z.string().optional()` | |
| `richtext` | `z.string().min(1)` | `z.string().optional()` | |

---

## 6. Permissions and navigation

Permission key format: `<moduleSlug>.<entityName>.<action>` where action ∈ {read, create, update, delete}.

```js
// Declare in defineAtlasModule
permissions: [
  { key: 'crm.contact.read',   name: 'Ver contactos' },
  { key: 'crm.contact.create', name: 'Crear contactos' },
  { key: 'crm.contact.update', name: 'Editar contactos' },
  { key: 'crm.contact.delete', name: 'Desactivar contactos' },
],

// Use in routes
app.get('/crm/contacts',          requirePermission('crm.contact.read'),   handler)
app.post('/crm/contacts',         requirePermission('crm.contact.create'), handler)
app.patch('/crm/contacts/:id',    requirePermission('crm.contact.update'), handler)
app.patch('/crm/contacts/:id/enabled', requirePermission('crm.contact.delete'), handler)
```

Navigation paths follow the pattern `/app/m/<moduleKey>/<slug>-<entity-kebab>s`:

```js
navigation: [
  {
    label: 'Contactos',
    path: '/app/m/custom.crm/crm-contacts',   // /app/m/<key>/<slug>-<entity-kebab>s
    icon: 'Users',
    permissionKey: 'crm.contact.read',
  },
],
```

---

## 7. Anti-patterns

| Never do this | Why | Correct approach |
|---|---|---|
| Edit `prisma/schema.prisma` for a module table | AME3 tables are managed by Atlas ORM | Declare fields in `defineModel`, run `/modules/sync` |
| `prisma.contact.findMany()` for AME3 tables | The Prisma model doesn't exist | `prisma.$queryRaw` or `prisma.$queryRawUnsafe` |
| Declare service functions at module scope | `prisma` is not in scope → ReferenceError at runtime | All functions inside `createXxxService({ prisma })` |
| `const id = uuidv7()` in JavaScript | UUIDs must be DB-generated for time-ordering guarantees | `INSERT ... RETURNING *` — let the DB produce the ID |
| `DELETE FROM crm_contact WHERE id = $1` | Breaks audit trail, violates soft-delete contract | `UPDATE ... SET enabled = false` via `setXxxEnabled` |
| Skip `prisma.auditLog.create` on mutation | Audit trail is incomplete | Add it to every create / update / setEnabled |
| Import `CrmServiceError` from the entity service file | The class lives in `service-helpers.js` | `import { CrmServiceError } from './service-helpers.js'` |
| Single quotes in label strings (e.g. `"L'étiquette"`) | Breaks generated JS string literals | Avoid apostrophes in label values |

---

## 8. Advanced: Custom components and CUSTOM views

### 8.1 Custom column renderers

Place React components in `components/` and register them via `components/index.js`.
Registry key format: `<moduleKey>:<ComponentName>`. Reference the key in a TABLE or
DETAIL view column declaration via the `component` field.

```js
// components/index.js
export async function register(registry) {
  if (typeof window === 'undefined') return  // safe to import in API/Node context
  const [{ default: ContactStatusBadge }] = await Promise.all([
    import('./ContactStatusBadge.jsx'),
  ])
  registry.register('custom.crm:ContactStatusBadge', ContactStatusBadge)
}

// views/contact.table.js — use the component key in a column
columns: [
  { field: 'full_name', label: 'Nombre', sortable: true },
  { field: 'status',    label: 'Estado', component: 'custom.crm:ContactStatusBadge' },
],
```

### 8.2 CUSTOM view kind

For fully custom pages (dashboards, wizards, immersive screens). The view renders
a registered React component at a specific URL via `ImmersiveShell`.

```js
import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'crm.dashboard',
  kind: 'CUSTOM',
  version: '0.1.0',
  schema: {
    component: 'custom.crm:CrmDashboard',      // must match registry.register() key
    path: '/app/m/custom.crm/dashboard',        // must start with /
    // public: true                             // required only if path starts with /p/
  },
})
```

Rules:
- `schema.component` must match pattern `namespace:ComponentName`
- `schema.path` must start with `/`
- If `schema.path` starts with `/p/`, then `schema.public: true` is required

---

## 9. Post-generation steps

```bash
# 1. Syntax-check every generated file
node --check modules/custom/<moduleKey>/module.manifest.js
node --check modules/custom/<moduleKey>/api/index.js
# (repeat for each file)

# 2. Ensure the API dev server is running
pnpm dev:api   # port 4010

# 3. Install the module (first time only)
curl -X POST http://localhost:4010/modules/<moduleKey>/install \
  -H "Authorization: Bearer $ATLAS_TOKEN"

# 4. Sync to provision tables and register blueprints
curl -X POST http://localhost:4010/modules/sync \
  -H "Authorization: Bearer $ATLAS_TOKEN"

# 5. Verify blueprints registered
curl http://localhost:4010/blueprints \
  -H "Authorization: Bearer $ATLAS_TOKEN" | grep -i "<moduleKey>"

# 6. Test CRUD
curl -X POST http://localhost:4010/<slug>/<entity>s \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "full_name": "Test" }'
```

---

## 10. Reference implementation

`modules/custom/custom.fleet/` is the canonical reference. Key files:

| File | Pattern it demonstrates |
|---|---|
| `module.manifest.js` | Full manifest with models, views, permissions, navigation, lifecycle |
| `models/vehicle.model.js` | defineModel with all field types, indexes |
| `api/fleet-service.js` | Factory closure, `$queryRaw`, auditLog, soft-delete |
| `api/service-helpers.js` | Shared helpers: normalizePagination, normalizeSearch, error detection |
| `api/vehicles-routes.js` | Thin Hono routes, permission guards, validation |
| `views/vehicle.table.js` | TABLE view with custom component reference |
| `views/vehicle.form.js` | FORM view with relation fields |
| `components/index.js` | register() pattern for custom components |
```

- [ ] **Step 2: Verify the file was created and contains key patterns**

Run:
```bash
node --check docs/ai-context/ame3-modules.md 2>&1 || true
grep -c "createContactService" docs/ai-context/ame3-modules.md
grep -c "prisma.\$queryRaw" docs/ai-context/ame3-modules.md
grep -c "auditLog" docs/ai-context/ame3-modules.md
grep -c "service-helpers" docs/ai-context/ame3-modules.md
```

Expected: each grep returns `1` or more.

- [ ] **Step 3: Commit**

```bash
git add docs/ai-context/ame3-modules.md
git commit -m "docs: add AME3 custom modules AI reference guide (hub)"
```

---

## Task 2: Update `CLAUDE.md` — add AME3 spoke section

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Find the insertion point**

In `CLAUDE.md`, locate the line that reads:

```
### Module system (packages/core + AME3 manifests)
```

The new AME3 section goes immediately after the existing module system paragraph block
(after `...blueprint flattening. The API seeds these into...` paragraph), before the
`### Blueprint system` heading.

- [ ] **Step 2: Insert the AME3 custom module section**

In `CLAUDE.md`, after the paragraph ending with `...The API seeds these into \`AtlasModule\` rows via \`prisma/seed.js\`.` and before `### Blueprint system`, insert:

```markdown
### AME3 custom module creation

Full reference: `docs/ai-context/ame3-modules.md` — read it before creating or modifying any module.

Critical rules (violating any of these corrupts the project):
- **Never edit `prisma/schema.prisma`** for AME3 module tables — Atlas ORM manages them via `defineModel` + `POST /modules/sync`
- **Never use `prisma.<model>` accessors** for AME3 tables — use `prisma.$queryRaw` tagged template literals
- **All service functions must be declared inside `createXxxService({ prisma })`** — functions at module scope cannot access `prisma` and throw `ReferenceError` at runtime
- **Never generate UUIDs in JavaScript** — the DB column has `DEFAULT uuidv7()`, use `INSERT ... RETURNING *`

```

- [ ] **Step 3: Verify the edit**

```bash
grep -n "docs/ai-context/ame3-modules.md" CLAUDE.md
grep -n "Never edit.*prisma/schema.prisma" CLAUDE.md
grep -n "All service functions must be declared inside" CLAUDE.md
```

Expected: each grep returns at least one match.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): add AME3 custom module creation section with 4 critical rules"
```

---

## Task 3: Create `AGENTS.md` — Codex spoke

**Files:**
- Create: `AGENTS.md`

- [ ] **Step 1: Write `AGENTS.md`**

Create `AGENTS.md` at the repo root with this exact content:

```markdown
# Atlas ERP v2 — Agent Instructions

Atlas ERP v2 is a Node.js + React + Hono monorepo. ERP features are built as self-contained
**AME3 modules** under `modules/custom/<moduleKey>/`. No module requires editing core files.

---

## Before working on any module

Read **`docs/ai-context/ame3-modules.md`** — it contains the full pattern guide with
working code examples for every pattern you need.

### Critical rules — violating these corrupts the project

1. **Never edit `prisma/schema.prisma`** for module tables — Atlas ORM manages them
   via `defineModel` declarations + `POST /modules/sync`

2. **Never use `prisma.<model>` accessors** for AME3 tables — those Prisma models do not
   exist. Use `prisma.$queryRaw` tagged template literals instead.

3. **All service functions must be inside the factory closure** — declare every function
   inside `createXxxService({ prisma })`, never at module scope. Functions outside the
   factory cannot access `prisma` and will throw `ReferenceError` at runtime.

4. **Never generate UUIDs in JavaScript** — the `id` column has `DEFAULT uuidv7()` in
   PostgreSQL. Use `INSERT ... RETURNING *` and let the database produce the ID.

---

## Creating a new module

Use the scaffolder CLI — it generates all files correctly in one command:

```bash
node scripts/scaffold-module.js                         # interactive
node scripts/scaffold-module.js my-module.config.json   # from JSON config
```

See `docs/ai-context/ame3-modules.md` §2 for the config JSON format.

---

## Modifying an existing module

Edit files directly. Follow the patterns in `docs/ai-context/ame3-modules.md`.
After changes: `curl -X POST http://localhost:4010/modules/sync -H "Authorization: Bearer $ATLAS_TOKEN"`

---

## Reference implementation

`modules/custom/custom.fleet/` is the canonical example of a complete AME3 module.

---

## Tech stack quick reference

- API: Node.js + Hono (`apps/api/`)
- Frontend: React + Vite + Tauri (`apps/desktop/`)
- DB: Supabase PostgreSQL via Prisma (`prisma/schema.prisma` for core tables only)
- Module engine: `@atlas/module-engine` — `defineAtlasModule`, `defineModel`, `defineView`, `definePage`
- Tests: Node.js built-in `node:test` (no Jest/Vitest)
- Style: JavaScript only, no TypeScript, Tailwind CSS, all UI text in Spanish
```

- [ ] **Step 2: Verify**

```bash
grep -c "docs/ai-context/ame3-modules.md" AGENTS.md
grep -c "Never edit.*prisma/schema.prisma" AGENTS.md
grep -c "factory closure" AGENTS.md
grep -c "Never generate UUIDs" AGENTS.md
```

Expected: each returns `1` or more.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add AGENTS.md spoke for Codex/OpenAI agents"
```

---

## Task 4: Create `.github/copilot-instructions.md` — Copilot spoke

**Files:**
- Create: `.github/copilot-instructions.md`

- [ ] **Step 1: Ensure `.github/` directory exists**

```bash
# Check if it exists
ls .github/ 2>/dev/null || mkdir .github
```

- [ ] **Step 2: Write `.github/copilot-instructions.md`**

Create the file with this exact content:

```markdown
# Atlas ERP v2 — GitHub Copilot Instructions

## Module system

ERP features live under `modules/custom/<moduleKey>/` as self-contained **AME3 modules**.
Full guide with code examples: `docs/ai-context/ame3-modules.md` — read it before
suggesting module code.

### Rules that break the app when violated

- **Do NOT edit `prisma/schema.prisma`** for module tables — use `defineModel` + `POST /modules/sync`
- **Do NOT use `prisma.<model>` for AME3 tables** — use `prisma.$queryRaw` tagged templates
- **Declare ALL service functions inside `createXxxService({ prisma })`** — never at module scope.
  Functions outside the factory cannot access `prisma` and will throw `ReferenceError` at runtime.
- **Do NOT call `uuidv7()` in JavaScript** — let the database generate IDs via `DEFAULT uuidv7()`

### Creating a new module

```bash
node scripts/scaffold-module.js   # interactive, generates all files correctly
```

### Reference implementation

`modules/custom/custom.fleet/` — canonical AME3 module example.

## General conventions

- JavaScript only (no TypeScript)
- All UI text in Spanish
- Tailwind CSS for all styles
- `node:test` for tests (no Jest/Vitest)
- UUID v7 only (no cuid, no uuid v4)
- Soft delete: `enabled = false`, never hard-delete
- Hono for API routes — keep routes thin, business logic in service files
```

- [ ] **Step 3: Verify**

```bash
grep -c "docs/ai-context/ame3-modules.md" .github/copilot-instructions.md
grep -c "Do NOT edit.*prisma/schema.prisma" .github/copilot-instructions.md
grep -c "createXxxService" .github/copilot-instructions.md
```

Expected: each returns `1` or more.

- [ ] **Step 4: Commit**

```bash
git add .github/copilot-instructions.md
git commit -m "docs: add GitHub Copilot instructions spoke"
```

---

## Task 5: Final verification

- [ ] **Step 1: Confirm all four files exist**

```bash
ls -la docs/ai-context/ame3-modules.md AGENTS.md .github/copilot-instructions.md
grep -n "AME3 custom module" CLAUDE.md
```

Expected: three files found, one grep match in CLAUDE.md.

- [ ] **Step 2: Confirm the four critical rules appear in all three spokes**

```bash
echo "=== CLAUDE.md ===" && grep -c "prisma/schema.prisma\|queryRaw\|factory closure\|uuidv7\|createXxxService\|Never generate" CLAUDE.md
echo "=== AGENTS.md ===" && grep -c "prisma/schema.prisma\|queryRaw\|factory closure\|uuidv7" AGENTS.md
echo "=== copilot-instructions ===" && grep -c "prisma/schema.prisma\|queryRaw\|createXxxService\|uuidv7" .github/copilot-instructions.md
```

Expected: each echo block shows 3 or more matches.

- [ ] **Step 3: Confirm hub has comprehensive coverage**

```bash
grep -c "prisma.\$queryRaw\|prisma.\$queryRawUnsafe" docs/ai-context/ame3-modules.md
grep -c "auditLog.create" docs/ai-context/ame3-modules.md
grep -c "setContactEnabled\|setXxxEnabled" docs/ai-context/ame3-modules.md
grep -c "CUSTOM" docs/ai-context/ame3-modules.md
grep -c "register(registry)" docs/ai-context/ame3-modules.md
```

Expected: each returns 1 or more.

- [ ] **Step 4: Final commit if any files were adjusted**

```bash
git status
# If clean, nothing to do.
# If there are changes from verification fixes:
git add -p
git commit -m "docs: finalize AI context system for AME3 modules"
```
