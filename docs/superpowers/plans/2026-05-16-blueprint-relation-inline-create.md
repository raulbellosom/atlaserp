# Blueprint Relation Inline Create - Implementation Plan

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY  
Spec: `docs/superpowers/specs/2026-05-16-blueprint-relation-inline-create-design.md`

## Execution rule

1. No implementation starts until explicit approval.
2. This document is sequencing-only and does not authorize coding.
3. Keep changes inside allowed files only.

## File structure map (future implementation only)

Planned core files:

1. `packages/ui/src/atlas-renderer/renderer-adapters.js`
2. `packages/ui/src/atlas-renderer/AtlasForm.jsx`
3. `packages/ui/src/components/FormFields.jsx`
4. `packages/ui/src/components/Dialog.jsx` (only if existing dialog primitives are required)

Planned Fleet metadata files:

1. `modules/custom/custom.fleet/views/vehicle.form.js`
2. `modules/custom/custom.fleet/views/catalog.vehicle-models.form.js`
3. `modules/custom/custom.fleet/views/maintenance.form.js` (if relation inline-create metadata is enabled there)

Planned docs update after implementation verification:

1. `docs/TASKS.md`

Forbidden files:

1. `prisma/schema.prisma`
2. `prisma/migrations/**`
3. `packages/maps/**`
4. `packages/validators/**`
5. `packages/sdk/**`
6. `apps/api/src/index.js`

## Phase 1: Current relation renderer audit

1. Confirm current normalization path for relation metadata in `normalizeRelationDescriptor`.
2. Confirm current remote option lifecycle in `AtlasForm` (`preload`, `search`, retry, clearable behavior).
3. Confirm current `RelationSelectField` capabilities and identify where create-action UI slot belongs.
4. Confirm current parent payload behavior keeps relation values as scalar IDs.
5. Confirm current Fleet relation fields and existing API paths:
   - vehicle form: `vehicle_model_id`, `driver_id`
   - vehicle-model form: `brand_id`, `type_id`
   - maintenance form: `maintenance_type_id`, `driver_id`, `vehicle_id`
6. Confirm `drivers-routes.js` is active route file and `driver-routes.js` is absent.

## Phase 2: Schema contract design

1. Extend relation schema contract with optional `relation.create` object.
2. Define defaults and validation for:
   - `enabled`
   - `label`
   - `mode`
   - `title`
   - `apiPath`
   - `viewKey`
   - `selectCreated`
   - `refreshOptions`
   - `prefillFromSearch`
   - `allowedWhen`
   - `permissionKey`
3. Define invalid contract fallback: hide create action and preserve existing relation behavior.
4. Define compatibility rules for relation fields without create config.

## Phase 3: Modal/nested form strategy

1. Define one-level nested modal policy (depth max = 1) to prevent recursive modal chains.
2. Reuse `AtlasForm` as nested form renderer, with isolated local state and submit lifecycle.
3. Resolve target form blueprint via `viewKey` (from loaded blueprint registry/context already used by renderer flows).
4. Define modal success flow:
   - parse created record
   - optional options refresh
   - optional auto-select created ID
   - close modal
5. Define modal cancel flow:
   - close modal
   - keep parent values and selected relation unchanged
6. Define modal error flow:
   - keep errors inside modal
   - avoid parent crash
7. Define fallback if refresh fails after successful create:
   - if created ID exists, still set parent scalar ID
   - show non-blocking Spanish warning in modal/field context.

## Phase 4: Fleet metadata update plan

1. Vehicle form `vehicle_model_id`:
   - enable inline create to `fleet.catalog.vehicle_models.form`
   - label `Crear modelo de vehículo`
2. Vehicle-model form `brand_id`:
   - enable inline create to `fleet.catalog.vehicle_brands.form`
   - label `Crear marca de vehículo`
3. Vehicle-model form `type_id`:
   - enable inline create to `fleet.catalog.vehicle_types.form`
   - label `Crear tipo de vehículo`
4. Maintenance form `maintenance_type_id`:
   - enable inline create to maintenance-type form view key
5. Maintenance form `driver_id`:
   - optionally enable inline create to `fleet.driver.form` (keep as configurable decision in implementation)
6. Maintenance form `vehicle_id`:
   - explicitly keep inline create disabled in v1.

## Phase 5: Future implementation tasks

1. Implement relation-create normalization in `renderer-adapters.js`.
2. Add create-action rendering and callbacks to `RelationSelectField` in `FormFields.jsx`.
3. Add nested modal state and orchestration to `AtlasForm.jsx`.
4. Implement created-record normalization and parent ID assignment logic.
5. Implement best-effort permission gate behavior for `permissionKey`.
6. Add Fleet blueprint metadata opt-ins in allowed view files.
7. Keep all behavior generic and metadata-driven; no Fleet branches in renderer core.

## Phase 6: Verification checklist

Static checks:

1. `node --check packages/ui/src/atlas-renderer/renderer-adapters.js`
2. `node --check packages/ui/src/atlas-renderer/AtlasForm.jsx`
3. `node --check packages/ui/src/components/FormFields.jsx`
4. `node --check modules/custom/custom.fleet/views/vehicle.form.js`
5. `node --check modules/custom/custom.fleet/views/catalog.vehicle-models.form.js`
6. `node --check modules/custom/custom.fleet/views/maintenance.form.js`

Build check:

1. `pnpm.cmd --filter @atlas/desktop build:web`

Runtime checks:

1. Vehicle form relation shows create option and opens nested modal.
2. Creating vehicle model selects created option in parent.
3. Parent field values remain unchanged after cancel and after success.
4. Vehicle-model nested brand/type creation works through configured views.
5. Maintenance nested maintenance-type (and optional driver) create works when enabled.
6. Maintenance vehicle relation does not expose create action in v1.
7. Response errors and validation errors are shown in Spanish inside modal.
8. Parent submit payload contains scalar IDs only.
9. Existing relation fields without `relation.create` behave as before.
10. No custom.fleet hardcoding appears in renderer core files.

## Phase 7: Documentation and commit strategy

1. Keep this phase docs-only until implementation approval.
2. After implementation and full verification, add a small evidence-backed note in `docs/TASKS.md`.
3. Use separate commits:
   - Commit A: renderer generic inline-create support.
   - Commit B: Fleet blueprint metadata opt-ins.
   - Commit C: docs verification update.
4. Do not commit or push automatically without explicit user instruction.
