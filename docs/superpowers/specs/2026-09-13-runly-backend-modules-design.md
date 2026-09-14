# Runly backend module registration

Date: 2026-09-13

## 1. Title
Stage 4b increment 3: official Runly module registration and dependency resolution.

## 2. Status
Complete locally for this increment; clean-install cutover remains pending.

## 3. Context
The user plans to recreate the test installation completely with Runly images. No existing database target has been identified or reset.

## 4. Problem
Discovery rejects runly.* official keys, dependency synchronization performs exact-only lookup, and duplicated core-protection lists omit official modules.

## 5. Goals
Accept official Runly manifests, reserve both official namespaces, resolve dependency aliases by persisted UUID, and use one authoritative core catalog.

## 6. Non-goals
No database reset, global seed default change, full backend data-key rewrite, asset changes, image publication or deployment.

## 7. User stories
An official Runly module can be discovered and synchronized; old module dependencies can reference the same newly named installed module.

## 8. UX
Existing installation/lifecycle responses and access middleware remain.

## 9. Routes
Module sync fallback skips discovered official counterparts; dependency reconciliation uses resolved UUIDs.

## 10. Data model
Preserve module UUID relationships, permission keys, model/view names and SQL migration checksums.

## 11. Prisma
No schema changes; use existing clients/transactions.

## 12. API
Required dependency errors remain explicit. Alias declarations resolving to one UUID merge required precedence; incompatible version strings fail explicitly.

## 13. SDK
Reuse core's explicit 21-pair alias catalog; no external dependencies.

## 14. Validation
Official manifests accept atlas.* or runly.*; custom/community manifests cannot claim either namespace.

## 15. Modules
Derive protected core identities from official manifests rather than divergent literal lists.

## 16. Navigation
No frontend changes.

## 17. Blueprints
No stored blueprint changes.

## 18. RBAC
Official core flags and uninstall protection follow the authoritative catalog. No extra privileges for arbitrary core:true custom manifests.

## 19. Tenancy
No tenant filter or cleanup-company boundary changes.

## 20. Files
Preserve existing module directories and user assets; test filesystem discovery only in owned temporary directories.

## 21. Import/export
No deployable seed mode is enabled prematurely.

## 22. Audit
Test discovery, core flags, dependency queries/UUID merging and lifecycle writes with fixtures.

## 23. Edge cases
Exact persisted collisions remain distinct; missing optional versus required dependencies; old/new declarations of one dependency; cycles by UUID.

## 24. Risks
Raw backend data-key queries and seed defaults still require coordinated cutover. A clean database alone does not address those code paths.

## 25. Acceptance
Runly official discovery succeeds, custom namespace impersonation fails, both dependency spellings resolve correctly, and every official core manifest retains protection.

## 26. Verification
Targeted Node discovery/dependency/lifecycle/router tests, scoped ESLint and diff checks.

## 27. Rollback
Revert only this increment's code. No database rollback is required.

## 28. Future
Complete clean-install seed and remaining backend/frontend data-key callers, build/publish Runly images, then recreate the identified test installation.
