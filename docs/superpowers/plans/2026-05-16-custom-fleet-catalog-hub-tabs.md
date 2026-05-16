# custom.fleet Catalog Hub Tabs - Implementation Plan

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY  
Spec: `docs/superpowers/specs/2026-05-16-custom-fleet-catalog-hub-tabs-design.md`

## Execution rule

1. No implementation until explicit approval.
2. This plan is sequencing-only.
3. Scope is UI/navigation only; no DB/API contract changes.

## File structure map (planned)

Primary:

1. `modules/custom/custom.fleet/module.manifest.js`
2. `apps/desktop/src/shell/BlueprintCrudScreen.jsx`

Conditional:

1. `packages/ui/src/atlas-renderer/AtlasCrudView.jsx` only if needed (prefer avoid).
2. `modules/custom/custom.fleet/views/catalog.hub.page.js` only if base route resolution cannot be done safely in shell logic.

Documentation (post-verification only):

1. `docs/TASKS.md`

Forbidden:

1. `prisma/schema.prisma`
2. `prisma/migrations/**`
3. `packages/maps/**`
4. `packages/validators/**`
5. `packages/sdk/**`
6. `apps/api/src/index.js`

## Phase 1: Current catalog route/navigation audit

1. Confirm current sidebar entries and their paths.
2. Confirm all four catalog PAGE blueprints and routes are available.
3. Confirm direct catalog routes already work in `BlueprintCrudScreen`.
4. Confirm runtime metadata sanity after sync:
   - vehicle types form still has `economic_group_number`
   - relation inline-create metadata remains present

## Phase 2: UX decision

1. Finalize one-sidebar-entry model:
   - `Catálogos` -> `/app/m/custom.fleet/catalogs`
2. Finalize hub tabs and labels:
   - Tipos de vehículo
   - Marcas de vehículo
   - Modelos de vehículo
   - Tipos de mantenimiento
3. Finalize base route behavior:
   - default route to `/catalogs/vehicle-types` via replace navigation.
4. Finalize route-driven active tab strategy.

## Phase 3: Implementation plan (future coding tasks)

1. Manifest cleanup
   - remove separate `Modelos de vehículo` sidebar entry
   - retarget `Catálogos` to `/app/m/custom.fleet/catalogs`
2. Shell enhancement in `BlueprintCrudScreen`
   - detect grouped catalog pages from route prefix and/or page metadata
   - render tab bar above existing CRUD content
   - navigate tabs by route change only
3. Preserve existing CRUD rendering
   - keep selection/fields/CRUD pipeline unchanged
   - avoid duplicating table/form/detail logic
4. Optional metadata (only if needed)
   - add generic group/tab metadata on catalog PAGE blueprints
   - avoid module-specific hardcoded branching
5. Avoid touching `AtlasCrudView` unless essential.

## Phase 4: Module sync and runtime verification

1. Run static checks:
   - `node --check modules/custom/custom.fleet/module.manifest.js`
   - `node --check apps/desktop/src/shell/BlueprintCrudScreen.jsx` (or document `.jsx` checker limitation)
2. Build check:
   - `pnpm.cmd --filter @atlas/desktop build:web`
3. Run authenticated sync:
   - `POST /modules/sync` with `$ATLAS_TOKEN` placeholder only in logs/docs
4. Verify runtime metadata:
   - catalog PAGE routes enabled
   - vehicle type form still includes `economic_group_number`
   - relation inline-create metadata still present
5. Browser/manual checks:
   - one sidebar catalog entry
   - hub tabs visible and functional
   - deep-link + refresh behavior correct
   - CRUD flows intact across all four tabs

## Phase 5: Documentation and commit strategy

1. Update `docs/TASKS.md` only after verified evidence exists.
2. Use clear commit separation:
   - Commit A: navigation + hub tab route UX
   - Commit B: docs verification update
3. Do not commit or push without explicit instruction.

## Verification checklist (future run)

1. `node --check modules/custom/custom.fleet/module.manifest.js`
2. `node --check apps/desktop/src/shell/BlueprintCrudScreen.jsx` (or document `ERR_UNKNOWN_FILE_EXTENSION` and rely on build)
3. `pnpm.cmd --filter @atlas/desktop build:web`
4. Authenticated module sync result captured.
5. Runtime schema checks captured for:
   - `economic_group_number` field
   - relation inline-create metadata
6. Manual UI checks captured for all acceptance criteria.
