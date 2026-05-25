# Atlas ERP - Project Status

**Last verified:** 2026-05-20  
**Current phase:** AME3 Phase 4 complete / `custom.fleet` GA / AME3 official-module migration next

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

## Architectural direction

Atlas ERP is transitioning to Atlas Module Engine v3 (AME3). The AME3 architecture replaces the legacy system entirely — not as a parallel track, but as the target.

Key decisions in force as of 2026-05-20:

- New modules must use `defineAtlasModule` from `@atlas/module-engine`, not `createModuleManifest`.
- New modules live in `modules/custom/` (with `modules/official/` reserved for optional curated distributions), not `packages/maps/`.
- No new module should require editing `prisma/schema.prisma`, `apps/api/src/index.js`, `apps/desktop/src/`, or `packages/validators/src/index.js`.
- Official manifest snapshots are maintained in `apps/api/src/manifests/official/` and `packages/maps/` has been removed.
- Prisma manages Atlas Core stable models only. Module-owned tables use the Atlas ORM.

See `docs/architecture/atlas-module-engine-v3.md` for the full specification and 7-phase roadmap.

## Remaining roadmap highlights

### AME3 phases (status)
- AME3 Phase 1: complete (`@atlas/module-engine` package, module lifecycle v2)
- AME3 Phase 2: complete (module folder structure, sample custom module, Route Loader, `modules/official/` reserved foundation)
- AME3 Phase 3: complete (Atlas ORM metadata tables/services + Blueprint renderer)
- AME3 Phase 4: complete (filesystem discovery primary source, hot sync/reload, component lifecycle registration by active module)
- AME3 Phase 5: retired (official module relocation no longer required)
- AME3 Phase 6: generic CRUD Blueprint renderer (AtlasTable, AtlasForm, AtlasCrudView)
- AME3 Phase 7: decommission legacy manifest package completed; final cleanup is in progress

### Feature modules
- HR module (Phase 9): full employee lifecycle, org chart, dossier
- Purchases: supplier orders, receiving
- Inventory: stock management
- Fleet: vehicles, drivers, maintenance
- Reports: cross-module reporting engine

## Documentation governance
- `docs/TASKS.md`, `docs/00_project_status.md`, and `docs/09_next_steps.md` are synchronized status sources.
- Checklist items are marked done only with explicit verification evidence and a dated `Verified:` note.
- Phase 8 planning artifacts:
  - Spec: `docs/superpowers/specs/2026-05-04-phase8-finance-design.md`
  - Plan: `docs/superpowers/plans/2026-05-04-phase8-finance.md`

## Known constraints still in force
- JavaScript-only codebase.
- UI text in Spanish; code/docs/comments in English.
- Prisma baseline pinned to `^7` in root workspace overrides.
- Frontend must consume ERP data only via `@atlas/sdk`.
