# Runly persisted-key rehearsal

Date: 2026-09-13

## 1. Title
Stage 4b, first increment: bidirectional API resolution and reversible identity-column rehearsal.
## 2. Status
Complete locally for this increment; complete runtime/data cutover remains pending.
## 3. Context
Stage 4a aliases and audit are available; the application still writes Atlas identities.
## 4. Problem
Old API requests cannot resolve Runly-only catalogs. The proposed data conversion has not exercised UPDATE, inverse UPDATE, UUID relations or failure recovery.
## 5. Goals
Resolve either official spelling using persisted exact-first lookup. Rehearse conversion and explicit inverse updates in disposable PostgreSQL.
## 6. Non-goals
No production converter, existing database connection, runtime-wide rename, JSON rewriting, publication or assets/palette changes.
## 7. User stories
Old clients keep resolving migrated module-management records. Maintainers can reproduce the identity-column conversion proof locally.
## 8. UX
Existing management responses and permission middleware are retained.
## 9. Routes
Only existing module-management key parameters use the updated resolver.
## 10. Data model
Exercise atlas_module.key and module_key in atlas_model, atlas_view, module_migration, permission and file_asset. Preserve every other field.
## 11. Prisma
Read existing schema for fixture constraints; do not edit Prisma schema or migrations.
## 12. API
Exact persisted match wins; otherwise use a persisted official counterpart. If neither exists, retain the requested key. Unknown/custom keys do not query aliases.
## 13. SDK
No SDK changes in this increment.
## 14. Validation
Block catalog collisions, unknown Atlas keys and orphan official identity references. Unique constraints remain enabled.
## 15. Modules
Use all 21 official pairs in synthetic data; retain custom keys and model/view identifiers.
## 16. Navigation
No navigation changes; whole-runtime compatibility remains required.
## 17. Blueprints
Preserve UUID references and stored schemas. JSON is explicitly deferred.
## 18. RBAC
Exercise permission IDs, role grants and company links without recreating rows; authentication and authorization still precede alias lookup.
## 19. Tenancy
Synthetic company relationships only; no customer data or credentials in reports.
## 20. Files
Preserve attachment IDs, bucket/object paths and ownership in the fixture.
## 21. Import/export
A local CLI creates its own disposable Docker PostgreSQL instance, accepts only --out/--help, and never reads database environment variables or .env files.
## 22. Audit
Six allowlisted identity columns only. Compare entire fixture rows before/after against expected transformations. Report aggregate counts, not payloads.
## 23. Edge cases
Cover already-current records, unknown namespaces, collisions, missing modules, unique conflicts and failures during forward/inverse updates.
## 24. Risks
The synthetic subset is not an installation copy and cannot establish production readiness. Real triggers, RLS and extensions require separate rehearsal.
## 25. Acceptance
All 21 pairs convert without changing UUIDs or non-allowlisted fields; inverse UPDATE restores the exact baseline; outer ROLLBACK runs on success and failure.
## 26. Verification
Real PostgreSQL integration tests, API route/helper tests, scoped ESLint, CLI smoke checks and diff checks.
## 27. Rollback
The rehearsal has no commit path. Stop only the container ID created by this invocation; tmpfs storage and --rm remove the fixture. Runtime resolver edits are reversible code changes.
## 28. Future
Complete runtime read/write and semantic JSON migration, classify audit/offline keys, then rehearse a representative installation copy and operational rollback after commit.
