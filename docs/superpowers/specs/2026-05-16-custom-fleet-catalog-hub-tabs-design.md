# custom.fleet Catalog Hub Tabs

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY

## 1. Feature title

custom.fleet Catalog Hub Tabs

## 2. Status

Draft

## 3. Context

`custom.fleet` already provides CRUD blueprints and routes for four catalogs:

1. Tipos de vehículo
2. Marcas de vehículo
3. Modelos de vehículo
4. Tipos de mantenimiento

The runtime module metadata is now synced and relation inline create metadata is expected to be available. The remaining issue is discoverability and navigation consistency.

## 4. Problem

Fleet sidebar/navigation is currently inconsistent for catalogs:

1. `Catálogos` points to `/app/m/custom.fleet/catalogs/vehicle-types`.
2. `Modelos de vehículo` exists as a separate sidebar item.
3. Vehicle brands and maintenance types are reachable by URL but not discoverable from primary navigation.
4. The current UX suggests there is no unified catalog management area.

## 5. Goals

1. Provide one clear sidebar entry: `Catálogos`.
2. Turn `Catálogos` into a hub with tabs/segmented navigation for all four catalog domains.
3. Reuse existing PAGE/TABLE/FORM blueprints and existing CRUD flow.
4. Keep direct deep-link routes functional.
5. Avoid backend, DB, and Prisma changes.

## 6. Non-goals

1. No Prisma schema or migration changes.
2. No API endpoint changes.
3. No new module outside `custom.fleet`.
4. No DocumentsPanel, dashboards, reports, or AME3 Phase 4 work.
5. No rewrite of generic CRUD rendering behavior.

## 7. User stories

1. As a Fleet operator, I want one Catalogs area where all catalog domains are visible, so I can manage reference data quickly.
2. As a Fleet admin, I want consistent navigation that matches available routes, so onboarding and support are easier.
3. As an existing user, I want direct links to each catalog route to continue working.

## 8. UX requirements

1. Sidebar must show one Fleet item for catalogs: `Catálogos`.
2. Entering `Catálogos` must present tabs/segmented controls:
   - `Tipos de vehículo`
   - `Marcas de vehículo`
   - `Modelos de vehículo`
   - `Tipos de mantenimiento`
3. Active tab must be route-driven.
4. Clicking a tab must navigate to the corresponding route.
5. Refresh on a deep route must preserve active tab.
6. UI copy remains Spanish UTF-8 with accents.

## 9. Routes/screens

Target routes:

1. `/app/m/custom.fleet/catalogs` (hub base route)
2. `/app/m/custom.fleet/catalogs/vehicle-types`
3. `/app/m/custom.fleet/catalogs/vehicle-brands`
4. `/app/m/custom.fleet/catalogs/vehicle-models`
5. `/app/m/custom.fleet/catalogs/maintenance-types`

Base route behavior:

1. Preferred: resolve hub base to default catalog route (`vehicle-types`) with replace navigation.
2. Hub tabs remain visible for all catalog subroutes.

## 10. Data model

N/A (no entity or schema changes).

## 11. Prisma impact

None.

## 12. API contract

None.

## 13. SDK contract

None.

## 14. Validator contract

None.

## 15. Module manifest impact

`modules/custom/custom.fleet/module.manifest.js` navigation changes:

1. Keep one catalog sidebar entry:
   - label: `Catálogos`
   - path: `/app/m/custom.fleet/catalogs`
   - permissionKey: `fleet.catalogs.read`
2. Remove redundant `Modelos de vehículo` sidebar entry.

All catalog view/page registrations remain unchanged.

## 16. Navigation impact

1. Sidebar is simplified to one catalog entry.
2. Catalog discoverability moves into the hub tab layer.
3. Existing direct route entry points remain valid.

## 17. Blueprint impact

Existing PAGE blueprints are reused:

1. `fleet.catalog.vehicle_types.page`
2. `fleet.catalog.vehicle_brands.page`
3. `fleet.catalog.vehicle_models.page`
4. `fleet.catalog.maintenance_types.page`

Optional metadata enhancement (if needed for generic grouping):

1. `schema.group = "catalogs"`
2. `schema.groupLabel = "Catálogos"`
3. `schema.tabLabel = "<Spanish tab label>"`
4. `schema.tabOrder = <number>`

## 18. RBAC/permissions

No new permission keys.

1. Hub entry uses `fleet.catalogs.read`.
2. Existing CRUD permissions (`fleet.catalogs.create/update/delete`) remain unchanged.

## 19. Multi-company behavior

Unchanged; all existing company-scoped catalog APIs and blueprint flows remain as-is.

## 20. Files/storage impact

None.

## 21. Export/import requirements

None.

## 22. Audit log requirements

Unchanged; no new audit events required for navigation-only improvements.

## 23. Edge cases

1. User opens `/catalogs` directly: default to `vehicle-types` route while preserving hub context.
2. User opens deep route (`/catalogs/vehicle-brands`): correct tab must be active.
3. Unknown subroute under `/catalogs/*`: keep current not-found behavior.
4. Missing permission to create/update/delete: tab still visible for read-only access.
5. Existing links/bookmarks to catalog routes remain valid.

## 24. Risks

1. Risk: Route grouping logic could become Fleet-specific.
   Mitigation: Use generic route-prefix/page metadata grouping logic in shell.
2. Risk: Duplicate rendering logic for CRUD.
   Mitigation: Keep `BlueprintCrudScreen` + `AtlasCrudView` as the only CRUD path.
3. Risk: Base route `/catalogs` may not resolve cleanly.
   Mitigation: Explicit default route handling and replace navigation.

## 25. Acceptance criteria

1. Sidebar shows one `Catálogos` Fleet entry.
2. Separate sidebar entry `Modelos de vehículo` is removed.
3. Opening `Catálogos` shows tabs for all four catalogs.
4. `Tipos de vehículo` tab renders existing vehicle types CRUD.
5. `Marcas de vehículo` tab renders existing brands CRUD.
6. `Modelos de vehículo` tab renders existing models CRUD.
7. `Tipos de mantenimiento` tab renders existing maintenance types CRUD.
8. Direct routes remain functional.
9. Create/edit/detail flows remain functional for each catalog.
10. `Número económico de grupo` remains visible in vehicle type form.
11. Relation inline-create metadata remains intact after module sync.
12. Desktop build passes.

## 26. Verification plan

Future implementation verification:

1. `node --check modules/custom/custom.fleet/module.manifest.js`
2. `node --check apps/desktop/src/shell/BlueprintCrudScreen.jsx` (or note `.jsx` runtime limitation)
3. `pnpm.cmd --filter @atlas/desktop build:web`
4. Authenticated `POST /modules/sync` using `$ATLAS_TOKEN` placeholder only.
5. Runtime metadata checks:
   - Catalog PAGEs enabled
   - `economic_group_number` in vehicle types form schema
   - `relation.create` metadata still present
6. Manual/browser checks for tab UX and CRUD behavior.

## 27. Rollback plan

1. Revert manifest navigation changes to previous paths/entries.
2. Revert hub/tab logic changes in desktop shell.
3. Run module sync to restore previous runtime navigation metadata.
4. Rebuild desktop app and validate legacy routes still work.

## 28. Future enhancements

1. Generic grouped-tab hub support reusable across modules beyond Fleet.
2. Optional tab counters/status badges.
3. Optional persisted “last selected catalog tab” per user.

---

## Implementation approach options

### Option A: Module-local hub component

Pros:
1. Module isolation.
2. Minimal impact on generic shell.

Cons:
1. Extra module-specific UI surface.
2. Harder to reuse and maintain consistency.

### Option B: Enhanced BlueprintCrudScreen grouped-route tabs (Recommended)

Pros:
1. Reuses existing generic CRUD path.
2. No CRUD duplication.
3. Can be implemented with route-prefix/page metadata discovery.

Cons:
1. Needs careful generic grouping logic.

### Option C: Navigation-only (add more sidebar entries)

Pros:
1. Smallest code change.

Cons:
1. Fails desired UX of single `Catálogos` hub.
2. Keeps navigation clutter and weak discoverability.

Recommendation: **Option B** with manifest cleanup to one catalog sidebar entry.
