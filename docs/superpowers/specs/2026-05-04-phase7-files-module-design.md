# Phase 7 - Files Module Design

Date: 2026-05-04

## Goal

Implement the Atlas Files module with full UX and signed URL delivery, using Atlas API as the single frontend entrypoint for file operations. Integrate branding logo workflows through shared files APIs/components.

## Architecture

### Storage and metadata boundaries

- Physical bytes are stored in canonical Supabase Storage bucket `atlas-files`.
- Metadata is stored in Prisma `FileAsset`.
- Frontend never talks directly to Supabase Storage; it only uses Atlas API + `@atlas/sdk`.
- No runtime writes should target `atlas-company` or `atlas-branding`.
- Legacy bucket deletion is a manual infra action (outside API boot/runtime).
- Canonical objectKey policy:
  - branding/logo: `company/branding/<companyId>/...`
  - module uploads: `modules/<moduleKey>/<entityType>/<entityId>/...`
  - system ZIP artifacts: `system/bulk-downloads/<companyId>/...`

### Files domain service

- API uses a dedicated files service (`apps/api/src/services/files-service.js`) for:
  - upload validation + persistence
  - company-scoped listing and retrieval
  - signed URL generation
  - soft lifecycle updates (`enabled`)

### Company scoping

- Files API actions are scoped to the authenticated user active company context.
- `FileAsset.entityId` is used as company scope anchor for Phase 7 files flows.
- Branding references may include legacy setup assets; branding update validates compatible file ownership/source.

## API Contracts

### New endpoints

- `POST /files/upload` (auth)
  - multipart body: `file`, optional `moduleKey`, `entityType`, `entityId`, `visibility`, `metadata`
  - returns `{ data: FileAsset }`
- `GET /files` (auth)
  - query: `q`, `moduleKey`, `entityType`, `entityId`, `mime`, `enabled`, `page`, `pageSize`, `sortBy`, `sortDir`
  - returns `{ data: FileAsset[], pagination }`
- `GET /files/:id` (auth)
  - returns `{ data: FileAsset }`
- `GET /files/:id/signed-url` (auth)
  - returns `{ data: { signedUrl, expiresIn } }`
- `PATCH /files/:id/enabled` (auth + admin)
  - body: `{ enabled: boolean }`
  - returns `{ data: FileAsset }`

### Branding update extension

- `PUT /branding/current` now accepts optional `logoFileId`.
- `GET /branding/current` now returns `logoFileId` together with `logoUrl`.

## Desktop UX

### New module screen

- `atlas.files` screen provides:
  - upload section with reusable `FileUploader`
  - files table (search/filter/sort UI)
  - row actions: preview, download, copy signed link, enable/disable
  - preview dialog via reusable `FileViewer`

### Branding integration

- Branding screen uploads logos through `atlas.files.upload`.
- Selected `logoFileId` is persisted through `atlas.branding.updateCurrent`.
- Existing logo preview remains signed URL-based.

## Shared Interfaces

### SDK (`@atlas/sdk`)

- `atlas.files.upload(formData, token)`
- `atlas.files.list(params, token)`
- `atlas.files.get(id, token)`
- `atlas.files.getSignedUrl(id, token)`
- `atlas.files.setEnabled(id, enabled, token)`

### UI (`@atlas/ui`)

- `FileUploader`
- `FileViewer`

## Verification

1. Auth contracts for new endpoints (`401`, `403` where applicable).
2. Upload constraints (max size, valid file, metadata persistence).
3. Signed URL generation and viewer/download behavior.
4. Files screen lifecycle operations reflect table state updates.
5. Branding logo update works with new `logoFileId` flow.
6. Shell/module/contacts/identity regression smoke.
