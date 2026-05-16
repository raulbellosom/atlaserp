# custom.fleet DocumentsPanel UI - Implementation Plan

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY  
Spec: `docs/superpowers/specs/2026-05-16-custom-fleet-documents-panel-ui-design.md`

## Execution rule

1. No implementation until explicit approval.
2. This document is planning-only.
3. Scope is UI/UX integration over existing document APIs; no Prisma work.

## Phase 0 status

1. Status: Draft.
2. Current backend inventory already includes document association APIs in:
   - `modules/custom/custom.fleet/api/vehicles-routes.js`
   - `modules/custom/custom.fleet/api/drivers-routes.js`
   - `modules/custom/custom.fleet/api/maintenance-routes.js`
3. No dedicated `vehicle-documents-routes.js` / `driver-documents-routes.js` / `maintenance-documents-routes.js` files exist currently.

## Planned file structure map (future implementation)

Primary candidates:
1. `packages/ui/src/components/DocumentsPanel.jsx` (new reusable panel)
2. `packages/ui/src/atlas-renderer/AtlasDetail.jsx` (generic metadata block rendering support)
3. `packages/ui/src/index.js` (export `DocumentsPanel`)
4. `modules/custom/custom.fleet/views/vehicle.detail.js` (documents metadata)
5. `modules/custom/custom.fleet/views/driver.detail.js` (documents metadata)
6. `modules/custom/custom.fleet/views/maintenance.detail.js` (documents metadata)

Conditional:
1. `packages/ui/src/atlas-renderer/AtlasCrudView.jsx` only if detail context wiring is required.
2. `packages/ui/src/components/Dialog.jsx` only if minor reusable dialog behavior updates are required.

Documentation after verified implementation:
1. `docs/TASKS.md`

Forbidden:
1. `prisma/schema.prisma`
2. `prisma/migrations/**`
3. `apps/api/src/index.js`
4. Any dashboard/report/AME3 Phase 4 files

## Phase 1: Existing API/model audit

1. Confirm exact document models and table intent:
   - `vehicle-document.model.js`
   - `driver-document.model.js`
   - `maintenance-document.model.js`
2. Confirm document routes and permissions for list/add/remove per entity.
3. Confirm upload/download dependencies:
   - `POST /files/upload`
   - `GET /files/:id/signed-url`
4. Confirm response shapes used by current services:
   - association row
   - nested `file_asset` metadata
5. Identify any missing critical endpoint support; document gaps before UI coding.

Deliverable:
1. API inventory notes embedded in implementation PR description and verification checklist.

## Phase 2: UI contract design

1. Define `DocumentsPanel` public props contract (generic):
   - `recordId`
   - endpoint templates (`listPath`, `addPath`, `removePath`)
   - upload config (`entityType`, `moduleKey`, upload endpoint)
   - permission keys
   - field mapping config
2. Define panel state machine:
   - idle/loading/error/empty/ready/uploading/removing
3. Define Spanish copy set for all states and actions.
4. Define action handlers:
   - upload file
   - attach association
   - resolve signed URL and open/download
   - soft-remove association

Deliverable:
1. Stable prop contract that can be consumed from `AtlasDetail` metadata blocks.

## Phase 3: Detail blueprint metadata design

1. Add metadata block to each Fleet detail blueprint section:
   - `type: "documents"`
   - `documents: { ... }`
2. Configure per-entity values:
   - vehicle routes/entity type/permissions
   - driver routes/entity type/permissions
   - maintenance routes/entity type/permissions
3. Keep API path strings fully module-local in blueprint files.
4. Ensure metadata remains compatible with module sync runtime storage.

Deliverable:
1. Three detail blueprints opt in with explicit documents contract.

## Phase 4: Implementation plan

1. Create reusable `DocumentsPanel` component in `packages/ui`.
2. Extend `AtlasDetail` generically to render non-field section blocks (`type: "documents"`).
3. Keep existing field rendering behavior unchanged for standard sections.
4. Wire panel actions to existing APIs:
   - upload -> attach -> refresh
   - open/download via signed URL
   - remove (soft-disable) -> refresh
5. Add optimistic refresh strategy without full page reload.
6. Add robust error boundaries per panel action to avoid detail screen crashes.

Guardrails:
1. No `custom.fleet` hardcoded branching in renderer.
2. No backend endpoint additions unless a hard blocker is discovered and approved.

## Phase 5: Runtime/API verification

1. Run authenticated `POST /modules/sync` after blueprint metadata changes.
2. Validate runtime `AtlasView` detail schemas include documents metadata blocks.
3. API smoke per entity:
   - list documents
   - upload file
   - attach association
   - remove association
4. Verify permission handling:
   - friendly Spanish errors on 401/403/validation failures.

## Phase 6: Browser/manual verification

1. Vehicle detail:
   - panel visible
   - list/upload/open/remove flow works
2. Driver detail:
   - panel visible
   - list/upload/open/remove flow works
3. Maintenance detail:
   - panel visible
   - list/upload/open/remove flow works
4. UX checks:
   - clear Spanish loading/empty/error states
   - no full-page reload required after upload
   - no regressions in existing detail sections/actions

## Phase 7: Documentation and commit strategy

1. Update `docs/TASKS.md` only after verification evidence exists.
2. Record verification command outputs with concrete dates.
3. Suggested commit split (future):
   - Commit A: renderer/ui + blueprint metadata
   - Commit B: docs verification update
4. Do not claim browser verification unless manually executed.

## Verification checklist template for implementation session

1. `node --check packages/ui/src/components/DocumentsPanel.jsx` (if added)
2. `node --check packages/ui/src/atlas-renderer/AtlasDetail.jsx` (or document `.jsx` node-check limitation)
3. `node --check modules/custom/custom.fleet/views/vehicle.detail.js`
4. `node --check modules/custom/custom.fleet/views/driver.detail.js`
5. `node --check modules/custom/custom.fleet/views/maintenance.detail.js`
6. `pnpm.cmd --filter @atlas/desktop build:web`
7. Authenticated `POST /modules/sync` (`$ATLAS_TOKEN` placeholder only)
8. Runtime schema verification for all three detail views
9. Manual browser checks for all acceptance criteria
