# Atlas ERP - Project Status

Last verified: 2026-05-25
Current phase: AME3 Phase 4 complete, Phase 5 retired, Phase 6 renderer complete, Phase 7 cleanup complete

## Implemented

### Platform foundation
- Phase 0-4 complete on self-hosted Supabase.
- Setup wizard + auth/session + protected API context complete.

### Shell and module lifecycle
- Runtime merge of manifest metadata and lifecycle state is active in desktop shell.
- Module catalog supports install, disable, enable, uninstall, and sync.
- Core protection and dependency protection are enforced in API and UI.

### Core modules baseline (internal)
- `atlas.core`
- `atlas.identity`
- `atlas.files`
- `atlas.company`
- `atlas.contacts`
- `atlas.hr`

All above are seeded/managed as `core: true`, `uninstallable: false` in official snapshots.

### AME3 and manifests
- AME3 discovery/sync is the primary source for module lifecycle metadata.
- Official manifest snapshots are maintained in `apps/api/src/manifests/official/`.
- `packages/maps` has been decommissioned and removed.

## Current roadmap highlights

### AME3 status
- Phase 1: complete (`@atlas/module-engine` foundation)
- Phase 2: complete (route loader + custom module baseline)
- Phase 3: complete (Atlas ORM + blueprint renderer)
- Phase 4: complete (filesystem discovery + lifecycle/component sync)
- Phase 5: retired (official module relocation not required)
- Phase 6: generic CRUD renderer baseline complete
- Phase 7: legacy manifest package removal complete

### Functional tracks
- Finance/Ledger: externalized as custom-module path during cutover
- HR: Phase 9 scope completed and treated as core policy module
- Fleet custom module: active under `modules/custom/custom.fleet`

## Governance

- Source of truth for checklists: `docs/TASKS.md`.
- Mark `[x]` only with explicit verification evidence and dated `Verified:` note.
- Historical specs/plans may mention transitional paths that are no longer active.

## Constraints

- JavaScript-only codebase.
- UI text in Spanish; code/docs/comments in English.
- Prisma baseline pinned to `^7`.
- Frontend consumes business data only via `@atlas/sdk`.
