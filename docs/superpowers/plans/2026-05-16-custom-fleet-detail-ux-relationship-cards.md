# custom.fleet Detail UX & Relationship Cards - Implementation Plan

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY  
Spec: `docs/superpowers/specs/2026-05-16-custom-fleet-detail-ux-relationship-cards-design.md`

## Execution rules

1. No implementation until explicit approval.
2. Plan is limited to detail UX, relation cards/lists, and icon mapping diagnostics/fixes.
3. No Prisma changes in this plan.

## Phase 1: Current detail/API audit

1. Audit current Fleet detail payloads and identify missing enriched relation fields:
   - Vehicle detail (`driver_id` visible issue)
   - Driver detail (missing assigned vehicles list API)
   - Maintenance detail (ensure readable maintenance type and relation labels)
2. Confirm current renderer behavior in `AtlasDetail` for section-type support baseline.
3. Confirm DocumentsPanel coexistence path in detail sections.

Deliverables:
1. Gap matrix: current field vs required UX field.
2. API enrichment checklist.

## Phase 2: Metadata contract design

1. Finalize `field.icon` contract for detail fields.
2. Finalize `relation-card` section contract:
   - `idField`, `titleField`, `subtitleFields`, `fallbackTitle`, `hrefTemplate`, `icon`
3. Finalize `relation-list` section contract:
   - `apiPath`, `titleField`, `subtitleFields`, `hrefTemplate`, `icon`, optional `emptyMessage`
4. Define fallback behavior when metadata is invalid/missing.

Deliverables:
1. Renderer contract notes in code comments/spec references.
2. Blueprint metadata examples per entity.

## Phase 3: API enrichment plan

1. Enrich vehicle service queries to include driver-readable fields (`driver_name`, optional phone/license).
2. Add company-scoped endpoint `GET /fleet/drivers/:id/vehicles` returning lightweight assigned vehicle cards.
3. Ensure maintenance service returns consistent relation display fields (`vehicle_plate`, `driver_full_name`, `maintenance_type_name`).
4. Keep route handlers thin and service-layer based.

Deliverables:
1. Updated routes/service methods and smoke test targets.
2. No permission key expansion unless strictly necessary.

## Phase 4: Renderer implementation plan

1. Extend `AtlasDetail` generically for:
   - `section.type === "relation-card"`
   - `section.type === "relation-list"`
2. Add icon rendering for detail fields when `field.icon` is present.
3. Preserve existing `fields` and `documents` section behavior with no regressions.
4. Maintain metadata-driven behavior without `custom.fleet` hardcoding.

Deliverables:
1. Generic renderer support for new section types.
2. Graceful empty/error rendering in Spanish.

## Phase 5: Fleet blueprint update plan

1. Update `vehicle.detail.js`:
   - replace plain driver UUID section with `relation-card`
   - apply icon metadata in general fields
2. Update `driver.detail.js`:
   - add profile-style relation card grouping metadata
   - add `relation-list` for assigned vehicles
3. Update `maintenance.detail.js`:
   - add vehicle and driver relation cards
   - keep operational groups + documents section
4. Ensure DocumentsPanel section remains present and functional.

Deliverables:
1. Blueprint metadata-only enhancements for all three detail views.

## Phase 6: Sidebar icon audit/fix plan

1. Audit icon resolution path in `ModuleSidebar`/icon map.
2. Add missing icon mappings for Fleet icon names (`Truck`, `Wrench`, `UserCheck`, and optional `ClipboardList`/`Library` aliases).
3. Confirm fallback behavior remains safe for unknown icon names.

Deliverables:
1. Fleet sidebar icons render as intended without Box fallback.

## Phase 7: Verification checklist

1. Static checks:
   - modified API/service/blueprint files via `node --check`
   - document `.jsx` check limitations if runtime rejects extension
2. Build check:
   - `pnpm.cmd --filter @atlas/desktop build:web`
3. Runtime sync:
   - tokenless local module metadata sync service or authenticated sync flow
4. Runtime metadata verification:
   - inspect `AtlasView` schemas for relation-card/list metadata
5. API smoke:
   - `GET /fleet/vehicles/:id` enriched relation fields
   - `GET /fleet/drivers/:id/vehicles` list shape (if added)
   - `GET /fleet/maintenance/:id` enriched relation fields
6. Browser/manual:
   - vehicle detail relation card shows readable driver + link
   - driver detail assigned vehicles list links work
   - maintenance relation cards and links work
   - DocumentsPanel still appears and behaves
   - sidebar Fleet icons are correct

## Phase 8: Documentation and commit strategy

1. Update `docs/TASKS.md` only after evidence-backed runtime/browser verification.
2. Commit strategy (future implementation phase):
   - Commit A: API enrichment
   - Commit B: renderer generic relation cards/lists + icon support
   - Commit C: Fleet detail metadata updates
   - Commit D: docs verification update
3. Do not overclaim browser verification when not executed.

## Candidate implementation file map (future)

Renderer/UI:
1. `packages/ui/src/atlas-renderer/AtlasDetail.jsx`
2. `packages/ui/src/atlas-renderer/AtlasCrudView.jsx` (only if extra context wiring is needed)
3. `packages/ui/src/components/ModuleSidebar.jsx` (icon mapping fix)

Fleet views:
1. `modules/custom/custom.fleet/views/vehicle.detail.js`
2. `modules/custom/custom.fleet/views/driver.detail.js`
3. `modules/custom/custom.fleet/views/maintenance.detail.js`

Fleet API/services (if enrichment required):
1. `modules/custom/custom.fleet/api/fleet-service.js`
2. `modules/custom/custom.fleet/api/driver-service.js`
3. `modules/custom/custom.fleet/api/maintenance-service.js`
4. `modules/custom/custom.fleet/api/drivers-routes.js`
5. `modules/custom/custom.fleet/api/vehicles-routes.js`
6. `modules/custom/custom.fleet/api/maintenance-routes.js`

Docs after verification:
1. `docs/TASKS.md`
