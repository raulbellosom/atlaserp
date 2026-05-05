# Phase 7 - Files Module Implementation Plan

Date: 2026-05-04

## Phase 7.1 Addendum - Storage unification

Changes:
- Adopt single canonical bucket policy (`atlas-files`) for setup logo uploads, module uploads, avatar uploads, and bulk ZIP artifacts.
- Normalize object keys by domain:
  - `company/branding/<companyId>/...`
  - `modules/<moduleKey>/<entityType>/<entityId>/...`
  - `system/bulk-downloads/<companyId>/...`
- Keep `FileAsset.bucket` in schema and force new records to `atlas-files`.
- Remove active API runtime references to `atlas-company` and `atlas-branding`.
- Keep legacy bucket removal as manual infra action (no destructive delete on API boot).

## Task 1 - Files service and API contracts

Files:
- `apps/api/src/services/files-service.js`
- `apps/api/src/index.js`

Changes:
- Add a dedicated files service for upload, list, detail, signed URL, and enabled lifecycle updates.
- Add authenticated files endpoints:
  - `POST /files/upload`
  - `GET /files`
  - `GET /files/:id`
  - `GET /files/:id/signed-url`
  - `PATCH /files/:id/enabled`
- Enforce company scoping and entity-type restrictions for all reads/mutations.
- Validate file size and allowed MIME types with Spanish API error messages.

Validation:
- Service compiles.
- New endpoints return expected success/error shape.
- Unauthorized requests return `401`; non-admin lifecycle mutation returns `403`.

## Task 2 - SDK files domain

Files:
- `packages/sdk/src/index.js`

Changes:
- Add `atlas.files` methods:
  - `upload(formData, token)`
  - `list(params, token)`
  - `get(id, token)`
  - `getSignedUrl(id, token)`
  - `setEnabled(id, enabled, token)`

Validation:
- Desktop can consume files endpoints through SDK only.

## Task 3 - Shared UI components for files

Files:
- `packages/ui/src/components/FileUploader.jsx`
- `packages/ui/src/components/FileViewer.jsx`
- `packages/ui/src/index.js`

Changes:
- Implement `FileUploader` with drag/drop, file-size checks, upload loading state, and error feedback.
- Implement `FileViewer` for image/PDF/generic preview with download/open actions using signed URLs.
- Export both components from `@atlas/ui`.

Validation:
- Components render without runtime errors in desktop screens.

## Task 4 - Atlas Files module screen and routing

Files:
- `apps/desktop/src/modules/atlas.files/screens/FilesScreen.jsx`
- `apps/desktop/src/app/ModuleOutlet.jsx`
- `packages/maps/src/core-modules.js`

Changes:
- Add full `atlas.files` screen with:
  - upload section
  - searchable/filtered table state
  - preview/download/copy-link row actions
  - enable/disable lifecycle action (admin)
- Register route resolution in module outlet (`atlas.files:/` and `atlas.files:/files`).
- Ensure files module manifest includes navigation entry for `/files`.

Validation:
- Installed `atlas.files` opens dedicated screen.
- Table and actions refresh to latest state after mutations.

## Task 5 - Branding integration with files pipeline

Files:
- `apps/desktop/src/modules/atlas.core/screens/BrandingSettings.jsx`
- `apps/api/src/index.js`

Changes:
- Move logo upload to shared files flow (`atlas.files.upload`).
- Persist selected `logoFileId` via branding API.
- Extend branding read/update contracts to return and accept `logoFileId`.
- Keep signed-URL preview behavior consistent with files service.

Validation:
- Branding logo update works with shared files APIs and renders preview correctly.

## Task 6 - Documentation reconciliation

Files:
- `docs/superpowers/specs/2026-05-04-phase7-files-module-design.md`
- `docs/superpowers/plans/2026-05-04-phase7-files-module.md`
- `docs/TASKS.md`

Changes:
- Finalize Phase 7 design and implementation plan docs.
- Update roadmap/checklist status to reflect current codebase reality.

Validation:
- Docs clearly show Phase 7 scope, contracts, and verification checklist.

## Task 7 - Verification pass

Commands:
- `node --check apps/api/src/services/files-service.js`
- `node --check apps/api/src/index.js`
- `pnpm.cmd --filter @atlas/desktop build:web`

Checklist:
- Files endpoints compile and boot-time import passes.
- Desktop build succeeds with Files screen + shared UI + Branding integration.
- No direct frontend Supabase business access introduced.
