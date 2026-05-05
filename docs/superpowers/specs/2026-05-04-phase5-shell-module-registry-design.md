# Phase 5 - Shell and Module Registry UI Design

Date: 2026-05-04

## Goal

Implement a runtime module registry in the desktop app that merges live module lifecycle state from the API with visual and navigation metadata from module manifests. Use that merged model to power launcher, sidebars, command palette, route availability, and the module catalog under Atlas Core.

## Architecture

### Runtime module model

Desktop resolves modules from two sources:

1. API lifecycle state (`GET /modules`): `status`, `enabled`, `core`, `uninstallable`, timestamps, manifest payload.
2. Manifest metadata (`@atlas/maps`): `icon`, `color`, `summary`, `category`, `navigation`, and layout hints.

The merge result is the only UI source for module visibility and navigation.

### Visibility rules

- Visible in launcher/sidebar/command module list: `status === INSTALLED` and `enabled === true`
- Catalog only (hidden from launcher/sidebar): `DISABLED` or `UNINSTALLED`
- Core modules are always locked against disable/uninstall actions

### Route availability guard

When user navigates directly to `/app/m/:moduleKey/...`:

- If module does not exist: render not found UI
- If module exists but is unavailable (`DISABLED` or `UNINSTALLED`): redirect to `/app/m/atlas.core/modules` and show a Spanish warning

### Module-specific shell strategy (hybrid)

Manifest-level `layoutMode` is introduced:

- `default`: normal shared `ModuleSidebar` behavior
- `no-sidebar`: render module content without sidebar
- `custom`: reserved for future custom shell integration (Phase 5 uses no-sidebar fallback behavior)

Unspecified mode defaults to `default`.

## API and Contracts

### Module lifecycle endpoints

- `GET /modules` (existing) - list lifecycle state
- `POST /modules/install` (existing, hardened)
- `POST /modules/:key/disable` (new)
- `POST /modules/:key/enable` (new)
- `DELETE /modules/:key` (existing soft uninstall, hardened)

### Mutation authorization

Lifecycle mutation endpoints require authenticated admin role:

- Auth: Bearer token via Supabase verification
- Allowed roles: `atlas.admin` or `system.admin`
- Missing token: `401`
- Non-admin: `403`

### Core protection

Mutations that disable/uninstall core modules are rejected with `409`.

### Dependency protection

Disable/uninstall is rejected with `409` when required installed/enabled dependents exist. Optional dependencies do not block.

### Response shape

- Success: `{ data: module }`
- Error: `{ error: string }`

## Desktop UX

### Surfaces updated to runtime model

- Home module grid
- App launcher modal
- Command palette module section
- Atlas app sidebar selection logic
- Module outlet availability checks
- Breadcrumb module metadata lookup

### Catalog location

Module catalog lives at Atlas Core route:

- `/app/m/atlas.core/modules`

It displays:

- module name, key, summary, status, version
- core lock status
- dependency status hints
- contextual actions by lifecycle state:
  - `UNINSTALLED` -> Instalar
  - `INSTALLED` -> Deshabilitar, Desinstalar
  - `DISABLED` -> Habilitar, Desinstalar

## Testing and Verification

No automated test framework is currently present. Verification is contract + manual integration:

1. Auth checks: unauthenticated mutation returns 401; non-admin returns 403.
2. Core checks: disable/uninstall core returns 409.
3. Lifecycle transitions: install/disable/enable/uninstall update status and enabled flag correctly.
4. Dependency checks: required dependents block disable/uninstall; optional dependencies do not.
5. UI visibility: only installed/enabled modules appear in launcher/sidebar.
6. Route guard: direct navigation to disabled/uninstalled module redirects to catalog.
7. Regression smoke: auth flow, existing module pages, and setup/login boot sequence remain functional.
