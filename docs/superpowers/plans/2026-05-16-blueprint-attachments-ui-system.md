# Blueprint Attachments UI System + Fleet Form Attachments Opt-in - Implementation Plan

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY  
Spec: `docs/superpowers/specs/2026-05-16-blueprint-attachments-ui-system-design.md`

## Execution rules

1. No implementation until explicit approval.
2. No Prisma schema or migration changes in this plan.
3. No module-specific hardcoding in core renderer.
4. Keep visible UI copy Spanish UTF-8 with accents.

## Phase 1: Current Files/Documents/UI audit

1. Audit current `DocumentsPanel` behavior and constraints.
2. Audit `AtlasForm` and `AtlasDetail` section rendering capabilities.
3. Audit shared file components (`FileUploader`, `FileCard`, `FileViewer`).
4. Audit `/files/upload` and `/files/:id/signed-url` usage contracts.
5. Audit Fleet document association route shapes.

Deliverables:
1. Contract matrix: current responses vs required attachments contract.
2. Gap list for create/edit lifecycle support.

## Phase 2: Reusable attachments component architecture

1. Define reusable component set in `packages/ui`:
   - `AttachmentsDropzone`
   - `AttachmentsList`
   - `AttachmentCard`
   - `AttachmentViewer`
   - `AttachmentsAside`
   - `AttachmentsPanel`
2. Define `useAttachmentsController` hook responsibilities:
   - queue management
   - upload/attach/remove flow
   - retry logic
   - state transitions
3. Define compatibility layer with existing `DocumentsPanel`.

Deliverables:
1. Component responsibility map.
2. State machine for attachments controller.

## Phase 3: Blueprint metadata contract

1. Finalize canonical `type: "attachments"` contract.
2. Define backward compatibility for `type: "documents"` alias.
3. Define required vs optional metadata keys:
   - paths
   - upload config
   - field mapping
   - permissions
   - mode and placement
4. Define safe defaults and invalid-config fallback behavior.

Deliverables:
1. Final metadata schema examples for form/detail.
2. Validation and fallback rules.

## Phase 4: Form create/edit lifecycle design

1. Create mode design:
   - pending queue before parent exists
   - post-create upload+associate batch flow
   - per-file retry model
2. Edit mode design:
   - existing attachments list load
   - immediate upload default for new files
   - soft-remove flow
3. Define transaction boundaries and failure behavior:
   - attachment failures do not crash parent form state
   - warnings shown in Spanish

Deliverables:
1. Create/edit sequence diagrams.
2. Failure policy matrix.

## Phase 5: Detail/DocumentsPanel refactor strategy

1. Choose strategy:
   - retain `DocumentsPanel` as wrapper over shared attachments logic, or
   - replace internals with shared `AttachmentsPanel` while keeping metadata compatibility.
2. Ensure detail UX parity for list/open/download/remove.
3. Preserve existing Fleet detail behavior during transition.

Deliverables:
1. Compatibility strategy decision.
2. Regression checklist for detail views.

## Phase 6: Renderer integration plan

1. `AtlasForm` integration:
   - render attachments section by metadata
   - support `placement: aside` and mobile fallback
2. `AtlasDetail` integration:
   - render embedded attachments panel
   - support both `documents` and `attachments` section naming
3. Keep renderer generic and module-agnostic.

Deliverables:
1. Renderer touchpoints and props contract.
2. No-hardcoding compliance checklist.

## Phase 7: Fleet opt-in blueprint plan

1. Add attachments metadata to:
   - `vehicle.form.js`
   - `driver.form.js`
   - `maintenance.form.js`
2. Keep Fleet-specific paths/entityType/permissions in metadata only.
3. Ensure Fleet detail metadata remains compatible.

Deliverables:
1. Fleet form metadata mapping table.
2. Migration notes for detail metadata naming.

## Phase 8: Runtime verification

1. Run safe local tokenless metadata sync strategy (service-level script) where possible.
2. Verify runtime `AtlasView` schemas contain attachments metadata.
3. Verify no schema drift in unrelated modules.
4. Verify API contracts still satisfy list/upload/signed-url/remove requirements.

Deliverables:
1. Runtime metadata evidence summary.
2. API contract verification summary.

## Phase 9: Browser/manual verification

1. Vehicle create form:
   - attachments aside visible on desktop
   - mobile fallback behavior works
   - staged files survive parent form edits
2. Vehicle edit form:
   - existing attachments load
   - add/remove works
3. Driver and maintenance forms:
   - same reusable behavior via metadata opt-in
4. Detail screens:
   - document/attachments panel still works

Deliverables:
1. Browser evidence checklist with pass/fail notes.

## Phase 10: Documentation and commit strategy

1. Update `docs/TASKS.md` only with evidence-backed verification.
2. Keep partial status if browser verification is pending.
3. Suggested commit split (future implementation):
   - Commit A: shared attachments controller/components
   - Commit B: renderer integration (`AtlasForm`/`AtlasDetail`)
   - Commit C: Fleet form/detail metadata opt-in
   - Commit D: documentation verification update

Deliverables:
1. Honest verification log.
2. Clean commit strategy without history rewrites.

## Suggested implementation file map (future)

Renderer/UI:
1. `packages/ui/src/components/AttachmentsDropzone.jsx`
2. `packages/ui/src/components/AttachmentsList.jsx`
3. `packages/ui/src/components/AttachmentCard.jsx`
4. `packages/ui/src/components/AttachmentViewer.jsx`
5. `packages/ui/src/components/AttachmentsAside.jsx`
6. `packages/ui/src/components/AttachmentsPanel.jsx`
7. `packages/ui/src/hooks/useAttachmentsController.js` (or colocated equivalent)
8. `packages/ui/src/atlas-renderer/AtlasForm.jsx`
9. `packages/ui/src/atlas-renderer/AtlasDetail.jsx`
10. `packages/ui/src/index.js`

Fleet metadata opt-in:
1. `modules/custom/custom.fleet/views/vehicle.form.js`
2. `modules/custom/custom.fleet/views/driver.form.js`
3. `modules/custom/custom.fleet/views/maintenance.form.js`
4. Optional: Fleet detail view metadata normalization if alias strategy is selected.

## Verification command template (future implementation)

1. `node --check` for modified non-JSX files.
2. Document `ERR_UNKNOWN_FILE_EXTENSION` when `node --check` is not valid for `.jsx`.
3. `pnpm.cmd --filter @atlas/desktop build:web`.
4. Safe local runtime metadata sync and schema verification.
5. API smoke for upload/list/signed-url/remove flows.
6. Manual browser verification of create/edit/detail attachments UX.
