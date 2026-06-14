# Growth Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stable Growth dashboard for acquisition, content, CTA, conversion, and retention with CSV export.

**Architecture:** Protected analytics services query daily aggregates plus an unaggregated current tail. One dashboard route shares date/comparison/site filters across five tabs. Metric definitions are centralized and tested.

**Tech Stack:** Prisma/PostgreSQL, Hono, React Query, Recharts, `@atlas/ui`, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-06-14-growth-analytics-design.md`

---

## File Structure Map

### Create

- `apps/api/src/routes/growth/growth-analytics-routes.js`
- `apps/api/src/routes/growth/growth-analytics-service.js`
- `apps/api/src/routes/growth/growth-analytics-csv.js`
- `apps/api/src/routes/growth/__tests__/growth-analytics-service.test.js`
- `apps/api/src/services/growth-aggregation-worker.js`
- `apps/api/src/services/__tests__/growth-aggregation-worker.test.js`
- `apps/desktop/src/modules/atlas.growth/screens/GrowthAnalyticsScreen.jsx`
- `apps/desktop/src/modules/atlas.growth/components/AnalyticsDateFilter.jsx`
- `apps/desktop/src/modules/atlas.growth/components/AnalyticsOverviewTab.jsx`
- `apps/desktop/src/modules/atlas.growth/components/AnalyticsAcquisitionTab.jsx`
- `apps/desktop/src/modules/atlas.growth/components/AnalyticsContentTab.jsx`
- `apps/desktop/src/modules/atlas.growth/components/AnalyticsConversionsTab.jsx`
- `apps/desktop/src/modules/atlas.growth/components/AnalyticsRetentionTab.jsx`

### Modify

- `apps/api/src/routes/growth/growth-router.js`
- `apps/api/src/routes/growth/growth-validators.js`
- `apps/api/src/manifests/official/feature-modules.js`
- `apps/worker/src/index.js`
- `packages/sdk/src/domains/growth.js`
- `packages/sdk/src/__tests__/growth-domain.test.js`
- `apps/desktop/src/app/ModuleOutlet.jsx`
- `docs/TASKS.md`

---

### Task 1: Metric fixtures and aggregation worker

- [ ] Create deterministic fixtures containing direct/UTM sessions, engaged/bounce sessions, CTA events, form funnel events, qualified/converted leads, and returning visitors.
- [ ] Write failing tests for daily dimensions, watermark idempotency, late events, current-day tail, D1/D7/D30 cohorts, and retention purge.
- [ ] Implement aggregation in bounded transactions with an explicit watermark.
- [ ] Register the worker tick with a configurable hourly interval.
- [ ] Run worker tests and commit `feat(growth): aggregate analytics metrics`.

### Task 2: Analytics query service

- [ ] Write failing tests for overview totals, preceding-period comparison, source/medium/campaign grouping, landing pages, page/CTA metrics, fixed funnel, retention cohorts, empty ranges, and company/site isolation.
- [ ] Implement one service factory with separate methods per tab and shared range normalization.
- [ ] Use aggregate tables for completed days and raw/session tail only after the watermark.
- [ ] Run:

```bash
node --test apps/api/src/routes/growth/__tests__/growth-analytics-service.test.js
```

- [ ] Commit `feat(growth): add analytics query service`.

### Task 3: Protected analytics routes and CSV

- [ ] Add validator tests for invalid dates, ranges over 25 months, invalid report, and cross-company site.
- [ ] Implement five JSON endpoints guarded by `growth.analytics.read`.
- [ ] Implement streamed CSV with UTF-8 BOM and Spanish headers guarded by `growth.analytics.export`.
- [ ] Add export audit record containing filters only.
- [ ] Update Growth router and manifest navigation.
- [ ] Run route/service tests and permission catalog verification.
- [ ] Commit `feat(growth): expose analytics API and export`.

### Task 4: Internal SDK methods

- [ ] Extend Growth SDK request tests for all analytics methods and blob CSV response.
- [ ] Implement methods in the existing extracted Growth domain.
- [ ] Run all SDK tests.
- [ ] Commit `feat(sdk): add growth analytics methods`.

### Task 5: Dashboard shell and shared filters

- [ ] Build `GrowthAnalyticsScreen` with `PageHeader`, shared date range, custom `DatePickerField`s, site filter, comparison switch, tabs, URL-search-param persistence, loading, empty, and error states.
- [ ] Add route `/` for `atlas.growth`.
- [ ] Ensure Leads remains reachable as a secondary navigation item.
- [ ] Build and run React Doctor.
- [ ] Commit `feat(growth): add analytics dashboard shell`.

### Task 6: Five analytic tabs

- [ ] Implement Resumen KPI cards and trend charts.
- [ ] Implement Adquisicion source/campaign/landing tables.
- [ ] Implement Contenido page and CTA tables with CTR.
- [ ] Implement Conversiones fixed funnel and form/campaign breakdown.
- [ ] Implement Retencion new/returning series and D1/D7/D30 cohort table.
- [ ] Every chart includes a textual/table fallback.
- [ ] Add CSV export action for the active tab.
- [ ] Build and run React Doctor.
- [ ] Commit `feat(growth): complete analytics tabs`.

### Task 7: Scale and full verification

- [ ] Generate a disposable one-million-event dataset.
- [ ] Run `EXPLAIN (ANALYZE, BUFFERS)` for each service query and record plans; add forward indexes only when evidence requires them.
- [ ] Run:

```bash
node --test apps/api/src/services/__tests__/growth-aggregation-worker.test.js
node --test apps/api/src/routes/growth/__tests__/growth-analytics-service.test.js
node --test packages/sdk/src/__tests__/growth-domain.test.js
pnpm --filter @atlas/desktop build:web
pnpm build
```

- [ ] Manually verify tabs, shared filters, comparison, empty ranges, CSV, RBAC, and mobile layout.
- [ ] Record verification evidence in TASKS.

## Rollback Notes

Stop the aggregation worker and remove analytics navigation/routes. Captured raw data and existing aggregates remain intact for reprocessing.

