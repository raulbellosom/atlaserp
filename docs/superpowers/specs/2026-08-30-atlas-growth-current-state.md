# atlas.growth — Current State Spec

**Date:** 2026-08-30
**Module:** `atlas.growth` (CORE — CRM / leads + web analytics). Manifest in `feature-modules.js`.
**Status:** Post-audit reference. **No code changes were needed** — the module is
in the best shape of any audited in the campaign.

---

## 1. Layout

```
apps/api/src/routes/growth/
  growth-router.js               createGrowthRouter — mounts lead / analytics / comment routers
  growth-lead-routes.js          (297)   growth-lead-service.js      (850)
  growth-analytics-routes.js     (119)   growth-analytics-service.js (759)
  growth-comment-routes.js       (60)    growth-analytics-csv.js     (71)
  growth-validators.js
  __tests__/  4 files (29 tests)
apps/desktop/src/modules/atlas.growth/  Leads list/detail, Analytics screen + reports
```

## 2. Data model

Prisma models: `GrowthLead` (`companyId`, `siteId`, `assigneeUserId`,
`contactId`, `status`, `convertedAt`, `updatedAt` for optimistic locking),
lead notes / comments (shared `commentsService`, `'GrowthLead'` entity), lead
files (`entityType: 'GrowthLead'`). Analytics reads from the storefront's
`sessions` / `events` / `leads` / `visitor` tables (populated by
`atlas.storefront`'s public ingest — growth is read-only here).

## 3. Access control — clean

- Every lead-service method takes `{ companyId }` and every query is
  `where: { …, companyId }`. `getLeadRecord` 404s if not in the company.
- Cross-reference guards: `assertAssignee({ companyId, userId })` verifies the
  assignee is a company member; `resolveSite({ companyId, siteId })` verifies the
  site; `convertLead` verifies an existing `contactId` is `companyId`-scoped.
- Analytics: `assertSite({ companyId, siteId })` gate + every raw query is a
  `prisma.$queryRaw` tagged template with `${companyId}::uuid` (parameterized).
- `convertLead` runs in a `prisma.$transaction` with **optimistic concurrency**:
  `assertVersion(lead, updatedAt)` + a conditional `growthLead.updateMany({
  where: { …, updatedAt: lead.updatedAt, status: { not: 'converted' } } })` whose
  `count !== 1` raises a 409 `lead_conversion_conflict`. `setLeadEnabled` and
  `updateLead` take the same `updatedAt` version param.

## 4. Permissions

`growth.access` (nav) · `growth.leads.{read,create,update,delete,assign,convert}`
· `growth.analytics.{read,export}` — all in `permission-catalog.js`.

Mapping is deliberate and includes **inline sub-permission checks**:
`PATCH /growth/leads/:id` needs `growth.leads.update`, but changing
`assigneeUserId` in that same call additionally requires `growth.leads.assign`
(403 otherwise); `POST /growth/leads/:id/convert` needs `growth.leads.convert`
**and** — inside the service — `contacts.contacts.read` (existing contact) or
`contacts.contacts.create` (new contact). `PATCH /growth/leads/:id/enabled`
(soft-delete toggle) uses `growth.leads.delete`.

_Minor:_ `GET /growth/leads/:id/assignees` is gated by `growth.leads.assign`
(a read behind a write permission — arguably intentional, you only need the
assignee picker if you can assign).

## 5. UI

`LeadStatusBadge` / `LeadPriorityBadge` render via `@atlas/ui` `Badge` with a
`variant` from `lib/growth-leads.js` — theme-aware from the start (the pattern
fleet/inventory/calendar/catalog badges had to be retrofitted to).
`ConfirmDialog` + `PageHeader` used; no `window.confirm/alert/prompt`, no native
form controls. `ConvertLeadDialog`, `CreateLeadDialog`, `GenerateDocumentDialog`.

## 6. Tests

`growth-lead-service.test.js`, `growth-lead-routes.test.js`,
`growth-analytics-service.test.js`, `growth-analytics-routes.test.js` — 29/29.
Plus desktop `lib/__tests__/growth-{analytics,leads}.test.js`.

## 7. Known gaps / follow-ups

- Analytics subqueries at `growth-analytics-service.js:250-292` filter only by
  `site_id = site_keys.site_id` — transitively company-safe (site ids are
  globally unique and `site_keys` is company-scoped), but a defensive
  `company_id` on each wouldn't hurt. — _low_
- `growth-lead-service.js` (850) / `growth-analytics-service.js` (759) — under
  the 1000-line limit, watch. `GrowthLeadDetailScreen.jsx` (610),
  `GrowthAnalyticsReports.jsx` (519) — watch.
- Browser responsive QA of the analytics reports screen.

## 8. Verification (2026-08-30)

- `node --test routes/growth/__tests__/*.test.js` — 29/29.
- Read audit of both services + all route files — no security / multi-tenancy /
  transaction / permission defects found.
