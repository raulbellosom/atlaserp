# Atlas Documents Template Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a versioned, provider-backed block template engine that generates branded PDFs as Atlas FileAssets and can be invoked from Growth leads.

**Architecture:** `atlas.documents` owns templates, versions, and generated-document metadata. A provider registry resolves authorized entity data. A controlled PDFKit renderer consumes validated blocks; no HTML or JavaScript is executed.

**Tech Stack:** Hono, Prisma, PDFKit, Supabase Storage, React, `@atlas/ui`, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-06-14-atlas-documents-template-engine-design.md`

---

## File Structure Map

### Create

- `prisma/migrations/20260614220000_add_atlas_documents/migration.sql`
- `apps/api/src/routes/documents/documents-router.js`
- `apps/api/src/routes/documents/document-template-routes.js`
- `apps/api/src/routes/documents/document-template-service.js`
- `apps/api/src/routes/documents/document-validators.js`
- `apps/api/src/routes/documents/document-provider-registry.js`
- `apps/api/src/routes/documents/providers/growth-lead-provider.js`
- `apps/api/src/routes/documents/document-renderer.js`
- `apps/api/src/routes/documents/__tests__/document-template-service.test.js`
- `apps/api/src/routes/documents/__tests__/document-provider-registry.test.js`
- `apps/api/src/routes/documents/__tests__/document-renderer.test.js`
- `packages/sdk/src/domains/documents.js`
- `packages/sdk/src/__tests__/documents-domain.test.js`
- `apps/desktop/src/modules/atlas.documents/screens/DocumentTemplatesScreen.jsx`
- `apps/desktop/src/modules/atlas.documents/screens/DocumentTemplateEditorScreen.jsx`
- `apps/desktop/src/modules/atlas.documents/screens/GeneratedDocumentsScreen.jsx`
- `apps/desktop/src/modules/atlas.documents/components/DocumentBlockEditor.jsx`
- `apps/desktop/src/modules/atlas.documents/components/DocumentPreviewDialog.jsx`
- `apps/desktop/src/modules/atlas.growth/components/GenerateDocumentDialog.jsx`

### Modify

- `prisma/schema.prisma`
- `prisma/seed.js`
- `apps/api/src/index.js` (router import/registration only)
- `apps/api/src/manifests/official/core-modules.js`
- `apps/api/src/manifests/official/feature-modules.js`
- `apps/api/src/services/files-service.js`
- `apps/api/src/services/pdf-branding-service.js`
- `packages/sdk/src/index.js`
- `apps/desktop/src/app/ModuleOutlet.jsx`
- `apps/desktop/src/modules/atlas.growth/screens/GrowthLeadDetailScreen.jsx`
- `docs/TASKS.md`

---

### Task 1: Documents schema, manifest, and permissions

- [x] Write a schema contract test for templates, immutable versions, generated documents, unique template key/company, version number, FileAsset reference, and indexes.
- [x] Add Prisma models and a forward migration.
- [x] Add `atlas.documents` official manifest, navigation, ACL, PWA identity, dependencies, lifecycle ownership, and permission seed.
- [x] Run Prisma generation, UUID policy, and permission catalog verification.
- [x] Commit `feat(documents): add template data model and module manifest`.

### Task 2: Block validators and provider registry

- [x] Write failing tests for every block type, invalid settings, unknown block, unknown binding, table collection/column validation, provider registration, source permission, and company isolation.
- [x] Implement a Zod discriminated union for heading, paragraph, fields, table, totals, image, divider, spacer, signature, and page break.
- [x] Implement provider contract:

```js
{
  sourceType,
  permissionKey,
  getSchema(),
  load({ companyId, sourceId, actorId })
}
```

- [x] Implement `growth.lead` provider with lead, attribution, converted Contact, and related submission summaries.
- [x] Run provider/validator tests.
- [x] Commit `feat(documents): add safe blocks and provider registry`.

### Task 3: Template/version service and routes

- [x] Write failing tests for CRUD, draft version creation, optimistic updates, publish validation, published immutability, disable behavior, audit entries, and RBAC.
- [x] Implement service factory and thin Hono routes.
- [x] Register router in `apps/api/src/index.js` by import/mount only.
- [x] Run service and route tests.
- [x] Commit `feat(documents): add template version workflow`.

### Task 4: PDF renderer

- [x] Create fixed fixture provider data and write renderer tests for branding, pagination, field paths, table overflow, totals, images, signature, explicit page break, missing optional values, and unsupported images.
- [x] Keep document block rendering isolated in `document-renderer.js`; no shared branding-service change was required.
- [x] Render PDFKit buffers deterministically enough to assert text/page counts and metadata.
- [x] Run renderer tests.
- [x] Commit `feat(documents): render versioned block templates to pdf`.

### Task 5: Preview, generation, FileAsset, and cleanup

- [x] Write failing tests for preview without persistence, successful generation, storage failure cleanup, generated metadata, exact version binding, cross-company rejection, disable, and download.
- [x] Generate a `GeneratedDocument` ID in PostgreSQL before building its object key; do not generate UUID in JavaScript.
- [x] Store private PDF under `modules/atlas.documents/GeneratedDocument/<id>/...`.
- [x] Create FileAsset and GeneratedDocument consistently; on partial storage failure remove the object best-effort and leave no enabled metadata.
- [x] Add `GeneratedDocument` and `GrowthLead` to files allowlist where required.
- [x] Run tests and commit `feat(documents): persist generated pdf assets`.

### Task 6: Internal SDK documents domain

- [x] Write request-shape tests for templates, versions, provider schema, preview blob, generate, and generated history.
- [x] Implement `packages/sdk/src/domains/documents.js` and export it from the SDK without adding inline domain logic.
- [x] Run all SDK tests.
- [x] Commit `feat(sdk): add documents domain`.

### Task 7: Templates and generated-document screens

- [x] Build templates list with `PageHeader`, `DataTable`, filters, create dialog, enable/disable confirmation, and states.
- [x] Build editor with block list/reordering, block configuration using `@atlas/ui`, provider variable picker, save draft, preview, and publish.
- [x] Build generated history with filters, `FileViewer`, download, and disable.
- [x] Add ModuleOutlet routes and run desktop build/React Doctor.
- [x] Commit `feat(documents): add template editor and generated history`.

### Task 8: Growth integration

- [x] Add `GenerateDocumentDialog` to Growth lead detail.
- [x] List only enabled published templates with `sourceType=growth.lead`.
- [x] Generate from the lead ID, refresh `AttachmentsPanel`, and open preview/download.
- [x] Gate action with Documents create plus Growth read permissions.
- [x] Build and commit `feat(growth): generate documents from leads`.

### Task 9: Full verification

- [x] Run:

```bash
pnpm db:generate
node --test apps/api/src/routes/documents/__tests__/
node --test packages/sdk/src/__tests__/documents-domain.test.js
pnpm --filter @atlas/desktop build:web
pnpm build
```

- [ ] Manually verify template lifecycle, each block, long multipage output, provider permissions, storage/download, generated history, and Growth attachment.
- [x] Record exact evidence in TASKS.

Automated verification evidence is recorded in
`docs/superpowers/verifications/2026-06-15-atlas-documents-template-engine.md`.
The manual target-environment verification remains intentionally unchecked.

## Rollback Notes

Remove Documents navigation and route registration, disable generation, and retain FileAssets/generated metadata. Schema removal requires a forward migration after export.
