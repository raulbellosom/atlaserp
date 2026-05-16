# custom.fleet Vehicle Catalog Relational Redesign

Date: 2026-05-16
Status: Draft
Author: Claude Code (claude-sonnet-4-6)
Spec file: docs/superpowers/specs/2026-05-16-custom-fleet-vehicle-catalog-relational-redesign-design.md
Plan file: docs/superpowers/plans/2026-05-16-custom-fleet-vehicle-catalog-relational-redesign.md

---

## 1. Feature title

custom.fleet Vehicle Catalog Relational Redesign

---

## 2. Status

Draft

---

## 3. Context

The `custom.fleet` module reached operational status with vehicles, drivers, maintenance records, three catalog tables (vehicle types, vehicle brands, maintenance types), and blueprint relation selectors as of 2026-05-16. Vehicle CRUD works end-to-end through `BlueprintCrudScreen` and `AtlasForm`.

However, the vehicle data model stores brand, model name, and year as denormalized free-text columns on `fleet_vehicle`. Vehicle type and vehicle brand exist as catalogs but are not structurally tied to a vehicle model concept. The economic group number lives on the vehicle record itself rather than on the vehicle type that determines it.

This creates several operational problems: a single Toyota Hilux 2024 must be entered as "Toyota" + "Hilux" + "2024" per vehicle record, producing drift across the fleet (typos, inconsistent casing, mismatched years). Economic group numbers are manually repeated per vehicle even though they are a property of the vehicle type. There is no way for managers to define the canonical model catalog once and reuse it across many vehicle records.

The redesign introduces a `fleet_vehicle_model` entity that belongs to a brand and a type and carries the model name and year. Vehicles reference a model instead of storing raw brand/model/year fields. Vehicle type gains an `economic_group_number` field as the authoritative source. The full economic number is computed at query time from `vehicle_type.economic_group_number + '-' + vehicle.economic_individual_number`.

---

## 4. Problem

1. `fleet_vehicle` stores `brand`, `model_name`, and `year` as free-text columns. These fields drift across records (inconsistent casing, typos, missing data) and offer no enforcement of a controlled model catalog.

2. `economic_group_number` is stored on `fleet_vehicle` as a per-record field. In practice it is a property of the vehicle type (all vehicles of the same type share the same group number). Storing it on the vehicle forces repetitive manual entry and produces inconsistency when the group number must change.

3. `fleet_vehicle` stores `vehicle_type_id` and `vehicle_brand_id` as independent foreign keys without a model layer in between. This means a "Toyota Hilux 2024" is not a first-class entity — it is reconstructed ad hoc by joining separate fields that can contradict each other.

4. There is no `fleet_vehicle_model` catalog. Fleet administrators cannot define the set of vehicle models recognized by the company, and fleet operators cannot select from a controlled list when registering a new vehicle.

5. The vehicle form asks for brand, model name, year, vehicle type, and vehicle brand as five independent fields. The form is unnecessarily complex and allows semantically inconsistent combinations (e.g., a vehicle type of "Camioneta" combined with a brand of "Honda" and a model of "Civic").

---

## 5. Goals

1. Introduce a `fleet_vehicle_model` catalog entity owned by `custom.fleet`. A model belongs to exactly one vehicle brand and one vehicle type, and stores a model name and model year.

2. Add `economic_group_number` to `fleet_vehicle_type` as the canonical source of economic group numbers. The vehicle type is the authority for what group number a category of vehicles carries.

3. Add `vehicle_model_id` to `fleet_vehicle` as the preferred foreign key for model resolution. A vehicle references one model, which in turn provides brand, type, and year.

4. The full economic number is computed as `vehicle_type.economic_group_number || '-' || vehicle.economic_individual_number` in API responses. The separator is the dash character (`-`). The vehicle table and detail views display this computed value as `economic_number`.

5. The vehicle form replaces the five separate brand/model/year/type/brand fields with a single model selector (`vehicle_model_id`). The form still captures `plate`, `color`, `status`, `driver_id`, `economic_individual_number`, and `notes`.

6. New catalog CRUD screens and API endpoints let fleet administrators manage the vehicle model catalog.

7. Legacy columns (`brand`, `model_name`, `year`, `vehicle_type_id`, `vehicle_brand_id`, `economic_group_number` on vehicle) are preserved for existing data. The new API responses enrich records with resolved labels. No columns are dropped in this spec.

8. Existing vehicle records remain readable without data loss. A backfill strategy creates `fleet_vehicle_model` rows from existing vehicle data and populates `vehicle_model_id` where the data is unambiguous.

---

## 6. Non-goals

1. Removing legacy columns (`brand`, `model_name`, `year`, `vehicle_type_id`, `vehicle_brand_id`, `economic_group_number`) from `fleet_vehicle`. Column cleanup is deferred to a future deprecation spec.
2. Inline create from relation selectors ("Crear nuevo" in the combobox dropdown). This is deferred to the Blueprint Relation Inline Create spec.
3. DocumentsPanel for vehicle models.
4. Dashboards, analytics, or fleet reports.
5. AME3 Phase 4 (discovery as primary source, official module migration).
6. Prisma schema or Prisma migration changes.
7. Fuel tracking, GPS, insurance, or spare-parts management.
8. Mobile or driver-facing interfaces.
9. Configurable economic number separator (default `-` is sufficient for this version).
10. Multi-model assignment (a vehicle has exactly one model at a time).

---

## 7. User stories

1. As a fleet administrator, I want to define a vehicle model catalog (brand + type + name + year) so that operators select from a controlled list instead of typing free text.
2. As a fleet administrator, I want to set the economic group number on a vehicle type so that the number is consistent across all vehicles of that type without per-vehicle entry.
3. As a fleet operator, I want to register a new vehicle by selecting a model and entering the plate, individual economic number, color, status, and driver so that the form is simpler and less error-prone.
4. As a fleet supervisor, I want to see the full computed economic number (e.g., "02-015") in the vehicle list and detail views so that I can identify vehicles using their operational code.
5. As a fleet operator, I want to browse, create, and update vehicle model records from within the Fleet module catalogs so that the model catalog stays current as new vehicle models are acquired.
6. As an existing Atlas ERP user, I want my existing vehicle records to remain accessible and readable after the relational redesign without any manual migration step on my part.

---

## 8. UX requirements

1. All visible labels must be in Spanish with correct UTF-8 accents.
2. The vehicle form must present a single "Modelo de vehículo" relation selector for `vehicle_model_id`. The selector's option labels display as `{brand_name} {model_name} ({year})`, e.g., "Toyota Hilux (2024)".
3. After selecting a model, the form may display read-only derived chips showing "Tipo: {type_name}" and "Marca: {brand_name}" so the operator can confirm the selection. This is display-only; no separate inputs for those fields.
4. The vehicle type form must include an "Número económico de grupo" text field (`economic_group_number`) accepting 1–4 numeric digits.
5. Vehicle model catalog list columns: Marca, Tipo, Nombre, Año, Estado.
6. Vehicle model form sections:
   - "Información del modelo": Marca (relation), Tipo de vehículo (relation), Nombre del modelo (text), Año (number).
7. Vehicle table must display "No. Económico" column showing the computed `economic_number` value.
8. Vehicle detail must display "No. Económico" derived from `vehicle_type.economic_group_number || '-' || vehicle.economic_individual_number`.
9. Relation comboboxes follow the `preload: true`, search-debounced pattern established by the Blueprint Relation Fields spec (2026-05-16).
10. Empty states and error states follow the existing `BlueprintCrudScreen` / `AtlasCrudView` conventions. No custom React screens.
11. No emojis anywhere in UI copy.

---

## 9. Routes/screens

All routes use the existing `BlueprintCrudScreen` shell. No new React screen files are needed.

| Route | Key | Blueprint views |
|---|---|---|
| `/app/m/custom.fleet/vehicles` | `custom.fleet` | `fleet.vehicle.table`, `fleet.vehicle.form`, `fleet.vehicle.detail` |
| `/app/m/custom.fleet/catalogs/vehicle-models` | `custom.fleet` | `fleet.catalog.vehicle_models.table`, `fleet.catalog.vehicle_models.form`, `fleet.catalog.vehicle_models.page` |
| `/app/m/custom.fleet/catalogs/vehicle-types` | `custom.fleet` | `fleet.catalog.vehicle_types.table`, `fleet.catalog.vehicle_types.form`, `fleet.catalog.vehicle_types.page` (existing, updated) |

Navigation item for vehicle models is added under the existing "Catálogos" group. Implementation may add a secondary catalog navigation entry "Modelos de vehículo" or extend the existing catalog page. The exact navigation expansion is determined in the plan.

---

## 10. Data model

### 10.1 New entity: fleet_vehicle_model

Table: `fleet_vehicle_model`
Owned by: `custom.fleet`
Atlas ORM key: `fleet.vehicle_model`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK, default gen_random_uuid() | |
| `company_id` | UUID | NOT NULL, FK company | Company scope |
| `brand_id` | UUID | NOT NULL, FK fleet_vehicle_brand.id | |
| `type_id` | UUID | NOT NULL, FK fleet_vehicle_type.id | |
| `name` | TEXT | NOT NULL, max 150 | Model name e.g. "Hilux" |
| `year` | INTEGER | NOT NULL, 1900–2100 | Model year |
| `enabled` | BOOLEAN | NOT NULL, default true | Soft delete |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `created_by_id` | UUID | nullable | Actor audit |
| `updated_by_id` | UUID | nullable | Actor audit |

Indexes:
- `(company_id, brand_id)` — filter by brand
- `(company_id, type_id)` — filter by type
- `(company_id, enabled)` — active filter
- `(company_id, brand_id, type_id, name, year)` UNIQUE — prevents duplicate model definitions per company

### 10.2 Modification: fleet_vehicle_type

Add column: `economic_group_number TEXT NULL`

Constraints: max 4 characters, numeric digits only (enforced at API/validator level, not DB constraint, for backward compatibility).

This column is the canonical source for the economic group prefix. It is `NULL` for types that do not use economic numbering. The vehicle API derives `economic_number` only when both `vehicle_type.economic_group_number` and `vehicle.economic_individual_number` are non-null.

### 10.3 Modification: fleet_vehicle

Add column: `vehicle_model_id UUID NULL REFERENCES fleet_vehicle_model(id) ON DELETE SET NULL`

Index: `(company_id, vehicle_model_id)` — supports join-based filtering.

Legacy columns preserved (not dropped): `brand`, `model_name`, `year`, `vehicle_type_id`, `vehicle_brand_id`, `economic_group_number`.

API read responses enrich with:
- `vehicle_model_name` — `fleet_vehicle_model.name`
- `vehicle_model_year` — `fleet_vehicle_model.year`
- `vehicle_brand_name` — resolved from model's brand (preferred) or legacy `fleet_vehicle_brand` join
- `vehicle_type_name` — resolved from model's type (preferred) or legacy `fleet_vehicle_type` join
- `economic_group_number` — from model's type (preferred) or legacy vehicle field
- `economic_number` — `vehicle_type.economic_group_number || '-' || vehicle.economic_individual_number` when both are non-null; otherwise null

### 10.4 Model definition files

Three model JS files must be created or updated:

- **New**: `models/vehicle-model.model.js` — `defineModel` for `fleet_vehicle_model`
- **Update**: `models/vehicle-type.model.js` — add `economic_group_number` field
- **Update**: `models/vehicle.model.js` — add `vehicle_model_id` relation field; mark legacy fields as deprecated in comments

---

## 11. Prisma impact

None. This feature uses Atlas ORM exclusively. No edits to `prisma/schema.prisma`. No Prisma migrations.

All table changes are applied via module-local SQL migration files in `modules/custom/custom.fleet/migrations/`, using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for additive changes and `CREATE TABLE IF NOT EXISTS` for the new vehicle model table.

---

## 12. API contract

### 12.1 Vehicle model catalog endpoints

All catalog endpoints are mounted by `catalogs-routes.js` and delegated to `catalog-service.js`.

**GET /fleet/catalogs/vehicle-models**
- Auth: required
- Permission: `fleet.catalogs.read`
- Query params: `page` (int, default 1), `pageSize` (int, default 20, max 100), `search` (string, optional), `brand_id` (UUID, optional), `type_id` (UUID, optional), `sortBy` (string, optional), `sortDir` (`asc|desc`, optional)
- Response:
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "company_id": "uuid",
        "brand_id": "uuid",
        "brand_name": "Toyota",
        "type_id": "uuid",
        "type_name": "Camioneta",
        "name": "Hilux",
        "year": 2024,
        "enabled": true,
        "created_at": "ISO",
        "updated_at": "ISO"
      }
    ],
    "total": 12,
    "page": 1,
    "pageSize": 20
  }
  ```
- Errors: 401, 403, 500

**POST /fleet/catalogs/vehicle-models**
- Auth: required
- Permission: `fleet.catalogs.create`
- Body: `{ brand_id: UUID, type_id: UUID, name: string (1–150), year: integer (1900–2100) }`
- Response: 201, created record with enriched labels
- Errors: 400 (validation), 401, 403, 409 (duplicate), 500

**PATCH /fleet/catalogs/vehicle-models/:id**
- Auth: required
- Permission: `fleet.catalogs.update`
- Body: `{ brand_id?: UUID, type_id?: UUID, name?: string, year?: integer }`
- Response: 200, updated record with enriched labels
- Errors: 400, 401, 403, 404, 409, 500

**PATCH /fleet/catalogs/vehicle-models/:id/enabled**
- Auth: required
- Permission: `fleet.catalogs.delete`
- Body: `{ enabled: boolean }`
- Response: 200, `{ id, enabled }`
- Errors: 400, 401, 403, 404, 500

### 12.2 Vehicle type endpoint changes

**GET /fleet/catalogs/vehicle-types** — response now includes `economic_group_number` field.

**POST /fleet/catalogs/vehicle-types** — body now accepts optional `economic_group_number` (1–4 numeric chars or null).

**PATCH /fleet/catalogs/vehicle-types/:id** — body now accepts optional `economic_group_number`.

### 12.3 Vehicle endpoint changes

**GET /fleet/vehicles** — response enriches each record with:
- `vehicle_model_id`, `vehicle_model_name`, `vehicle_model_year`
- `vehicle_brand_name` (from model or legacy join)
- `vehicle_type_name` (from model or legacy join)
- `economic_group_number` (from type via model or legacy field)
- `economic_number` (computed; null if either part is absent)

**GET /fleet/vehicles/:id** — same enrichment as list.

**POST /fleet/vehicles** — accepts optional `vehicle_model_id` (UUID). Legacy fields `brand`, `model_name`, `year`, `vehicle_type_id`, `vehicle_brand_id`, `economic_group_number` remain accepted for backward compatibility.

**PATCH /fleet/vehicles/:id** — accepts optional `vehicle_model_id`. Legacy fields remain accepted.

---

## 13. SDK contract

No new SDK domain methods are required for this feature. The existing `atlas.blueprints.list(token)` and the blueprint renderer handle the new views through the same path as existing catalog screens.

If the Atlas SDK is later expanded to expose a `fleet` domain with dedicated methods, that will be specified separately. N/A for this spec.

---

## 14. Validator contract

All validators live in `modules/custom/custom.fleet/validators/index.js`. No edits to `packages/validators`.

New schemas:

```js
createVehicleModelSchema = z.object({
  brand_id: z.string().uuid(),
  type_id: z.string().uuid(),
  name: z.string().min(1).max(150),
  year: z.number().int().min(1900).max(2100),
})

updateVehicleModelSchema = z.object({
  brand_id: z.string().uuid().optional(),
  type_id: z.string().uuid().optional(),
  name: z.string().min(1).max(150).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
})
```

Modified schemas:

```js
createVehicleTypeSchema — add:
  economic_group_number: z.string().regex(/^[0-9]{1,4}$/).nullable().optional()

updateVehicleTypeSchema — add same field.

createVehicleSchema — add:
  vehicle_model_id: z.string().uuid().nullable().optional()

updateVehicleSchema — add same field.
```

---

## 15. Module manifest impact

Module key: `custom.fleet` (existing, no new manifest file).
Manifest file: `modules/custom/custom.fleet/module.manifest.js` (existing, to be updated).

Changes required:
1. Add `"./models/vehicle-model.model.js"` to `models` array.
2. Add three new view refs to `views` array:
   - `"./views/catalog.vehicle-models.table.js"`
   - `"./views/catalog.vehicle-models.form.js"`
   - `"./views/catalog.vehicle-models.page.js"`
3. Add `"fleet.vehicle_model"` to `lifecycle.ownedModels`.
4. Add `"fleet_vehicle_model"` to `lifecycle.ownedTables`.
5. No new permissions are required. Vehicle model CRUD is gated by the existing `fleet.catalogs.*` permission set.
6. Add `VehicleModel` to `acl.models` with read/create/update/delete mapping to `fleet.catalogs.*`.

No changes to `packages/maps`, `packages/validators`, or `packages/sdk`.

---

## 16. Navigation impact

The existing "Catálogos" navigation item points to `/app/m/custom.fleet/catalogs/vehicle-types`. A secondary catalog navigation entry is added for vehicle models.

New navigation entry:
```js
{
  label: 'Modelos de vehículo',
  path: '/app/m/custom.fleet/catalogs/vehicle-models',
  icon: 'Layers',
  layout: 'main',
  permissionKey: 'fleet.catalogs.read',
}
```

This gives operators a dedicated route to the vehicle model catalog. The icon `Layers` (from Lucide) visually suggests a grouped/layered catalog.

---

## 17. Blueprint impact

### New blueprint views

**fleet.catalog.vehicle_models.table** (TABLE)
- `apiPath: '/fleet/catalogs/vehicle-models'`
- Columns: Marca (brand_name), Tipo (type_name), Nombre (name), Año (year), Estado (enabled badge)
- Actions: "Agregar modelo"
- Row actions: Ver, Editar, Desactivar

**fleet.catalog.vehicle_models.form** (FORM)
- `apiPath: '/fleet/catalogs/vehicle-models'`
- Section "Información del modelo":
  - `brand_id` — relation → `/fleet/catalogs/vehicle-brands`, labelField: name
  - `type_id` — relation → `/fleet/catalogs/vehicle-types`, labelField: name
  - `name` — text, required
  - `year` — number, required

**fleet.catalog.vehicle_models.page** (PAGE)
- Wires table + form + detail views

### Updated blueprint views

**fleet.catalog.vehicle_types.form** — add `economic_group_number` text field to the form section.

**fleet.vehicle.form** — replace the five separate fields (`brand`, `model_name`, `year`, `vehicle_type_id`, `vehicle_brand_id`) with a single relation field:
- `vehicle_model_id` — relation → `/fleet/catalogs/vehicle-models`, labelField: `['brand_name', 'name', 'year']`, labelSeparator: ' '

Retain: `plate`, `color`, `status`, `economic_individual_number`, `driver_id`, `notes`.

**fleet.vehicle.table** — update columns to show `vehicle_model_name`, `vehicle_type_name`, `vehicle_brand_name`, `economic_number`. Remove raw `brand`, `model_name`, `year` columns.

**fleet.vehicle.detail** — update to show model-derived fields: `vehicle_model_name`, `vehicle_model_year`, `vehicle_brand_name`, `vehicle_type_name`, `economic_number`.

---

## 18. RBAC/permissions

No new permission keys. The existing `fleet.catalogs.*` permission set covers vehicle model CRUD:

| Permission key | Guards |
|---|---|
| `fleet.catalogs.read` | `GET /fleet/catalogs/vehicle-models` |
| `fleet.catalogs.create` | `POST /fleet/catalogs/vehicle-models` |
| `fleet.catalogs.update` | `PATCH /fleet/catalogs/vehicle-models/:id` |
| `fleet.catalogs.delete` | `PATCH /fleet/catalogs/vehicle-models/:id/enabled` |
| `fleet.catalogs.read` | Navigation item "Modelos de vehículo" |

Vehicle type `economic_group_number` field is writable via the existing `fleet.catalogs.update` permission, read via `fleet.catalogs.read`.

Vehicle `vehicle_model_id` field is writable via the existing `fleet.vehicles.update` / `fleet.vehicles.create` permissions.

---

## 19. Multi-company behavior

All entities are company-scoped. Every `fleet_vehicle_model`, `fleet_vehicle_type`, `fleet_vehicle_brand`, and `fleet_vehicle` row carries a `company_id` column. All service queries filter by `company_id` derived from the authenticated user's membership context. No cross-company data leakage is possible through the service layer.

The unique constraint `(company_id, brand_id, type_id, name, year)` on `fleet_vehicle_model` is scoped per company, so two companies may define identically named models without conflict.

---

## 20. Files/storage impact

N/A. This spec introduces no file uploads or Supabase Storage references. Vehicle model records are metadata only.

---

## 21. Export/import requirements

N/A. No export or bulk import is specified for vehicle models in this version. This is explicitly deferred.

---

## 22. Audit log requirements

No `AuditLog` entries are required for vehicle model CRUD in this version. The existing `created_by_id` / `updated_by_id` columns on `fleet_vehicle_model` provide actor tracking at the row level. Full audit log integration (matching the `fleet.vehicles.create` → `AuditLog` pattern) is deferred.

---

## 23. Edge cases

1. **Vehicle with no model**: `vehicle_model_id` is NULL. The vehicle remains readable. `economic_number` is null or falls back to the legacy computation if `vehicle_type_id` and `economic_group_number` on vehicle are set.

2. **Model disabled after vehicle assignment**: A vehicle may reference a `fleet_vehicle_model` where `enabled = false`. The vehicle remains valid; the model combobox shows a "Registro no disponible" fallback label for the selected ID. Fleet administrators must re-assign the vehicle to an active model.

3. **Vehicle type with no economic group number**: `economic_group_number` is null. `economic_number` for vehicles of that type is null. The column displays blank, not an error.

4. **Duplicate vehicle model**: The unique constraint `(company_id, brand_id, type_id, name, year)` prevents duplicate definitions. The API returns HTTP 409 with a descriptive error.

5. **Backfill ambiguity**: Multiple brand + type combinations for the same model name + year. The backfill strategy creates distinct `fleet_vehicle_model` records per unique combination and assigns each vehicle to its matching model.

6. **Year outside valid range**: Year values on legacy vehicle records may be 0 or very old (pre-1900). The validator clamps accepted range to 1900–2100 for new records. Legacy records outside this range are preserved as-is and are not migrated until manually corrected.

7. **Brand or type deleted after model reference**: `fleet_vehicle_model.brand_id` and `fleet_vehicle_model.type_id` use `ON DELETE RESTRICT` in the SQL schema. Disabling a brand or type (soft delete via `enabled = false`) does not violate the FK; only hard deletes would, and hard deletes are not supported in this module.

8. **economic_group_number format on type**: Operators may enter non-numeric or longer values. The validator enforces 1–4 numeric digits at the API boundary. Existing rows without a value default to NULL, not empty string.

---

## 24. Risks

1. **Risk**: The `catalog-service.js` and `catalogs-routes.js` files may approach the 1000-line limit after vehicle model endpoints are added.
   **Mitigation**: Measure current line counts before implementation. If either file exceeds 800 lines after the additions, split vehicle model logic into `vehicle-model-service.js` and `vehicle-model-routes.js`. The file structure map in the plan must make this decision explicit.

2. **Risk**: The vehicle form blueprint change (replacing 5 fields with 1 model selector) breaks the existing UI flow for operators who are accustomed to entering brand/model/year separately.
   **Mitigation**: The legacy fields remain in the DB and are still accepted by the API. The UI change is in the blueprint view only. Operators who have bookmarked or scripted the old form fields will need to update their workflow.

3. **Risk**: Backfill creates duplicate `fleet_vehicle_model` rows if two existing vehicles have the same brand+type+name+year combination from different sources.
   **Mitigation**: The backfill script uses `ON CONFLICT DO NOTHING` and a deterministic SELECT to find the existing model ID. Duplicate rows are avoided.

4. **Risk**: The `economic_number` computation requires a JOIN through `fleet_vehicle_model` → `fleet_vehicle_type`. Vehicles without `vehicle_model_id` must fall back to a direct join on `vehicle_type_id`. The service layer must implement both paths.
   **Mitigation**: Plan clearly specifies the JOIN fallback logic. The vehicle list query builds `economic_number` using a CASE expression or two-step enrichment in the service.

5. **Risk**: Module sync (`POST /modules/sync`) imports the updated model and view files. The new `fleet_vehicle_model` model's `CREATE TABLE IF NOT EXISTS` runs on sync and may fail if the DB user lacks DDL permissions.
   **Mitigation**: The Atlas ORM provisioning has been tested in prior phases (Phases 1–6 of operational expansion). The same pattern applies here. The module migration SQL files are used for ALTER TABLE changes.

6. **Risk**: The vehicle model relation combobox in the vehicle form must load options that include enriched labels (`brand_name + model_name + year`). The API endpoint must return these enriched fields in the list response so the combobox can construct `{brand_name} {name} ({year})` labels.
   **Mitigation**: The `GET /fleet/catalogs/vehicle-models` response includes `brand_name`, `name`, and `year`. The blueprint `labelField` uses an array `['brand_name', 'name', 'year']`. The `normalizeRelationDescriptor` implementation already supports array labelField.

---

## 25. Acceptance criteria

1. Given a fleet administrator with `fleet.catalogs.create` permission, when they POST to `/fleet/catalogs/vehicle-models` with `{ brand_id, type_id, name, year }`, then the API returns 201 and a `fleet_vehicle_model` row exists in the database.

2. Given a fleet administrator, when they open the "Modelos de vehículo" catalog screen, then they can browse, create, edit, and soft-disable vehicle model records without leaving the Fleet module.

3. Given a vehicle type with `economic_group_number = "02"` and a vehicle with `economic_individual_number = "015"`, when the vehicle list is fetched, then the `economic_number` field in the response is `"02-015"`.

4. Given a vehicle type with no `economic_group_number`, when the vehicle list is fetched, then the `economic_number` field in the response is `null` for vehicles of that type.

5. Given a fleet operator with `fleet.vehicles.create` permission, when they open "Vehículos → Nuevo", then the form shows a "Modelo de vehículo" relation selector and does NOT show separate brand, model name, year, vehicle type, or vehicle brand inputs.

6. Given an existing vehicle with `vehicle_model_id = NULL`, when the vehicle detail is loaded, then the record is readable and all non-model fields display their values correctly.

7. Given a vehicle model record, when it is soft-disabled (`enabled = false`), then the vehicle model combobox excludes it from new option loads but existing vehicle records that reference it remain unaffected.

8. Given an attempt to create a duplicate vehicle model with the same `company_id + brand_id + type_id + name + year`, then the API returns HTTP 409 with a descriptive Spanish error message.

9. Given a fresh `POST /modules/sync`, then the `fleet.vehicle_model` AtlasModel row exists in the DB and the three catalog vehicle model views (`fleet.catalog.vehicle_models.table`, `.form`, `.page`) exist in AtlasView with correct schemas.

10. Given the desktop build command `pnpm --filter @atlas/desktop build:web`, then the build completes with zero errors.

11. Given existing vehicle records before the migration, after the migration runs, then all existing records remain readable through `GET /fleet/vehicles` with no data loss.

12. Given a vehicle model with `brand_id` pointing to a disabled brand, when the vehicle form loads, then the relation selector shows the model with a fallback label (using `disabledField: 'enabled'` on the brand selector) but does not prevent the form from loading.

---

## 26. Verification plan

```bash
# 1. Static checks (no Node.js JSX limitation — run on .js files only)
node --check modules/custom/custom.fleet/models/vehicle-model.model.js
node --check modules/custom/custom.fleet/views/catalog.vehicle-models.table.js
node --check modules/custom/custom.fleet/views/catalog.vehicle-models.form.js
node --check modules/custom/custom.fleet/views/catalog.vehicle-models.page.js
node --check modules/custom/custom.fleet/api/catalog-service.js
node --check modules/custom/custom.fleet/api/catalogs-routes.js
node --check modules/custom/custom.fleet/validators/index.js
node --check modules/custom/custom.fleet/module.manifest.js

# 2. Desktop build
pnpm --filter @atlas/desktop build:web

# 3. API startup
# Start: pnpm dev:api
# Wait for: "Atlas API running on http://localhost:4010"
# Check: curl -s http://localhost:4010/health

# 4. Module sync
# POST /modules/sync (with auth token)
# Verify: fleet.vehicle_model in AtlasModel
# Verify: fleet.catalog.vehicle_models.table, .form, .page in AtlasView
# Verify: fleet.vehicle.form schema has vehicle_model_id relation field

# 5. API contract smoke tests (with auth token)
# GET /fleet/catalogs/vehicle-models → 200, data array
# POST /fleet/catalogs/vehicle-models → 201
# GET /fleet/vehicles → 200, includes vehicle_model_name, economic_number fields
# PATCH /fleet/catalogs/vehicle-types/:id with economic_group_number → 200

# 6. Backfill verification
# SELECT count(*) FROM fleet_vehicle_model; -- > 0 after backfill
# SELECT count(*) FROM fleet_vehicle WHERE vehicle_model_id IS NOT NULL; -- > 0 after backfill

# 7. Browser verification
# Hard refresh (Ctrl+Shift+R)
# Navigate: Flota → Catálogos → Modelos de vehículo → verify table loads
# Navigate: Flota → Vehículos → Nuevo → verify vehicle_model_id selector, no brand/model/year fields
# Navigate: Flota → Catálogos → Tipos de vehículo → Editar → verify economic_group_number field
```

---

## 27. Rollback plan

No Prisma migrations are involved. Rollback consists of:

1. **Module-local migration rollback**: Apply the corresponding rollback SQL files committed at `modules/custom/custom.fleet/migrations/`:
   - `V004_vehicle_model_create_rollback.sql` — drops `fleet_vehicle_model` and removes `vehicle_model_id` from `fleet_vehicle`
   - `V005_vehicle_type_economic_group_number_rollback.sql` — removes `economic_group_number` from `fleet_vehicle_type`

2. **Module sync**: After rollback SQL is applied, call `POST /modules/sync` to update AtlasModel and AtlasView to the pre-redesign state.

3. **Blueprint revert**: The old view files are restored from git history. Git revert of the implementation commit covers this automatically.

4. **Existing data**: Legacy columns (`brand`, `model_name`, `year`, `vehicle_type_id`, `vehicle_brand_id`, `economic_group_number`) are never dropped in this spec, so all pre-existing vehicle data is preserved even if rollback occurs.

---

## 28. Future enhancements

1. **Blueprint Relation Inline Create**: A follow-up spec will add a generic "Crear nuevo" option to relation comboboxes. When a vehicle model does not exist yet, the operator can click "Crear nuevo" to open a modal form without leaving the vehicle form. This is the most impactful follow-up for this redesign.

2. **Legacy column cleanup**: After the relational redesign has been running for a release cycle, create a separate deprecation spec that drops `brand`, `model_name`, `year`, `vehicle_type_id`, `vehicle_brand_id`, and `economic_group_number` from `fleet_vehicle`. This requires a non-additive migration and careful testing.

3. **Configurable economic number separator**: The default `-` separator is hardcoded in this version. A future enhancement could store the separator in `InstanceConfig` or on the company record.

4. **Model-level photo**: A future enhancement could add a `photo_url` to `fleet_vehicle_model` so all vehicles sharing a model can display a catalog photo without per-vehicle photo upload.

5. **Model import from external catalog**: Integration with a vehicle data provider (VIN decoder, industry catalog) to pre-populate models.

6. **Multi-year model variants**: Some fleets treat the same model across multiple years as the same entity. A future variant could group models by name+brand+type and treat year as an optional variant tag.
