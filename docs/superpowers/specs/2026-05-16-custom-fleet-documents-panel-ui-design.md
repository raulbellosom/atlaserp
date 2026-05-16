# custom.fleet DocumentsPanel UI

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY

## 1. Feature title

custom.fleet DocumentsPanel UI

## 2. Status

Draft

## 3. Context

`custom.fleet` already includes document models (`fleet_vehicle_document`, `fleet_driver_document`, `fleet_maintenance_document`) and API routes to list/add/remove document associations for vehicles, drivers, and maintenance records.  
The module also has stable detail blueprints and runtime metadata sync, but detail screens still lack a polished in-place document management experience.

## 4. Problem

Users must leave Fleet detail flows (or work with raw IDs) to manage supporting files. This creates friction and weakens operational traceability for vehicle files, driver files, and maintenance evidence.

## 5. Goals

1. Add a document management panel directly in vehicle, driver, and maintenance detail screens.
2. Support list, upload, open/download, and soft-remove actions from the detail context.
3. Keep API paths module-specific in Fleet blueprint metadata, not hardcoded in renderer logic.
4. Reuse existing UI primitives (`FileUploader`, `FileCard`, `FileViewer`, dialog/sheet patterns) where possible.
5. Preserve existing CRUD detail behavior and avoid regressions.

## 6. Non-goals

1. OCR, AI extraction, or document classification.
2. File versioning/history.
3. New storage architecture or bucket redesign.
4. Prisma schema or Prisma migration changes.
5. Dashboards, reports, AME3 Phase 4 work.
6. Multi-module generic file policy redesign.

## 7. User stories

1. As a Fleet operator, I want to view all documents linked to a vehicle from its detail screen.
2. As a Fleet operator, I want to upload and attach a file to a driver or maintenance record without leaving that detail page.
3. As a Fleet operator, I want to open or download an attached file quickly for audits.
4. As a Fleet admin, I want to disable a wrong document association without deleting the base file record.

## 8. UX requirements

1. A visible `Documentos` panel appears on:
   - Vehículos detail
   - Choferes detail
   - Mantenimientos detail
2. Panel states in Spanish:
   - loading (`Cargando documentos...`)
   - empty (`No hay documentos asociados.`)
   - error (`No se pudieron cargar los documentos.`)
3. Each item shows at minimum:
   - file name
   - document type/category
   - upload date
   - active state (if relevant)
4. Primary actions:
   - `Agregar documento`
   - `Abrir` / `Descargar`
   - `Quitar` (soft-remove association)
5. Upload flow must remain inside the detail context and refresh list without full page reload.
6. Parent detail information remains visible and unchanged while using documents actions.

## 9. Routes/screens

No new top-level route is required for v1.  
Integration target screens:

1. `/app/m/custom.fleet/vehicles/:id` (detail)
2. `/app/m/custom.fleet/drivers/:id` (detail)
3. `/app/m/custom.fleet/maintenance/:id` (detail)

## 10. Data model

No new tables or columns.

Existing models:

1. `fleet.vehicle_document` (`fleet_vehicle_document`)
2. `fleet.driver_document` (`fleet_driver_document`)
3. `fleet.maintenance_document` (`fleet_maintenance_document`)

Association payload fields already in use:

1. `file_asset_id` (UUID)
2. `document_type` (optional, max 50)
3. `label` (optional, max 200)
4. `enabled` (soft-disable on remove)

## 11. Prisma impact

None.

## 12. API contract

### Existing Fleet document association endpoints

Vehicle:
1. `GET /fleet/vehicles/:id/documents` (`fleet.vehicles.read`)
2. `POST /fleet/vehicles/:id/documents` (`fleet.vehicles.update`)
3. `DELETE /fleet/vehicles/:id/documents/:docId` (`fleet.vehicles.update`)

Driver:
1. `GET /fleet/drivers/:id/documents` (`fleet.drivers.read`)
2. `POST /fleet/drivers/:id/documents` (`fleet.drivers.update`)
3. `DELETE /fleet/drivers/:id/documents/:docId` (`fleet.drivers.update`)

Maintenance:
1. `GET /fleet/maintenance/:id/documents` (`fleet.maintenance.read`)
2. `POST /fleet/maintenance/:id/documents` (`fleet.maintenance.update`)
3. `DELETE /fleet/maintenance/:id/documents/:docId` (`fleet.maintenance.update`)

### Existing file upload/download endpoints (reused)

1. `POST /files/upload` (`files.assets.create`)  
   Multipart `file` + metadata fields (`moduleKey`, `entityType`, `entityId`).
2. `GET /files/:id/signed-url` (`files.assets.read`)  
   Used for open/download URL resolution.

### UI sequence

1. Upload file via `/files/upload` using entity type:
   - `FleetVehicle`, `FleetDriver`, `FleetMaintenance`
2. Attach returned `file_asset_id` via corresponding Fleet `POST .../documents`.
3. Refresh `GET .../documents`.
4. On open/download, resolve signed URL via `/files/:id/signed-url` (or use pre-existing URL if already present in response shape in future).

## 13. SDK contract

Preferred implementation path: use existing `@atlas/sdk` generic request helpers and `atlas.files.*` methods where available.

No mandatory new SDK domain in this spec.  
Optional future ergonomics (not required for v1): `atlas.fleet.documents.*` wrappers.

## 14. Validator contract

No new validator schema required for backend contract:
1. `createDocumentAssociationSchema` already validates `file_asset_id`, `document_type`, `label`.

UI-only local validation may be added for required fields before submit (for example document type choice).

## 15. Module manifest impact

No manifest structure change required for v1.

Possible later additions (metadata only) if desired:
1. New detail schema metadata for documents panel opt-in.

## 16. Navigation impact

None (detail-embedded panel only).

## 17. Blueprint impact

Detail blueprints (`vehicle.detail`, `driver.detail`, `maintenance.detail`) need metadata opt-in for panel rendering.

### Proposed metadata contract (v1)

Add a section-level block in `schema.sections`:

```js
{
  id: "documents",
  type: "documents",
  label: "Documentos",
  documents: {
    recordType: "vehicle", // vehicle | driver | maintenance
    listPath: "/fleet/vehicles/:id/documents",
    addPath: "/fleet/vehicles/:id/documents",
    removePath: "/fleet/vehicles/:id/documents/:docId",
    upload: {
      endpoint: "/files/upload",
      moduleKey: "custom.fleet",
      entityType: "FleetVehicle",
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
      sizeBytes: "sizeBytes",
    },
    signedUrl: {
      endpointTemplate: "/files/:fileId/signed-url",
      field: "signedUrl",
    },
    permissions: {
      read: "fleet.vehicles.read",
      create: "fleet.vehicles.update",
      remove: "fleet.vehicles.update",
      fileUpload: "files.assets.create",
      fileRead: "files.assets.read",
    },
  },
}
```

Same contract for drivers/maintenance with their route/permission values.

## 18. RBAC/permissions

Fleet association actions:
1. Vehicle docs: `fleet.vehicles.read` + `fleet.vehicles.update`
2. Driver docs: `fleet.drivers.read` + `fleet.drivers.update`
3. Maintenance docs: `fleet.maintenance.read` + `fleet.maintenance.update`

File service actions:
1. Upload: `files.assets.create`
2. Signed URL retrieval: `files.assets.read`

If user has Fleet update permission but lacks file permissions, panel should show a Spanish actionable error on upload/open attempts.

## 19. Multi-company behavior

Unchanged.  
All document list/add/remove services are company-scoped in current Fleet services.  
File service remains company-scoped via membership context and `FileAsset.entityId` company mapping.

## 20. Files/storage impact

Reuses existing Files module behavior and `atlas-files` bucket.  
No storage path redesign.

## 21. Export/import requirements

None.

## 22. Audit log requirements

Existing audit actions are already emitted in current Fleet services:
1. `fleet.vehicle.document.add` / `fleet.vehicle.document.remove`
2. `fleet.driver.document.add` / `fleet.driver.document.remove`
3. `fleet.maintenance.document.add` / `fleet.maintenance.document.remove`

No new audit action keys required for v1.

## 23. Edge cases

1. Detail record ID missing or invalid in route context: panel shows clear error and disables actions.
2. Upload succeeds but association add fails: show error and keep upload result recoverable for retry.
3. Association exists but linked `FileAsset` not found: render fallback item (`Archivo no disponible`) without crashing panel.
4. Remove returns 404 because already removed: refresh list and show non-blocking message.
5. Signed URL fetch fails: show `No se pudo abrir el archivo.` and keep list state.
6. User lacks `files.assets.create` or `files.assets.read`: action-specific permission error in Spanish.
7. Large file or unsupported type rejected by `/files/upload`: surface backend message in panel.

## 24. Risks

1. Renderer coupling risk: adding Fleet-only logic in `AtlasDetail`.  
   Mitigation: metadata-driven `type: "documents"` block interpreted generically.
2. Permission mismatch risk between Fleet and Files module permissions.  
   Mitigation: explicit `permissions` metadata block + UI error handling.
3. Signed URL latency for each file open.  
   Mitigation: lazy fetch on demand and optional cache per file during session.
4. `AtlasDetail` currently field-only sections.  
   Mitigation: extend section parser generically for component blocks rather than field-only assumptions.

## 25. Acceptance criteria

1. Vehicle detail renders `Documentos` panel.
2. Driver detail renders `Documentos` panel.
3. Maintenance detail renders `Documentos` panel.
4. Existing document associations load from corresponding API endpoint.
5. Upload + attach workflow succeeds for at least one file per entity type.
6. Newly added document appears in panel without full page reload.
7. Open/download action works through signed URL flow.
8. Soft-remove hides association from active list.
9. Loading/empty/error states are shown in Spanish.
10. No custom.fleet hardcoding is introduced inside generic renderer flow if metadata-driven path is available.
11. Desktop build passes.
12. Module sync reflects any new detail metadata if blueprint files changed.

## 26. Verification plan

Static:
1. `node --check` for all modified renderer/UI/blueprint files.
2. `pnpm.cmd --filter @atlas/desktop build:web`.

Runtime/API:
1. Authenticated `POST /modules/sync` (if blueprint metadata changed).
2. `GET /fleet/vehicles/:id/documents`, `/fleet/drivers/:id/documents`, `/fleet/maintenance/:id/documents` return expected shape.
3. `POST /files/upload` + `POST .../documents` + `GET .../documents` flow verified.
4. `DELETE .../documents/:docId` verifies soft-remove behavior.

Browser/manual:
1. Open each detail route and confirm `Documentos` panel visibility.
2. Upload a file and confirm immediate list refresh.
3. Open/download and remove one file per entity.
4. Validate Spanish labels and error messages.

## 27. Rollback plan

1. Revert renderer/UI/blueprint metadata changes via git revert.
2. Run `POST /modules/sync` to restore previous runtime detail metadata.
3. No DB rollback needed (no schema changes in this feature).
4. Existing file/document records remain intact and usable through APIs.

## 28. Future enhancements

1. Document type presets per entity (`Factura`, `Póliza`, `Licencia`, etc.).
2. Inline preview thumbnails for images/PDF.
3. Batch attach/remove actions.
4. Per-file notes/history timeline.
5. Entity-level document counters in list/detail headers.

---

## Implementation options

### Option A: Renderer extension only (generic)

Pros:
1. Fully reusable across modules.

Cons:
1. More initial complexity in generic `AtlasDetail` contracts.

### Option B: Fleet-only panel component

Pros:
1. Fastest for Fleet.

Cons:
1. Harder to reuse; higher long-term maintenance.
2. Conflicts with renderer generalization goals.

### Option C: Hybrid (recommended)

Approach:
1. Build reusable `DocumentsPanel` in `packages/ui`.
2. Add generic `AtlasDetail` support for metadata block `type: "documents"`.
3. Configure all Fleet specifics (paths, entity types, permissions, labels) in Fleet detail blueprints.

Rationale:
1. Balanced implementation risk.
2. Reusable for future modules.
3. Avoids Fleet hardcoding in core renderer while delivering near-term Fleet UX.
