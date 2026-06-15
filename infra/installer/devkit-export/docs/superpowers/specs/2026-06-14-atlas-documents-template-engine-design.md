# Atlas Documents Template Engine

Date: 2026-06-14
Status: Implemented (repository scope)
Author: Codex
Spec file: `docs/superpowers/specs/2026-06-14-atlas-documents-template-engine-design.md`
Plan file: `docs/superpowers/plans/2026-06-14-atlas-documents-template-engine.md`

---

## 1. Feature title

Atlas Documents Template Engine

## 2. Status

Implemented (repository scope)

Automated verification completed on 2026-06-15. Applying the migration in the
target installation and authenticated browser/storage QA remain pending.

## 3. Context

Atlas modules produce branded PDFs independently. Growth needs proposals from leads, and future modules need reusable document templates without HTML execution or module-specific PDF duplication.

## 4. Problem

There is no user-managed, versioned, reusable template engine backed by trusted ERP entity data and stored `FileAsset` output.

## 5. Goals

1. Add official `atlas.documents`.
2. Provide versioned block templates with safe variable bindings.
3. Resolve data through server-side entity providers.
4. Generate branded PDFs and register them as FileAssets.
5. Allow Growth to generate and attach documents from a lead.

## 6. Non-goals

1. HTML/CSS or JavaScript templates.
2. Pixel-perfect desktop publishing.
3. DOCX, electronic signatures, approval workflows, fiscal calculations, or payments.
4. A sales quotation model.

## 7. User stories

- As an administrator, I want reusable templates so documents remain consistent.
- As a Growth user, I want to generate a proposal from a lead without retyping ERP data.
- As a module developer, I want to register a provider so my entity can feed templates safely.

## 8. UX requirements

- Screens start with `PageHeader`.
- Templates list uses `DataTable`; editor uses block cards and `Dialog`/`Sheet` for configuration.
- Inputs use `@atlas/ui`, including `CreatableComboboxField` only where inline creation is supported.
- Preview uses `FileViewer`.
- Destructive actions use `ConfirmDialog`.
- Empty and error states use `EmptyState`/`ErrorState`.

## 9. Routes/screens

| Route | Screen | Module | Description |
|---|---|---|---|
| `/app/m/atlas.documents/templates` | `DocumentTemplatesScreen` | `atlas.documents` | Template list |
| `/app/m/atlas.documents/templates/:id/editor` | `DocumentTemplateEditorScreen` | `atlas.documents` | Draft editor and preview |
| `/app/m/atlas.documents/generated` | `GeneratedDocumentsScreen` | `atlas.documents` | Generated-document history |

Growth detail adds a “Generar documento” action and attachments section.

## 10. Data model

- `DocumentTemplate`: company, key, name, description, sourceType, publishedVersionId, enabled, timestamps.
- `DocumentTemplateVersion`: template, version number, status `draft|published`, blocks JSON, createdBy, publishedAt.
- `GeneratedDocument`: template/version, sourceType/sourceId, nullable fileAssetId, status `pending|ready|failed`, metadata, generatedBy, generatedAt, enabled.

Blocks: heading, paragraph, field list, table, totals, image, divider, spacer, signature image, page break.

Bindings use simple paths such as `{{lead.name}}`; no expressions, code, or HTML.

## 11. Prisma impact

New models: `DocumentTemplate`, `DocumentTemplateVersion`, `GeneratedDocument`.

Modified models: `FileAsset` relation only if useful; IDs remain sufficient.

New forward migration required: Yes.

## 12. API contract

Protected endpoints:

- `GET|POST /documents/templates`
- `GET|PATCH /documents/templates/:id`
- `PATCH /documents/templates/:id/enabled`
- `GET /documents/templates/:id/versions`
- `POST /documents/templates/:id/versions`
- `PATCH /documents/templates/:id/versions/:versionId`
- `POST /documents/templates/:id/versions/:versionId/publish`
- `GET /documents/providers/:sourceType/schema`
- `POST /documents/templates/:id/preview`
- `POST /documents/templates/:id/generate`
- `GET /documents/generated`
- `GET /documents/generated/:id`
- `PATCH /documents/generated/:id/enabled`

Generate body: `{ "sourceId": "uuid" }`. The server resolves all official data.

## 13. SDK contract

Extract a dedicated documents domain in `packages/sdk/src/domains/documents.js`:

- template CRUD and versions.
- provider schema.
- preview and generate.
- generated-document list/detail/enable.

Growth domain adds `listCompatibleDocumentTemplates` or uses documents list filtered by `sourceType=growth.lead`.

## 14. Validator contract

- template create/update schemas.
- block discriminated union schema.
- version create/update/publish schemas.
- preview/generate schema.
- generated-document query schema.

## 15. Module manifest impact

New official `atlas.documents`:

- dependencies: `atlas.core`, `atlas.files`, `atlas.company`.
- core, non-uninstallable.
- icon `Files`, color `#0F766E`, PWA short name `Documentos`, start path `/templates`.
- owns three document models; shares Company, FileAsset, AuditLog.

## 16. Navigation impact

| Label | Path | Icon | Layout | permissionKey |
|---|---|---|---|---|
| Plantillas | `/templates` | `LayoutTemplate` | `main` | `documents.templates.read` |
| Generados | `/generated` | `Files` | `main` | `documents.generated.read` |

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

- `documents.access`
- `documents.templates.read/create/update/delete/publish`
- `documents.generated.read/create/delete`

Provider resolution also checks read permission for the source entity; Growth generation requires `growth.leads.read`.

## 19. Multi-company behavior

Templates, versions, generated records, source entities, and FileAssets are company-scoped. Provider lookups must reject cross-company source IDs.

## 20. Files/storage impact

Generated PDFs use bucket `atlas-files` and object keys:

`modules/atlas.documents/GeneratedDocument/<generatedDocumentId>/<timestamp>-<safe-name>.pdf`

Generation first inserts a `pending` GeneratedDocument so PostgreSQL produces its UUID. Each successful output creates `FileAsset` with `moduleKey=atlas.documents`, `entityType=GeneratedDocument`, private visibility, and entity ID, then marks the record `ready`.

## 21. Export/import requirements

PDF generation is required. No template import/export in v1.

## 22. Audit log requirements

Audit template create/update/enable/disable, version create/publish, preview, generation, and generated-document disable. Generation records template/version/source/FileAsset IDs.

## 23. Edge cases

1. Published versions are immutable.
2. Templates cannot publish with invalid blocks or unknown bindings.
3. Provider data missing at generation returns 404 without creating files.
4. File upload failure rolls back generated metadata.
5. Existing generated PDFs remain tied to the exact version used.
6. Disabling a template does not delete generated documents.

## 24. Risks

1. PDF layout overflow. Mitigation: bounded block settings, page-break logic, and fixture snapshots.
2. Unsafe data access. Mitigation: registered providers and source permission checks.
3. Orphaned files. Mitigation: transactional metadata plus best-effort storage cleanup and reconciliation tests.

## 25. Acceptance criteria

1. Given a valid draft, when published, then a new immutable version becomes active.
2. Given a Growth lead and compatible template, when generated, then a branded PDF FileAsset and GeneratedDocument are created.
3. Given unknown binding, when publishing, then API returns 422.
4. Given no source permission, when previewing or generating, then API returns 403.
5. Given the lead detail, when generation succeeds, then the PDF appears in its attachment area.

## 26. Verification plan

- `node --test apps/api/src/routes/documents/__tests__/document-template-service.test.js`
- `node --test apps/api/src/routes/documents/__tests__/document-renderer.test.js`
- `node --test apps/api/src/routes/documents/__tests__/document-provider-registry.test.js`
- `node --test packages/sdk/src/__tests__/documents-domain.test.js`
- `pnpm --filter @atlas/desktop build:web`
- Manual editor, preview, generation, download, and Growth attachment QA.

## 27. Rollback plan

Hide navigation and disable generation routes. Preserve generated FileAssets. Remove schema only with a forward migration after exporting templates and generated metadata.

## 28. Future enhancements

1. Manual-data providers.
2. Sales quote entity and calculations.
3. Electronic signatures and approval workflows.
4. DOCX export and template exchange.
