# atlas.documents — Current State Spec

**Date:** 2026-08-30
**Module:** `atlas.documents` (CORE — document templates + PDF generation).
Manifest in `feature-modules.js`.
**Status:** Post-audit reference. **No code changes needed.**

---

## 1. Layout

```
apps/api/src/routes/documents/
  documents-router.js              document-validators.js
  document-template-service.js  (569) / document-template-routes.js  (264)
  document-generation-service.js (469) / document-generation-routes.js (177)
  document-renderer.js           (588) — block → pdfkit render plan + PDF
  document-provider-registry.js  (90)  — pluggable data-source providers
  __tests__/  7 files (35 tests)
apps/desktop/src/modules/atlas.documents/  TemplateEditor, Templates list, Generated list
```

## 2. Model & flow

`DocumentTemplate` (`companyId`, `sourceType`, `enabled`) → versioned via
`DocumentTemplateVersion` (`blocks` JSON, `publishedAt`). A generated document
picks a template + a `sourceId`; a **provider** (registered by `sourceType`,
e.g. an invoice/contact data source) loads the variable `data`; the renderer
interpolates it into the block tree and draws a PDF with `pdfkit`.

## 3. Security — clean

- **Template interpolation is whitelist-based.** `interpolateDocumentText` only
  substitutes `{{segment.segment}}` matched by a strict
  `[a-zA-Z][a-zA-Z0-9_]*` regex, resolved by object-path traversal
  (`resolveDocumentPath`), formatted via `Intl` / `JSON.stringify`. **No `eval`,
  no `Function`, no template engine.** `__proto__` / `constructor` paths are
  rejected by the leading-`[a-zA-Z]` requirement.
- **No SSRF / LFI.** PDF is drawn server-side with `pdfkit` (no HTML→headless
  browser, no `fetch`, no `file://`). The only external fetch is the company
  logo, via the shared `pdf-branding-service.resolveCompanyBranding` (signed
  Supabase URL).
- Desktop editor/preview uses **no `dangerouslySetInnerHTML`**.

## 4. Multi-tenancy

Every template / version / generated-document query in both services is
`where: { …, companyId }` (including nested `template: { companyId }` on version
lookups). Multi-step template operations (`createVersion`, `updateTemplate`,
`setTemplateEnabled`, `setGeneratedEnabled`) run in a `prisma.$transaction`.

## 5. Permissions — granular + cross-module

`documents.access` (nav) · `documents.templates.{read,create,update,delete,publish}`
· `documents.generated.{read,create,delete}` — all in `permission-catalog.js`;
`publish` is its own key.

**The provider registry enforces per-source permission:** `load()` /
`getSchema()` call `assertPermission(provider, { permissionKeys, isAdmin })`
which 403s unless the caller holds the provider's own `permissionKey` (or is
admin). So generating a document from, say, an invoice source needs the
invoice-read permission — not just `documents.generated.create`.

## 6. UI

`DocumentTemplateEditorScreen` (block editor), `DocumentTemplatesScreen`,
`GeneratedDocumentsScreen`, `DocumentPreviewDialog`. `ConfirmDialog` +
`PageHeader` on all screens; no `window.confirm/alert/prompt`, no native form
controls, no hardcoded non-theme colors.

## 7. Tests

7 API test files, 35/35: renderer, provider registry, both services, both route
files, validators.

## 8. Known gaps / follow-ups

- Each provider's `load({ companyId, sourceId, actorId })` must scope by
  `companyId` internally — verified by contract, not exhaustively per provider.
  Worth a per-provider spot check when providers are added.
- `document-renderer.js` (588) / `document-template-service.js` (569) — under the
  limit, watch.

## 9. Verification (2026-08-30)

- `node --test routes/documents/__tests__/*.test.js` — 35/35.
- Read audit of renderer + both services + provider registry + route files — no
  injection / SSRF / multi-tenancy / permission defects found.
