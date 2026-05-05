# Phase 5 - Shell and Module Registry UI Implementation Plan

Date: 2026-05-04

## Task 1 - API lifecycle and mutation authorization

Files:
- `apps/api/src/index.js`

Changes:
- Add lifecycle mutation auth guard (`requireAdminMutation`) backed by Supabase token + membership role lookup.
- Add reusable helpers for module dependency checks and core protections.
- Add `POST /modules/:key/disable` and `POST /modules/:key/enable`.
- Harden `POST /modules/install` and `DELETE /modules/:key` with:
  - auth guard
  - core protection
  - dependency protection
  - clear Spanish API errors.

Validation:
- API boots.
- Mutation endpoints return expected 401/403/409 semantics.

## Task 2 - SDK module lifecycle methods

Files:
- `packages/sdk/src/index.js`

Changes:
- Add `modules.disable(key, token)`.
- Add `modules.enable(key, token)`.
- Update `modules.install` and `modules.uninstall` to accept optional token.
- Preserve existing list API and response conventions.

Validation:
- SDK import passes.

## Task 3 - Runtime registry adapter for desktop

Files:
- `apps/desktop/src/lib/runtimeModules.js` (new)

Changes:
- Create merge utilities between API module rows and manifest metadata.
- Expose helpers for visibility/state logic:
  - available modules
  - module by key
  - route target
  - category labels
  - layout mode resolution.

Validation:
- Desktop imports compile with new helper.

## Task 4 - Refactor shell surfaces to runtime modules

Files:
- `apps/desktop/src/app/AtlasApp.jsx`
- `apps/desktop/src/app/HomeScreen.jsx`
- `apps/desktop/src/components/AppLauncher.jsx`
- `apps/desktop/src/components/CommandPalette.jsx`
- `apps/desktop/src/components/Breadcrumbs.jsx`
- `apps/desktop/src/app/ModuleOutlet.jsx`

Changes:
- Replace direct static manifest arrays in runtime surfaces with merged runtime model.
- Add module availability route guard in `ModuleOutlet` with redirect to core catalog + warning.
- Respect `layoutMode` for sidebar rendering in `AtlasApp`.

Validation:
- Home/launcher/palette reflect lifecycle availability.
- Route guard works for disabled/uninstalled modules.

## Task 5 - Build module catalog screen under Atlas Core

Files:
- `apps/desktop/src/modules/atlas.core/screens/ModuleCatalog.jsx` (new)
- `apps/desktop/src/app/ModuleOutlet.jsx`

Changes:
- Add Atlas Core `modules` screen with status, protections, and action buttons.
- Wire lifecycle mutations (`install`, `disable`, `enable`, `uninstall`) via SDK with auth token.
- Keep core modules locked in UI.

Validation:
- Catalog actions map correctly by status.
- API errors surfaced in Spanish.

## Task 6 - Layout mode support in manifest contract

Files:
- `packages/core/src/module-contract.js`

Changes:
- Add default manifest field `layoutMode: 'default'`.
- Keep backward compatibility for existing manifests.

Validation:
- Existing manifests run unchanged.

## Task 7 - Verification pass

Commands:
- `pnpm.cmd --filter @atlas/api dev` (sanity)
- `pnpm.cmd --filter @atlas/desktop dev:web` (sanity)
- module lifecycle endpoint checks with curl/Invoke-WebRequest

Checklist:
- 401 unauthenticated mutation
- 403 non-admin mutation
- 409 core protection
- dependency protection
- launcher/sidebar visibility rules
- redirect from unavailable module route
- auth/login regression smoke
