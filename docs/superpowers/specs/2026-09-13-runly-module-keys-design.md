# Runly module keys

Date: 2026-09-13
Status: Complete (local stage 4a)

## 1. Title

Runly module-key compatibility and read-only migration audit (stage 4a).

## 2. Status

Complete locally; stage 4b is still required before persisted key conversion.

## 3. Context

Branding, package and environment migrations are locally complete.

## 4. Problem

Module keys occur in persisted identity, JSON, routes, permissions and migration histories; replacement without inventory risks duplication and lost access.

## 5. Goals

Explicit aliases for the 21 official modules; preserve exact lookup priority; audit DB collisions and schema/source references without rewriting records.

## 6. Non-goals

No key/ID/data conversion, table rename, native/offline identity changes, app asset changes, production query, deployment or publication. Stage 4b owns cutover.

## 7. User stories

Authors can resolve official modules by either name; existing links work; operators can review collision/reference counts before conversion.

## 8. UX

Runly module URLs redirect to the currently registered key only after existing access checks, preserving suffix/query/hash.

## 9. Routes

Module management key parameters resolve current names to legacy only when no exact persisted record exists. All permission middleware remains.

## 10. Data model

Read only. Preserve UUIDs, foreign keys and every saved value.

## 11. Prisma

Read schema only; no migration or generated model edits.

## 12. API

Legacy key requests keep existing behavior. New known key requests prefer an exact DB record; missing exact matches fall back to the known official legacy key.

## 13. SDK

Core exports alias helpers; both in-memory registries use exact-first lookup. No public storefront SDK dependency change.

## 14. Validation

Unknown namespaces and similar prefixes never alias; collision reporting never silently combines records.

## 15. Modules

Manifests still declare Atlas keys during preparation. The catalog is explicit and checked against all official manifests.

## 16. Navigation

Respect the visible module map, unavailable status and path permissions before redirects.

## 17. Blueprints

Persisted keys/schemas unchanged; count candidate references for manual classification.

## 18. RBAC

Same existing middleware and permission keys; IDs unchanged. No use of aliases to grant access.

## 19. Tenancy

No company/role filtering changes. Audit only aggregates reference counts, never outputs row payloads.

## 20. Files

Source/schema report only plus new scripts/tests. Existing untracked user Runly assets left untouched.

## 21. Import/export

CLI defaults to offline inventory; DB mode requires --database plus RUNLY_MIGRATION_DATABASE_URL explicitly, no .env auto-load. Reports are aggregates.

## 22. Audit

READ ONLY REPEATABLE READ transaction, statement/lock timeouts, rollback in finally. Detect both-name collisions, unknown legacy keys and UUID foreign-key dependencies.

## 23. Edge cases

Both names registered: exact match wins. Only alias exists: same object returned. Similar/custom names: unchanged. JSON matches are candidates, not proposed automatic replacements.

## 24. Risks

Source-only report cannot certify live readiness; JSON scans can be expensive and use bounded statement timeout. Read-only DB mode never offers apply.

## 25. Acceptance

Aliases work without duplicate list entries or manifest mutation; read-only audit rejects/flags collisions and retains database content in an isolated Postgres test.

## 26. Verification

Core/engine and API alias tests; offline CLI report; real isolated PostgreSQL fixture with aggregates and collision checks; web build, lint, React Doctor.

## 27. Rollback

Restore only stage 4a code/report and workspace importer change. No database rollback required.

## 28. Future

Stage 4b: full persistent conversion strategy, JSON semantic rules, old links/PWA/cache/bundle identities and rollback rehearsal before deployment.
