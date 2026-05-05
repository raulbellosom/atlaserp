# Phase 7.1 - Files Module Advanced UX Design

Date: 2026-05-04

## Goal

Expand Atlas Files from Phase 7 baseline into a full explorer experience with:

1. Rich visual rendering (file-type icons + image thumbnails).
2. Advanced preview modal (image transforms, PDF support, previous/next navigation).
3. Multi-view explorer modes (table, cards, grid).
4. Origin traceability (file detail + navigation to source record when available).
5. Rename and bulk download flows (individual/multiple and ZIP).

All UI copy remains Spanish. Architecture boundaries remain:
Desktop -> `@atlas/sdk` -> API -> Prisma/Supabase.

## Scope

### In scope

1. Files explorer with view mode switch: `table | cards | grid`.
2. Thumbnail/icon rendering by MIME type and file family.
3. Advanced viewer modal:
   - images: rotate left/right, flip horizontal/vertical, reset transforms (visual-only).
   - PDFs: embedded preview.
   - generic files: metadata card + open/download actions.
   - previous/next navigation within current filtered dataset.
4. File detail view containing full metadata + origin block.
5. Origin navigation:
   - always open file detail first.
   - from detail, "Ir al origen" when route mapping exists.
6. Rename file action:
   - `originalName` editable with validation.
7. Multi-select + bulk download:
   - direct signed links for selected files.
   - ZIP temporary artifact for selected files.

### Out of scope

1. Persisting image transforms to storage.
2. File version history.
3. Heavy async processors (OCR/virus scan/media pipelines).
4. Cross-company file sharing.

## UX Design

### Explorer layout

1. Toolbar section:
   - search input (`Buscar archivo...`)
   - filters (`Tipo`, `Modulo`, `Estado`, `Origen`)
   - sort selector (`Reciente`, `Nombre`, `Tamano`)
   - segmented view toggle (`Tabla`, `Cards`, `Cuadricula`)
   - selected counter (`Seleccionados: N`)
2. Bulk actions section (active when `N > 0`):
   - `Descargar seleccionados`
   - `Descargar ZIP`
   - `Limpiar seleccion`
3. Content area:
   - `FilesTableView` for dense operational listing.
   - `FilesCardView` for mixed metadata/visual context.
   - `FilesGridView` for preview-focused browsing.

## File item representation

Each row/card/tile shows:

1. File visual:
   - thumbnail for images.
   - icon by family for PDF/spreadsheets/docs/text/generic.
2. Metadata:
   - name, type/MIME, size, module key, entity type, date, status.
3. Actions:
   - `Ver`
   - `Descargar`
   - `Copiar enlace`
   - `Renombrar`
   - `Ir a detalle`

## Advanced viewer modal

1. Header:
   - file name + file type badge.
   - `Anterior` and `Siguiente` navigation.
2. Content:
   - image: applies CSS transforms in local state only.
   - PDF: iframe/embed using signed URL.
   - generic: no embedded preview, action-centric panel.
3. Transform actions (image only):
   - `Rotar izq`
   - `Rotar der`
   - `Invertir H`
   - `Invertir V`
   - `Reset`
4. Footer:
   - `Descargar`
   - `Abrir externo`
   - `Cerrar`

## File detail + origin navigation

1. File detail route/sheet includes:
   - canonical metadata fields.
   - ownership/scope markers (`companyId`, module/entity metadata).
   - status and timestamps.
2. Origin block:
   - route-resolved source descriptor if mapping exists.
   - `Ir al origen` button when navigable.
   - fallback message when source cannot be resolved.

## Architecture

## Desktop (`apps/desktop`)

### New/updated modules

1. `useFilesExplorer` hook:
   - centralized state for search, filters, sorting, view mode, selection, pagination.
2. `FilesToolbar` component.
3. View renderers:
   - `FilesTableView`
   - `FilesCardView`
   - `FilesGridView`
4. `AdvancedFileViewer` component:
   - accepts file list context and active index.
5. `FileDetailPanel` (route or side sheet).
6. `file-origin-resolver.js`:
   - maps `moduleKey/entityType/entityId` to app routes.

### Shared UI package (`packages/ui`)

Enhance/reuse:

1. `FileViewer` can be extended or superseded by `AdvancedFileViewer`.
2. `FileCard` may be expanded for icon/thumbnail strategies.
3. Keep exports centralized in `packages/ui/src/index.js`.

## API (`apps/api`)

### Existing endpoints kept

1. `POST /files/upload`
2. `GET /files`
3. `GET /files/:id`
4. `GET /files/:id/signed-url`
5. `PATCH /files/:id/enabled`

### New endpoints

1. `PATCH /files/:id`
   - purpose: rename/update editable metadata.
   - body: `{ originalName: string }`
2. `POST /files/bulk-download`
   - body: `{ fileIds: string[], mode: "direct" | "zip" }`
   - hard limits:
     - max 50 files per request.
     - max cumulative size 250 MB per request.
   - mode `direct` response:
     - `{ data: { mode: "direct", files: [{ id, name, signedUrl, expiresIn }] } }`
   - mode `zip` response:
     - `{ data: { mode: "zip", signedUrl, expiresIn, fileName } }`

### Service layer additions

`files-service.js` adds:

1. `rename({ authUserId, id, originalName })`
2. `bulkDownload({ authUserId, fileIds, mode })`
3. Internal helpers:
   - company-scoped file resolution for many IDs.
   - temporary ZIP creation flow (server-side artifact with TTL).

## SDK (`packages/sdk`)

Add to `atlas.files`:

1. `rename(id, data, token)`
2. `bulkDownload(payload, token)`

No direct frontend access to Supabase storage APIs.

## Data and origin mapping rules

1. Source traceability uses:
   - `moduleKey`
   - `entityType`
   - `entityId`
   - optional metadata hints
2. Origin navigation strategy:
   - map known cases (e.g., Branding config, Contacts detail route when entity mapping exists).
   - unknown origins remain visible but non-navigable with clear UX.
3. Company scoping:
   - all rename/download operations strictly constrained by active company context.

## Validation and error handling

1. Rename validation:
   - non-empty string
   - trimmed
   - max length guard
   - reject unsafe path-like characters.
2. Bulk download validation:
   - at least one file ID
   - max selection threshold per request
   - strict policy for this phase: if any file is unsupported/disabled/non-owned, reject entire request with explicit Spanish error.
3. Spanish user-facing errors preserved in API and UI.

## Testing Plan

1. Explorer behavior:
   - view switching keeps same filter/search state.
   - selection state behaves correctly across views.
2. Visual rendering:
   - image thumbnails load.
   - non-image file icons match MIME family.
3. Viewer modal:
   - image transforms apply/reset visually only.
   - PDF preview loads with signed URL.
   - previous/next navigation follows filtered ordering.
4. Rename flow:
   - optimistic or immediate refresh consistency in all views.
   - validation and API errors surfaced.
5. Bulk download:
   - direct mode returns multiple valid signed URLs.
   - ZIP mode returns temporary signed URL with expiration.
6. Origin flow:
   - detail always accessible.
   - `Ir al origen` appears only when mapping exists.
7. Security/contracts:
   - `401` unauthenticated.
   - `403` unauthorized mutation.
   - cross-company access blocked.

## Rollout Strategy

1. Step 1: API + SDK (`rename`, `bulk-download`, contracts).
2. Step 2: Explorer state model and three view modes.
3. Step 3: Advanced viewer with transforms and sequential navigation.
4. Step 4: File detail + origin resolver + origin navigation.
5. Step 5: Regression smoke across shell/modules/branding/contacts/auth.
