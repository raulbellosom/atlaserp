# Runly module keys: preparation and cutover

Stage 4a and the first three stage 4b increments are implemented locally. Existing installation keys remain unchanged; complete runtime and clean-install cutover are still pending.

The user now plans to recreate the test project entirely with Runly images and an empty database. A fresh installation is the primary delivery path. The earlier audit/conversion tools remain available for installations that need to retain data; they are not prerequisites for this clean reinstall.

## Available compatibility

The explicit catalog covers 21 official modules. Both in-memory registries resolve either spelling to the same registered object when only one exists. Exact matches always win when both exist. Unknown and custom namespaces do not alias.

Module-management routes accept either known spelling after their existing authentication/permission middleware. They first check for an exact persisted record, then look for the persisted official counterpart. This now works for both Atlas-only and Runly-only catalogs. If neither record exists, the requested key is retained for the existing missing-record response. Unknown/custom keys never alias. Each known-key request adds one exact lookup, and an additional counterpart lookup when the exact record is missing.

The web module outlet resolves against the visible module map, retains availability/path checks, and redirects aliases to the registered key. Query strings, hashes and path suffixes survive. Child screens therefore continue receiving the existing persisted key. The shell uses the resolved identity for PWA configuration; no installed PWA identity is deliberately renamed.

Manifests, model/view/permission keys, migration histories and stored module IDs remain unchanged. These aliases do not make the whole runtime ready for a database rename.

The web runtime now merges official local manifest aliases into the persisted API identity without duplicate alias entries. Exact catalog collisions remain separate and cannot borrow each other's local manifest. Authenticated navigation comes from the API's filtered manifest, including empty navigation; local authoring changes require module sync to appear there. Nested navigation/fullscreen paths normalize registered official prefixes while preserving suffixes, query/hash and permission metadata.

Built-in screens, notes sidebar slots, PFM assistant layout, chat fullscreen layout and live company color resolve both official spellings. Static/dynamic component registrations accept official namespace aliases against the active known module catalog; a known inactive exact owner cannot fall through to an active counterpart. An explicitly empty active catalog blocks namespaced components. This implements central web compatibility, not every child screen's hardcoded path or API query.

Backend discovery now accepts official `runly.*` and legacy `atlas.*` manifests and reserves both prefixes against custom/community modules. Dependency installation/reconciliation resolves known aliases to persisted IDs in a batch, keeps exact collisions distinct and combines required precedence when both declarations refer to one module. Conflicting alias version strings are rejected explicitly. Official fallback manifests do not recreate a discovered counterpart. Core protection derives from the complete official catalog, and existing cleanup handlers resolve both spellings without changing their SQL or tenancy rules.

## Audit commands

Offline source/schema inventory (no database connection or `.env` loading):

```powershell
node scripts/audit-runly-module-keys.mjs --out docs/migrations/runly-module-keys-source-audit.json
```

Optional database audit, after explicitly configuring `RUNLY_MIGRATION_DATABASE_URL` for the intended instance:

```powershell
node scripts/audit-runly-module-keys.mjs --database --out runly-module-key-database-audit.json
```

The second command runs a read-only repeatable-read transaction and rolls it back. Statement timeout is 10 seconds and lock timeout is 1 second. It never offers `--apply`. The report contains module keys, schema metadata and aggregate counts, never row JSON or credentials. Exit code 2 means a known-name collision or unknown Atlas module requires review; exit code 1 means the audit did not complete. Even exit code 0 is not cutover approval: every report explicitly sets `dataConversionReady: false`.

Database visibility depends on the supplied account. Restricted table/column privileges or RLS may produce a partial inventory. JSON/path/key counts are candidates for review, not automatic replacement instructions. Large JSON columns can require full scans; a timeout is an incomplete audit, never zero affected rows.

## Source findings

The stage 4a tracked inventory found 436 source files with official key references and 104 candidate schema columns. Nine columns directly store module identity:

| Table | Column | Cutover concern |
|---|---|---|
| atlas_module | key | Rename the existing record, preserve its UUID; reject collisions. |
| atlas_model | module_key | Preserve model IDs, physical table names and schema checksums. |
| atlas_view | module_key | Preserve IDs and classify view keys/model references separately. |
| module_migration | module_key | Preserve filenames, checksums and applied timestamps; avoid replay. |
| permission | module_key | Preserve permission IDs, role grants and permission keys. |
| file_asset | module_key | Preserve object paths, buckets, shares and attachment ownership. |
| audit_log | module_key | Decide historical-record handling explicitly; no bulk rewrite. |
| sync_cursor | module_key | Check per-company unique collisions and existing client cursors. |
| sync_mutation_log | module_key | Preserve idempotency/replay behavior and existing offline clients. |

`company_module`, `module_dependency`, `blueprint`, and `permission` reference module UUIDs. Their relationships can survive a key rename only if existing module records and UUIDs are retained. Never delete/recreate modules as a renaming strategy.

JSON manifests, blueprint schemas, saved preferences, notification links and configuration need field-specific rules. URLs, model/entity names, permission strings, migration checksums, historical audit payloads, filenames and storage objects cannot be handled by a global text replacement.

This report describes tracked repository source. Customer modules, untracked code, deployed bundles and the intended live database still need inventory before cutover. The checked-in JSON report contains no live database results.

## Stage 4b identity-column rehearsal

Run the isolated laboratory proof with Docker running and `postgres:18-alpine` already cached:

```powershell
node scripts/rehearse-runly-module-keys.mjs --out docs/migrations/runly-module-keys-rehearsal.json
```

The command creates its own PostgreSQL 18 container with temporary memory-backed storage and an ephemeral loopback port, seeds a synthetic 19-table subset, converts six exact identity columns and explicitly reverses those UPDATEs by UUID. Every non-allowlisted field and every relationship in the fixture must match the expected complete-row snapshot. An outer ROLLBACK runs even after a successful inverse conversion. The owned container is removed when the command finishes. The CLI accepts no existing database URL, `.env`, `--database` or `--apply` input and does not pull images automatically.

The six exercised columns are `atlas_module.key` and `module_key` in `atlas_model`, `atlas_view`, `module_migration`, `permission` and `file_asset`. All 21 official pairs are represented, along with custom keys, two companies, enabled/disabled company links, role/user grants, attachment shares and UUID dependencies. Existing Runly rows are excluded from the inverse journal. Catalog collisions, unknown Atlas modules and orphan references block conversion; database unique constraints remain enabled. Statement and lock timeouts bound each SQL operation.

The [synthetic report](runly-module-keys-rehearsal.json) records 126 converted and reversed values. It contains only counts and explicitly reports `dataConversionReady: false`. This is a proof of six-column identity preservation, **not a usable migrated application state**: manifest JSON still contains legacy keys during the transient forward step. JSON paths, model/view identifiers, checksums, audit records, offline cursors and idempotency records are intentionally unchanged in this experiment. Their cutover policy remains pending.

The real PostgreSQL tests are opt-in so ordinary unit tests do not require Docker:

```powershell
$env:RUNLY_REHEARSAL_TEST_DOCKER = '1'
node --test scripts/__tests__/runly-module-rehearsal.test.js
Remove-Item Env:RUNLY_REHEARSAL_TEST_DOCKER
```

The synthetic schema exercises selected UUID/FK/unique relationships; it is not a full Prisma schema, a database backup, or evidence about an installation's triggers, RLS, extensions and customer modules. Explicit inverse updates run within one transaction, not after a deployment or committed concurrent application writes. The latter still requires a separate operational rollback design.

## Remaining clean-install work

The user wants the recreated test installation completely empty. No reset has been executed. Identify the concrete test project, database and persistent storage before deleting resources; no source-workspace deletion is implied. A reset alone cannot fix hardcoded identities in application code.

1. Complete remaining backend data-key queries, child-screen paths, PWA routes, caches and bundle identity handling.
2. Switch the canonical official seed/catalog to Runly together with those callers. It still defaults to Atlas in the current source; do not mistake alias readiness for a completed fresh-install cutover.
3. Build matching Runly API/worker/web images and verify schema initialization, module registration, admin access, permissions and installation flows on an empty disposable database.
4. Recreate the identified test deployment with the Runly images and intended empty database/storage, then perform application acceptance checks.
5. Finish domain/integration and native/offline identity work; assets/palette remain deferred.

If a different installation must preserve data, use the earlier read-only audit, semantic JSON classification, representative-copy conversion rehearsal and operational rollback work before its cutover. That remains a separate optional delivery path.

## Verification

The auditor was exercised against an isolated PostgreSQL 18 container with synthetic records, a deliberate Atlas/Runly collision, JSON references and foreign-key relationships. It detected the collision, counted references, used read-only mode and preserved every fixture row. The temporary container was removed. No existing database was inspected or changed in stage 4a.

The stage 4b increment passed 22 Node tests including eight real PostgreSQL scenarios: conversion/inverse preservation, already-current rows, catalog collision, unknown Atlas module, orphan reference, migration-history unique conflict, unexpected protected-field mutation and inverse identity mismatch. API tests cover both catalog spellings, exact precedence, missing records and authentication/permission guards. Existing upload/bundle routes also passed. The standalone CLI generated the checked-in report and removed its container. No existing database was accessed.

The second stage 4b increment passed 22 focused web/core Node tests, the web build and scoped ESLint. React Doctor remained at 59 existing warnings, 48/100. No database was accessed; application-wide browser acceptance against a migrated installation remains pending. See the [web runtime plan](../superpowers/plans/2026-09-13-runly-web-runtime.md).

The third increment passed 27 backend Node tests and scoped ESLint: namespace discovery from disk, dependency IDs/alias conflicts, official core protection and existing API/upload/bundle regressions. Database behavior was tested with controlled client fixtures; no installation database was accessed. See the [backend registration plan](../superpowers/plans/2026-09-13-runly-backend-modules.md).

PostgreSQL references: [read-only transactions](https://www.postgresql.org/docs/current/sql-set-transaction.html), [rollback](https://www.postgresql.org/docs/18/sql-rollback.html), [table locking](https://www.postgresql.org/docs/18/sql-lock.html).
