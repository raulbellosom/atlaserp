# custom.fleet Detail UX & Relationship Cards

Date: 2026-05-16  
Status: Draft  
Mode: SPEC + PLAN ONLY

## 1. Feature title

custom.fleet Detail UX & Relationship Cards

## 2. Status

Draft

## 3. Context

`custom.fleet` now has stable CRUD blueprints, relational catalog data, catalog hub tabs, and DocumentsPanel metadata support. However, detail views still render many values as plain text rows, and relationship context is not presented in an ERP-quality way.

## 4. Problem

Fleet detail screens expose relationship fields with weak UX. In vehicle detail specifically, the assigned driver can appear as a raw UUID (`driver_id`) instead of a readable relation card with navigation. Driver detail does not surface assigned vehicles as a navigable related list. Maintenance detail mixes business-critical relationships and operational fields without card-level emphasis.

## 5. Goals

1. Replace raw relationship value rendering with metadata-driven relation cards/lists.
2. Keep implementation generic in renderer blocks, not hardcoded for Fleet.
3. Ensure vehicle, driver, and maintenance detail views become readable, linked, and ERP-oriented.
4. Preserve DocumentsPanel functionality and placement.
5. Align Fleet sidebar icon behavior with manifest intent.

## 6. Non-goals

1. No dashboard/report features.
2. No AME3 Phase 4/discovery architecture work.
3. No new OCR/AI/document classification features.
4. No full shell redesign.
5. No Prisma schema changes unless later approved by a separate migration spec.

## 7. User stories

1. As a fleet operator, I want to see assigned driver information on vehicle detail as a readable card, so I do not interpret UUIDs.
2. As a fleet supervisor, I want quick links from maintenance detail to vehicle and driver details, so I can navigate context fast.
3. As a dispatcher, I want driver detail to show assigned vehicles, so I can inspect workload and assignments.
4. As an admin, I want detail sections to keep DocumentsPanel visible and stable.

## 8. UX requirements

1. Vehicle detail groups core identity fields (matrícula, modelo, marca, tipo, año, número económico) with icons.
2. Vehicle assigned driver appears as `relation-card`, never as raw UUID text.
3. Driver detail includes profile card and related assigned vehicles list with links.
4. Maintenance detail includes vehicle and driver relation cards and readable maintenance type label.
5. Empty/missing relations display friendly Spanish states.
6. DocumentsPanel remains visible and functional on all three detail views.
7. UI copy remains Spanish UTF-8 with accents.

## 9. Routes/screens

1. `/app/m/custom.fleet/vehicles/:id` (Vehicle detail)
2. `/app/m/custom.fleet/drivers/:id` (Driver detail)
3. `/app/m/custom.fleet/maintenance/:id` (Maintenance detail)
4. Linked destinations remain existing CRUD routes:
   - `/app/m/custom.fleet/vehicles/:id`
   - `/app/m/custom.fleet/drivers/:id`

## 10. Data model

No new data model required for v1 UX.

Existing relevant entities:
1. `fleet_vehicle` (includes `driver_id`, `vehicle_model_id`, operational fields)
2. `fleet_driver`
3. `fleet_maintenance` (includes `vehicle_id`, `driver_id`, `maintenance_type_id`)
4. catalog entities: `fleet_vehicle_model`, `fleet_vehicle_type`, etc.

## 11. Prisma impact

None in this phase.

## 12. API contract

### Current API gaps identified

1. `GET /fleet/vehicles/:id` currently returns `driver_id` but not guaranteed `driver_name`/driver card fields.
2. Driver routes currently do not expose `GET /fleet/drivers/:id/vehicles` for assigned-vehicle cards.
3. `GET /fleet/maintenance/:id` includes `vehicle_plate` and `driver_full_name` but should standardize relation-card fields (`vehicle_id`, `vehicle_plate`, `driver_id`, `driver_full_name`, `maintenance_type_name`).

### Planned API enrichment (future implementation)

1. Enrich vehicle list/detail responses with:
   - `driver_name` (or `driver_full_name`)
   - optional `driver_phone`
   - optional `driver_license_number`
2. Add `GET /fleet/drivers/:id/vehicles` (company-scoped) returning assigned active vehicles.
3. Ensure maintenance list/detail include `maintenance_type_name` consistently.

## 13. SDK contract

Preferred: no immediate SDK expansion if Atlas renderer keeps direct blueprint-driven fetch behavior.

Optional ergonomic additions (later):
1. `atlas.fleet.drivers.listAssignedVehicles(driverId)`
2. `atlas.fleet.vehicles.getWithRelations(id)`

## 14. Validator contract

No new validators required for read-only enrichment endpoints unless a new query endpoint is added (`GET /fleet/drivers/:id/vehicles`), where optional list query schema may be introduced for pagination/search.

## 15. Module manifest impact

No manifest structure change required unless icon fallback audit results require normalized icon naming policy documentation.

## 16. Navigation impact

Navigation labels/paths remain unchanged.

Icon expectations:
1. Vehículos: `Truck`
2. Mantenimiento: `Wrench` or `ClipboardList`
3. Choferes: `UserCheck`
4. Catálogos: `BookOpen` or `Library`

## 17. Blueprint impact

### New metadata contracts to support

1. Field icon metadata:
```js
{ field: "plate", label: "Matrícula", icon: "Hash" }
```

2. Relation card section metadata:
```js
{
  id: "assigned_driver",
  type: "relation-card",
  label: "Conductor asignado",
  relationCard: {
    idField: "driver_id",
    titleField: "driver_name",
    subtitleFields: ["driver_license_number", "driver_phone"],
    fallbackTitle: "Conductor no asignado",
    hrefTemplate: "/app/m/custom.fleet/drivers/:id",
    icon: "UserCheck"
  }
}
```

3. Relation list section metadata:
```js
{
  id: "assigned_vehicles",
  type: "relation-list",
  label: "Vehículos asignados",
  relationList: {
    apiPath: "/fleet/drivers/:id/vehicles",
    titleField: "plate",
    subtitleFields: ["vehicle_model_name", "economic_number"],
    hrefTemplate: "/app/m/custom.fleet/vehicles/:id",
    icon: "Truck"
  }
}
```

4. Documents section remains supported and coexists in section array order.

## 18. RBAC/permissions

No new permission keys required for base phase if `relation-list` reads reuse existing read permissions:
1. `fleet.vehicles.read`
2. `fleet.drivers.read`
3. `fleet.maintenance.read`

If `GET /fleet/drivers/:id/vehicles` is added, guard with `fleet.drivers.read` (and optionally enforce `fleet.vehicles.read` for cross-entity exposure).

## 19. Multi-company behavior

All new relation enrichments and assigned-vehicle lists must remain company-scoped exactly like existing fleet services.

## 20. Files/storage impact

None beyond existing DocumentsPanel behavior.

## 21. Export/import requirements

None.

## 22. Audit log requirements

No new audit actions required for read-only relation rendering/enrichment.

## 23. Edge cases

1. Missing driver assignment (`driver_id = null`) should show friendly empty card state.
2. Stale foreign key where relation row is disabled/missing should show fallback text, not crash.
3. Relation list endpoint returns empty array.
4. Detail view loaded with partial payload missing enriched fields.
5. Broken `hrefTemplate` token should degrade to non-clickable card with warning-safe fallback.
6. DocumentsPanel errors must remain isolated from relation-card sections.

## 24. Risks

1. Renderer scope creep risk.
   - Mitigation: implement only metadata-driven `relation-card` and `relation-list` blocks.
2. API contract drift across list/detail endpoints.
   - Mitigation: define explicit enrichment fields and align in spec + verification.
3. Icon mismatch risk.
   - Mitigation: audit icon resolver and add missing Lucide names/fallback policy.
4. Over-fetch risk in driver assigned vehicles.
   - Mitigation: lightweight fields only (`id`, `plate`, `vehicle_model_name`, `economic_number`, `status`).

## 25. Acceptance criteria

1. Vehicle detail no longer shows driver UUID as the visible relationship value.
2. Vehicle detail renders assigned driver relation card with link to `/app/m/custom.fleet/drivers/:id`.
3. Driver detail renders assigned vehicles relation list/cards with links to vehicle details.
4. Maintenance detail renders vehicle and driver relation cards with links.
5. Maintenance type displays a readable label (`maintenance_type_name`), not only raw id.
6. Field icons render where metadata config provides icon names.
7. Missing relations show friendly Spanish empty states.
8. DocumentsPanel remains functional and visible in detail views.
9. Sidebar shows intended icons for Fleet nav entries (no Box fallback for supported icons).
10. No Fleet hardcoding is introduced in generic renderer beyond metadata-driven section types.
11. Desktop build passes.
12. Runtime/browser checks pass for all three detail screens.

## 26. Verification plan

1. Static checks for modified renderer/blueprint/api files (`node --check` where applicable).
2. Desktop build: `pnpm.cmd --filter @atlas/desktop build:web`.
3. Runtime metadata sync: tokenless local service sync or authenticated `/modules/sync`.
4. DB/runtime validation for three detail `AtlasView` schemas containing new section metadata.
5. API smoke:
   - `GET /fleet/vehicles/:id` includes enriched driver fields.
   - `GET /fleet/drivers/:id/vehicles` (if added) returns assigned vehicles.
   - `GET /fleet/maintenance/:id` includes enriched relation fields.
6. Browser manual:
   - Vehicle/driver/maintenance detail cards render and link correctly.
   - DocumentsPanel still loads.
   - Missing states and errors are Spanish and non-crashing.

## 27. Rollback plan

1. Revert detail blueprint metadata updates and renderer section-type additions.
2. Revert API enrichment endpoint/query additions if shipped.
3. Re-sync module metadata to restore previous runtime schemas.
4. No DB rollback needed unless a future approved migration is introduced.

## 28. Future enhancements

1. Shared generic `RelationCard` UI primitive for all modules.
2. Avatar/photo support for driver relation cards.
3. Quick actions from relation cards (call/message/open map).
4. Relation-card permission-aware action menus.
5. Reusable icon registry validation for blueprint metadata.

---

## Sidebar icon mapping audit note

Current code review indicates Fleet manifest icon names include `Truck`, `Wrench`, `UserCheck`, `BookOpen`, but `ModuleSidebar` icon map currently includes `BookOpen` and does not include all Fleet icon names. This can cause fallback to `Box` for some nav entries. Future implementation must include a targeted fix in icon resolver mapping.
