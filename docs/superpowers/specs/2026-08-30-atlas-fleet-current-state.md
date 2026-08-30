# atlas.fleet — Current State Spec

**Date:** 2026-08-30
**Module:** `atlas.fleet` (CORE, `core: true`, `uninstallable: false`, version `0.5.1`)
**Status:** Living reference — describes the module as it stands after the 2026-08-30 deep audit + fix pass.

> This document supersedes the `custom.fleet` design specs in
> `docs/superpowers/specs/2026-05-*-*custom-fleet*` and
> `docs/superpowers/specs/2026-05-25-fleet-expansion-design.md`. Those describe
> the retired AME3 demo module `custom.fleet` under `modules/custom/`, **not**
> the shipping product `atlas.fleet`.

---

## 1. Scope and layout

Vehicle-fleet management: vehicles, drivers, insurance policies, and operational
reports (maintenance / service / repair / other) with parts and documents, plus
supporting catalogs (vehicle types / brands / models).

```
apps/api/src/routes/fleet/
  index.js                → re-exports createFleetRouter (from vehicles-routes.js)
  vehicles-routes.js      → mounts drivers/catalogs/reports/insurance sub-routers
  drivers-routes.js       catalogs-routes.js   reports-routes.js   insurance-routes.js
  fleet-service.js (785)  driver-service.js (762)  catalog-service.js (459)
  insurance-service.js (525)  reports-service.js (964)  reports-schema.js (NEW — DDL bootstrap)
  fleet-export-service.js (Excel)  report-pdf.js (~650)  vehicle-pdf.js (~270)
  validators.js  service-helpers.js
apps/desktop/src/modules/atlas.fleet/
  screens/  VehiclesScreen  DriversScreen  InsuranceScreen
            ReportsScreen  ReportFormPage  ReportDetailScreen  CatalogsScreen
  components/  VehicleStatusBadge  DriverStatusBadge  DriverLicenseBadge (NEW)
               ReportStatusBadge  CoverageTypeBadge  InsuranceBadgeCell
               DriverAvatarCell  DriverAssignedVehicleCell  VehicleImageCell
```

Router mounted in `apps/api/src/index.js` via
`mountWithAuth(app, createFleetRouter({ prisma, requirePermission, enrichFilesWithSignedUrls }))`.
Desktop routes resolved in `apps/desktop/src/app/ModuleOutlet.jsx` (`moduleKey === "atlas.fleet"`).

## 2. Entities (Atlas ORM / AME3 tables — not in prisma/schema.prisma)

`fleet_vehicle`, `fleet_driver`, `fleet_vehicle_type`, `fleet_vehicle_brand`,
`fleet_vehicle_model`, `fleet_vehicle_document`, `fleet_driver_document`,
`fleet_report`, `fleet_report_part`, `fleet_report_document`,
`fleet_insurance_policy`.

All are provisioned lazily via idempotent `CREATE TABLE IF NOT EXISTS` DDL on
first use. The report-table DDL now lives in `reports-schema.js`
(`createReportSchemaEnsurer(prisma)`).

Legacy `fleet_maintenance*` tables (from the retired `custom.fleet` era) are no
longer referenced by any code path. The one-shot `dev/purge-legacy` route and its
service function were removed on 2026-08-30.

## 3. Permissions and access model

Catalog: `apps/api/src/permission-catalog.js` (`groupKey: "fleet"`). Manifest:
`apps/api/src/manifests/official/core-modules.js` (`atlasFleetManifest`).

| Feature | Keys |
|---|---|
| Module | `fleet.access` |
| Vehicles | `fleet.vehicles.{read,create,update,delete}` |
| Reports | `fleet.reports.{read,create,update,delete}` |
| Drivers | `fleet.drivers.{read,create,update,delete}` |
| Catalogs | `fleet.catalogs.{read,create,update,delete}` |
| Insurance | `fleet.insurance.{read,create,update,delete}` |

- `read` is separated from mutations everywhere, including catalogs (they feed the
  vehicle and report form dropdowns — a `fleet.catalogs.read` role can populate
  those pickers without any create/update grant).
- Every route is guarded by `requirePermission("fleet.<feature>.<action>")`.
  `fleet.vehicles.delete` guards the `/enabled` soft-delete toggle.
- `fleet.access` (`acl.module`) is used for navigation visibility
  (`filterModuleNavigation`) and `userCanAccessModule`. It is **not** enforced
  per-route — consistent with every other Atlas module; roles are always built
  with `fleet.access` alongside the feature grants.
- Navigation children under "Reportes" are Mantenimiento / Servicio / Reparación /
  **Otro** (the last one added 2026-08-30 to match the routes and the in-screen
  tab bar). Catalog children: Tipos de vehículo / Marcas / Modelos.
- `rbac-granular-contract` test: fleet keys are all present in both the manifest
  and the catalog; the module adds no drift. (A pre-existing, unrelated failure
  in that test concerns `calendar/catalog/inventory/notes` keys.)

## 4. Multi-tenancy / privacy

- `companyId` is always taken from
  `c.get("userContext").memberships[0].companyId` — never from the request body.
- Every service normalizes it through `toScopedCompanyUuid()`, which throws
  `FleetServiceError(400)` when the value is missing or is not a UUID v7. There is
  **no** NULL / "visible to everyone" fallback.
- All queries are `prisma.$queryRaw` tagged templates or
  `prisma.$queryRawUnsafe(sql, ...params)` with `$n` placeholders — no string
  interpolation of user input. No `prisma.<model>` accessors for fleet tables.
- Every `SELECT`/`UPDATE`/`DELETE` is filtered by `company_id`. `hr-employee-options`
  is parameterized and company-scoped. Cross-company isolation is covered by
  `__tests__/company-isolation.test.js`.

## 5. Reports — transactions and structure

- `createReport` and `updateReport` now write the report row and its parts inside
  a single `prisma.$transaction`. A failing part insert rolls the whole thing back
  (`__tests__/reports-transaction.test.js`).
- `reports-service.js` was brought under the 1000-line limit by extracting the DDL
  bootstrap into `reports-schema.js` and importing shared helpers from
  `service-helpers.js`.
- Report types: `maintenance | service | repair | other`. Folios are reserved per
  `(company, type)` with a `PREFIX-000000` counter. Finalize/reopen gate editing.

## 6. Report editing flow (fixed 2026-08-30)

- Canonical edit URL: `/app/m/atlas.fleet/reports/<type>/<id>/edit` — keeps the
  real report type in the URL so the correct form blueprint loads with no extra
  fetch.
- `ModuleOutlet.jsx` routes `.../reports/<type>/<id>/edit` → `ReportFormPage`.
- `ReportFormPage` parser recognises `reports/<type>/new` (create),
  `reports/<type>/<id>/edit` (typed edit), and the legacy `reports/<id>/edit`
  (falls back to the maintenance form).
- `ReportsScreen` "Editar" row action and `ReportDetailScreen` "Editar" action
  both navigate to the canonical typed edit URL.

## 7. PDFs and Excel exports — branding

All fleet PDF/Excel output is authored by the **real company**; "Atlas ERP" only
appears as a discreet watermark.

- `report-pdf.js` and `vehicle-pdf.js` no longer carry their own
  `resolveCompanyBranding` / logo pipeline. Both import
  `apps/api/src/services/pdf-branding-service.js`
  (`resolveCompanyBranding`, `resolvePdfDocumentCtor`, `drawPdfFooter`,
  `formatDateEs`, …). The shared resolver loads the real logo from
  `BrandingConfig.logoFileId` (Supabase Storage + sharp normalization).
- `vehicle-pdf.js` now renders the real company logo (previously always blank) and
  reads the correct `Company` fields (`rfc`, `contactEmail`).
- Footers: `Generado por <empresa> · <fecha>` on the left, discreet
  `Hecho con Atlas ERP` centered, page numbers on the right.
- `fleet-export-service.js` `applyWorkbookIdentity(wb, companyName)` sets
  `wb.creator` / `wb.lastModifiedBy` / `wb.company` to the company name
  (fallback `"Atlas ERP"` only when unknown) and `wb.description = "Hecho con Atlas ERP"`.
- The four export routes now fetch the company name via
  `resolveCompanyName({ prisma, companyId })` and pass it to the builders (they
  previously never did, so the "Empresa" info row was always blank).

Covered by `__tests__/pdf-branding.test.js`.

## 8. UI

- All screens are thin wrappers over `@atlas/ui` `AtlasCrudView` / `AtlasTable` /
  `PageHeader`. No native `<select>/<input>/<textarea>/<table>`, no
  `window.confirm/alert/prompt`. Destructive confirmation is handled by
  `AtlasCrudView`. File uploads are inline in every entity form (attachments
  sections), never a redirect to atlas.files.
- Badge components (`VehicleStatusBadge`, `DriverStatusBadge`, `ReportStatusBadge`,
  `CoverageTypeBadge`, `InsuranceBadgeCell`, `DriverLicenseBadge`) now render via
  the theme-aware `@atlas/ui` `Badge` (`success/warning/destructive/secondary/outline`)
  instead of hardcoded `bg-*-100 text-*-800` — they read correctly in dark mode.

## 9. Driver licence expiry

`driver-service.js` `withLicenseStatus(row)` adds computed
`license_status` (`valid | expiring | expired | unknown`) and
`license_days_to_expiry` to every driver row in `listDrivers` and `getDriver`.
Threshold: **30 days** (`LICENSE_EXPIRY_WARNING_DAYS`, product default). Surfaced
in the drivers table and detail via `DriverLicenseBadge`.

Insurance already exposes an `expired` computed badge and an `active` filter.
Vehicle inspection/"verificación" expiry is still not modeled.

## 10. Known gaps / follow-ups

- **Responsive QA not yet run in-browser** for this pass. `ReportFormPage` has 8
  long collapsible sections + a parts editor — verify at 390px and 1440px against
  `docs/ai-context/ui-screen-audit-checklist.md`.
- `AtlasTable` "Desactivar" row action on `ReportsScreen` is not wired to an
  explicit `onDelete`; confirm the shared renderer handles it via
  `apiPath + /:id/enabled`.
- Vehicle inspection/verification expiry status is not modeled.
- `report-pdf.js` (~650) and `driver-service.js` (762) are under the limit but
  worth watching.
- Tab bar in `ReportsScreen` uses bare `<button>` elements (no `role="tab"`).

## 11. Verification performed (2026-08-30)

- `node --check` on every modified API file + `apps/api/src/index.js` — pass.
- `node --test apps/api/src/routes/fleet/__tests__/*.test.js` — 28/28 pass
  (company isolation, PDF/Excel branding, report transaction).
- `node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js` —
  no new fleet drift (pre-existing unrelated failure for calendar/catalog/
  inventory/notes keys).
- `node --test apps/api/src/routes/ledger/__tests__/*.test.js` — 18/18 pass
  (shared `pdf-branding-service.js` change is additive).
- `pnpm --filter @atlas/desktop build:web` — pass.
