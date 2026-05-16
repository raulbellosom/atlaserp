# custom.fleet Catalog Hub Tabs - Implementation Plan

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY  
Spec: `docs/superpowers/specs/2026-05-16-custom-fleet-catalog-hub-tabs-design.md`

## Execution rule

1. No implementation until explicit approval.
2. This plan is design-time sequencing only.
3. Scope is limited to catalog discoverability + hub UX; no feature expansion.

## File structure map (planned for future implementation)

Primary candidates:

1. `modules/custom/custom.fleet/module.manifest.js`
2. `apps/desktop/src/shell/BlueprintCrudScreen.jsx`
3. `packages/ui/src/atlas-renderer/AtlasCrudView.jsx` (only if truly needed for tab/header composition)
4. Optional: new Fleet hub PAGE view file if route-base blueprint is required:
   - `modules/custom/custom.fleet/views/catalog.hub.page.js` (name to finalize during implementation)

Docs after verification only:

1. `docs/TASKS.md`

Forbidden:

1. `prisma/schema.prisma`
2. `prisma/migrations/**`
3. `packages/maps/**`
4. `packages/validators/**`
5. `packages/sdk/**`
6. `apps/api/src/index.js`

## Phase 1: Current catalog route/navigation audit

1. Confirm current manifest navigation:
   - `Catálogos` -> `/catalogs/vehicle-types`
   - `Modelos de vehículo` -> `/catalogs/vehicle-models`
2. Confirm all four catalog PAGE blueprints exist and are enabled.
3. Confirm each PAGE resolves to the existing table/form/detail CRUD flow.
4. Confirm runtime metadata remains healthy after sync:
   - `economic_group_number` present on vehicle types form
   - relation inline create metadata present on affected forms

## Phase 2: UX decision

1. Adopt single sidebar entry:
   - `Catálogos` -> `/app/m/custom.fleet/catalogs`
2. Define hub tab set:
   - `Tipos de vehículo`
   - `Marcas de vehículo`
   - `Modelos de vehículo`
   - `Tipos de mantenimiento`
3. Define route-first tab behavior:
   - tab click navigates to existing catalog routes
   - active tab computed from URL
4. Define `/catalogs` base behavior:
   - default to `vehicle-types` without losing hub tab UI.

## Phase 3: Implementation plan (future, not executed now)

1. Manifest cleanup:
   - remove separate `Modelos de vehículo` sidebar item
   - set single `Catálogos` entry to `/app/m/custom.fleet/catalogs`
2. Route strategy:
   - ensure `/catalogs` base route resolves (hub PAGE alias or generic fallback)
3. Shell strategy (recommended generic):
   - enhance `BlueprintCrudScreen` to detect grouped catalog pages under `/catalogs/*`
   - render generic tabs above existing `AtlasCrudView`
   - keep CRUD rendering path unchanged
4. Preserve direct deep links:
   - `/catalogs/vehicle-types`
   - `/catalogs/vehicle-brands`
   - `/catalogs/vehicle-models`
   - `/catalogs/maintenance-types`
5. Ensure no Fleet-specific CRUD branching in renderer internals.

## Phase 4: Module sync and runtime verification

1. Run static checks on modified files.
2. Run desktop build:
   - `pnpm.cmd --filter @atlas/desktop build:web`
3. Run authenticated module sync:
   - `POST /modules/sync` using `$ATLAS_TOKEN` placeholder only in docs/logs
4. Verify runtime metadata:
   - hub/page routes present and enabled
   - vehicle types form still has `economic_group_number`
   - relation inline create metadata remains present
5. Manual UI verification:
   - one sidebar `Catálogos` entry
   - hub tabs visible and route-linked
   - each tab CRUD working
   - direct route deep links still valid

## Phase 5: Documentation and commit strategy

1. Update `docs/TASKS.md` only after all verification evidence is collected.
2. Keep commit sequence clear:
   - Commit A: navigation + route/hub behavior
   - Commit B: verification/docs updates
3. Do not commit/push automatically without explicit instruction.

## Verification checklist (future execution)

1. `node --check apps/desktop/src/shell/BlueprintCrudScreen.jsx` (if supported in environment)
2. `node --check modules/custom/custom.fleet/module.manifest.js`
3. `pnpm.cmd --filter @atlas/desktop build:web`
4. Authenticated module sync result captured
5. Runtime AtlasView checks for catalog pages/forms captured
6. Browser checks:
   - hub tabs + active tab by URL
   - CRUD create/edit/detail in all 4 tabs
   - `Número económico de grupo` visible in vehicle type form
   - inline-create metadata behavior unchanged
