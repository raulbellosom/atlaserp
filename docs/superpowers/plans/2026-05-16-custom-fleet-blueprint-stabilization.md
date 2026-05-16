# custom.fleet + Blueprint Renderer Stabilization Plan

Date: 2026-05-16  
Status: Draft  
Spec: `docs/superpowers/specs/2026-05-16-custom-fleet-blueprint-stabilization-design.md`  
Mode: SPEC + PLAN ONLY

## Execution Rule

- No implementation work starts until explicit user approval.
- This plan is design-only and task-sequenced for later execution.

## Phase 1: Discovery / Read-Only Validation

- [ ] Re-read current renderer route logic in `BlueprintCrudScreen.parseRouteInfo()`.
- [ ] Re-read PAGE/table lookup logic in `selectBlueprints()`.
- [ ] Verify current behavior against required catalog and maintenance route matrix.
- [ ] Capture current invalid request patterns (`.../vehicle-types/vehicle-types`, `/fleet/vehicles/m`, `/fleet/vehicles/new` as ID).
- [ ] Confirm no changes needed in forbidden files.

## Phase 2: Route Resolution Design

- [ ] Define collection base extraction from matched PAGE path (supports multi-segment paths).
- [ ] Define longest-PAGE-path-first resolver across PAGE blueprints.
- [ ] Define PAGE schema path priority: `schema.path` then `schema.page.path`.
- [ ] Define PAGE view/table reference resolution priority:
  - `schema.view` -> `schema.page.view` -> `schema.table` -> `schema.page.table`
- [ ] Define fallback rules when PAGE match is missing, preserving existing single-segment behavior.

## Phase 3: `schema.formMode` Design

- [ ] Add metadata contract for `schema.formMode` in renderer behavior:
  - `page` = force page mode
  - `sheet` = force sheet mode
  - `auto`/missing = current heuristic
- [ ] Define precedence: explicit mode always wins over heuristic.
- [ ] Define fleet maintenance metadata update approach (`maintenance.form.js`) without core hardcoding.

## Phase 4: Implementation Tasks (Planned, Not Executed Yet)

- [ ] Update `apps/desktop/src/shell/BlueprintCrudScreen.jsx` route parsing and PAGE matching.
- [ ] Update `packages/ui/src/atlas-renderer/renderer-adapters.js` to support explicit `schema.formMode`.
- [ ] Update `packages/ui/src/atlas-renderer/AtlasCrudView.jsx` to consume explicit form mode override.
- [ ] Update `modules/custom/custom.fleet/views/maintenance.form.js` (or related blueprint metadata) to opt into desired form mode.
- [ ] Keep implementation generic and blueprint-driven; do not add `custom.fleet`-specific conditions in core renderer files.

## Phase 5: Runtime / Browser Validation Checklist

- [ ] Validate maintenance UI routes:
  - `/app/m/custom.fleet/maintenance`
  - `/app/m/custom.fleet/maintenance/new`
  - `/app/m/custom.fleet/maintenance/:id`
  - `/app/m/custom.fleet/maintenance/:id/edit`
- [ ] Validate maintenance API paths:
  - `/fleet/maintenance`
  - `/fleet/maintenance/:id`
- [ ] Validate catalog UI routes for:
  - `catalogs/vehicle-types`
  - `catalogs/vehicle-brands`
  - `catalogs/maintenance-types`
  with list/new/detail/edit variants.
- [ ] Confirm no bad requests are emitted:
  - `/fleet/catalogs/vehicle-types/vehicle-types`
  - `/fleet/vehicles/m`
  - `/fleet/vehicles/new` as ID
- [ ] Confirm no CORS regressions.
- [ ] Regression-check single-segment routes:
  - `/app/m/custom.fleet/vehicles`
  - `/app/m/custom.fleet/drivers`
- [ ] Run desktop build:
  - `pnpm --filter @atlas/desktop build:web`

## Phase 6: Documentation and Commit Instructions

- [ ] If implementation is approved and completed, update `docs/TASKS.md` only with explicit verification evidence.
- [ ] Keep relation picker work out of this stabilization and document it as follow-up spec `Blueprint Schema Expansion`.
- [ ] Prepare clean commit scope limited to allowed files.
- [ ] Do not commit or push until explicit user instruction.
