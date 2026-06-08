# Fleet Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `custom.fleet` to production quality: remove all legacy maintenance models, add insurance policy entity with vehicle integration, and fix UX/validation gaps.

**Architecture:** AME3 pattern throughout — defineModel + defineView + Hono route factory + Zod validators. Insurance is a new standalone entity (`fleet.insurance_policy`) that enriches vehicle list and detail views. No Prisma schema changes; Atlas ORM manages all fleet tables.

**Tech Stack:** Node.js ESM, Hono, Zod (imported from `apps/api/node_modules/zod`), raw SQL via `prisma.$queryRaw`, `@atlas/module-engine` primitives, React/Tailwind for the badge component.

---

## File Structure

### Deleted
```
modules/custom/custom.fleet/models/maintenance.model.js
modules/custom/custom.fleet/models/maintenance-type.model.js
modules/custom/custom.fleet/models/maintenance-document.model.js
modules/custom/custom.fleet/views/maintenance.table.js
modules/custom/custom.fleet/views/maintenance.form.js
modules/custom/custom.fleet/views/maintenance.detail.js
modules/custom/custom.fleet/views/maintenance.page.js
modules/custom/custom.fleet/views/catalog.maintenance-types.table.js
modules/custom/custom.fleet/views/catalog.maintenance-types.form.js
modules/custom/custom.fleet/views/catalog.maintenance-types.page.js
modules/custom/custom.fleet/api/maintenance-routes.js
modules/custom/custom.fleet/api/maintenance-service.js
```

### Created
```
modules/custom/custom.fleet/models/insurance-policy.model.js     — defineModel for fleet_insurance_policy
modules/custom/custom.fleet/views/insurance-policy.table.js      — TABLE view for insurance list
modules/custom/custom.fleet/views/insurance-policy.form.js       — FORM view for create/edit
modules/custom/custom.fleet/views/insurance-policy.detail.js     — DETAIL view read-only
modules/custom/custom.fleet/views/insurance-policy.page.js       — PAGE route /app/m/custom.fleet/insurance
modules/custom/custom.fleet/api/insurance-service.js             — createInsuranceService factory
modules/custom/custom.fleet/api/insurance-routes.js              — createInsuranceRouter factory
modules/custom/custom.fleet/components/InsuranceBadgeCell.jsx    — badge: active/expired/none
modules/custom/custom.fleet/api/__tests__/insurance-routes-auth.test.js  — auth contract tests
scripts/fleet-legacy-cleanup.mjs                                  — one-shot drop of legacy tables
```

### Modified
```
modules/custom/custom.fleet/module.manifest.js       — remove legacy; add insurance model/views/perms/nav; bump version
modules/custom/custom.fleet/validators/index.js      — remove maintenance schemas; add insurance schemas; fix update vehicle
modules/custom/custom.fleet/api/catalogs-routes.js   — remove maintenance-type imports; add brand_id/type_id filter
modules/custom/custom.fleet/api/vehicles-routes.js   — mount insurance router; add /fleet/vehicles/:id/insurance endpoint
modules/custom/custom.fleet/api/fleet-service.js     — add insurance_status to listVehicles; add active_insurance_policy to getVehicle
modules/custom/custom.fleet/views/vehicle.table.js   — add insurance_status column
modules/custom/custom.fleet/views/vehicle.detail.js  — add insurance relation-card + relation-list sections
modules/custom/custom.fleet/views/vehicle.form.js    — add dependsOn to vehicle_model_id picker
modules/custom/custom.fleet/components/index.js      — register InsuranceBadgeCell
```

---

## Task 1: Delete legacy files

**Files:** 12 files to delete

- [ ] **Step 1: Delete legacy model files**

```bash
cd atlaserp
rm modules/custom/custom.fleet/models/maintenance.model.js
rm modules/custom/custom.fleet/models/maintenance-type.model.js
rm modules/custom/custom.fleet/models/maintenance-document.model.js
```

- [ ] **Step 2: Delete legacy view files**

```bash
rm modules/custom/custom.fleet/views/maintenance.table.js
rm modules/custom/custom.fleet/views/maintenance.form.js
rm modules/custom/custom.fleet/views/maintenance.detail.js
rm modules/custom/custom.fleet/views/maintenance.page.js
rm modules/custom/custom.fleet/views/catalog.maintenance-types.table.js
rm modules/custom/custom.fleet/views/catalog.maintenance-types.form.js
rm modules/custom/custom.fleet/views/catalog.maintenance-types.page.js
```

- [ ] **Step 3: Delete legacy API files**

```bash
rm modules/custom/custom.fleet/api/maintenance-routes.js
rm modules/custom/custom.fleet/api/maintenance-service.js
```

Note: `maintenance-routes.js` is already not imported in `vehicles-routes.js` — it is a disk orphan. Deleting it only.

- [ ] **Step 4: Verify deletions**

```bash
ls modules/custom/custom.fleet/models/ | grep maintenance
ls modules/custom/custom.fleet/views/ | grep maintenance
ls modules/custom/custom.fleet/api/ | grep maintenance
```

Expected: no output from any of the three commands.

---

## Task 2: Update module.manifest.js — remove legacy

**Files:** Modify `modules/custom/custom.fleet/module.manifest.js`

- [ ] **Step 1: Remove legacy model paths from `models` array**

Remove these three lines from the `models` array:
```js
"./models/maintenance.model.js",
"./models/maintenance-type.model.js",
"./models/maintenance-document.model.js",
```

- [ ] **Step 2: Remove legacy view paths from `views` array**

Remove these six lines from the `views` array:
```js
"./views/catalog.maintenance-types.table.js",
"./views/catalog.maintenance-types.form.js",
"./views/catalog.maintenance-types.page.js",
```
(The `maintenance.table.js`, `.form.js`, `.detail.js`, `.page.js` were never in the manifest views array — disk-only files.)

- [ ] **Step 3: Remove legacy from `lifecycle.ownedModels` and `lifecycle.ownedTables`**

From `ownedModels`, remove:
```js
"fleet.maintenance",
"fleet.maintenance_type",
"fleet.maintenance_document",
```

From `ownedTables`, remove:
```js
"fleet_maintenance",
"fleet_maintenance_type",
"fleet_maintenance_document",
```

- [ ] **Step 4: Remove legacy from `acl.models`**

Remove the entire `Maintenance`, `MaintenanceDocument`, and `MaintenanceType` blocks from `acl.models`:
```js
Maintenance: { read: ..., create: ..., update: ..., delete: ... },
MaintenanceDocument: { read: ..., create: ..., update: ..., delete: ... },
MaintenanceType: { read: ..., create: ..., update: ..., delete: ... },
```

- [ ] **Step 5: Remove "Tipos de mantenimiento" from navigation**

In the `navigation` array, find the `Catalogos` entry and remove its child:
```js
{ label: "Tipos de mantenimiento", path: "/app/m/custom.fleet/catalogs/maintenance-types", permissionKey: "fleet.catalogs.read" },
```

- [ ] **Step 6: Bump version to 0.5.0**

Change `version: "0.4.3"` → `version: "0.5.0"`.

- [ ] **Step 7: Syntax check**

```bash
node --check modules/custom/custom.fleet/module.manifest.js
```

Expected: no output (no errors).

---

## Task 3: Update validators/index.js — remove maintenance, fix update schema

**Files:** Modify `modules/custom/custom.fleet/validators/index.js`

- [ ] **Step 1: Remove `maintenanceTypeSchema` (line 6)**

Delete:
```js
const maintenanceTypeSchema = z.enum(['preventive', 'corrective', 'inspection'])
```

- [ ] **Step 2: Remove legacy maintenance schemas (lines 88-130 and 202-210)**

Delete these blocks entirely:
```js
const maintenanceStatusSchema = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled'])
const isoDateTimeSchema = z.string().refine(
  (v) => !Number.isNaN(new Date(v).getTime()),
  { message: 'Debe ser una fecha y hora ISO valida.' }
)

export const createMaintenanceSchema = z.object({ ... }) // lines 94-111

export const updateMaintenanceSchema = z.object({ ... }) // lines 113-130
```

And:
```js
export const createMaintenanceTypeSchema = z.object({ ... }) // lines 202-205
export const updateMaintenanceTypeSchema = z.object({ ... }) // lines 207-210
```

- [ ] **Step 3: Fix `updateVehicleSchema` — add orphaned financing data check**

The current `updateVehicleSchema.superRefine` only checks date ordering. Add the orphaned-data check to match `createVehicleSchema`:

```js
export const updateVehicleSchema = z.object({
  // ... (all existing fields unchanged)
}).superRefine((value, ctx) => {
  if (value.financing_start_date && value.financing_end_date && value.financing_end_date < value.financing_start_date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['financing_end_date'], message: 'La fecha fin no puede ser menor a la fecha inicio del financiamiento.' })
  }
  if (value.is_financed === false) {
    const hasFinancingData =
      Boolean(value.financing_institution) ||
      Boolean(value.financing_contract_number) ||
      Boolean(value.financing_start_date) ||
      Boolean(value.financing_end_date) ||
      (value.financing_monthly_payment !== undefined && value.financing_monthly_payment !== null) ||
      Boolean(value.financing_notes)
    if (hasFinancingData) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['is_financed'], message: 'Activa "Vehiculo financiado" para capturar datos de financiamiento.' })
    }
  }
})
```

- [ ] **Step 4: Syntax check**

```bash
node --check modules/custom/custom.fleet/validators/index.js
```

Expected: no output.

---

## Task 4: Update catalogs-routes.js — remove maintenance-type imports and add vehicle-model filter

**Files:** Modify `modules/custom/custom.fleet/api/catalogs-routes.js`

- [ ] **Step 1: Remove maintenance-type schema imports**

From the imports at the top of the file, remove:
```js
  createMaintenanceTypeSchema,
  updateMaintenanceTypeSchema,
```

- [ ] **Step 2: Find vehicle-models list endpoint and add brand_id/type_id filter**

Find `GET /fleet/catalogs/vehicle-models` in catalogs-routes.js. The current query fetches all models for the company. Add optional filtering:

```js
app.get('/fleet/catalogs/vehicle-models', requirePermission('fleet.catalogs.read'), async (c) => {
  try {
    const companyId = getCompanyIdFromContext(c)
    const brandId = c.req.query('brand_id') ?? null
    const typeId = c.req.query('type_id') ?? null
    const result = await service.listVehicleModels({ companyId, brandId, typeId })
    return c.json(result)
  } catch (err) {
    return handleRouteError(c, err, { fallbackError: 'No se pudieron listar los modelos.', route: '/fleet/catalogs/vehicle-models', moduleKey, operation: 'listVehicleModels' })
  }
})
```

Then update `catalog-service.js` `listVehicleModels` function to accept and apply `brandId` and `typeId` optional filters. Find the function and add WHERE conditions:

```js
async function listVehicleModels({ companyId, brandId = null, typeId = null }) {
  const safeCompanyId = toScopedCompanyUuid(companyId)
  return withDbErrorMapping(async () => {
    const rows = await prisma.$queryRaw`
      SELECT vm.*, vb.name AS brand_name, vt.name AS type_name
      FROM fleet_vehicle_model vm
      LEFT JOIN fleet_vehicle_brand vb ON vb.id = vm.brand_id AND vb.company_id = vm.company_id
      LEFT JOIN fleet_vehicle_type vt ON vt.id = vm.type_id AND vt.company_id = vm.company_id
      WHERE vm.company_id = ${safeCompanyId}
        AND vm.enabled = true
        ${brandId ? prisma.$queryRaw`AND vm.brand_id = ${brandId}` : prisma.$queryRaw``}
        ${typeId ? prisma.$queryRaw`AND vm.type_id = ${typeId}` : prisma.$queryRaw``}
      ORDER BY vb.name, vm.name, vm.year
    `
    return { data: rows }
  })
}
```

Note: if the current `listVehicleModels` uses `$queryRawUnsafe` or a different approach, adapt accordingly — keep the same SQL structure, just add two optional AND clauses.

- [ ] **Step 3: Remove the maintenance-type CRUD route handlers**

Delete the following route blocks from catalogs-routes.js:
- `GET /fleet/catalogs/maintenance-types`
- `POST /fleet/catalogs/maintenance-types`
- `GET /fleet/catalogs/maintenance-types/:id`
- `PATCH /fleet/catalogs/maintenance-types/:id`
- `PATCH /fleet/catalogs/maintenance-types/:id/enabled`

- [ ] **Step 4: Syntax check**

```bash
node --check modules/custom/custom.fleet/api/catalogs-routes.js
node --check modules/custom/custom.fleet/api/catalog-service.js
```

Expected: no output.

---

## Task 5: Create insurance-policy model

**Files:** Create `modules/custom/custom.fleet/models/insurance-policy.model.js`

- [ ] **Step 1: Write the model file**

```js
import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'insurance_policy',
  name: 'fleet.insurance_policy',
  label: 'Poliza de seguro',
  tableName: 'fleet_insurance_policy',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'vehicle_id',        type: 'relation', label: 'Vehiculo',          relatedModel: 'fleet.vehicle', required: true },
    { name: 'insurer_name',      type: 'text',     label: 'Aseguradora',       required: true, maxLength: 100 },
    { name: 'policy_number',     type: 'text',     label: 'Numero de poliza',  required: true, maxLength: 50 },
    { name: 'coverage_type',     type: 'select',   label: 'Tipo de cobertura',
      options: ['basic', 'comprehensive', 'third_party', 'other'] },
    { name: 'start_date',        type: 'date',     label: 'Inicio de vigencia', required: true },
    { name: 'expiry_date',       type: 'date',     label: 'Fin de vigencia',    required: true },
    { name: 'premium',           type: 'decimal',  label: 'Prima' },
    { name: 'currency',          type: 'text',     label: 'Moneda',            maxLength: 3, default: 'MXN' },
    { name: 'notes',             type: 'textarea', label: 'Notas',             maxLength: 3000 },
    { name: 'document_asset_id', type: 'file',     label: 'Certificado (archivo)' },
  ],
  indexes: [
    { fields: ['company_id', 'vehicle_id'] },
    { fields: ['company_id', 'policy_number'], unique: true },
    { fields: ['company_id', 'expiry_date'] },
  ],
})
```

- [ ] **Step 2: Syntax check**

```bash
node --check modules/custom/custom.fleet/models/insurance-policy.model.js
```

Expected: no output.

---

## Task 6: Add insurance schemas to validators/index.js

**Files:** Modify `modules/custom/custom.fleet/validators/index.js`

- [ ] **Step 1: Add insurance schemas at the end of the file**

```js
const coverageTypeSchema = z.enum(['basic', 'comprehensive', 'third_party', 'other'])

export const createInsurancePolicySchema = z.object({
  vehicle_id:          z.string().uuid('ID de vehiculo invalido.'),
  insurer_name:        z.string().min(1, 'La aseguradora es requerida.').max(100),
  policy_number:       z.string().min(1, 'El numero de poliza es requerido.').max(50),
  coverage_type:       coverageTypeSchema.nullable().optional(),
  start_date:          isoDateSchema,
  expiry_date:         isoDateSchema,
  premium:             z.number().min(0, 'La prima no puede ser negativa.').nullable().optional(),
  currency:            z.string().length(3, 'La moneda debe ser un codigo de 3 letras.').default('MXN'),
  notes:               z.string().max(3000).nullable().optional(),
  document_asset_id:   z.string().uuid('ID de archivo invalido.').nullable().optional(),
}).refine(d => d.expiry_date >= d.start_date, {
  message: 'La fecha de vencimiento debe ser igual o posterior al inicio de vigencia.',
  path: ['expiry_date'],
})

export const updateInsurancePolicySchema = z.object({
  vehicle_id:          z.string().uuid().optional(),
  insurer_name:        z.string().min(1).max(100).optional(),
  policy_number:       z.string().min(1).max(50).optional(),
  coverage_type:       coverageTypeSchema.nullable().optional(),
  start_date:          isoDateSchema.optional(),
  expiry_date:         isoDateSchema.optional(),
  premium:             z.number().min(0).nullable().optional(),
  currency:            z.string().length(3).optional(),
  notes:               z.string().max(3000).nullable().optional(),
  document_asset_id:   z.string().uuid().nullable().optional(),
}).refine(d => {
  if (d.start_date && d.expiry_date) return d.expiry_date >= d.start_date
  return true
}, {
  message: 'La fecha de vencimiento debe ser igual o posterior al inicio de vigencia.',
  path: ['expiry_date'],
})
```

- [ ] **Step 2: Syntax check**

```bash
node --check modules/custom/custom.fleet/validators/index.js
```

Expected: no output.

---

## Task 7: Write insurance auth contract test (TDD — write first)

**Files:** Create `modules/custom/custom.fleet/api/__tests__/insurance-routes-auth.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import createFleetRouter from '../vehicles-routes.js'

const COMPANY_ID = '11111111-1111-7111-a111-111111111111'

function buildPrismaStub() {
  let rawCalls = 0
  return {
    auditLog: { create: async () => ({ id: 'audit-1' }) },
    async $queryRaw() {
      rawCalls += 1
      if (rawCalls % 2 === 1) return []
      return [{ total: '0' }]
    },
    async $queryRawUnsafe() { return [] },
  }
}

function buildRequirePermission(allowedKeys = []) {
  const allowed = new Set(allowedKeys)
  return (permissionKey) => async (c, next) => {
    if (!allowed.has(permissionKey)) return c.json({ error: 'Forbidden' }, 403)
    await next()
  }
}

function createApp({ userContext, allowedPermissions = [] }) {
  const app = new Hono()
  app.use('*', async (c, next) => { c.set('userContext', userContext); await next() })
  app.route('/', createFleetRouter({
    prisma: buildPrismaStub(),
    requirePermission: buildRequirePermission(allowedPermissions),
    moduleContext: { moduleKey: 'custom.fleet' },
  }))
  return app
}

const USER_CTX = { profile: { id: 'actor-1' }, memberships: [{ companyId: COMPANY_ID }] }

test('insurance-routes auth: GET /fleet/insurance — 403 without permission', async () => {
  const app = createApp({ userContext: USER_CTX, allowedPermissions: [] })
  const res = await app.request('/fleet/insurance')
  assert.equal(res.status, 403)
})

test('insurance-routes auth: GET /fleet/insurance — 200 with fleet.insurance.read', async () => {
  const app = createApp({ userContext: USER_CTX, allowedPermissions: ['fleet.insurance.read'] })
  const res = await app.request('/fleet/insurance')
  assert.equal(res.status, 200)
})

test('insurance-routes auth: POST /fleet/insurance — 403 without create permission', async () => {
  const app = createApp({ userContext: USER_CTX, allowedPermissions: ['fleet.insurance.read'] })
  const res = await app.request('/fleet/insurance', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } })
  assert.equal(res.status, 403)
})

test('insurance-routes auth: GET /fleet/vehicles/:id/insurance — 200 with vehicles.read', async () => {
  const vehicleId = '22222222-2222-7222-a222-222222222222'
  const app = createApp({ userContext: USER_CTX, allowedPermissions: ['fleet.vehicles.read'] })
  const res = await app.request(`/fleet/vehicles/${vehicleId}/insurance`)
  assert.equal(res.status, 200)
})
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
node --test modules/custom/custom.fleet/api/__tests__/insurance-routes-auth.test.js
```

Expected: tests for `/fleet/insurance` fail because the route does not exist yet (404, not 200 or 403). Tests for `/fleet/vehicles/:id/insurance` may also fail.

---

## Task 8: Create insurance-service.js

**Files:** Create `modules/custom/custom.fleet/api/insurance-service.js`

- [ ] **Step 1: Write the service file**

```js
import {
  normalizePagination,
  normalizeOptionalString,
  isTableNotFoundError,
  isUniqueViolation,
  toCount,
  firstRow,
} from './service-helpers.js'
import { FleetServiceError } from './fleet-service.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function toScopedCompanyUuid(companyId) {
  const n = typeof companyId === 'string' ? companyId.trim() : ''
  if (!n) throw new FleetServiceError('companyId es requerido.', 400)
  if (!UUID_REGEX.test(n)) throw new FleetServiceError('companyId debe ser UUID valido.', 400)
  return n.toLowerCase()
}

function normalizeRecordId(id, msg) {
  const v = String(id ?? '').trim()
  if (!UUID_REGEX.test(v)) throw new FleetServiceError(msg, 404)
  return v.toLowerCase()
}

async function withDbErrorMapping(fn) {
  try {
    return await fn()
  } catch (error) {
    if (isTableNotFoundError(error)) throw new FleetServiceError('Las tablas del modulo no estan disponibles aun.', 503)
    throw error
  }
}

export function createInsuranceService({ prisma }) {
  async function listPolicies({ companyId, vehicleId = null, active = null, page, pageSize }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const pagination = normalizePagination({ page, pageSize })
    const safeVehicleId = vehicleId ? normalizeRecordId(vehicleId, 'vehicleId invalido.') : null

    const [rows, totalRows] = await withDbErrorMapping(async () => {
      const dataRows = await prisma.$queryRaw`
        SELECT
          ip.*,
          fv.plate AS vehicle_plate,
          (ip.enabled = true AND ip.expiry_date >= CURRENT_DATE) AS is_active
        FROM fleet_insurance_policy ip
        LEFT JOIN fleet_vehicle fv ON fv.id = ip.vehicle_id AND fv.company_id = ip.company_id
        WHERE ip.company_id = ${safeCompanyId}
          AND ip.enabled = true
          ${safeVehicleId ? prisma.$queryRaw`AND ip.vehicle_id = ${safeVehicleId}` : prisma.$queryRaw``}
          ${active === true ? prisma.$queryRaw`AND ip.expiry_date >= CURRENT_DATE` : active === false ? prisma.$queryRaw`AND ip.expiry_date < CURRENT_DATE` : prisma.$queryRaw``}
        ORDER BY ip.expiry_date DESC
        LIMIT ${pagination.limit} OFFSET ${pagination.offset}
      `
      const countRow = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM fleet_insurance_policy ip
        WHERE ip.company_id = ${safeCompanyId}
          AND ip.enabled = true
          ${safeVehicleId ? prisma.$queryRaw`AND ip.vehicle_id = ${safeVehicleId}` : prisma.$queryRaw``}
      `
      return [dataRows, toCount(countRow)]
    })

    return { data: rows, total: totalRows, page: pagination.page, pageSize: pagination.pageSize }
  }

  async function createPolicy({ companyId, data }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)

    return withDbErrorMapping(async () => {
      // Check uniqueness of policy_number within company
      const existing = await prisma.$queryRaw`
        SELECT id FROM fleet_insurance_policy
        WHERE company_id = ${safeCompanyId} AND policy_number = ${data.policy_number} AND enabled = true
        LIMIT 1
      `
      if (existing.length > 0) {
        throw new FleetServiceError('Ya existe una poliza activa con ese numero en esta empresa.', 409)
      }

      const rows = await prisma.$queryRaw`
        INSERT INTO fleet_insurance_policy (
          id, company_id, vehicle_id, insurer_name, policy_number,
          coverage_type, start_date, expiry_date, premium, currency,
          notes, document_asset_id, enabled, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${safeCompanyId}, ${data.vehicle_id}, ${data.insurer_name}, ${data.policy_number},
          ${data.coverage_type ?? null}, ${data.start_date}, ${data.expiry_date},
          ${data.premium ?? null}, ${data.currency ?? 'MXN'},
          ${data.notes ?? null}, ${data.document_asset_id ?? null},
          true, NOW(), NOW()
        )
        RETURNING *
      `
      return firstRow(rows)
    })
  }

  async function getPolicy({ companyId, id }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeId = normalizeRecordId(id, 'Poliza no encontrada.')

    return withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        SELECT ip.*, fv.plate AS vehicle_plate,
          (ip.expiry_date >= CURRENT_DATE) AS is_active
        FROM fleet_insurance_policy ip
        LEFT JOIN fleet_vehicle fv ON fv.id = ip.vehicle_id AND fv.company_id = ip.company_id
        WHERE ip.id = ${safeId} AND ip.company_id = ${safeCompanyId} AND ip.enabled = true
        LIMIT 1
      `
      const row = firstRow(rows)
      if (!row) throw new FleetServiceError('Poliza no encontrada.', 404)
      return row
    })
  }

  async function updatePolicy({ companyId, id, data }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeId = normalizeRecordId(id, 'Poliza no encontrada.')

    return withDbErrorMapping(async () => {
      // If policy_number is changing, check uniqueness
      if (data.policy_number !== undefined) {
        const existing = await prisma.$queryRaw`
          SELECT id FROM fleet_insurance_policy
          WHERE company_id = ${safeCompanyId}
            AND policy_number = ${data.policy_number}
            AND id != ${safeId}
            AND enabled = true
          LIMIT 1
        `
        if (existing.length > 0) {
          throw new FleetServiceError('Ya existe una poliza activa con ese numero en esta empresa.', 409)
        }
      }

      // Build SET clause dynamically
      const fields = [
        ['vehicle_id', data.vehicle_id],
        ['insurer_name', data.insurer_name],
        ['policy_number', data.policy_number],
        ['coverage_type', data.coverage_type],
        ['start_date', data.start_date],
        ['expiry_date', data.expiry_date],
        ['premium', data.premium],
        ['currency', data.currency],
        ['notes', data.notes],
        ['document_asset_id', data.document_asset_id],
      ].filter(([, v]) => v !== undefined)

      if (fields.length === 0) throw new FleetServiceError('No hay campos para actualizar.', 400)

      const rows = await prisma.$queryRaw`
        UPDATE fleet_insurance_policy
        SET ${prisma.$queryRaw(fields.map(([k]) => `${k} = $${k}`).join(', '))}, updated_at = NOW()
        WHERE id = ${safeId} AND company_id = ${safeCompanyId} AND enabled = true
        RETURNING *
      `
      const row = firstRow(rows)
      if (!row) throw new FleetServiceError('Poliza no encontrada.', 404)
      return row
    })
  }

  async function disablePolicy({ companyId, id }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeId = normalizeRecordId(id, 'Poliza no encontrada.')

    return withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        UPDATE fleet_insurance_policy
        SET enabled = false, updated_at = NOW()
        WHERE id = ${safeId} AND company_id = ${safeCompanyId} AND enabled = true
        RETURNING id
      `
      if (firstRow(rows) === null) throw new FleetServiceError('Poliza no encontrada.', 404)
      return { success: true }
    })
  }

  async function listVehiclePolicies({ companyId, vehicleId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeVehicleId = normalizeRecordId(vehicleId, 'vehicleId invalido.')

    return withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        SELECT ip.*, (ip.expiry_date >= CURRENT_DATE) AS is_active
        FROM fleet_insurance_policy ip
        WHERE ip.company_id = ${safeCompanyId}
          AND ip.vehicle_id = ${safeVehicleId}
          AND ip.enabled = true
        ORDER BY ip.expiry_date DESC
      `
      return { data: rows }
    })
  }

  async function getActivePolicyForVehicle({ companyId, vehicleId }) {
    const safeCompanyId = toScopedCompanyUuid(companyId)
    const safeVehicleId = normalizeRecordId(vehicleId, 'vehicleId invalido.')

    return withDbErrorMapping(async () => {
      const rows = await prisma.$queryRaw`
        SELECT id, insurer_name, policy_number, coverage_type, expiry_date,
          (expiry_date >= CURRENT_DATE) AS is_active
        FROM fleet_insurance_policy
        WHERE company_id = ${safeCompanyId}
          AND vehicle_id = ${safeVehicleId}
          AND enabled = true
        ORDER BY expiry_date DESC
        LIMIT 1
      `
      return firstRow(rows) ?? null
    })
  }

  return {
    listPolicies,
    createPolicy,
    getPolicy,
    updatePolicy,
    disablePolicy,
    listVehiclePolicies,
    getActivePolicyForVehicle,
  }
}
```

**Implementation note on `updatePolicy`:** The dynamic SET clause above uses a simplified pseudo-SQL. In practice, use the same pattern as fleet-service.js `updateVehicle` — build partial update fields and use `$queryRawUnsafe` or individual Prisma field updates. Adapt as needed to match the pattern in `fleet-service.js`.

- [ ] **Step 2: Syntax check**

```bash
node --check modules/custom/custom.fleet/api/insurance-service.js
```

Expected: no output.

---

## Task 9: Create insurance-routes.js and mount it

**Files:**
- Create `modules/custom/custom.fleet/api/insurance-routes.js`
- Modify `modules/custom/custom.fleet/api/vehicles-routes.js`

- [ ] **Step 1: Write insurance-routes.js**

```js
import { Hono } from 'hono'
import { z } from 'zod'
import { createInsurancePolicySchema, updateInsurancePolicySchema } from '../validators/index.js'
import { createInsuranceService } from './insurance-service.js'
import { FleetServiceError } from './fleet-service.js'

const insuranceEnabledSchema = z.object({ enabled: z.boolean() })

function getValidationErrorMessage(error) {
  const issue = error?.issues?.[0]
  if (!issue) return 'Datos invalidos.'
  const path = Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join('.') : null
  return path ? `Datos invalidos en ${path}: ${issue.message}` : `Datos invalidos: ${issue.message}`
}

function getCompanyIdFromContext(c) {
  const companyId = c.get('userContext')?.memberships?.[0]?.companyId
  return typeof companyId === 'string' && companyId.trim() ? companyId.trim() : null
}

function handleRouteError(c, err, { fallbackError, route, moduleKey, operation }) {
  if (err instanceof FleetServiceError) return c.json({ error: err.message }, err.status)
  if (process.env.NODE_ENV !== 'production') {
    console.error('[custom.fleet] route error', { route, moduleKey, operation, error: { name: err?.name, message: err?.message } })
  }
  return c.json({ error: fallbackError }, 500)
}

export function createInsuranceRouter({ prisma, requirePermission, moduleContext }) {
  const app = new Hono()
  const service = createInsuranceService({ prisma })
  const moduleKey = moduleContext?.moduleKey ?? 'custom.fleet'

  app.get('/fleet/insurance', requirePermission('fleet.insurance.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const vehicleId = c.req.query('vehicle_id') ?? null
      const activeParam = c.req.query('active')
      const active = activeParam === 'true' ? true : activeParam === 'false' ? false : null
      const result = await service.listPolicies({ companyId, vehicleId, active, page: c.req.query('page'), pageSize: c.req.query('pageSize') })
      return c.json(result)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudieron listar las polizas.', route: '/fleet/insurance', moduleKey, operation: 'listPolicies' })
    }
  })

  app.post('/fleet/insurance', requirePermission('fleet.insurance.create'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const body = await c.req.json()
      const parsed = createInsurancePolicySchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const created = await service.createPolicy({ companyId, data: parsed.data })
      return c.json({ data: created }, 201)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo crear la poliza.', route: '/fleet/insurance', moduleKey, operation: 'createPolicy' })
    }
  })

  app.get('/fleet/insurance/:id', requirePermission('fleet.insurance.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const row = await service.getPolicy({ companyId, id: c.req.param('id') })
      return c.json({ data: row })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo obtener la poliza.', route: '/fleet/insurance/:id', moduleKey, operation: 'getPolicy' })
    }
  })

  app.patch('/fleet/insurance/:id', requirePermission('fleet.insurance.update'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const body = await c.req.json()
      const parsed = updateInsurancePolicySchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const updated = await service.updatePolicy({ companyId, id: c.req.param('id'), data: parsed.data })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo actualizar la poliza.', route: '/fleet/insurance/:id', moduleKey, operation: 'updatePolicy' })
    }
  })

  app.patch('/fleet/insurance/:id/enabled', requirePermission('fleet.insurance.delete'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const body = await c.req.json()
      const parsed = insuranceEnabledSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      if (parsed.data.enabled === false) {
        const result = await service.disablePolicy({ companyId, id: c.req.param('id') })
        return c.json(result)
      }
      return c.json({ error: 'Operacion no soportada.' }, 400)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo desactivar la poliza.', route: '/fleet/insurance/:id/enabled', moduleKey, operation: 'disablePolicy' })
    }
  })

  return app
}
```

- [ ] **Step 2: Mount insurance router in vehicles-routes.js**

At the top of `vehicles-routes.js`, add the import (alongside the other router imports):
```js
import { createInsuranceRouter } from './insurance-routes.js'
```

At the bottom of `createFleetRouter` (alongside the existing `app.route` calls at lines 169-171), add:
```js
app.route('', createInsuranceRouter({ prisma, requirePermission, moduleContext }))
```

Also add the vehicle-scoped insurance endpoint (inside `createFleetRouter`, after the existing vehicle routes):
```js
app.get('/fleet/vehicles/:vehicleId/insurance', requirePermission('fleet.vehicles.read'), async (c) => {
  try {
    const companyId = getCompanyIdFromContext(c)
    const { createInsuranceService } = await import('./insurance-service.js')
    const insuranceService = createInsuranceService({ prisma })
    const result = await insuranceService.listVehiclePolicies({ companyId, vehicleId: c.req.param('vehicleId') })
    return c.json(result)
  } catch (err) {
    return handleRouteError(c, err, { fallbackError: 'No se pudieron listar las polizas del vehiculo.', route: '/fleet/vehicles/:vehicleId/insurance', moduleKey, operation: 'listVehiclePolicies' })
  }
})
```

Note: to avoid circular imports, instantiate `createInsuranceService` directly using a static import at the top of vehicles-routes.js rather than a dynamic import if the service file has no circular dependency. Import it at the top like the other routers.

- [ ] **Step 3: Syntax check**

```bash
node --check modules/custom/custom.fleet/api/insurance-routes.js
node --check modules/custom/custom.fleet/api/vehicles-routes.js
```

Expected: no output.

- [ ] **Step 4: Run the insurance auth test — all tests should now pass**

```bash
node --test modules/custom/custom.fleet/api/__tests__/insurance-routes-auth.test.js
```

Expected: all 4 tests PASS.

---

## Task 10: Create insurance views (4 files)

**Files:** Create 4 view files under `modules/custom/custom.fleet/views/`

- [ ] **Step 1: Create insurance-policy.table.js**

```js
import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.insurance_policy.table',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'insurance_policy',
    component: 'AtlasTable',
    apiPath: '/fleet/insurance',
    primaryField: 'policy_number',
    searchable: false,
    columns: [
      { field: 'vehicle_plate',  label: 'Vehiculo',       sortable: false, link: false },
      { field: 'insurer_name',   label: 'Aseguradora',    sortable: true,  link: true },
      { field: 'policy_number',  label: 'No. Poliza',     sortable: true },
      { field: 'coverage_type',  label: 'Cobertura',      sortable: false },
      { field: 'start_date',     label: 'Inicio',         sortable: true, type: 'date' },
      { field: 'expiry_date',    label: 'Vencimiento',    sortable: true, type: 'date' },
      { field: 'is_active',      label: 'Estado',         sortable: false, type: 'boolean' },
      { field: 'premium',        label: 'Prima',          sortable: false, type: 'currency' },
    ],
    actions: [
      { label: 'Agregar poliza', permission: 'fleet.insurance.create', variant: 'primary' },
    ],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.insurance.read' },
      { label: 'Editar',      permission: 'fleet.insurance.update' },
      { label: 'Desactivar',  permission: 'fleet.insurance.delete' },
    ],
    emptyState: {
      message: 'No hay polizas de seguro registradas.',
    },
  },
})
```

- [ ] **Step 2: Create insurance-policy.form.js**

```js
import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.insurance_policy.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'insurance_policy',
    component: 'AtlasForm',
    apiPath: '/fleet/insurance',
    sections: [
      {
        label: 'Datos de la poliza',
        icon: 'ShieldCheck',
        collapsible: true,
        fields: [
          {
            field: 'vehicle_id',
            label: 'Vehiculo',
            type: 'relation',
            required: true,
            hint: 'Selecciona el vehiculo al que pertenece esta poliza',
            relation: {
              apiPath: '/fleet/vehicles',
              labelField: 'plate',
              pageSize: 50,
              preload: false,
              clearable: false,
              disabledField: 'enabled',
            },
          },
          {
            field: 'insurer_name',
            label: 'Aseguradora',
            type: 'text',
            required: true,
            hint: 'Nombre de la compania aseguradora',
          },
          {
            field: 'policy_number',
            label: 'Numero de poliza',
            type: 'text',
            required: true,
            hint: 'Identificador unico de la poliza',
          },
          {
            field: 'coverage_type',
            label: 'Tipo de cobertura',
            type: 'select',
            options: [
              { value: 'basic',         label: 'Basica' },
              { value: 'comprehensive', label: 'Amplia' },
              { value: 'third_party',   label: 'Terceros' },
              { value: 'other',         label: 'Otra' },
            ],
          },
        ],
      },
      {
        label: 'Vigencia y costo',
        icon: 'CalendarDays',
        collapsible: true,
        fields: [
          { field: 'start_date',  label: 'Inicio de vigencia', type: 'date', required: true },
          { field: 'expiry_date', label: 'Fin de vigencia',    type: 'date', required: true },
          { field: 'premium',     label: 'Prima',              type: 'number' },
          { field: 'currency',    label: 'Moneda',             type: 'text', hint: 'Codigo ISO de 3 letras (MXN, USD...)' },
        ],
      },
      {
        label: 'Observaciones',
        icon: 'FileText',
        collapsible: true,
        fields: [
          { field: 'notes', label: 'Notas', type: 'textarea' },
        ],
      },
    ],
  },
})
```

- [ ] **Step 3: Create insurance-policy.detail.js**

```js
import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.insurance_policy.detail',
  kind: 'DETAIL',
  version: '0.1.0',
  schema: {
    entity: 'insurance_policy',
    component: 'AtlasDetail',
    apiPath: '/fleet/insurance',
    sections: [
      {
        label: 'Datos de la poliza',
        columns: 2,
        fields: [
          { field: 'vehicle_plate',  label: 'Vehiculo',          icon: 'Truck' },
          { field: 'insurer_name',   label: 'Aseguradora',       icon: 'ShieldCheck' },
          { field: 'policy_number',  label: 'No. de poliza',     icon: 'Hash' },
          { field: 'coverage_type',  label: 'Tipo de cobertura', icon: 'Tag' },
          { field: 'is_active',      label: 'Poliza activa',     icon: 'Activity', type: 'boolean' },
        ],
      },
      {
        label: 'Vigencia y costo',
        columns: 2,
        fields: [
          { field: 'start_date',  label: 'Inicio de vigencia', icon: 'CalendarDays', type: 'date' },
          { field: 'expiry_date', label: 'Fin de vigencia',    icon: 'CalendarDays', type: 'date' },
          { field: 'premium',     label: 'Prima',              icon: 'DollarSign',   type: 'currency' },
          { field: 'currency',    label: 'Moneda',             icon: 'Tag' },
        ],
      },
      {
        label: 'Observaciones',
        fields: [
          { field: 'notes', label: 'Notas', icon: 'FileText' },
        ],
      },
    ],
    actions: [
      { label: 'Editar',     permission: 'fleet.insurance.update' },
      { label: 'Desactivar', permission: 'fleet.insurance.delete' },
    ],
  },
})
```

- [ ] **Step 4: Create insurance-policy.page.js**

```js
import { definePage } from '@atlas/module-engine'

export default definePage({
  key: 'fleet.insurance_policy.page',
  path: '/app/m/custom.fleet/insurance',
  title: 'Seguros',
  layout: 'main',
  view: 'fleet.insurance_policy.table',
})
```

- [ ] **Step 5: Syntax check all four files**

```bash
node --check modules/custom/custom.fleet/views/insurance-policy.table.js
node --check modules/custom/custom.fleet/views/insurance-policy.form.js
node --check modules/custom/custom.fleet/views/insurance-policy.detail.js
node --check modules/custom/custom.fleet/views/insurance-policy.page.js
```

Expected: no output from any.

---

## Task 11: Update module.manifest.js — add insurance

**Files:** Modify `modules/custom/custom.fleet/module.manifest.js`

- [ ] **Step 1: Add insurance model path to `models` array**

```js
"./models/insurance-policy.model.js",
```

- [ ] **Step 2: Add insurance view paths to `views` array**

```js
"./views/insurance-policy.table.js",
"./views/insurance-policy.form.js",
"./views/insurance-policy.detail.js",
"./views/insurance-policy.page.js",
```

- [ ] **Step 3: Add insurance to `lifecycle.ownedModels` and `lifecycle.ownedTables`**

```js
// In ownedModels:
"fleet.insurance_policy",
// In ownedTables:
"fleet_insurance_policy",
```

- [ ] **Step 4: Add insurance to `acl.models`**

```js
InsurancePolicy: {
  read:   'fleet.insurance.read',
  create: 'fleet.insurance.create',
  update: 'fleet.insurance.update',
  delete: 'fleet.insurance.delete',
},
```

- [ ] **Step 5: Add insurance permissions to `permissions` array**

```js
{ key: 'fleet.insurance.read',   name: 'Ver polizas de seguro' },
{ key: 'fleet.insurance.create', name: 'Crear polizas de seguro' },
{ key: 'fleet.insurance.update', name: 'Editar polizas de seguro' },
{ key: 'fleet.insurance.delete', name: 'Desactivar polizas de seguro' },
```

- [ ] **Step 6: Add insurance to `acl.actions`**

```js
'fleet.insurance.read':   'fleet.insurance.read',
'fleet.insurance.create': 'fleet.insurance.create',
'fleet.insurance.update': 'fleet.insurance.update',
'fleet.insurance.delete': 'fleet.insurance.delete',
```

- [ ] **Step 7: Add "Seguros" to `navigation` array**

Insert after the "Choferes" entry and before "Catalogos":
```js
{
  label: 'Seguros',
  path: '/app/m/custom.fleet/insurance',
  icon: 'ShieldCheck',
  layout: 'main',
  permissionKey: 'fleet.insurance.read',
},
```

- [ ] **Step 8: Syntax check**

```bash
node --check modules/custom/custom.fleet/module.manifest.js
```

Expected: no output.

---

## Task 12: Create InsuranceBadgeCell and register component

**Files:**
- Create `modules/custom/custom.fleet/components/InsuranceBadgeCell.jsx`
- Modify `modules/custom/custom.fleet/components/index.js`

- [ ] **Step 1: Create InsuranceBadgeCell.jsx**

```jsx
import React from 'react'

const CONFIGS = {
  active:  { label: 'Con poliza', className: 'bg-emerald-100 text-emerald-800' },
  expired: { label: 'Vencida',    className: 'bg-amber-100 text-amber-800' },
  none:    { label: 'Sin poliza', className: 'bg-gray-100 text-gray-600' },
}

export default function InsuranceBadgeCell({ value }) {
  const config = CONFIGS[value] ?? CONFIGS.none
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
```

- [ ] **Step 2: Register in components/index.js**

Open `modules/custom/custom.fleet/components/index.js` and add the import and registration alongside the existing components:

```js
import InsuranceBadgeCell from './InsuranceBadgeCell.jsx'

// Inside the register block (alongside VehicleStatusBadge, etc.):
registry.register('custom.fleet:InsuranceBadgeCell', InsuranceBadgeCell)
```

- [ ] **Step 3: Syntax check**

```bash
node --check modules/custom/custom.fleet/components/index.js
```

Expected: no output.

---

## Task 13: Enrich vehicle list and detail with insurance_status

**Files:** Modify `modules/custom/custom.fleet/api/fleet-service.js`

- [ ] **Step 1: Add insurance_status to listVehicles query**

In `fleet-service.js`, find the `listVehicles` function and its `$queryRaw` SELECT. In the SELECT list (after the existing computed fields like `full_economic_number`), add:

```sql
CASE
  WHEN EXISTS (
    SELECT 1 FROM fleet_insurance_policy ip
    WHERE ip.vehicle_id = fv.id
      AND ip.company_id = fv.company_id
      AND ip.enabled = true
      AND ip.expiry_date >= CURRENT_DATE
  ) THEN 'active'
  WHEN EXISTS (
    SELECT 1 FROM fleet_insurance_policy ip
    WHERE ip.vehicle_id = fv.id
      AND ip.company_id = fv.company_id
      AND ip.enabled = true
  ) THEN 'expired'
  ELSE 'none'
END AS insurance_status,
```

This is a correlated subquery appended to the existing SELECT clause in the raw SQL string. Place it before the final `FROM fleet_vehicle fv` clause.

- [ ] **Step 2: Add active_insurance_policy to getVehicle**

Find the `getVehicle` function. After retrieving the vehicle row, add a call to fetch the active policy:

```js
async function getVehicle({ companyId, id }) {
  const safeCompanyId = toScopedCompanyUuid(companyId)
  const safeId = normalizeRecordId(id, 'Vehiculo no encontrado.')

  return withDbErrorMapping(async () => {
    // ... existing vehicle query ...
    const vehicle = firstRow(rows)
    if (!vehicle) throw new FleetServiceError('Vehiculo no encontrado.', 404)

    // Enrich with active insurance policy
    const policyRows = await prisma.$queryRaw`
      SELECT id, insurer_name, policy_number, coverage_type, expiry_date,
        (expiry_date >= CURRENT_DATE) AS is_active
      FROM fleet_insurance_policy
      WHERE company_id = ${safeCompanyId}
        AND vehicle_id = ${safeId}
        AND enabled = true
      ORDER BY expiry_date DESC
      LIMIT 1
    `
    vehicle.active_insurance_policy = firstRow(policyRows) ?? null

    return vehicle
  })
}
```

- [ ] **Step 3: Syntax check**

```bash
node --check modules/custom/custom.fleet/api/fleet-service.js
```

Expected: no output.

---

## Task 14: Update vehicle.table.js and vehicle.detail.js

**Files:**
- Modify `modules/custom/custom.fleet/views/vehicle.table.js`
- Modify `modules/custom/custom.fleet/views/vehicle.detail.js`

- [ ] **Step 1: Add insurance_status column to vehicle.table.js**

In the `columns` array of `vehicle.table.js`, add after the `status` column:

```js
{
  field: 'insurance_status',
  label: 'Seguro',
  sortable: false,
  component: 'custom.fleet:InsuranceBadgeCell',
},
```

- [ ] **Step 2: Add insurance sections to vehicle.detail.js**

In `vehicle.detail.js`, add two new sections after the existing `assigned_driver` relation-card section and before the `documents` section:

```js
{
  id: 'active_insurance',
  type: 'relation-card',
  label: 'Poliza de seguro activa',
  relationCard: {
    idField: 'active_insurance_policy.id',
    titleField: 'active_insurance_policy.insurer_name',
    subtitleFields: ['active_insurance_policy.policy_number', 'active_insurance_policy.expiry_date'],
    fallbackTitle: 'Sin poliza de seguro activa',
    hrefTemplate: '/app/m/custom.fleet/insurance/:id',
    icon: 'ShieldCheck',
  },
},
{
  id: 'insurance_history',
  type: 'relation-list',
  label: 'Historial de polizas',
  relationList: {
    apiPath: '/fleet/vehicles/:id/insurance',
    columns: [
      { field: 'insurer_name',  label: 'Aseguradora' },
      { field: 'policy_number', label: 'No. Poliza' },
      { field: 'expiry_date',   label: 'Vencimiento', type: 'date' },
      { field: 'is_active',     label: 'Activa', type: 'boolean' },
    ],
    emptyMessage: 'Este vehiculo no tiene polizas registradas.',
  },
},
```

- [ ] **Step 3: Syntax check**

```bash
node --check modules/custom/custom.fleet/views/vehicle.table.js
node --check modules/custom/custom.fleet/views/vehicle.detail.js
```

Expected: no output.

---

## Task 15: Add dependsOn to vehicle.form.js for model picker

**Files:** Modify `modules/custom/custom.fleet/views/vehicle.form.js`

- [ ] **Step 1: Update vehicle_model_id relation field**

Find the `vehicle_model_id` field in `vehicle.form.js` (it already has a `relation` block). Add `dependsOn` to filter options based on selected brand and type:

```js
{
  field: 'vehicle_model_id',
  label: 'Modelo de vehiculo',
  type: 'relation',
  required: true,
  hint: 'Selecciona la marca, modelo y año del vehiculo',
  dependsOn: ['vehicle_brand_id', 'vehicle_type_id'],
  relation: {
    apiPath: '/fleet/catalogs/vehicle-models',
    labelField: ['brand_name', 'name', 'year'],
    labelSeparator: ' · ',
    // ... (keep all existing relation config)
    queryParams: {
      brand_id: '$vehicle_brand_id',
      type_id: '$vehicle_type_id',
    },
  },
},
```

The `queryParams` keys map to query string parameters; values prefixed with `$` reference other form field values. If AtlasForm does not yet support this exact syntax, document it as a forward-compatible declaration and implement the AtlasForm support in the UI layer as a follow-on.

- [ ] **Step 2: Syntax check**

```bash
node --check modules/custom/custom.fleet/views/vehicle.form.js
```

Expected: no output.

---

## Task 16: Run full test suite

- [ ] **Step 1: Run all fleet tests**

```bash
node --test modules/custom/custom.fleet/api/__tests__/fleet-routes-auth.test.js
node --test modules/custom/custom.fleet/api/__tests__/fleet-services.test.js
node --test modules/custom/custom.fleet/api/__tests__/insurance-routes-auth.test.js
```

Expected: all tests PASS.

- [ ] **Step 2: Full build**

```bash
pnpm build
```

Expected: exits with code 0, no errors.

- [ ] **Step 3: Static syntax check on all modified files**

```bash
node --check modules/custom/custom.fleet/module.manifest.js
node --check modules/custom/custom.fleet/validators/index.js
node --check modules/custom/custom.fleet/api/vehicles-routes.js
node --check modules/custom/custom.fleet/api/fleet-service.js
node --check modules/custom/custom.fleet/components/index.js
```

Expected: no output from any.

---

## Task 17: Create and run legacy table cleanup script

**Files:** Create `scripts/fleet-legacy-cleanup.mjs` (one-shot, delete after use)

- [ ] **Step 1: Create the script**

```js
import { createRequire } from 'module'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Dropping legacy fleet maintenance tables...')
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS fleet_maintenance_document CASCADE')
  console.log('  fleet_maintenance_document — done')
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS fleet_maintenance CASCADE')
  console.log('  fleet_maintenance — done')
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS fleet_maintenance_type CASCADE')
  console.log('  fleet_maintenance_type — done')
  console.log('Legacy cleanup complete.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run the script**

```bash
node scripts/fleet-legacy-cleanup.mjs
```

Expected output:
```
Dropping legacy fleet maintenance tables...
  fleet_maintenance_document — done
  fleet_maintenance — done
  fleet_maintenance_type — done
Legacy cleanup complete.
```

- [ ] **Step 3: Delete the script (one-shot)**

```bash
rm scripts/fleet-legacy-cleanup.mjs
```

---

## Task 18: Sync module and smoke test

- [ ] **Step 1: Start dev API (if not running)**

```bash
pnpm dev:api
```

- [ ] **Step 2: Re-sync the fleet module**

```bash
curl -X POST http://localhost:4010/modules/custom.fleet/sync \
  -H "Authorization: Bearer $ATLAS_TOKEN"
```

Expected: `{"success":true}` or similar — no errors about missing models or route conflicts.

- [ ] **Step 3: Smoke test insurance list endpoint**

```bash
curl http://localhost:4010/fleet/insurance \
  -H "Authorization: Bearer $ATLAS_TOKEN"
```

Expected: `{"data":[],"total":0,"page":1,"pageSize":25}` (empty list, 200 OK).

- [ ] **Step 4: Verify maintenance routes are gone**

```bash
curl http://localhost:4010/fleet/catalogs/maintenance-types \
  -H "Authorization: Bearer $ATLAS_TOKEN"
```

Expected: 404 Not Found (route no longer exists).

- [ ] **Step 5: Verify vehicle list includes insurance_status**

```bash
curl "http://localhost:4010/fleet/vehicles?pageSize=1" \
  -H "Authorization: Bearer $ATLAS_TOKEN"
```

Expected: response includes `"insurance_status": "none"` (or `"active"` / `"expired"` depending on data) on each vehicle row.

---

## Task 19: Commit

- [ ] **Step 1: Stage all changes**

```bash
git add modules/custom/custom.fleet/ 
git status
```

Verify: only expected files are staged. The `scripts/fleet-legacy-cleanup.mjs` should NOT appear (already deleted).

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(fleet): expand to production quality v0.5.0

- Remove legacy fleet.maintenance, fleet.maintenance_type, fleet.maintenance_document entities
- Add fleet.insurance_policy entity with full CRUD, permissions, navigation
- Enrich vehicle list with insurance_status badge (active/expired/none)
- Add insurance relation-card and policy history to vehicle detail
- Fix updateVehicleSchema financing orphan-data validation edge case
- Add brand_id/type_id filter to vehicle-models catalog endpoint

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- `full_economic_number` was already computed and shown in the vehicle table — no action needed for that UX item.
- The `updatePolicy` dynamic SET clause in `insurance-service.js` uses a simplified pattern. Check `fleet-service.js` `updateVehicle` for the exact `$queryRawUnsafe` / field-by-field update approach used in this codebase and mirror it.
- `maintenance-routes.js` was already not mounted in `vehicles-routes.js` before this plan — its deletion is safe with no routing impact.
- The `dependsOn` / `queryParams` syntax in `vehicle.form.js` Task 15 is a forward-compatible declaration. If `AtlasForm` does not yet read these keys, the picker still works (shows all models); the filtering activates once the renderer supports it.
- The `relation-list` section type in `vehicle.detail.js` (Task 14) must be supported by `AtlasDetail`. Verify with the existing `reports` relation-list in the vehicle detail — if only `relation-card` is supported, simplify to a card showing active policy only and defer the history list.
