# Growth Analytics

Date: 2026-06-14
Status: Implemented - live verification pending
Author: Codex
Spec file: `docs/superpowers/specs/2026-06-14-growth-analytics-design.md`
Plan file: `docs/superpowers/plans/2026-06-14-growth-analytics.md`

---

## 1. Feature title

Growth Analytics

## 2. Status

Implemented - live verification pending

## 3. Context

Spec A captures privacy-limited events, sessions, attribution, forms, and lead outcomes. Atlas needs useful reporting over those records.

## 4. Problem

Website users cannot determine where visitors come from, which content or CTA performs, where form conversion fails, or whether visitors return.

## 5. Goals

1. Deliver one dashboard with shared date and comparison filters.
2. Report acquisition, content, CTA, conversion, and retention.
3. Keep definitions stable and testable.
4. Export filtered analytic tables and series as CSV.

## 6. Non-goals

1. Realtime dashboards.
2. Session replay, heatmaps, arbitrary funnel builders, A/B tests, or external BI.
3. Cross-device identity.
4. PDF analytics reports.

## 7. User stories

- As a marketing user, I want source and campaign performance so I can prioritize acquisition.
- As a content owner, I want page and CTA performance so I can improve the public site.
- As a manager, I want lead and Contact conversion rates so I can evaluate business outcomes.

## 8. UX requirements

- One route with tabs: Resumen, Adquisicion, Contenido, Conversiones, Retencion.
- Shared date range: 7, 30, 90 days, or custom.
- Optional comparison to the immediately preceding equal-length period.
- Use `PageHeader`, `StatCard`, `Tabs`, `DatePickerField`, `SelectField`, `DataTable`, `EmptyState`, `ErrorState`, and `recharts`.
- Every chart has an accessible tabular equivalent or summary.

## 9. Routes/screens

| Route | Screen | Module | Description |
|---|---|---|---|
| `/app/m/atlas.growth` | `GrowthAnalyticsScreen` | `atlas.growth` | Tabbed analytics dashboard |

## 10. Data model

Reuse `GrowthSession`, `GrowthEvent`, `GrowthLead`, and `GrowthDailyMetric`.

Daily metrics retain 25 months. Raw events retain 90 days.

Definitions:

- session timeout: 30 minutes inactivity.
- engaged session: visible seconds >= 10, pageviews >= 2, or conversion.
- bounce: non-engaged session.
- returning visitor: same first-party visitor seen on an earlier calendar date.
- funnel: `form_view`, `form_start`, `form_submit`, `lead_created`, `qualified`, `converted`.

## 11. Prisma impact

No new model expected. Add indexes or metric dimension fields only through forward migration if query plans require them.

## 12. API contract

Protected endpoints, all guarded by `growth.analytics.read`:

- `GET /growth/analytics/overview`
- `GET /growth/analytics/acquisition`
- `GET /growth/analytics/content`
- `GET /growth/analytics/conversions`
- `GET /growth/analytics/retention`

Common query: `from`, `to`, `compare`, optional `siteId`.

`GET /growth/analytics/export.csv` requires `growth.analytics.export` and query `report=overview|acquisition|content|conversions|retention`.

Responses contain `range`, optional `comparisonRange`, `totals`, `series`, and `rows`.

## 13. SDK contract

Add to internal `atlas.growth` domain:

- `getAnalyticsOverview(token, query)`
- `getAnalyticsAcquisition(token, query)`
- `getAnalyticsContent(token, query)`
- `getAnalyticsConversions(token, query)`
- `getAnalyticsRetention(token, query)`
- `exportAnalyticsCsv(token, query)`

## 14. Validator contract

- `growthAnalyticsQuerySchema`: valid dates, maximum 25-month range, comparison flag, optional site.
- `growthAnalyticsExportQuerySchema`: report enum plus common filters.

## 15. Module manifest impact

Add Growth root navigation:

- “Crecimiento”, path `/`, icon `TrendingUp`, permission `growth.analytics.read`.
- retain Leads child/navigation from Spec B.

## 16. Navigation impact

| Label | Path | Icon | Layout | permissionKey |
|---|---|---|---|---|
| Crecimiento | `/` | `TrendingUp` | `main` | `growth.analytics.read` |

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

- `growth.analytics.read`: dashboard endpoints and navigation.
- `growth.analytics.export`: CSV endpoint and export action.

## 19. Multi-company behavior

All aggregates and raw fallback queries include company scope. `siteId` must belong to the company. No cross-company totals exist.

## 20. Files/storage impact

CSV is streamed and not persisted.

## 21. Export/import requirements

CSV export for every dashboard tab using the active filters. UTF-8 BOM and Spanish headers. No import.

## 22. Audit log requirements

Reading analytics is not audited. CSV export records `growth.analytics.export` with report and date range, not row data.

## 23. Edge cases

1. Empty ranges return zeros and empty series, not errors.
2. Current-day metrics combine completed daily aggregates with newer raw/session data without double counting.
3. Ranges older than retained aggregates are rejected.
4. Missing UTM values group under “Directo / Sin campaña”.
5. Deleted pages/forms remain reportable by stored labels/IDs.
6. Consent-denied visits never appear.

## 24. Risks

1. Double counting current data. Mitigation: aggregation watermark and explicit raw tail.
2. Slow queries. Mitigation: daily dimensions, bounded ranges, indexes, and query-plan tests.
3. Metric ambiguity. Mitigation: fixed definitions documented in UI help text and tests.

## 25. Acceptance criteria

1. Given a date range, when dashboard loads, then all tabs use that same range and company.
2. Given comparison enabled, then totals include absolute and percentage deltas against the preceding equal period.
3. Given a form journey, then each funnel step is less than or equal to its preceding eligible population.
4. Given a visitor returns on a later date, then retention counts them once for the matching cohort interval.
5. Given export permission, then CSV reflects current tab filters.

## 26. Verification plan

- `node --test apps/api/src/routes/growth/__tests__/growth-analytics-service.test.js`
- `node --test apps/api/src/services/__tests__/growth-aggregation-worker.test.js`
- `node --test packages/sdk/src/__tests__/growth-domain.test.js`
- SQL query plan checks on one million synthetic events.
- `pnpm --filter @atlas/desktop build:web`
- Manual chart/table/filter/export QA.

## 27. Rollback plan

Hide analytics navigation and stop aggregation ticks. Captured data remains available for reprocessing. Remove added indexes only through forward migration.

## 28. Future enhancements

1. Realtime visitor view.
2. Saved reports.
3. Custom funnels.
4. External BI connectors.
