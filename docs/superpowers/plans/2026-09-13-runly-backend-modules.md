# Runly backend module registration plan

Spec: ../specs/2026-09-13-runly-backend-modules-design.md

## Exact file map

- apps/api/src/services/module-dependency-utils.js — alias-aware persisted dependency loading and deduplication.
- apps/api/src/services/module-discovery-service.js — official Runly namespace and custom reservation.
- apps/api/src/services/module-manifests-service.js — authoritative core-key and fallback helpers.
- apps/api/src/services/module-lifecycle-service.js — shared core policy and dependency resolution.
- apps/api/src/services/module-cleanup-registry.js — exact-first known aliases for existing handlers.
- apps/api/src/routes/modules.js — shared dependency/core/fallback handling.
- apps/api/src/services/__tests__/module-dependency-utils.test.js — dependency alias and conflict coverage.
- apps/api/src/services/__tests__/module-discovery-service.test.js — namespace validation and disk discovery.
- apps/api/src/services/__tests__/runly-module-registration.test.js — catalog/handler/lifecycle regression.
- docs/TASKS.md and docs/migrations/runly-module-keys.md — progress and clean-install direction.
- This plan and its spec — evidence.

## Work

- [x] Implement shared backend identity handling.
- [x] Verify official/custom discovery, UUID dependencies and lifecycle protection.
- [x] Run regressions and lint; record remaining clean-install work.

## Verification — 2026-09-13

- 27 Node tests passed, zero skips: ten dependency utility tests, four discovery tests, six registration/lifecycle/reconciliation tests, five API alias/auth tests, upload and bundle delivery tests.
- Disk fixture verifies official `runly.example` discovery and rejection when loaded as custom. Namespace validation now runs during manifest loading, before declarations load, as well as final discovery validation. Temporary fixture directories were removed.
- Dependency lookup batches both known spellings in one query, resolves exact records first, and merges declarations by persisted module ID. Required precedence survives alias deduplication. Distinct exact records remain separate. Differing nonempty version strings on aliases of one ID fail with `DEPENDENCY_ALIAS_VERSION_CONFLICT`/409; no semver intersection is inferred.
- Lifecycle installation checks missing required dependencies and UUID cycles before replacing dependency edges. Reconciliation tests exercise its shared loader through the route helper and verify conflicts cause no edge writes.
- Official core protection now derives from manifest metadata for all 21 modules, including previously omitted PFM, documents, inventory, chat and notes in the lifecycle list. Custom `core: true` cannot opt into this policy. Existing record IDs are retained in mocked sync verification; no real DB writes were performed.
- Official fallback selection suppresses both spellings of a discovered official identity. Cleanup aliases return existing handlers; their SQL and company scoping were not changed or executed.
- Scoped ESLint passed for nine implementation/test files; `git diff --check` passed. No frontend changes or dependency updates, so no additional frontend build/React Doctor run.

The primary delivery path is now a fresh installation, per the user's explicit direction. Data conversion/rollback tools from earlier increments remain optional. Default seed manifests still declare Atlas keys until remaining runtime callers are converted together; this increment does not claim that a fresh database already boots entirely as Runly. No existing project/database/volume was deleted, no seed/sync ran against an installation, and no image was published or deployed.
