# custom.fleet Catalog Hub Tabs

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY

## 1. Feature title

custom.fleet Catalog Hub Tabs

## 2. Status

Draft

## 3. Context

The `custom.fleet` module already has four catalog PAGE blueprints and working CRUD flows:

1. Vehicle types
2. Vehicle brands
3. Vehicle models
4. Maintenance types

After relation inline create rollout and module sync, runtime metadata is up-to-date. However, catalog discoverability in sidebar/navigation is inconsistent.

## 4. Problem

Current Fleet navigation makes catalogs look incomplete:

1. Sidebar exposes `Catálogos` pointing to vehicle types only.
2. Sidebar exposes a separate `Modelos de vehículo` entry.
3. Vehicle brands and maintenance types exist but are not discoverable from sidebar.
4. Users infer that only one or two catalogs exist, even though four are available.

## 5. Goals

1. Provide a single Fleet `Catálogos` entry in sidebar.
2. Make all four catalogs discoverable from one hub experience.
3. Reuse existing blueprint CRUD pages and routes.
4. Avoid duplicate CRUD logic and avoid new backend/API contracts.
5. Keep direct deep-link routes to each catalog working.

## 6. Non-goals

1. Database schema or migration changes.
2. New API endpoints for catalogs.
3. DocumentsPanel, dashboards, or reports.
4. AME3 Phase 4 work.
5. Replacing Blueprint CRUD internals with module-specific CRUD code.

## 7. User stories

1. As a Fleet operator, I want to open `Catálogos` and quickly switch between all catalogs so I can manage reference data without hunting routes.
2. As a Fleet admin, I want brands and maintenance types to be discoverable from navigation so onboarding and data hygiene are clearer.
3. As a support user, I want existing direct catalog URLs to continue working so bookmarks and shared links remain valid.

## 8. UX requirements

1. `Flota → Catálogos` opens a catalog hub with tabs/segmented controls:
   - `Tipos de vehículo`
   - `Marcas de vehículo`
   - `Modelos de vehículo`
   - `Tipos de mantenimiento`
2. Tab labels must be Spanish UTF-8 with accents.
3. Tab switch must navigate to existing catalog routes (URL changes), not fake client-only state.
4. Active tab must match the current route.
5. CRUD behavior inside each tab remains exactly the existing blueprint CRUD behavior.

## 9. Routes/screens

Target routes:

1. `/app/m/custom.fleet/catalogs` (hub base route)
2. `/app/m/custom.fleet/catalogs/vehicle-types`
3. `/app/m/custom.fleet/catalogs/vehicle-brands`
4. `/app/m/custom.fleet/catalogs/vehicle-models`
5. `/app/m/custom.fleet/catalogs/maintenance-types`

Routing behavior:

1. Hub base route should resolve to default tab (`vehicle-types`) while preserving hub UI.
2. All tab routes render current `BlueprintCrudScreen` flow for their selected catalog.

## 10. Data model

N/A. No new entities or field changes.

## 11. Prisma impact

None.

## 12. API contract

None. Existing catalog APIs are reused unchanged.

## 13. SDK contract

None.

## 14. Validator contract

None.

## 15. Module manifest impact

`custom.fleet` manifest navigation is adjusted:

1. Keep a single catalog sidebar entry:
   - label: `Catálogos`
   - path: `/app/m/custom.fleet/catalogs`
2. Remove redundant sidebar entry `Modelos de vehículo` once hub is active.

Views/PAGE blueprints for individual catalogs remain and continue to be registered.

## 16. Navigation impact

Sidebar becomes cleaner:

1. One `Catálogos` item replaces multiple catalog-specific side entries.
2. Catalog selection moves into hub tabs at page-level.

## 17. Blueprint impact

Preferred strategy:

1. Keep existing catalog PAGE blueprints as-is.
2. Add a lightweight hub PAGE blueprint for `/app/m/custom.fleet/catalogs` if needed for clean route resolution.
3. Do not duplicate table/form/detail blueprint definitions.

## 18. RBAC/permissions

No new permissions.

1. Hub entry uses `fleet.catalogs.read`.
2. Individual catalog CRUD remains guarded by existing `fleet.catalogs.*` permissions.

## 19. Multi-company behavior

Unchanged. Existing company-scoped APIs and blueprint runtime behavior remain in effect.

## 20. Files/storage impact

None.

## 21. Export/import requirements

None.

## 22. Audit log requirements

Unchanged. Existing catalog create/update/enable audit behavior remains.

## 23. Edge cases

1. User lands directly on `/catalogs/vehicle-brands`: brands tab should appear active.
2. User lands on `/catalogs`: default tab should be selected predictably (vehicle types).
3. Missing PAGE blueprint for one catalog: hub should degrade gracefully and not break other tabs.
4. Lack of permission for create/update: tab remains visible for read, actions continue to respect RBAC.
5. Browser refresh on a tab route should preserve the selected tab.

## 24. Risks

1. Risk: Hardcoding Fleet tab logic in renderer core.
   Mitigation: Implement tab grouping using generic route-prefix/page metadata patterns, not module-specific conditionals.
2. Risk: Route ambiguity for `/catalogs` base path.
   Mitigation: Add explicit hub PAGE or explicit fallback/redirect behavior in routing logic.
3. Risk: Duplicate navigation concepts between sidebar and hub tabs.
   Mitigation: Consolidate sidebar to a single `Catálogos` entry.

## 25. Acceptance criteria

1. Sidebar shows one `Catálogos` entry for Fleet.
2. Opening `Catálogos` shows tabs for all four catalogs.
3. `Tipos de vehículo` tab shows existing vehicle types CRUD.
4. `Marcas de vehículo` tab shows existing brands CRUD.
5. `Modelos de vehículo` tab shows existing models CRUD.
6. `Tipos de mantenimiento` tab shows existing maintenance types CRUD.
7. Direct routes to each catalog continue working.
8. Create/edit/detail flows keep working in each catalog.
9. `Número económico de grupo` remains visible in vehicle type form.
10. `relation.create` metadata remains intact after sync.
11. Desktop build passes.

## 26. Verification plan

Future implementation verification:

1. Static checks for modified files (`node --check` where applicable).
2. `pnpm.cmd --filter @atlas/desktop build:web`.
3. Authenticated `POST /modules/sync` (with `$ATLAS_TOKEN` placeholder only in documentation).
4. Runtime AtlasView checks:
   - catalog PAGE keys enabled
   - vehicle type form still includes `economic_group_number`
   - relation create metadata still present
5. Manual UI checks:
   - tab visibility and active-state by route
   - CRUD behavior per tab
   - direct route deep-linking

## 27. Rollback plan

1. Revert hub/tab route/navigation changes in Fleet manifest and UI shell files.
2. Restore previous sidebar entries.
3. Run module sync to republish previous metadata.
4. Validate direct catalog routes still work.

No DB rollback is required.

## 28. Future enhancements

1. Generic multi-catalog hub pattern reusable across modules beyond Fleet.
2. Optional tab badges/counters per catalog.
3. Optional saved last-active tab preference by user.

---

## Architecture options considered

### Option A: Module-local hub component

Pros:
1. Isolated module customization.
2. Minimal risk to global shell behavior.

Cons:
1. Requires custom UI wiring that may duplicate shell patterns.
2. Harder to standardize for other modules.

### Option B: Enhanced `BlueprintCrudScreen` with generic catalog-group tabs (Recommended)

Pros:
1. Reuses existing blueprint CRUD logic directly.
2. Avoids module-specific CRUD duplication.
3. Can be implemented generically by route prefix/page discovery.

Cons:
1. Requires careful generic design in shell route selection.

### Option C: Navigation-only approach (add more sidebar items)

Pros:
1. Smallest change.

Cons:
1. Does not satisfy desired single `Catálogos` hub UX.
2. Keeps sidebar clutter and discoverability fragmentation.

**Recommendation:** Option B (generic `BlueprintCrudScreen` enhancement) plus Fleet manifest cleanup to one catalog sidebar entry.
