# Blueprint Relation Inline Create

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY

## 1. Feature title

Blueprint Relation Inline Create

## 2. Status

Draft

## 3. Context

Blueprint relation selectors are now functional and load options from API endpoints. This removed UUID-only workflows, but users still must leave the parent form when a related record does not exist. In Fleet this creates high friction during vehicle, vehicle model, and maintenance capture.

## 4. Problem

Relation selectors are read-only from a data-creation perspective. If a required related record is missing, users must navigate away, create it elsewhere, return, and reselect. This interrupts flow, causes data-entry abandonment, and increases inconsistent partially-filled forms.

## 5. Goals

1. Define a generic blueprint metadata contract for inline create in relation fields.
2. Add a reusable renderer behavior that shows a `Crear nuevo` action when configured.
3. Support modal-based inline creation with isolated nested form state.
4. Preserve parent form state and selected values across open, cancel, and create flows.
5. Allow optional auto-selection and option refresh after successful create.
6. Keep the design module-agnostic with no `custom.fleet` hardcoding in renderer core.

## 6. Non-goals

1. Prisma schema or Prisma migration changes.
2. New backend endpoints beyond existing CRUD routes already available.
3. DocumentsPanel work.
4. Dashboards, analytics, or reports.
5. AME3 Phase 4 discovery/mounting work.
6. Multi-step wizard-based inline creation.
7. Deep recursive nested creation chains beyond one nested modal level in v1.
8. Full permission UI framework redesign.

## 7. User stories

1. As a fleet operator, I want to create a missing vehicle model from the vehicle form so I do not lose parent form progress.
2. As a fleet admin, I want to create missing brand/type while creating a vehicle model so catalog setup is faster.
3. As a maintenance operator, I want to create a missing maintenance type or driver inline so I can complete maintenance records in one flow.
4. As a product team, we want one generic renderer contract usable by any module, not a Fleet-specific branch.

## 8. UX requirements

1. Relation selectors with `relation.create.enabled=true` must render a create action inside the selector panel.
2. Default create label is `Crear nuevo`; custom label comes from `relation.create.label`.
3. If `prefillFromSearch=true` and search has text, label format is `Crear "<texto>"`.
4. Clicking create opens a modal with a nested form resolved from blueprint metadata.
5. Modal title uses `relation.create.title` if provided; fallback uses label.
6. On create success, modal closes, options refresh (when enabled), and created record is selected (when enabled).
7. On cancel, modal closes and parent form state is preserved exactly.
8. Modal validation and API errors render in Spanish inside modal context.
9. Existing relation selectors without `relation.create` config must behave exactly as today.
10. Visible UI copy remains Spanish UTF-8 with accents.

## 9. Routes/screens

No new top-level routes or screens are required. Inline create reuses existing API paths and existing blueprint FORM views.

Fleet usage examples:

1. Parent: `/fleet/vehicles` form relation `vehicle_model_id` -> create target `POST /fleet/catalogs/vehicle-models`, view `fleet.catalog.vehicle_models.form`.
2. Nested inside vehicle-model form: `brand_id` -> `POST /fleet/catalogs/vehicle-brands`, view `fleet.catalog.vehicle_brands.form`.
3. Nested inside vehicle-model form: `type_id` -> `POST /fleet/catalogs/vehicle-types`, view `fleet.catalog.vehicle_types.form`.
4. Maintenance form: `maintenance_type_id` -> `POST /fleet/catalogs/maintenance-types`, view `fleet.catalog.maintenance_types.form`.
5. Maintenance form: `driver_id` optional inline create -> `POST /fleet/drivers`, view `fleet.driver.form`.
6. Maintenance form: `vehicle_id` inline create disabled for v1.

## 10. Data model

No database model changes. This feature adds UI metadata and runtime form behavior only.

New normalized field-level metadata contract inside blueprint FORM schema:

```js
relation: {
  apiPath: "/fleet/catalogs/vehicle-models",
  valueField: "id",
  labelField: ["brand_name", "name", "year"],
  labelSeparator: " ",
  clearable: false,
  create: {
    enabled: true,
    label: "Crear modelo de vehículo",
    mode: "modal",
    title: "Crear modelo de vehículo",
    apiPath: "/fleet/catalogs/vehicle-models",
    viewKey: "fleet.catalog.vehicle_models.form",
    selectCreated: true,
    refreshOptions: true,
    prefillFromSearch: true,
    allowedWhen: "always",
    permissionKey: "fleet.catalogs.create"
  }
}
```

## 11. Prisma impact

None. No changes to `prisma/schema.prisma` and no `prisma/migrations/**` changes.

## 12. API contract

No new endpoints are introduced. Inline create uses existing `POST` endpoints declared per relation create config.

Expected generic assumptions:

1. `relation.create.apiPath` supports `POST` with auth.
2. Success status is `200` or `201`.
3. Response may be `{ data: {...} }` or direct object `{...}`.
4. Created record ID is read from `relation.valueField` (default `id`) inside response payload.
5. Permission denial (`403`) must be handled as modal-local error.

## 13. SDK contract

No `@atlas/sdk` changes are required in v1. AtlasForm continues using current fetch-based blueprint runtime behavior.

## 14. Validator contract

No `@atlas/validators` changes are required. Inline create uses existing target endpoint validators.

## 15. Module manifest impact

No manifest structure changes are required for the renderer feature itself. Module view files may opt-in by adding `relation.create` metadata in existing view schemas.

## 16. Navigation impact

None. Inline create runs inside modal context and does not add navigation entries.

## 17. Blueprint impact

Blueprint FORM relation fields gain optional `relation.create` metadata:

1. `enabled: boolean` (required to activate)
2. `label?: string`
3. `mode?: "modal"` (v1 only)
4. `title?: string`
5. `apiPath?: string` (fallback to `relation.apiPath`)
6. `viewKey: string` (required for nested form blueprint resolution)
7. `selectCreated?: boolean` (default `true`)
8. `refreshOptions?: boolean` (default `true`)
9. `prefillFromSearch?: boolean` (default `false`)
10. `allowedWhen?: "always" | "empty-search" | "has-search"` (default `always`)
11. `permissionKey?: string` (optional, best-effort UI gate)

Contract normalization rules:

1. Missing/invalid `relation.create` disables inline create safely.
2. `mode` values other than `modal` are invalid in v1 and disable inline create.
3. If `viewKey` is missing, create action is hidden.
4. If `apiPath` is missing in `create`, fallback to `relation.apiPath`.

## 18. RBAC/permissions

1. If `relation.create.permissionKey` exists and permission context is available, hide create action when permission is missing.
2. If permission context is unavailable, fallback is optimistic UI with backend enforcement.
3. A backend `403` response must show a Spanish inline modal error and keep parent form unchanged.
4. Spec does not block implementation on adding a new global permission-state system.

## 19. Multi-company behavior

Inline create inherits company scope from authenticated API context exactly as existing create endpoints do. Renderer must not inject company IDs from frontend state.

## 20. Files/storage impact

None.

## 21. Export/import requirements

None.

## 22. Audit log requirements

No new audit contract is introduced. Existing endpoint-level audit behavior remains source of truth.

## 23. Edge cases

1. Create succeeds but option refresh fails: still select created ID when present in create response.
2. Create response lacks label fields: add fallback option label using ID until next refresh.
3. Search text exists and `prefillFromSearch=true`: prefill only compatible text fields in nested form, never force unsupported fields.
4. Parent already has selected value and user cancels modal: selected value remains intact.
5. Parent relation is required and currently empty: required validation remains enforced if modal closes without creation.
6. Nested form request fails validation/API: errors remain inside modal and parent submit remains available.
7. Target relation points to endpoint returning non-standard wrapper: fallback parser checks both `data` object and root object.
8. User opens create repeatedly: disable duplicate submit while nested form is submitting.
9. Recursive create loop risk: v1 allows one nested modal depth only; nested form cannot open another nested create modal.

## 24. Risks

1. Risk: Recursive modal complexity and state leakage.
   Mitigation: enforce depth=1 max for v1.
2. Risk: Inconsistent API response shapes across modules.
   Mitigation: normalize success payload with tolerant parser (`data` wrapper and root object fallback).
3. Risk: Permission-gating inconsistency without centralized frontend permission context.
   Mitigation: support optional UI gate and always handle backend `403` gracefully.
4. Risk: Parent form rerender resets values when modal opens/closes.
   Mitigation: isolate modal state and avoid rebuilding parent initial values on nested modal lifecycle.
5. Risk: Fleet-only shortcuts creeping into renderer.
   Mitigation: contract-driven behavior only through relation metadata.

## 25. Acceptance criteria

1. Vehicle form `vehicle_model_id` selector shows `Crear modelo de vehículo` when configured.
2. Clicking create opens modal using blueprint `fleet.catalog.vehicle_models.form`.
3. Creating model from modal closes modal and selects created model in parent vehicle form.
4. Parent vehicle form values remain preserved after create and cancel.
5. Vehicle model form `brand_id` selector can inline create vehicle brand when configured.
6. Vehicle model form `type_id` selector can inline create vehicle type when configured.
7. Maintenance `maintenance_type_id` can inline create maintenance type when configured.
8. Maintenance `driver_id` can inline create driver when configured (if enabled).
9. Maintenance `vehicle_id` inline create remains disabled in v1 by explicit metadata.
10. Inline create errors are shown in Spanish within modal.
11. Parent payload still submits only scalar relation IDs.
12. Relation selectors without `relation.create` metadata remain behaviorally unchanged.
13. No `custom.fleet` hardcoding is introduced in core renderer files.
14. Desktop web build passes.

## 26. Verification plan

Future implementation verification commands:

```powershell
node --check packages/ui/src/atlas-renderer/renderer-adapters.js
node --check packages/ui/src/atlas-renderer/AtlasForm.jsx
node --check packages/ui/src/components/FormFields.jsx
node --check modules/custom/custom.fleet/views/vehicle.form.js
node --check modules/custom/custom.fleet/views/catalog.vehicle-models.form.js
node --check modules/custom/custom.fleet/views/maintenance.form.js
pnpm.cmd --filter @atlas/desktop build:web
```

Future authenticated runtime smoke checks:

```powershell
# Token placeholder only; never print real token
$env:ATLAS_TOKEN="<TOKEN>"
node scripts/smoke-fleet-relational.mjs
```

Manual runtime checks:

1. Open vehicle form and create model inline.
2. Confirm parent state preservation on cancel and success.
3. Open nested brand/type creates from vehicle-model form.
4. Validate `403` handling by testing a user lacking create permission.
5. Verify created relation ID is submitted as scalar in parent payload.

## 27. Rollback plan

Because this is renderer + blueprint metadata only:

1. Revert renderer changes in:
   - `packages/ui/src/atlas-renderer/renderer-adapters.js`
   - `packages/ui/src/atlas-renderer/AtlasForm.jsx`
   - `packages/ui/src/components/FormFields.jsx`
2. Revert Fleet blueprint metadata changes in view files.
3. Run build verification to ensure baseline relation behavior is restored.
4. No database rollback required.

## 28. Future enhancements

1. Support drawer mode or full-page create mode beyond modal.
2. Configurable mapping for prefill from search to specific fields.
3. Permission-aware UI hide/show using centralized permission context.
4. Safe multi-level nested create with explicit depth controls.
5. Generic event hooks for analytics (`relation_inline_create_opened`, `created`, `cancelled`, `failed`).
