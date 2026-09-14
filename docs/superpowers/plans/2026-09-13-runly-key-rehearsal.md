# Runly key rehearsal implementation plan

Spec: ../specs/2026-09-13-runly-key-rehearsal-design.md

## Exact file map

- apps/api/src/services/module-key-alias.js — bidirectional persisted resolution.
- apps/api/src/routes/__tests__/runly-module-alias.test.js — both catalogs, collisions, missing keys, permission guards.
- scripts/lib/runly-module-rehearsal.js — allowlisted forward/inverse updates, invariant checks, always rollback.
- scripts/lib/runly-module-fixture.js — owned disposable Docker instance and synthetic rows.
- scripts/fixtures/runly-module-keys.sql — minimal UUID/FK/unique schema matching relevant core relationships.
- scripts/__tests__/runly-module-rehearsal.test.js — real PostgreSQL integration/failure tests.
- scripts/rehearse-runly-module-keys.mjs — isolated rehearsal CLI and aggregate report.
- docs/migrations/runly-module-keys-rehearsal.json — generated synthetic evidence.
- docs/migrations/runly-module-keys.md — scope, command and remaining cutover requirements.
- docs/TASKS.md — increment evidence; retain stage 4b as pending.
- This plan and its spec — implementation and verification status.

## Work

- [x] Implement bidirectional resolution with exact-match precedence.
- [x] Implement synthetic fixture, conversion/inverse proof and disposable CLI.
- [x] Exercise happy path, collisions, already-current keys and transactional failure recovery.
- [x] Run relevant tests/lint and generate report; document precise remaining work.

No existing database, seed/sync, deployment, published image or user assets are involved.

## Verification — 2026-09-13

- 20 Node tests passed with `RUNLY_REHEARSAL_TEST_DOCKER=1`: rehearsal suite (including eight real PostgreSQL scenarios), five API tests and four core identity tests. No skips. The Node count includes the integration parent test.
- Two additional existing integration tests passed: module upload and module bundle delivery. Total 22 distinct tests.
- Six scoped JavaScript files passed ESLint with no errors or warnings. `git diff --check` passed; repository line-ending notices are unchanged.
- Standalone CLI successfully wrote `docs/migrations/runly-module-keys-rehearsal.json`: six columns, 21 converted values each, explicit inverse verification, 19 watched tables, `dataConversionReady: false`.
- Temporary PostgreSQL containers removed after both tests and standalone CLI. Docker listing confirms no remaining container from this rehearsal.
- Exact persisted identity always wins; fallback requires an actual counterpart record. Unknown/custom identities do not cause alias queries. The existing authentication and permission middleware remains before lookup.
- Reversal restores only journaled UUIDs with expected current keys. Complete-row assertions detect unexpected protected-field changes. Unique conflicts and inverse identity mismatches roll back all earlier writes.
- No frontend edits in this increment, so no additional web build or React Doctor run was needed.

Remaining: application-wide read/write compatibility, semantic JSON migration, audit/offline policies, representative installation-copy rehearsal and rollback after committed application use. The six-column lab intentionally leaves manifest JSON unchanged and is not a valid application cutover. No production apply command is supplied.
