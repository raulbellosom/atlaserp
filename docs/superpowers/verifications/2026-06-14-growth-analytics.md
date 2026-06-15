# Verification Checklist - Growth Analytics

Date: 2026-06-14
Feature: Growth Analytics
Spec: `docs/superpowers/specs/2026-06-14-growth-analytics-design.md`
Plan: `docs/superpowers/plans/2026-06-14-growth-analytics.md`

## Automated Checks

- [x] Growth API, worker, manifest, validator, SDK, and filter tests
  - Result: 49 passed, 0 failed.
- [x] Complete internal SDK suite
  - Result: 19 passed, 0 failed.
- [x] Prisma validation and UUID policy
  - Result: both commands exited 0.
- [x] JavaScript syntax checks for analytics routes, service, worker, and worker entrypoint
  - Result: all checks exited 0.
- [x] Desktop production build
  - Result: Vite transformed 4,956 modules.
- [x] Full monorepo build
  - Result: web build, native executable, MSI, and NSIS completed.
- [x] React Doctor
  - Result: no correctness errors. One contextual Recharts warning remains;
    the complete Analytics screen is already loaded through `React.lazy`.

## Scale Evidence

- [x] Disposable PostgreSQL 17 dataset generated in Docker
  - 100,000 visitors
  - 200,000 sessions
  - 1,000,000 events
  - 20,000 leads
  - 6,192 daily metric rows
- [x] `EXPLAIN (ANALYZE, BUFFERS)` recorded with current indexes
  - 25-month aggregate read: 7.245 ms
  - acquisition one-day tail: 23.490 ms
  - content one-day tail: 58.293 ms
  - CTA one-day tail: 50.247 ms
  - forms one-day tail: 47.379 ms
  - 44-day retention cohort: 272.868 ms
- [x] No forward index migration added
  - Result: current composite and event indexes were used; measured plans do
    not justify another index for the initial one-million-event target.
- [x] Benchmark container removed after execution.
- [x] Reproducible benchmark stored at
  `scripts/benchmarks/growth-analytics-scale.sql`.

## Behavioral Coverage

- [x] Shared 7/30/90/custom range, site, comparison, and tab filters persist in URL.
- [x] Aggregate rows and all raw-tail dimensions merge after the watermark.
- [x] Fixed funnel is monotonic and reports forms and converting campaigns.
- [x] Retention reports new/returning visitors and D1/D7/D30 cohorts.
- [x] CSV uses UTF-8 BOM, Spanish headers, active filters, export permission,
  and filter-only audit metadata.
- [x] Company/site isolation and exact read/export permissions are covered by tests.
- [x] Every chart has KPI, summary, or DataTable fallback.

## Pending Environment Checks

- [ ] Apply and verify migrations in the target installation.
- [ ] Verify the hourly worker and watermark against the target database.
- [ ] Run authenticated browser QA for all tabs, comparison, empty ranges,
  CSV download, RBAC, and mobile layout.
- [ ] Observe production ingestion and query latency after deployment.

## Known Unrelated Issue

`pnpm.cmd rbac:verify-catalog` still exits 1 for 30 pre-existing missing
Calendar, Catalog, and Inventory entries plus two extra platform entries. No
Growth permission is missing.

## Summary

Repository implementation and scale verification: PASS.

Live deployment and authenticated browser verification: PENDING.
