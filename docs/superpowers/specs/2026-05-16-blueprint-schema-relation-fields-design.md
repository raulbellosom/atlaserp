# Blueprint Schema Expansion - Relation Fields Design

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY

## Problem Statement

`AtlasForm` currently supports `field.type = "relation"` but renders relation values as manual UUID text inputs (hint: `ID del registro relacionado`). This blocks normal ERP operation in Fleet because users must know and type raw IDs.

## Current Behavior

- `AtlasForm` treats relation fields as plain `TextField` controls.
- Form payload submission already preserves scalar IDs (good baseline), but selection UX is missing.
- Fleet forms currently mix `uuid`, `text`, and limited `relation` modeling for foreign keys.
- No generic relation option loading contract exists in blueprint schema.

## Desired Behavior

- Blueprint metadata defines how to resolve relation options.
- Renderer loads options from static arrays or remote API endpoints.
- UI control is Spanish-labeled select/combobox, not raw UUID text input.
- Submit payload contains only ID values, never label objects.
- Edit mode shows readable labels for existing related records.
- Behavior remains generic and blueprint-driven, with no `custom.fleet` hardcoding in core renderer.

## Proposed Blueprint Schema Contract

Minimum generic relation contract:

```js
{
  field: 'vehicle_type_id',
  label: 'Tipo de vehiculo',
  type: 'relation',
  required: true,
  relation: {
    source: 'remote', // 'remote' | 'static'
    apiPath: '/fleet/catalogs/vehicle-types',
    valueField: 'id',
    labelField: 'name',
    searchParam: 'search',
    pageParam: 'page',
    pageSizeParam: 'pageSize',
    pageSize: 20,
    preload: true,
    clearable: false,
    includeDisabled: false,
    disabledField: 'enabled'
  }
}
```

Static-source variant:

```js
{
  field: 'status_owner_id',
  label: 'Responsable',
  type: 'relation',
  relation: {
    source: 'static',
    options: [
      { value: 'uuid-1', label: 'Operaciones' },
      { value: 'uuid-2', label: 'Mantenimiento' }
    ],
    clearable: true
  }
}
```

Contract notes:

- `source` defaults to `remote` when `apiPath` exists, else `static`.
- Unknown or invalid relation config must degrade to safe read/write behavior with explicit UI error state.
- `valueField` default: `id`.
- `labelField` default: `name`.
- `pageSize` default: `20`.
- `searchParam`, `pageParam`, `pageSizeParam` default to `search`, `page`, `pageSize`.

## Renderer Behavior

- `AtlasForm` resolves a normalized relation descriptor per field.
- For `relation.source = static`: render combobox using `relation.options`.
- For `relation.source = remote`: fetch from `relation.apiPath` and map each row to `{ value, label, disabled }`.
- Reuse shared form field components (combobox/select) to keep UI consistent.
- No module-specific conditionals in renderer.

## Data Loading Behavior

- Initial load:
  - If `preload = true`, request first page immediately.
  - If `preload = false`, request on first open/focus/search interaction.
- Search:
  - Debounced query updates `searchParam`.
  - Empty search returns base list.
- Pagination:
  - Request page 1 by default.
  - Support incremental page requests when control exposes "load more" behavior.
- Caching:
  - Cache options in-memory by `(apiPath, search, pageSize)` for active form lifecycle.

## Validation Behavior

- Required relation fields validate like existing required fields.
- Optional relation fields (`clearable: true`) can be set to `null`.
- If field is not clearable, clear action is hidden/blocked.
- Submitted payload rules:
  - send selected `value` only (UUID/string scalar),
  - never send display label,
  - empty optional relation sends `null`.

## Edit Mode Behavior

- Existing ID in `initialData[field]` must resolve to a readable label.
- Resolution strategy:
  1. Use already loaded options if present.
  2. If missing, fetch from relation source (search by ID fallback or detail endpoint strategy if documented by relation metadata).
- If record is disabled:
  - keep value selected,
  - mark as disabled/inactive in label,
  - allow save unless validation/business rules reject.
- If record is missing/deleted:
  - show fallback label (e.g. `Registro no disponible`),
  - preserve raw ID until user changes selection.

## Error, Loading, and Empty States

- Loading: show control-level loading indicator.
- Error: show inline Spanish message and retry action when remote load fails.
- Empty:
  - no data: `Sin opciones disponibles`.
  - no search match: `Sin resultados`.
- Control remains usable for manual retry; global form should not crash.

## Fleet Application Examples

Target Fleet fields using relation metadata:

- `vehicle_type_id` -> `/fleet/catalogs/vehicle-types`
- `vehicle_brand_id` -> `/fleet/catalogs/vehicle-brands`
- `maintenance_type_id` -> `/fleet/catalogs/maintenance-types`
- `driver_id` -> `/fleet/drivers`
- `vehicle_id` -> `/fleet/vehicles`

Expected label fields:

- Catalogs: `name`
- Drivers: composed display label (e.g. name + last name) via metadata-compatible label mapping strategy
- Vehicles: composed display label (e.g. plate + model) via metadata-compatible label mapping strategy

## Scope

- Define generic relation schema contract for blueprint forms.
- Define renderer relation option lifecycle (load/search/paginate/select/clear/submit).
- Define Fleet blueprint metadata migration approach for affected relation fields.
- Preserve existing non-relation field behavior.

## Out Of Scope

- Prisma schema or migration changes.
- SDK changes unless proven strictly required.
- API join expansion or new relation-specific endpoints.
- Nested object writes in form payloads.
- Inline create for related records.
- DocumentsPanel, dashboards, reports, or AME3 Phase 4 work.
- New Fleet feature expansion beyond relation field usability.

## Allowed Files (Future Implementation)

- `packages/ui/src/atlas-renderer/AtlasForm.jsx`
- `packages/ui/src/atlas-renderer/renderer-adapters.js`
- `packages/ui/src/components/FormFields.jsx`
- `modules/custom/custom.fleet/views/vehicle.form.js`
- `modules/custom/custom.fleet/views/maintenance.form.js`
- `modules/custom/custom.fleet/views/driver.form.js` (optional)
- `docs/TASKS.md` only after implementation verification evidence exists

## Forbidden Files

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `packages/maps/**`
- `packages/validators/**`
- `packages/sdk/**`
- `apps/api/src/index.js`

## Acceptance Criteria

- `vehicle_type_id` renders as Spanish relation selector sourced from `/fleet/catalogs/vehicle-types`.
- `vehicle_brand_id` renders as Spanish relation selector sourced from `/fleet/catalogs/vehicle-brands`.
- `maintenance_type_id` renders as Spanish relation selector sourced from `/fleet/catalogs/maintenance-types`.
- `driver_id` renders as Spanish relation selector sourced from `/fleet/drivers`.
- `vehicle_id` renders as Spanish relation selector sourced from `/fleet/vehicles`.
- Create mode submits only ID values for relation fields.
- Edit mode shows readable selected labels for existing relation IDs.
- Optional relation fields can be cleared.
- Required relation fields keep required validation behavior.
- Existing text/select/date/number/boolean fields continue functioning.
- No `custom.fleet` hardcode is introduced in core renderer.
- Desktop web build passes after future implementation.

## Verification Checklist (For Future Implementation)

- Verify relation field rendering for all five Fleet fields.
- Verify search query parameters and debounced fetch behavior.
- Verify pagination parameters and page-size behavior.
- Verify create payload contains only scalar IDs.
- Verify edit mode label hydration for existing IDs.
- Verify disabled/missing relation records UI behavior.
- Regression test non-relation field types in `AtlasForm`.
- Run:
  - `node --check packages/ui/src/atlas-renderer/AtlasForm.jsx`
  - `node --check packages/ui/src/atlas-renderer/renderer-adapters.js`
  - `node --check packages/ui/src/components/FormFields.jsx`
  - `pnpm.cmd --filter @atlas/desktop build:web`

## Follow-Up Specs

1. Relation data-source interoperability hardening
   - Cross-module relation patterns and reusable label templates.
2. Advanced relation UX
   - Async infinite scroll, keyboard-first accessibility polish, and optional grouped options.
