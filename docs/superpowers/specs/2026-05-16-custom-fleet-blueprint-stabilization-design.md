# custom.fleet + Blueprint Renderer Stabilization Design

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY

## Problem Statement

`BlueprintCrudScreen.parseRouteInfo()` currently assumes only `segments[0]` is the collection path. For multi-segment routes like `/app/m/custom.fleet/catalogs/vehicle-types`, it incorrectly treats:

- `entitySegment = catalogs`
- `recordId = vehicle-types`

This produces invalid detail requests such as `GET /fleet/catalogs/vehicle-types/vehicle-types`.

## Current Behavior

- Route mode inference is based on `segments[1..]` with a single-segment collection assumption.
- PAGE matching is exact-first but not longest-path-first.
- Entity fallback still depends on first URL segment.
- `schema.apiPath` is used by renderer requests, but wrong route parsing can still feed fake record IDs.
- Form presentation is heuristic-only (`shouldUsePageMode`), without explicit `schema.formMode`.

## Desired Behavior

1. Multi-segment collection parsing works for:
   - `/app/m/custom.fleet/catalogs/vehicle-types`
   - `/app/m/custom.fleet/catalogs/vehicle-types/new`
   - `/app/m/custom.fleet/catalogs/vehicle-types/:id`
   - `/app/m/custom.fleet/catalogs/vehicle-types/:id/edit`
2. PAGE blueprints are resolved by longest matching PAGE path before entity guessing.
3. PAGE path source supports `schema.path` and `schema.page.path`.
4. PAGE-to-table resolution supports `schema.view`/`schema.page.view` and `schema.table`/`schema.page.table`.
5. CRUD requests use selected table blueprint `schema.apiPath` exactly, never appending route subsegments as IDs.
6. Renderer supports `schema.formMode`:
   - `page`: force page mode
   - `sheet`: force sheet mode
   - `auto` or missing: keep current heuristic
7. Maintenance can opt into page mode via blueprint metadata (no renderer hardcode).

## Scope

- Stabilize route resolution and mode inference for blueprint-driven CRUD routes.
- Add explicit `schema.formMode` contract support in renderer adapters/view layer.
- Validate maintenance and catalog flows for list/create/detail/edit.
- Preserve existing single-segment routes (`/vehicles`, `/drivers`).

## Out Of Scope

- Relation picker implementation (`vehicle_type_id`, `vehicle_brand_id`, `driver_id`, `maintenance_type_id`, `vehicle_id`).
- New fleet feature expansion.
- Prisma/schema changes, migrations, SDK/validator/maps work.
- Hardcoded `custom.fleet` logic in core renderer.

## Architecture Notes

- Route resolution must derive collection base from matched PAGE path, not from first URL segment.
- Longest PAGE path match avoids ambiguous matches between shallow and deep routes.
- Table blueprint selected from PAGE metadata is the source of truth for CRUD API pathing.
- `schema.apiPath` remains canonical for list/create/detail/edit/delete endpoints.
- `schema.formMode` becomes metadata-driven rendering behavior override.

## File Constraints

Allowed target files for later implementation:

- `apps/desktop/src/shell/BlueprintCrudScreen.jsx`
- `packages/ui/src/atlas-renderer/AtlasCrudView.jsx`
- `packages/ui/src/atlas-renderer/renderer-adapters.js`
- `modules/custom/custom.fleet/views/maintenance.form.js`
- Optional fleet page/form blueprint metadata files if needed for explicit mode/path clarity
- `docs/TASKS.md` only after verification evidence exists

Forbidden files for this stabilization:

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `packages/maps/**`
- `packages/validators/**`
- `packages/sdk/**`
- `apps/api/src/index.js`
- `CLAUDE.md`

## Acceptance Criteria

- Catalog routes support list/create/detail/edit for:
  - `catalogs/vehicle-types`
  - `catalogs/vehicle-brands`
  - `catalogs/maintenance-types`
- Maintenance routes support list/create/detail/edit for:
  - `/app/m/custom.fleet/maintenance`
  - `/app/m/custom.fleet/maintenance/new`
  - `/app/m/custom.fleet/maintenance/:id`
  - `/app/m/custom.fleet/maintenance/:id/edit`
- No generated requests for:
  - `/fleet/catalogs/vehicle-types/vehicle-types`
  - `/fleet/vehicles/m`
  - `/fleet/vehicles/new` as record ID
- No CORS regressions introduced.
- Existing single-segment routes still work:
  - `/app/m/custom.fleet/vehicles`
  - `/app/m/custom.fleet/drivers`
- Renderer remains blueprint-driven (no `custom.fleet` core hardcoding).
- Visible UI copy remains Spanish UTF-8 with accents.
- Desktop web build passes.

## Verification Checklist

- Route parser/unit-level route matrix check for all target URLs.
- Blueprint selection check:
  - Longest PAGE path chosen
  - PAGE references resolve to expected TABLE blueprint
- Request path checks confirm exact `schema.apiPath` usage for all CRUD modes.
- Manual browser validation for catalog and maintenance route families.
- Console/network audit confirms no fake ID requests and no new CORS errors.
- Regression smoke for `/vehicles` and `/drivers`.
- `pnpm --filter @atlas/desktop build:web` passes.

## Follow-Up Specs

1. `Blueprint Schema Expansion` (new spec required)
   - Relation picker UX and relation field schema expansion.
   - Known deferred fields:
     - `vehicle_type_id`
     - `vehicle_brand_id`
     - `driver_id`
     - `maintenance_type_id`
     - `vehicle_id`
