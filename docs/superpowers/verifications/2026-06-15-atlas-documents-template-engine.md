# Verification Checklist - Atlas Documents Template Engine

Date: 2026-06-15
Feature: Atlas Documents Template Engine
Spec: `docs/superpowers/specs/2026-06-14-atlas-documents-template-engine-design.md`
Plan: `docs/superpowers/plans/2026-06-14-atlas-documents-template-engine.md`

## Automated Checks

- [x] Prisma schema validation, client generation, and UUID policy
  - Result: all commands exited 0.
- [x] Documents, Growth, and internal SDK suites
  - Result: 84 passed, 0 failed.
- [x] Documents schema, migration, manifest, and permission contract
  - Result: 3 passed, 0 failed.
- [x] Growth lead attachment integration plus Documents routes/services
  - Result: focused suite reported 54 passed, 0 failed.
- [x] Desktop production build
  - Result: Vite transformed 4,963 modules.
- [x] Full monorepo build
  - Result: web build, native executable, MSI, and NSIS completed.
- [x] React Doctor on changed React/UI files
  - Result: no correctness errors.
  - Remaining diagnostics are heuristic warnings for existing large components,
    helper-based query invalidation, and existing `AttachmentsPanel` structure.

## Behavioral Coverage

- [x] Controlled schemas cover every supported block and reject unsafe settings,
  unknown bindings, expression-like paths, and invalid table collections.
- [x] Provider resolution checks source permissions and company isolation.
- [x] Published versions are immutable and source type is locked after publication.
- [x] Preview does not persist files or generated metadata.
- [x] Generation binds the exact published version, obtains its ID from PostgreSQL,
  stores a private PDF, creates `FileAsset`, and cleans partial failures.
- [x] Renderer tests cover branding, pagination, long text, tables, totals, images,
  signatures, page breaks, missing optional values, and remote-image rejection.
- [x] Growth lists generated documents with lead attachments while only Growth-owned
  attachments expose the remove action.
- [x] SDK request-shape tests cover templates, versions, provider schema, preview,
  generation, history, download, and enable state.

## Pending Environment Checks

- [ ] Apply and verify `20260614220000_add_atlas_documents` in the target installation.
- [ ] Run authenticated browser QA for create, draft, reorder, preview, publish,
  generate, history, download, disable, empty/error states, and responsive layout.
- [ ] Verify Supabase Storage upload, signed download, cleanup, and company isolation
  against the target bucket.
- [ ] Verify Growth generation with real permissions and a real lead.

## Known Unrelated Issue

`pnpm.cmd rbac:verify-catalog` exits 1 for 30 pre-existing missing Calendar,
Catalog, and Inventory entries plus two extra platform entries. No Documents or
Growth permission is missing.

## Summary

Repository implementation and automated verification: PASS.

Live migration, authenticated browser QA, and target storage verification: PENDING.
