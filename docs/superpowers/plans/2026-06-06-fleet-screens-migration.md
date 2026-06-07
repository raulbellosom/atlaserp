# Fleet Screens Migration — Plan A

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace atlas.fleet's blueprint-driven DB UI with custom React screens that embed blueprint schemas inline, removing the dependency on `modules/official/atlas.fleet/views/` and `BlueprintCrudScreen`.

**Architecture:** Each fleet section gets a dedicated screen file. Blueprint schemas (TABLE/FORM/DETAIL) are copied from `modules/official/atlas.fleet/views/fleet-views.js` and `fleet-catalogs.js` into the screen as JS constants. Screens pass these constants directly to `AtlasCrudView`. Vehicle/driver/insurance screens use sheet mode; reports use page mode. All fleet routes are wired in `ModuleOutlet.jsx`.

**Tech Stack:** React, React Router v6, TanStack Query, `@atlas/ui` (`AtlasCrudView`, `AtlasTable`), `moduleComponentRegistry`, `useParams`/`useNavigate`

---

## File Map

| Status | Path | Responsibility |
|---|---|---|
| Create | `apps/desktop/src/modules/atlas.fleet/screens/VehiclesScreen.jsx` | Vehicles list + form sheet + detail |
| Create | `apps/desktop/src/modules/atlas.fleet/screens/DriversScreen.jsx` | Drivers list + form sheet + detail |
| Create | `apps/desktop/src/modules/atlas.fleet/screens/InsuranceScreen.jsx` | Insurance policies list + form sheet + detail |
| Create | `apps/desktop/src/modules/atlas.fleet/screens/ReportsScreen.jsx` | Tabbed reports list (maintenance/service/repair/other) |
| Create | `apps/desktop/src/modules/atlas.fleet/screens/ReportDetailScreen.jsx` | Detail view for any report type |
| Create | `apps/desktop/src/modules/atlas.fleet/screens/ReportFormPage.jsx` | Full-page form for creating/editing reports |
| Create | `apps/desktop/src/modules/atlas.fleet/screens/CatalogsScreen.jsx` | Tabbed catalogs (vehicle-types/brands/models) |
| Modify | `apps/desktop/src/app/ModuleOutlet.jsx` | Add fleet entries to SCREEN_MAP + resolveScreen logic |

**Reference files (read-only, source for schemas):**
- `modules/official/atlas.fleet/views/fleet-views.js` — VEHICLE_TABLE/FORM/DETAIL, DRIVER_TABLE/FORM/DETAIL, INSURANCE_TABLE/FORM/DETAIL, all REPORT schemas
- `modules/official/atlas.fleet/views/fleet-catalogs.js` — CATALOG schemas for types/brands/models

---

## Task 1: VehiclesScreen.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.fleet/screens/VehiclesScreen.jsx`

- [ ] **Step 1: Create the screen file**

Read `modules/official/atlas.fleet/views/fleet-views.js` first to get `vehicleTable`, `vehicleForm`, `vehicleDetail` schemas. Create the file:

```jsx
// apps/desktop/src/modules/atlas.fleet/screens/VehiclesScreen.jsx
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasCrudView } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { componentRegistry } from '../../../lib/moduleComponentRegistry'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'
const BASE_PATH = '/app/m/atlas.fleet/vehicles'

// Schemas copied from modules/official/atlas.fleet/views/fleet-views.js
// vehicleTable, vehicleForm, vehicleDetail — copy the .schema property of each
const VEHICLE_TABLE = { key: 'fleet.vehicle.table', kind: 'TABLE', schema: /* vehicleTable.schema */ }
const VEHICLE_FORM  = { key: 'fleet.vehicle.form',  kind: 'FORM',  schema: /* vehicleForm.schema  */ }
const VEHICLE_DETAIL = { key: 'fleet.vehicle.detail', kind: 'DETAIL', schema: /* vehicleDetail.schema */ }

function parseModeAndId(wildcard) {
  const segs = String(wildcard ?? '').replace(/^\/+/, '').replace(/^vehicles\/?/, '').split('/').filter(Boolean)
  if (segs[0] === 'new') return { initialMode: 'create', recordId: null }
  if (segs[1] === 'edit') return { initialMode: 'edit', recordId: segs[0] }
  if (segs[0]) return { initialMode: 'detail', recordId: segs[0] }
  return { initialMode: 'list', recordId: null }
}

export default function VehiclesScreen() {
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
      tableBlueprint={VEHICLE_TABLE}
      formBlueprint={VEHICLE_FORM}
      detailBlueprint={VEHICLE_DETAIL}
      token={token}
      apiBaseUrl={API_BASE}
      initialMode={initialMode}
      recordId={recordId}
      onNavigate={handleNavigate}
      componentRegistry={componentRegistry}
    />
  )
}
```

Copy the complete `.schema` from `vehicleTable`, `vehicleForm`, `vehicleDetail` in `fleet-views.js` into the respective consts above (including all sections, columns, actions, attachments).

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.fleet/screens/VehiclesScreen.jsx
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.fleet/screens/VehiclesScreen.jsx
git commit -m "feat(fleet): add VehiclesScreen with inline blueprint schemas"
```

---

## Task 2: DriversScreen.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.fleet/screens/DriversScreen.jsx`

- [ ] **Step 1: Create the screen file**

Read `modules/official/atlas.fleet/views/fleet-views.js` for `driverTable`, `driverForm`. Note: the source has no `driverDetail` export — use the driverForm schema for detail (or create a detail schema modeled after vehicleDetail with driver fields).

```jsx
// apps/desktop/src/modules/atlas.fleet/screens/DriversScreen.jsx
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasCrudView } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { componentRegistry } from '../../../lib/moduleComponentRegistry'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'
const BASE_PATH = '/app/m/atlas.fleet/drivers'

// Schemas from modules/official/atlas.fleet/views/fleet-views.js
const DRIVER_TABLE = { key: 'fleet.driver.table', kind: 'TABLE', schema: /* driverTable.schema */ }
const DRIVER_FORM  = { key: 'fleet.driver.form',  kind: 'FORM',  schema: /* driverForm.schema  */ }
const DRIVER_DETAIL = {
  key: 'fleet.driver.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'driver',
    component: 'AtlasDetail',
    apiPath: '/fleet/drivers',
    sections: [
      {
        label: 'Datos del chofer',
        columns: 2,
        fields: [
          { field: 'full_name', label: 'Nombre completo', icon: 'User' },
          { field: 'phone', label: 'Telefono', icon: 'Phone' },
          { field: 'email', label: 'Correo', icon: 'Mail' },
          { field: 'license_number', label: 'No. Licencia', icon: 'Hash' },
          { field: 'license_type', label: 'Tipo licencia', icon: 'Tag' },
          { field: 'license_expiry_date', label: 'Vencimiento', type: 'date', icon: 'CalendarDays' },
          { field: 'status', label: 'Estado', icon: 'Activity' },
        ],
      },
      {
        id: 'documents',
        type: 'documents',
        label: 'Documentos del chofer',
        documents: {
          listPath: '/fleet/drivers/:id/documents',
          addPath: '/fleet/drivers/:id/documents',
          removePath: '/fleet/drivers/:id/documents/:docId',
          upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetDriver' },
          fields: {
            associationId: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type',
            label: 'label', createdAt: 'created_at', enabled: 'enabled',
            fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes',
          },
          signedUrl: { endpointTemplate: '/files/:fileId/signed-url' },
          permissions: {
            read: 'fleet.drivers.read', create: 'fleet.drivers.update',
            remove: 'fleet.drivers.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read',
          },
        },
      },
    ],
    actions: [
      { label: 'Editar', permission: 'fleet.drivers.update' },
      { label: 'Desactivar', permission: 'fleet.drivers.delete' },
    ],
  },
}

function parseModeAndId(wildcard) {
  const segs = String(wildcard ?? '').replace(/^\/+/, '').replace(/^drivers\/?/, '').split('/').filter(Boolean)
  if (segs[0] === 'new') return { initialMode: 'create', recordId: null }
  if (segs[1] === 'edit') return { initialMode: 'edit', recordId: segs[0] }
  if (segs[0]) return { initialMode: 'detail', recordId: segs[0] }
  return { initialMode: 'list', recordId: null }
}

export default function DriversScreen() {
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
      tableBlueprint={DRIVER_TABLE}
      formBlueprint={DRIVER_FORM}
      detailBlueprint={DRIVER_DETAIL}
      token={token}
      apiBaseUrl={API_BASE}
      initialMode={initialMode}
      recordId={recordId}
      onNavigate={handleNavigate}
      componentRegistry={componentRegistry}
    />
  )
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.fleet/screens/DriversScreen.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.fleet/screens/DriversScreen.jsx
git commit -m "feat(fleet): add DriversScreen with inline blueprint schemas"
```

---

## Task 3: InsuranceScreen.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.fleet/screens/InsuranceScreen.jsx`

- [ ] **Step 1: Create the screen file**

Read `modules/official/atlas.fleet/views/fleet-views.js` for `insurancePolicyPage`, `insurancePolicyTable`, `insurancePolicyForm`, `insurancePolicyDetail`.

```jsx
// apps/desktop/src/modules/atlas.fleet/screens/InsuranceScreen.jsx
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasCrudView } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { componentRegistry } from '../../../lib/moduleComponentRegistry'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'
const BASE_PATH = '/app/m/atlas.fleet/insurance'

// Schemas from modules/official/atlas.fleet/views/fleet-views.js
const INSURANCE_TABLE  = { key: 'fleet.insurance_policy.table',  kind: 'TABLE',  schema: /* insurancePolicyTable.schema  */ }
const INSURANCE_FORM   = { key: 'fleet.insurance_policy.form',   kind: 'FORM',   schema: /* insurancePolicyForm.schema   */ }
const INSURANCE_DETAIL = { key: 'fleet.insurance_policy.detail', kind: 'DETAIL', schema: /* insurancePolicyDetail.schema */ }

function parseModeAndId(wildcard) {
  const segs = String(wildcard ?? '').replace(/^\/+/, '').replace(/^insurance\/?/, '').split('/').filter(Boolean)
  if (segs[0] === 'new') return { initialMode: 'create', recordId: null }
  if (segs[1] === 'edit') return { initialMode: 'edit', recordId: segs[0] }
  if (segs[0]) return { initialMode: 'detail', recordId: segs[0] }
  return { initialMode: 'list', recordId: null }
}

export default function InsuranceScreen() {
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
      tableBlueprint={INSURANCE_TABLE}
      formBlueprint={INSURANCE_FORM}
      detailBlueprint={INSURANCE_DETAIL}
      token={token}
      apiBaseUrl={API_BASE}
      initialMode={initialMode}
      recordId={recordId}
      onNavigate={handleNavigate}
      componentRegistry={componentRegistry}
    />
  )
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.fleet/screens/InsuranceScreen.jsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.fleet/screens/InsuranceScreen.jsx
git commit -m "feat(fleet): add InsuranceScreen with inline blueprint schemas"
```

---

## Task 4: ReportsScreen.jsx + ReportDetailScreen.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.fleet/screens/ReportsScreen.jsx`
- Create: `apps/desktop/src/modules/atlas.fleet/screens/ReportDetailScreen.jsx`

- [ ] **Step 1: Create ReportsScreen.jsx**

Read `fleet-views.js` for `reportsMaintenanceTable`, `reportsServiceTable`, `reportsRepairTable`, `reportsOtherTable`. Reports use page-mode forms → "Create" navigates to the form page; row click navigates to detail.

```jsx
// apps/desktop/src/modules/atlas.fleet/screens/ReportsScreen.jsx
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasTable, Button, PageHeader } from '@atlas/ui'
import { Plus } from 'lucide-react'
import { useAuth } from '../../../auth/AuthProvider'
import { componentRegistry } from '../../../lib/moduleComponentRegistry'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

const REPORT_TABS = [
  { key: 'maintenance', label: 'Mantenimiento' },
  { key: 'service',     label: 'Servicio'      },
  { key: 'repair',      label: 'Reparacion'    },
  { key: 'other',       label: 'Otro'          },
]

// Schemas from fleet-views.js — copy .schema from each
const REPORT_TABLES = {
  maintenance: { key: 'fleet.reports.maintenance.table', kind: 'TABLE', schema: /* reportsMaintenanceTable.schema */ },
  service:     { key: 'fleet.reports.service.table',     kind: 'TABLE', schema: /* reportsServiceTable.schema     */ },
  repair:      { key: 'fleet.reports.repair.table',      kind: 'TABLE', schema: /* reportsRepairTable.schema      */ },
  other:       { key: 'fleet.reports.other.table',       kind: 'TABLE', schema: /* reportsOtherTable.schema       */ },
}

const REPORT_LABELS = {
  maintenance: 'Nuevo reporte de mantenimiento',
  service: 'Nuevo reporte de servicio',
  repair: 'Nuevo reporte de reparacion',
  other: 'Nuevo reporte',
}

export default function ReportsScreen() {
  const { '*': wildcard } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const reportType = useMemo(() => {
    const segs = String(wildcard ?? '').replace(/^\/+/, '').split('/')
    const type = segs.find((s) => REPORT_TABS.some((t) => t.key === s))
    return type ?? 'maintenance'
  }, [wildcard])

  const currentBlueprint = REPORT_TABLES[reportType]

  const handleTabChange = useCallback((tab) => {
    navigate(`/app/m/atlas.fleet/reports/${tab}`, { replace: true })
  }, [navigate])

  const handleRowClick = useCallback((row) => {
    navigate(`/app/m/atlas.fleet/reports/${row.id}`)
  }, [navigate])

  const handleCreate = useCallback(() => {
    navigate(`/app/m/atlas.fleet/reports/${reportType}/new`)
  }, [navigate, reportType])

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title="Reportes de Flota" />
      <div className="flex gap-2 border-b border-[hsl(var(--border))] pb-0">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              reportType === tab.key
                ? 'border-[var(--module-accent,hsl(var(--primary)))] text-[hsl(var(--foreground))]'
                : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={handleCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          {REPORT_LABELS[reportType]}
        </Button>
      </div>
      <AtlasTable
        blueprint={currentBlueprint}
        token={token}
        apiBaseUrl={API_BASE}
        componentRegistry={componentRegistry}
        onRowClick={handleRowClick}
        suppressCreate
      />
    </div>
  )
}
```

- [ ] **Step 2: Create ReportDetailScreen.jsx**

Read `fleet-views.js` for `reportsMaintenanceDetail`, `reportsServiceDetail`, `reportsRepairDetail`, `reportsOtherDetail`. The `report_type` field returned by the API determines which detail schema to use.

```jsx
// apps/desktop/src/modules/atlas.fleet/screens/ReportDetailScreen.jsx
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasCrudView } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { componentRegistry } from '../../../lib/moduleComponentRegistry'
import { useQuery } from '@tanstack/react-query'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

// Schemas from fleet-views.js — copy .schema from each
const DETAIL_BY_TYPE = {
  maintenance: { key: 'fleet.reports.maintenance.detail', kind: 'DETAIL', schema: /* reportsMaintenanceDetail.schema */ },
  service:     { key: 'fleet.reports.service.detail',     kind: 'DETAIL', schema: /* reportsServiceDetail.schema     */ },
  repair:      { key: 'fleet.reports.repair.detail',      kind: 'DETAIL', schema: /* reportsRepairDetail.schema      */ },
  other:       { key: 'fleet.reports.other.detail',       kind: 'DETAIL', schema: /* reportsOtherDetail.schema       */ },
}

// Generic table blueprint to satisfy AtlasCrudView (list mode not used here)
const REPORT_TABLE_STUB = {
  key: 'fleet.reports.stub',
  kind: 'TABLE',
  schema: { entity: 'report', apiPath: '/fleet/reports', columns: [], emptyState: { message: '' } },
}

export default function ReportDetailScreen() {
  const { '*': wildcard } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const recordId = useMemo(() => {
    const segs = String(wildcard ?? '').replace(/^\/+/, '').split('/').filter(Boolean)
    return segs[1] ?? null // wildcard is 'reports/:id'
  }, [wildcard])

  const { data: reportData } = useQuery({
    queryKey: ['fleet-report', recordId, token],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/fleet/reports/${recordId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return null
      return res.json()
    },
    enabled: Boolean(recordId && token),
  })

  const reportType = reportData?.data?.report_type ?? reportData?.report_type ?? 'maintenance'
  const detailBlueprint = DETAIL_BY_TYPE[reportType] ?? DETAIL_BY_TYPE.maintenance

  const handleNavigate = useCallback(({ mode }) => {
    if (mode === 'list') navigate('/app/m/atlas.fleet/reports/maintenance', { replace: true })
  }, [navigate])

  if (!recordId) return null

  return (
    <AtlasCrudView
      tableBlueprint={REPORT_TABLE_STUB}
      detailBlueprint={detailBlueprint}
      token={token}
      apiBaseUrl={API_BASE}
      initialMode="detail"
      recordId={recordId}
      onNavigate={handleNavigate}
      componentRegistry={componentRegistry}
    />
  )
}
```

- [ ] **Step 3: Syntax checks**

```bash
node --check apps/desktop/src/modules/atlas.fleet/screens/ReportsScreen.jsx
node --check apps/desktop/src/modules/atlas.fleet/screens/ReportDetailScreen.jsx
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.fleet/screens/ReportsScreen.jsx apps/desktop/src/modules/atlas.fleet/screens/ReportDetailScreen.jsx
git commit -m "feat(fleet): add ReportsScreen and ReportDetailScreen"
```

---

## Task 5: ReportFormPage.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.fleet/screens/ReportFormPage.jsx`

- [ ] **Step 1: Create ReportFormPage.jsx**

Read `fleet-views.js` for `reportsMaintenanceForm`, `reportsServiceForm`, `reportsRepairForm`, `reportsOtherForm`. All have `formMode: 'page'`.

```jsx
// apps/desktop/src/modules/atlas.fleet/screens/ReportFormPage.jsx
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasCrudView } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { componentRegistry } from '../../../lib/moduleComponentRegistry'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

// Schemas from fleet-views.js — copy .schema from each (includes formMode: 'page')
const FORMS_BY_TYPE = {
  maintenance: { key: 'fleet.reports.maintenance.form', kind: 'FORM', schema: /* reportsMaintenanceForm.schema */ },
  service:     { key: 'fleet.reports.service.form',     kind: 'FORM', schema: /* reportsServiceForm.schema     */ },
  repair:      { key: 'fleet.reports.repair.form',      kind: 'FORM', schema: /* reportsRepairForm.schema      */ },
  other:       { key: 'fleet.reports.other.form',       kind: 'FORM', schema: /* reportsOtherForm.schema       */ },
}

const REPORT_TABLE_STUB = {
  key: 'fleet.reports.stub',
  kind: 'TABLE',
  schema: { entity: 'report', apiPath: '/fleet/reports', columns: [], emptyState: { message: '' } },
}

export default function ReportFormPage() {
  const { '*': wildcard } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const { reportType, recordId, mode } = useMemo(() => {
    // wildcard: 'reports/maintenance/new' or 'reports/:id/edit'
    const segs = String(wildcard ?? '').replace(/^\/+/, '').split('/').filter(Boolean)
    // segs[0] = 'reports', segs[1] = type or :id, segs[2] = 'new' or 'edit'
    const knownTypes = ['maintenance', 'service', 'repair', 'other']
    if (knownTypes.includes(segs[1])) {
      return { reportType: segs[1], recordId: null, mode: 'create' }
    }
    // edit case: /reports/:id/edit — need to determine type from API (default maintenance)
    return { reportType: 'maintenance', recordId: segs[1] ?? null, mode: 'edit' }
  }, [wildcard])

  const formBlueprint = FORMS_BY_TYPE[reportType] ?? FORMS_BY_TYPE.maintenance

  const handleNavigate = useCallback(({ mode }) => {
    if (mode === 'list') navigate(`/app/m/atlas.fleet/reports/${reportType}`, { replace: true })
  }, [navigate, reportType])

  const handleCreateSuccess = useCallback(() => {
    navigate(`/app/m/atlas.fleet/reports/${reportType}`, { replace: true })
  }, [navigate, reportType])

  return (
    <AtlasCrudView
      tableBlueprint={REPORT_TABLE_STUB}
      formBlueprint={formBlueprint}
      token={token}
      apiBaseUrl={API_BASE}
      initialMode={mode}
      recordId={recordId}
      onNavigate={handleNavigate}
      onCreateSuccess={handleCreateSuccess}
      componentRegistry={componentRegistry}
    />
  )
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.fleet/screens/ReportFormPage.jsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.fleet/screens/ReportFormPage.jsx
git commit -m "feat(fleet): add ReportFormPage for page-mode report creation"
```

---

## Task 6: CatalogsScreen.jsx

**Files:**
- Create: `apps/desktop/src/modules/atlas.fleet/screens/CatalogsScreen.jsx`

- [ ] **Step 1: Create CatalogsScreen.jsx**

Read `modules/official/atlas.fleet/views/fleet-catalogs.js` for all vehicle-type/brand/model TABLE/FORM schemas.

```jsx
// apps/desktop/src/modules/atlas.fleet/screens/CatalogsScreen.jsx
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasCrudView, PageHeader } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { componentRegistry } from '../../../lib/moduleComponentRegistry'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

const CATALOG_TABS = [
  { key: 'vehicle-types',  label: 'Tipos de vehiculo' },
  { key: 'vehicle-brands', label: 'Marcas'            },
  { key: 'vehicle-models', label: 'Modelos'           },
]

// Schemas from fleet-catalogs.js — copy TABLE and FORM schemas for each catalog
// vehicleTypeTable, vehicleTypeForm, vehicleBrandTable, vehicleBrandForm, vehicleModelTable, vehicleModelForm
const CATALOG_BLUEPRINTS = {
  'vehicle-types': {
    table: { key: 'fleet.catalog.vehicle_types.table', kind: 'TABLE', schema: /* vehicleTypeTable.schema */ },
    form:  { key: 'fleet.catalog.vehicle_types.form',  kind: 'FORM',  schema: /* vehicleTypeForm.schema  */ },
  },
  'vehicle-brands': {
    table: { key: 'fleet.catalog.vehicle_brands.table', kind: 'TABLE', schema: /* vehicleBrandTable.schema */ },
    form:  { key: 'fleet.catalog.vehicle_brands.form',  kind: 'FORM',  schema: /* vehicleBrandForm.schema  */ },
  },
  'vehicle-models': {
    table: { key: 'fleet.catalog.vehicle_models.table', kind: 'TABLE', schema: /* vehicleModelTable.schema */ },
    form:  { key: 'fleet.catalog.vehicle_models.form',  kind: 'FORM',  schema: /* vehicleModelForm.schema  */ },
  },
}

export default function CatalogsScreen() {
  const { '*': wildcard } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const catalogKey = useMemo(() => {
    const segs = String(wildcard ?? '').replace(/^\/+/, '').split('/')
    const key = segs.find((s) => CATALOG_TABS.some((t) => t.key === s))
    return key ?? 'vehicle-types'
  }, [wildcard])

  const { table: tableBlueprint, form: formBlueprint } = CATALOG_BLUEPRINTS[catalogKey]

  const handleTabChange = useCallback((key) => {
    navigate(`/app/m/atlas.fleet/catalogs/${key}`, { replace: true })
  }, [navigate])

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title="Catalogos de Flota" />
      <div className="flex gap-2 border-b border-[hsl(var(--border))] pb-0">
        {CATALOG_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              catalogKey === tab.key
                ? 'border-[var(--module-accent,hsl(var(--primary)))] text-[hsl(var(--foreground))]'
                : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <AtlasCrudView
        tableBlueprint={tableBlueprint}
        formBlueprint={formBlueprint}
        token={token}
        apiBaseUrl={API_BASE}
        initialMode="list"
        componentRegistry={componentRegistry}
      />
    </div>
  )
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.fleet/screens/CatalogsScreen.jsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.fleet/screens/CatalogsScreen.jsx
git commit -m "feat(fleet): add CatalogsScreen for vehicle types/brands/models"
```

---

## Task 7: Wire SCREEN_MAP + resolveScreen in ModuleOutlet.jsx

**Files:**
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`

- [ ] **Step 1: Add fleet lazy imports to SCREEN_MAP**

In `ModuleOutlet.jsx`, add these entries to the `SCREEN_MAP` object (after the `atlas.catalog` entries and before `atlas.activity`):

```js
// atlas.fleet custom screens
"atlas.fleet:/vehicles": lazy(() => import("../modules/atlas.fleet/screens/VehiclesScreen.jsx")),
"atlas.fleet:/vehicles/:id": lazy(() => import("../modules/atlas.fleet/screens/VehiclesScreen.jsx")),
"atlas.fleet:/drivers": lazy(() => import("../modules/atlas.fleet/screens/DriversScreen.jsx")),
"atlas.fleet:/drivers/:id": lazy(() => import("../modules/atlas.fleet/screens/DriversScreen.jsx")),
"atlas.fleet:/insurance": lazy(() => import("../modules/atlas.fleet/screens/InsuranceScreen.jsx")),
"atlas.fleet:/insurance/:id": lazy(() => import("../modules/atlas.fleet/screens/InsuranceScreen.jsx")),
"atlas.fleet:/reports/:type": lazy(() => import("../modules/atlas.fleet/screens/ReportsScreen.jsx")),
"atlas.fleet:/reports/:type/new": lazy(() => import("../modules/atlas.fleet/screens/ReportFormPage.jsx")),
"atlas.fleet:/reports/:id": lazy(() => import("../modules/atlas.fleet/screens/ReportDetailScreen.jsx")),
"atlas.fleet:/catalogs/:section": lazy(() => import("../modules/atlas.fleet/screens/CatalogsScreen.jsx")),
```

- [ ] **Step 2: Add fleet resolveScreen logic**

In the `resolveScreen` function in `ModuleOutlet.jsx`, add a fleet block before the `if (subPath === '/') ...` line at the bottom:

```js
if (moduleKey === "atlas.fleet") {
  if (subPath === "/vehicles" || subPath === "/vehicles/new") return SCREEN_MAP["atlas.fleet:/vehicles"] ?? null
  if (subPath.startsWith("/vehicles/")) return SCREEN_MAP["atlas.fleet:/vehicles/:id"] ?? null
  if (subPath === "/drivers" || subPath === "/drivers/new") return SCREEN_MAP["atlas.fleet:/drivers"] ?? null
  if (subPath.startsWith("/drivers/")) return SCREEN_MAP["atlas.fleet:/drivers/:id"] ?? null
  if (subPath === "/insurance" || subPath === "/insurance/new") return SCREEN_MAP["atlas.fleet:/insurance"] ?? null
  if (subPath.startsWith("/insurance/")) return SCREEN_MAP["atlas.fleet:/insurance/:id"] ?? null
  if (/^\/reports\/(maintenance|service|repair|other)\/new$/.test(subPath)) return SCREEN_MAP["atlas.fleet:/reports/:type/new"] ?? null
  if (/^\/reports\/(maintenance|service|repair|other)$/.test(subPath)) return SCREEN_MAP["atlas.fleet:/reports/:type"] ?? null
  if (/^\/reports\/[^/]+$/.test(subPath)) return SCREEN_MAP["atlas.fleet:/reports/:id"] ?? null
  if (/^\/catalogs\/(vehicle-types|vehicle-brands|vehicle-models)$/.test(subPath)) return SCREEN_MAP["atlas.fleet:/catalogs/:section"] ?? null
  if (subPath === "/catalogs") {
    return SCREEN_MAP["atlas.fleet:/catalogs/:section"] ?? null
  }
  return null
}
```

Place this block immediately after the `atlas.catalog` block and before the final `if (subPath === "/") ...` line.

- [ ] **Step 3: Syntax check**

```bash
node --check apps/desktop/src/app/ModuleOutlet.jsx
```

Expected: no output.

- [ ] **Step 4: Verify screens load in browser**

Start dev server:
```bash
pnpm dev:frontend
```

Navigate to:
- `http://localhost:5173/app/m/atlas.fleet/vehicles` — should show vehicles list (AtlasTable)
- `http://localhost:5173/app/m/atlas.fleet/drivers` — should show drivers list
- `http://localhost:5173/app/m/atlas.fleet/insurance` — should show insurance list
- `http://localhost:5173/app/m/atlas.fleet/reports/maintenance` — should show maintenance reports tab
- `http://localhost:5173/app/m/atlas.fleet/catalogs/vehicle-types` — should show catalogs

Verify no console errors. Verify badge components (VehicleStatusBadge, etc.) render correctly in cells.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "feat(fleet): wire all fleet screens into SCREEN_MAP and resolveScreen"
```
