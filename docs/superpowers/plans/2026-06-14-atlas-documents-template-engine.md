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

- [ ] Write a schema contract test for templates, immutable versions, generated documents, unique template key/company, version number, FileAsset reference, and indexes.
- [ ] Add Prisma models and a forward migration.
- [ ] Add `atlas.documents` official manifest, navigation, ACL, PWA identity, dependencies, lifecycle ownership, and permission seed.
- [ ] Run Prisma generation, UUID policy, and permission catalog verification.
- [ ] Commit `feat(documents): add template data model and module manifest`.

### Task 2: Block validators and provider registry

- [ ] Write failing tests for every block type, invalid settings, unknown block, unknown binding, table collection/column validation, provider registration, source permission, and company isolation.
- [ ] Implement a Zod discriminated union for heading, paragraph, fields, table, totals, image, divider, spacer, signature, and page break.
- [ ] Implement provider contract:

```js
{
  sourceType,
  permissionKey,
  getSchema(),
  load({ companyId, sourceId, actorId })
}
```

- [ ] Implement `growth.lead` provider with lead, attribution, converted Contact, and related submission summaries.
- [ ] Run provider/validator tests.
- [ ] Commit `feat(documents): add safe blocks and provider registry`.

### Task 3: Template/version service and routes

- [ ] Write failing tests for CRUD, draft version creation, optimistic updates, publish validation, published immutability, disable behavior, audit entries, and RBAC.
- [ ] Implement service factory and thin Hono routes.
- [ ] Register router in `apps/api/src/index.js` by import/mount only.
- [ ] Run service and route tests.
- [ ] Commit `feat(documents): add template version workflow`.

### Task 4: PDF renderer

- [ ] Create fixed fixture provider data and write renderer tests for branding, pagination, field paths, table overflow, totals, images, signature, explicit page break, missing optional values, and unsupported images.
- [ ] Extend `pdf-branding-service` only with reusable low-level helpers; keep document block rendering in `document-renderer.js`.
- [ ] Render PDFKit buffers deterministically enough to assert text/page counts and metadata.
- [ ] Run renderer tests.
- [ ] Commit `feat(documents): render versioned block templates to pdf`.

### Task 5: Preview, generation, FileAsset, and cleanup

- [ ] Write failing tests for preview without persistence, successful generation, storage failure cleanup, generated metadata, exact version binding, cross-company rejection, disable, and download.
- [ ] Generate a `GeneratedDocument` ID in PostgreSQL before building its object key; do not generate UUID in JavaScript.
- [ ] Store private PDF under `modules/atlas.documents/GeneratedDocument/<id>/...`.
- [ ] Create FileAsset and GeneratedDocument consistently; on partial storage failure remove the object best-effort and leave no enabled metadata.
- [ ] Add `GeneratedDocument` and `GrowthLead` to files allowlist where required.
- [ ] Run tests and commit `feat(documents): persist generated pdf assets`.

### Task 6: Internal SDK documents domain

- [ ] Write request-shape tests for templates, versions, provider schema, preview blob, generate, and generated history.
- [ ] Implement `packages/sdk/src/domains/documents.js` and export it from the SDK without adding inline domain logic.
- [ ] Run all SDK tests.
- [ ] Commit `feat(sdk): add documents domain`.

### Task 7: Templates and generated-document screens

- [ ] Build templates list with `PageHeader`, `DataTable`, filters, create dialog, enable/disable confirmation, and states.
- [ ] Build editor with block list/reordering, block configuration using `@atlas/ui`, provider variable picker, save draft, preview, and publish.
- [ ] Build generated history with filters, `FileViewer`, download, and disable.
- [ ] Add ModuleOutlet routes and run desktop build/React Doctor.
- [ ] Commit `feat(documents): add template editor and generated history`.

### Task 8: Growth integration

- [ ] Add `GenerateDocumentDialog` to Growth lead detail.
- [ ] List only enabled published templates with `sourceType=growth.lead`.
- [ ] Generate from the lead ID, refresh `AttachmentsPanel`, and open preview/download.
- [ ] Gate action with Documents create plus Growth read permissions.
- [ ] Build and commit `feat(growth): generate documents from leads`.

### Task 9: Full verification

- [ ] Run:

```bash
pnpm db:generate
node --test apps/api/src/routes/documents/__tests__/
node --test packages/sdk/src/__tests__/documents-domain.test.js
pnpm --filter @atlas/desktop build:web
pnpm build
```

- [ ] Manually verify template lifecycle, each block, long multipage output, provider permissions, storage/download, generated history, and Growth attachment.
- [ ] Record exact evidence in TASKS.

## Rollback Notes

Remove Documents navigation and route registration, disable generation, and retain FileAssets/generated metadata. Schema removal requires a forward migration after export.
