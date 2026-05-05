# Atlas ERP - Project Status

**Last verified:** 2026-05-04  
**Current phase:** Phase 7.1.1 complete / Phase 8 planning complete (implementation pending)

## What is implemented

### Platform foundation
- Phase 0 and Phase 1 completed against self-hosted Supabase.
- Phase 2 and Phase 3 completed: initialization guard + setup wizard + transactional bootstrap.
- Phase 4 completed: Supabase login/session + protected API context loading.

### Shell and module lifecycle
- Runtime module merge (manifest metadata + live lifecycle state) is active in desktop shell.
- Module catalog supports install, disable, enable, and uninstall actions.
- Core module protections and dependency protections are enforced in API and UI.
- Unavailable module route guard redirects to `atlas.core/modules` with warning state.

### Contacts v1
- Contacts API moved to a dedicated service layer (`apps/api/src/services/contacts-service.js`).
- Company-scoped, authenticated contacts endpoints for list/create/update/soft-disable.
- Contact picker endpoint available at `GET /contacts/picker` for downstream modules.
- `@atlas/ui` now exports reusable `DynamicForm`, `DynamicTable`, and `ContactPicker`.
- Contacts screen migrated to blueprint-driven `DynamicTable` + `DynamicForm`.

### Files v1
- Files API moved to a dedicated service layer (`apps/api/src/services/files-service.js`).
- Authenticated files endpoints implemented for upload/list/detail/signed-url/enabled lifecycle.
- `@atlas/sdk` includes `atlas.files` domain methods for all Phase 7 contracts.
- `@atlas/ui` exports reusable `FileUploader` and `FileViewer`.
- Atlas Files module screen supports upload, preview, download, copy signed link, and enable/disable.
- Branding logo workflow now uses shared files pipeline (`logoFileId` + signed URL preview).

### Files v1.1 (advanced UX)
- Explorer now supports `Tabla`, `Cards`, and `Cuadricula` modes with shared filtering/sorting state.
- File visuals include type icons and image thumbnails.
- Advanced viewer supports image transforms (visual-only), PDF preview, and previous/next navigation.
- File detail panel includes origin context and `Ir al origen` navigation when mapping exists.
- Bulk operations include rename and multi-file download (`direct` and `zip`) through API/SDK contracts.

## Remaining roadmap highlights
- Phase 8.1: accounting core (double-entry, company-scoped accounts/journal entries, base balances).
- Phase 8.2: full multi-currency (manual historical FX, conversion traceability).
- Phase 8.3: financial analytics dashboard (operational and analytical widgets).
- Phase 9+: future modules and hardening automation.

## Documentation governance
- `docs/TASKS.md`, `docs/00_project_status.md`, and `docs/09_next_steps.md` are synchronized status sources.
- Checklist items are marked done only with explicit verification evidence and a dated `Verified:` note.
- Phase 8 planning artifacts:
  - Spec: `docs/superpowers/specs/2026-05-04-phase8-finance-design.md`
  - Plan: `docs/superpowers/plans/2026-05-04-phase8-finance.md`

## Known constraints still in force
- JavaScript-only codebase.
- UI text in Spanish; code/docs/comments in English.
- Prisma pinned to `^6`.
- Frontend must consume ERP data only via `@atlas/sdk`.
