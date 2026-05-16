# Blueprint Schema Expansion - Relation Fields Plan

Date: 2026-05-16  
Status: Draft  
Spec: `docs/superpowers/specs/2026-05-16-blueprint-schema-relation-fields-design.md`  
Mode: SPEC + PLAN ONLY

## Execution Rule

- No implementation starts until explicit user approval.
- This document defines sequencing only.

## Phase 1: Discovery / Current Renderer Audit

- [ ] Reconfirm current `AtlasForm` relation rendering path and payload shaping behavior.
- [ ] Audit `renderer-adapters` for normalization hooks to host relation metadata parsing.
- [ ] Audit `FormFields` reusable controls (`ComboboxField` and related controls) for relation UX fit.
- [ ] Validate current Fleet form blueprints (`vehicle`, `maintenance`, `driver`) and identify fields requiring relation metadata migration.
- [ ] Capture current API response shape assumptions from Fleet list endpoints (`/fleet/vehicles`, `/fleet/drivers`, `/fleet/catalogs/*`).

## Phase 2: Schema Contract Design

- [ ] Finalize relation schema contract with `source = static|remote`.
- [ ] Finalize required and optional keys (`apiPath`, `valueField`, `labelField`, params, preload, clearable, includeDisabled).
- [ ] Define defaults and invalid-config fallback behavior.
- [ ] Define backward compatibility for relation fields missing new metadata.

## Phase 3: UI Component Strategy

- [ ] Select renderer control strategy (reuse existing combobox/select components, no module-specific UI path).
- [ ] Define control-level states: loading, empty, error, disabled/missing selected record.
- [ ] Define search interaction (debounce timing and trigger conditions).
- [ ] Define pagination interaction (page reset on search, incremental loading behavior).
- [ ] Define accessibility and Spanish copy rules for relation control messaging.

## Phase 4: Fleet Blueprint Metadata Update Plan

- [ ] Map Fleet relation fields to metadata-driven remote sources:
  - `vehicle_type_id` -> `/fleet/catalogs/vehicle-types`
  - `vehicle_brand_id` -> `/fleet/catalogs/vehicle-brands`
  - `maintenance_type_id` -> `/fleet/catalogs/maintenance-types`
  - `driver_id` -> `/fleet/drivers`
  - `vehicle_id` -> `/fleet/vehicles`
- [ ] Define label mapping per endpoint shape (`name`, composed labels where needed).
- [ ] Plan migration from current `uuid/text/relation` field declarations to relation contract without changing API payload contracts.

## Phase 5: Future Implementation Tasks (Planned, Not Executed)

- [ ] Implement relation schema normalization helper(s) in renderer adapter layer.
- [ ] Implement relation option loading lifecycle in `AtlasForm`.
- [ ] Integrate combobox/select control rendering for relation fields.
- [ ] Preserve submit payload as scalar relation ID values.
- [ ] Implement edit-mode selected-value hydration for missing preloaded options.
- [ ] Update Fleet form blueprints with relation metadata.
- [ ] Keep implementation generic and blueprint-driven; no `custom.fleet` branch logic in core renderer.

## Phase 6: Verification Checklist (Future Execution)

- [ ] Static checks:
  - `node --check packages/ui/src/atlas-renderer/AtlasForm.jsx`
  - `node --check packages/ui/src/atlas-renderer/renderer-adapters.js`
  - `node --check packages/ui/src/components/FormFields.jsx`
  - `node --check modules/custom/custom.fleet/views/vehicle.form.js`
  - `node --check modules/custom/custom.fleet/views/maintenance.form.js`
  - `node --check modules/custom/custom.fleet/views/driver.form.js` (if modified)
- [ ] Build check:
  - `pnpm.cmd --filter @atlas/desktop build:web`
- [ ] Runtime validation:
  - Vehicle form relation selectors load expected options.
  - Maintenance form relation selectors load expected options.
  - Optional relations clear correctly.
  - Required relations block submit when empty.
  - Edit mode shows readable labels for persisted IDs.
  - Payload inspection confirms IDs only (no labels).

## Phase 7: Documentation / Commit Strategy

- [ ] Update `docs/TASKS.md` only after implementation verification evidence is captured.
- [ ] Keep this spec/plan pass as documentation-only scope.
- [ ] Prepare commit split guidance:
  - docs-only commit for spec/plan
  - implementation commit later (after approval and verification)
- [ ] Do not commit or push from implementation phase without explicit user instruction.
