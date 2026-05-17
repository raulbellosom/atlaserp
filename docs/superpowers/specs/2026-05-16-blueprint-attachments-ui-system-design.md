# Blueprint Attachments UI System + Fleet Form Attachments Opt-in

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY

## 1. Feature title

Blueprint Attachments UI System + Fleet Form Attachments Opt-in

## 2. Status

Draft

## 3. Context

`custom.fleet` currently has a working `DocumentsPanel` in detail screens and recently improved relation/detail UX. That solves read-oriented document operations, but Atlas ERP now needs equivalent attachment workflows during create/edit forms and across future modules, not only Fleet.

## 4. Problem

Current attachment UX is detail-centric and module-adjacent:

1. Attachments are not first-class in `AtlasForm` create/edit lifecycle.
2. Pending files before parent record creation are not modeled generically.
3. Upload/retry/remove/open behavior is implemented for details but not standardized as a renderer-wide contract.
4. Re-implementing this per module would create duplication and drift.

## 5. Goals

1. Define a reusable, blueprint-driven attachments UI system in `packages/ui`.
2. Support create mode, edit mode, and detail mode through one contract.
3. Keep module API paths and entity specifics in blueprint metadata.
4. Let Fleet opt in via metadata only (no Fleet hardcoding in renderer).
5. Preserve/bridge existing `DocumentsPanel` behavior while converging to a shared attachments model.

## 6. Non-goals

1. No Prisma schema changes.
2. No storage bucket redesign.
3. No OCR or AI document classification.
4. No document versioning.
5. No drag sorting or bulk delete.
6. No dashboards/reports/AME3 Phase 4 scope.

## 7. Why this is an Atlas-wide reusable system

Attachments are a horizontal ERP capability (HR dossiers, finance evidence, contacts contracts, maintenance files, legal docs). The solution must be:

1. Renderer-compatible (`AtlasForm` and `AtlasDetail`).
2. Metadata-driven.
3. API-agnostic with field mapping.
4. Reusable for any module that exposes list/add/remove + signed URL behavior.

## 8. Current inventory and limitations

### Existing assets

1. `DocumentsPanel.jsx` implements list/upload/open/download/remove for detail views.
2. Shared file components already exist:
   - `FileUploader`
   - `FileCard`
   - `FileViewer`
3. Existing backend endpoints:
   - `POST /files/upload`
   - `GET /files/:id/signed-url`
4. Fleet association endpoints exist for vehicle/driver/maintenance documents.

### Current limitations

1. No generic form-side attachments panel contract.
2. No staged upload queue for parentless create mode.
3. No standardized controller/hook for upload state machine across modes.
4. `type: "documents"` is detail-specific naming, not lifecycle-generic.

## 9. Proposed reusable architecture

### 9.1 Core components (packages/ui)

1. `AttachmentsDropzone`
2. `AttachmentsList`
3. `AttachmentCard`
4. `AttachmentViewer`
5. `AttachmentsAside`
6. `AttachmentsPanel`
7. `useAttachmentsController`

### 9.2 Design principle

`AttachmentsPanel` is the orchestration UI. Other components are composable internals. `DocumentsPanel` may become:

1. A thin compatibility wrapper over `AttachmentsPanel`, or
2. Fully replaced by `AttachmentsPanel` with a backward-compatible metadata alias.

### 9.3 Renderer integration points

1. `AtlasForm`: support section type for attachments with form-aware lifecycle.
2. `AtlasDetail`: support same attachments core in embedded mode.

## 10. Blueprint metadata contract (proposed)

### 10.1 Unified section type

Preferred canonical type:

1. `type: "attachments"`

Backward compatibility:

1. Keep `type: "documents"` accepted as alias in v1 transition.
2. Internally normalize both to the same attachments renderer block.

### 10.2 Metadata shape

```js
{
  id: "attachments",
  type: "attachments",
  label: "Documentos",
  placement: "aside", // aside | embedded
  attachments: {
    recordType: "vehicle",
    createMode: "stage-until-parent-create", // or upload-immediately-if-possible
    editMode: "upload-immediately", // recommended default
    listPath: "/fleet/vehicles/:id/documents",
    addPath: "/fleet/vehicles/:id/documents",
    removePath: "/fleet/vehicles/:id/documents/:docId",
    upload: {
      endpoint: "/files/upload",
      moduleKey: "custom.fleet",
      entityType: "FleetVehicle"
    },
    signedUrl: {
      endpointTemplate: "/files/:fileId/signed-url"
    },
    fields: {
      id: "id",
      fileAssetId: "file_asset_id",
      documentType: "document_type",
      label: "label",
      createdAt: "created_at",
      enabled: "enabled",
      fileAsset: "file_asset",
      fileName: "originalName",
      mimeType: "mimeType",
      sizeBytes: "sizeBytes"
    },
    permissions: {
      read: "fleet.vehicles.read",
      create: "fleet.vehicles.update",
      remove: "fleet.vehicles.update",
      fileUpload: "files.assets.create",
      fileRead: "files.assets.read"
    },
    limits: {
      maxFiles: 20,
      maxSizeMB: 10,
      allowMultiple: true
    }
  }
}
```

## 11. Lifecycle design

### 11.1 Create mode (no parent record yet)

1. User can drop/select multiple files into pending queue.
2. Pending entries track status: `pending | uploading | attaching | success | error`.
3. After parent create success (record id available):
   - upload each pending file via `upload.endpoint`
   - associate via `addPath`
4. On per-file failure:
   - keep item in error state
   - allow retry for upload/association only
5. Parent form state must remain intact on attachment errors.

### 11.2 Edit mode (parent exists)

Recommended default: `upload-immediately`.

1. Load existing associated attachments from `listPath`.
2. New files upload+associate immediately.
3. Remove action performs soft-remove via `removePath`.
4. Optional future mode (`stage-until-save`) can be contract-ready but not required in first implementation.

### 11.3 Detail mode

1. Reuse `AttachmentsPanel` in embedded/read-optimized layout.
2. Preserve existing DocumentsPanel user expectations.
3. Avoid regression in current detail workflows.

## 12. UX behavior

### 12.1 Interaction support

1. Dropzone + click-to-select.
2. Multiple file selection.
3. Image thumbnails.
4. Non-image file cards (icon + metadata).
5. Open/view/download.
6. Remove pending file.
7. Soft-remove associated file.
8. Retry failed uploads/associations.

### 12.2 Responsive layout

1. Forms desktop: right-side aside panel.
2. Forms mobile: stacked or collapsible panel.
3. Details: embedded panel section.

### 12.3 State model

1. `idle`
2. `loading`
3. `empty`
4. `ready`
5. `uploading`
6. `partial-error`
7. `removing`
8. `error`

## 13. File-type handling

1. Images: preview thumbnail + viewer support.
2. PDFs: file card + open/view via signed URL.
3. Office docs: file card + open/download.
4. Unknown files: generic file card fallback.

## 14. Error handling and retry

1. Upload errors are per-file, not global page-fatal.
2. Association errors are per-file retryable.
3. Signed URL failures show safe Spanish error.
4. Parent form submit should not crash if attachments have failed items.
5. Policy decision for create mode: allow form save with failed attachments, but keep visible warnings.

## 15. Permissions model

1. `permissions.read` controls listing visibility.
2. `permissions.create` and `permissions.fileUpload` gate upload/attach actions.
3. `permissions.remove` gates remove action.
4. If frontend permission context is partial, default to optimistic UI + API 401/403 handling with Spanish feedback.

## 16. Spanish UI copy baseline

1. `Documentos`
2. `Arrastra archivos aquí o haz clic para seleccionar`
3. `Subiendo...`
4. `No hay documentos asociados.`
5. `No se pudieron cargar los documentos.`
6. `Reintentar`
7. `Quitar`
8. `Abrir`
9. `Descargar`
10. `Archivo no disponible`

## 17. Fleet opt-in strategy (metadata only)

1. Add attachments section to:
   - `vehicle.form.js`
   - `driver.form.js`
   - `maintenance.form.js`
2. Keep per-entity paths/entityType in Fleet metadata.
3. Keep detail views compatible via `documents` alias or migrated `attachments` type.

## 18. Backend/API impact

Default expectation: existing endpoints are sufficient.

Only add backend changes if audit proves missing capability in:

1. multi-file ergonomics,
2. association payload flexibility,
3. signed-url response consistency.

No Prisma changes allowed in this phase.

## 19. Risks and mitigations

1. Risk: lifecycle complexity in create mode staging.
   - Mitigation: centralize with `useAttachmentsController`.
2. Risk: renderer bloat in `AtlasForm`/`AtlasDetail`.
   - Mitigation: keep orchestration in dedicated attachments components.
3. Risk: duplicate systems (`documents` vs `attachments`).
   - Mitigation: define alias compatibility and migration path.
4. Risk: state loss on form submit.
   - Mitigation: isolate attachment queue from core form field state.

## 20. Acceptance criteria (future implementation)

1. Reusable attachment components exist in `packages/ui`.
2. Vehicle create form shows right-side attachments aside on desktop.
3. Vehicle edit form loads existing attachments and supports add/remove.
4. Driver form opts into the same system.
5. Maintenance form opts into the same system.
6. Create mode supports staging before parent record exists.
7. After parent create, staged files upload+associate automatically.
8. Edit mode supports loading existing + immediate upload for new files.
9. Images and non-image files render differently.
10. Upload status/progress is visible.
11. Multi-file selection is supported.
12. Errors are Spanish and preserve parent form state.
13. Detail DocumentsPanel still works or is internally unified with shared attachments logic.
14. Desktop build passes.
15. Runtime metadata sync reflects new form/detail section metadata.

## 21. Verification checklist (future implementation)

1. Static checks for modified renderer/components/blueprints.
2. Desktop build: `pnpm.cmd --filter @atlas/desktop build:web`.
3. Safe local runtime metadata sync (tokenless service script when possible).
4. Runtime `AtlasView` schema checks for form/detail attachments metadata.
5. API smoke: upload, attach, list, signed URL, soft-remove.
6. Browser checks for create/edit/detail behavior and responsive layout.

## 22. Rollback strategy

1. Revert blueprint attachments metadata blocks.
2. Revert renderer hooks/components integration.
3. Keep existing detail documents flow operational.
4. Re-sync module metadata to restore prior schemas.

## 23. Out of scope

1. OCR
2. AI classification
3. Versioning
4. Drag sorting
5. Bulk delete
6. Storage redesign
7. Prisma changes
8. Dashboards/reports
9. AME3 Phase 4
