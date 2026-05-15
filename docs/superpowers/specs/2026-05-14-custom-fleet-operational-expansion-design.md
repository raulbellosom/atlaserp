# custom.fleet Operational Expansion — Maintenance, Drivers, Catalogs, Documents, and Media

Date: 2026-05-14
Status: Approved
Author: Claude Code (claude-sonnet-4-6)
Spec file: docs/superpowers/specs/2026-05-14-custom-fleet-operational-expansion-design.md
Plan file: docs/superpowers/plans/2026-05-14-custom-fleet-operational-expansion.md

---

## 1. Feature title

custom.fleet Operational Expansion — Maintenance, Drivers, Catalogs, Documents, and Media

---

## 2. Status

Approved

---

## 3. Context

The AME3 Atlas ORM + Blueprint Renderer pipeline is complete as of 2026-05-13. The `custom.fleet` module has working vehicle CRUD through `AtlasModel`/`AtlasView`/`BlueprintCrudScreen`, with `fleet_vehicle` and `fleet_maintenance` tables provisioned in PostgreSQL. The existing vehicle record is minimal: plate, brand, model_name, year, color, status, driver_id (a bare UUID), and notes.

The maintenance screen exists as a navigation entry but has no backing blueprint views or functional form — navigating to `/app/m/custom.fleet/maintenance` shows the "No se encontró una vista para este módulo" empty state.

Fleet operations in Atlas ERP require a substantially richer model: vehicles need economic numbers, type/brand catalogs, photo, and document attachments; maintenance records need a proper status lifecycle, type catalog, cost/currency, provider information, and receipts; a driver catalog is needed so driver records exist independently (with license data and documents); and catalog management screens are needed so operators can maintain the lookup data without code changes.

This spec defines the second phase of `custom.fleet` evolution — transforming the module from a bare vehicle registry into an operational fleet management system.

---

## 4. Problem

1. Vehicle records lack economic numbers (used in commercial fleet management for vehicle identification within a fleet group), vehicle type, brand (as a catalog rather than free text), photo, and document attachments. Fleet managers cannot produce complete vehicle identity sheets.

2. The maintenance module has API endpoints but no blueprint views, no proper status lifecycle (`scheduled / in_progress / completed / cancelled`), no maintenance type catalog, no cost tracking with currency, no provider/workshop field, no odometer reading, and no document/receipt attachments. Maintenance records created via API are not visible in the UI.

3. There is no driver catalog. The `driver_id` field in `fleet_vehicle` is a bare UUID with no entity backing it. Fleet managers cannot manage driver records (license data, documents, assignment history).

4. Vehicle type and brand are free-text fields. There is no catalog management, so data is inconsistent across records (e.g., "Toyota", "TOYOTA", "toyota" treated as separate brands). Fleet administrators cannot enforce consistent terminology.

5. There is no mechanism to attach files (photos, vehicle registration, driver license scans, maintenance receipts) to fleet records. The Atlas Files module exists and works for other entities, but fleet entities are not registered as allowed upload targets.

6. Adding new fields to the existing `fleet_vehicle` and `fleet_maintenance` physical tables is not supported by the current Atlas ORM migration engine (which uses `CREATE TABLE IF NOT EXISTS` — idempotent for the whole table, but does not add new columns to existing tables). The expansion spec must explicitly address how to add columns safely.

---

## 5. Goals

1. Vehicle records support economic numbers (group + individual, each up to 4 chars, displayed as `group-individual`), vehicle type catalog reference, vehicle brand catalog reference, a primary photo file reference, and multi-document attachment support.

2. A driver catalog (`fleet_driver`) is fully operational: CRUD with license information, status, photo, and multi-document attachment support (license scans, ID documents, medical certificates).

3. Maintenance records have a full status lifecycle (`scheduled / in_progress / completed / cancelled`), a maintenance type catalog, title/summary field, started_at and completed_at timestamps, odometer reading, provider/workshop field, cost with currency, enabled soft delete, and multi-document attachment support (receipts, photos).

4. Three catalog tables are operational: `fleet_vehicle_type`, `fleet_vehicle_brand`, and `fleet_maintenance_type` — each company-scoped, with seeded default values and CRUD management screens.

5. Document/media attachments for all fleet entities reuse the existing Atlas Files infrastructure (the `atlas-files` Supabase Storage bucket and the `FileAsset` Prisma model). No parallel file storage system is introduced.

6. All new entities are accessible via the existing `BlueprintCrudScreen` / `AtlasCrudView` blueprint renderer — no custom React screens are needed for this expansion.

7. The additive column migration problem for existing tables (`fleet_vehicle`, `fleet_maintenance`) is solved via explicit ALTER TABLE migration files in `modules/custom/custom.fleet/migrations/`, applied once during implementation. The approach is documented so it can inform future Atlas ORM additive migration support.

8. The `api/index.js` and service files are split into domain files before the line limit is reached.

---

## 6. Non-goals

1. Fleet analytics dashboards or reporting (vehicle utilization, maintenance cost trends, driver performance metrics).
2. Scheduled maintenance alerts, reminders, or notification integration.
3. Inventory or spare parts management.
4. Fuel tracking (tank levels, fill-up logs, consumption).
5. Insurance policy management (policy number, expiry, insurer, premium).
6. Advanced reporting engine or exportable fleet reports (CSV/PDF).
7. Mobile driver portal or driver-facing interface.
8. GPS/telematics integration or real-time vehicle location.
9. Automated maintenance scheduling based on odometer or date rules.
10. Linking fleet driver records to HR employee records (`atlas.hr` module integration). The `fleet_driver` table is a standalone catalog in this phase; future integration with `atlas.hr` is deferred.
11. Bulk import of vehicles, drivers, or maintenance records.
12. Route loader hot-reload or Atlas ORM additive column migration engine (those are platform features deferred to a future spec).
13. Blueprint schema expansion for `rightPreview`, `bulkActions`, advanced `cardLayout`, `primaryActions`, or `header` fields — the current renderer capabilities are sufficient for this expansion.

---

## 7. User stories

- As a fleet manager, I want to register vehicles with economic group and individual numbers so that I can use the organization's internal vehicle identification system.
- As a fleet manager, I want to select vehicle type and brand from a catalog dropdown so that vehicle data is consistent and searchable.
- As a fleet manager, I want to attach a primary photo and supporting documents to each vehicle so that vehicle identity packets are complete.
- As a fleet manager, I want to create and manage driver records with license number, license type, and license expiration date so that I always know which drivers have valid credentials.
- As a fleet manager, I want to attach a driver photo and scanned documents (license front/back, ID, medical certificate) to each driver record.
- As a fleet manager, I want to log a maintenance record with type, status, title, scheduled date, provider, cost, currency, and odometer reading so that service history is complete.
- As a fleet manager, I want to attach photos and receipts to a maintenance record so that financial documentation is linked directly to the service event.
- As an administrator, I want to manage vehicle type, vehicle brand, and maintenance type catalogs so that the terminology in the system matches our organization.
- As a dispatcher, I want to see which driver is currently assigned to each vehicle so that I can manage assignments.
- As a user with read-only access to fleet, I want to view vehicle details including photo, documents, and assigned driver so that I can answer client inquiries.

---

## 8. UX requirements

All user-facing text, labels, placeholders, and error messages must be in Spanish. Code identifiers, API paths, file names, and comments remain in English. All screens follow Atlas Glassic UI patterns: `rounded-2xl border bg-card` section cards, muted uppercase eyebrow labels, `ActionMenu` for row actions, `EmptyState`/`ErrorState` for data states, and `PageHeader` with eyebrow + title + primary action.

### Vehicle table (enhanced)
Columns: Matrícula (link), Número económico (derived: `group-individual`), Tipo, Marca, Año, Estado (status chip), Conductor asignado.
Row actions: Ver detalle / Editar / Desactivar.

### Vehicle form (enhanced)
Sections:
1. **Identificación** — Matrícula, Número de grupo (4 chars max), Número individual (4 chars max), Tipo de vehículo (catalog select), Marca (catalog select), Año, Color.
2. **Estado y asignación** — Estado (select), Conductor (driver catalog select).
3. **Foto del vehículo** — Single image upload (PNG/JPG/WEBP, max 5 MB).
4. **Notas** — Textarea.
Form mode: page mode (> 6 fields), so create/edit render as a full-page panel with "Volver al listado".

### Vehicle detail (enhanced)
Two-column layout. Photo shown in a dedicated section. Document list shown as a FileCard grid at the bottom.

### Maintenance table (new)
Columns: Vehículo (plate link), Tipo, Título, Estado (chip), Fecha programada, Costo.
Row actions: Ver detalle / Editar / Cancelar.

### Maintenance form (new)
Sections:
1. **Vehículo y conductor** — Vehículo (vehicle catalog select, required), Conductor (driver select, optional).
2. **Tipo de mantenimiento** — Tipo (maintenance type catalog select, required), Título, Descripción.
3. **Fechas y odómetro** — Fecha programada (required), Fecha inicio, Fecha término, Odómetro (km).
4. **Proveedor y costo** — Proveedor/Taller, Costo, Moneda (MXN default).
5. **Estado** — Estado (scheduled default).
6. **Notas** — Textarea.
Form mode: page mode.

### Maintenance detail (new)
Section cards matching form layout. Status shown as a colored chip. Documents shown as FileCard grid.

### Driver table (new)
Columns: Nombre completo (link), Teléfono, N° Licencia, Tipo de licencia, Vencimiento licencia, Estado.

### Driver form (new)
Sections:
1. **Datos personales** — Nombre, Apellido, Teléfono, Email (optional).
2. **Licencia** — Número de licencia, Tipo de licencia, Fecha de vencimiento.
3. **Foto del conductor** — Single image upload.
4. **Estado** — Estado (active default).
5. **Notas** — Textarea.

### Catalog screens
Each catalog (vehicle types, vehicle brands, maintenance types) has a simple table and a short form (name + description fields). Accessed from the Catálogos navigation entry. Standard glassic table layout with EmptyState, ActionMenu.

### Document management
Documents are attached inside the detail view of vehicle, driver, and maintenance records. A "Agregar documento" button opens a file upload area. Documents are listed as `FileCard` components showing file type icon, name, size, and a download/delete action. No standalone document screen is needed for Phase 8.

---

## 9. Routes/screens

All routes are resolved generically by `BlueprintCrudScreen` via AtlasView blueprints. No custom React screen files are created.

| Route | Blueprint entity | Module | Description |
|---|---|---|---|
| `/app/m/custom.fleet/vehicles` | vehicles | custom.fleet | Vehicle list (enhanced) |
| `/app/m/custom.fleet/vehicles/new` | vehicles | custom.fleet | Create vehicle |
| `/app/m/custom.fleet/vehicles/:id` | vehicles | custom.fleet | Vehicle detail |
| `/app/m/custom.fleet/vehicles/:id/edit` | vehicles | custom.fleet | Edit vehicle |
| `/app/m/custom.fleet/maintenance` | maintenance | custom.fleet | Maintenance list |
| `/app/m/custom.fleet/maintenance/new` | maintenance | custom.fleet | Create maintenance record |
| `/app/m/custom.fleet/maintenance/:id` | maintenance | custom.fleet | Maintenance detail |
| `/app/m/custom.fleet/maintenance/:id/edit` | maintenance | custom.fleet | Edit maintenance record |
| `/app/m/custom.fleet/drivers` | drivers | custom.fleet | Driver list |
| `/app/m/custom.fleet/drivers/new` | drivers | custom.fleet | Create driver |
| `/app/m/custom.fleet/drivers/:id` | drivers | custom.fleet | Driver detail |
| `/app/m/custom.fleet/drivers/:id/edit` | drivers | custom.fleet | Edit driver |
| `/app/m/custom.fleet/catalogs/vehicle-types` | vehicle-types | custom.fleet | Vehicle type catalog |
| `/app/m/custom.fleet/catalogs/vehicle-brands` | vehicle-brands | custom.fleet | Vehicle brand catalog |
| `/app/m/custom.fleet/catalogs/maintenance-types` | maintenance-types | custom.fleet | Maintenance type catalog |

---

## 10. Data model

### New models

#### `fleet.driver` → physical table `fleet_driver`

Stores driver/chofer records. Company-scoped. Soft-delete enabled.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id UUID NOT NULL`
- `first_name VARCHAR(100) NOT NULL`
- `last_name VARCHAR(100) NOT NULL`
- `phone VARCHAR(30) NOT NULL`
- `email VARCHAR(254)` (optional)
- `photo_asset_id UUID` (nullable — FileAsset.id reference for profile photo)
- `license_number VARCHAR(50) NOT NULL`
- `license_type VARCHAR(50) NOT NULL` (e.g., A, B, C, D, E or local classification)
- `license_expiry_date DATE NOT NULL`
- `status VARCHAR(32) NOT NULL DEFAULT 'active'` (active / inactive / suspended)
- `notes TEXT`
- `enabled BOOLEAN NOT NULL DEFAULT true`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Indexes: `(company_id, enabled)`, `(company_id, license_number) UNIQUE`

#### `fleet.vehicle_type` → physical table `fleet_vehicle_type`

Catalog of vehicle types (e.g., Sedán, SUV, Pickup, Camión, Motocicleta). Company-scoped. Soft-delete enabled.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id UUID NOT NULL`
- `name VARCHAR(100) NOT NULL`
- `description TEXT`
- `enabled BOOLEAN NOT NULL DEFAULT true`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Indexes: `(company_id, name) UNIQUE WHERE enabled = true`, `(company_id, enabled)`

#### `fleet.vehicle_brand` → physical table `fleet_vehicle_brand`

Catalog of vehicle brands/manufacturers. Company-scoped. Soft-delete enabled.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id UUID NOT NULL`
- `name VARCHAR(100) NOT NULL`
- `enabled BOOLEAN NOT NULL DEFAULT true`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Indexes: `(company_id, name) UNIQUE WHERE enabled = true`, `(company_id, enabled)`

#### `fleet.maintenance_type` → physical table `fleet_maintenance_type`

Catalog of maintenance/service types. Company-scoped. Soft-delete enabled. Seeded with 14 default types.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id UUID NOT NULL`
- `name VARCHAR(100) NOT NULL`
- `description TEXT`
- `is_system BOOLEAN NOT NULL DEFAULT false` (system records cannot be deleted)
- `enabled BOOLEAN NOT NULL DEFAULT true`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Indexes: `(company_id, name) UNIQUE WHERE enabled = true`, `(company_id, enabled)`

Default seeded records (is_system = true):
preventivo, correctivo, inspección, cambio de aceite, servicio de neumáticos, servicio de batería, servicio de frenos, carrocería/colisión, eléctrico, mecánico, servicio programado, emergencia, garantía, otro.

#### `fleet.vehicle_document` → physical table `fleet_vehicle_document`

Join table storing file associations for vehicles. Company-scoped.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id UUID NOT NULL`
- `vehicle_id UUID NOT NULL`
- `file_asset_id UUID NOT NULL` (FileAsset.id reference)
- `document_type VARCHAR(50) NOT NULL DEFAULT 'document'` (photo / document / registration / insurance)
- `label VARCHAR(200)`
- `enabled BOOLEAN NOT NULL DEFAULT true`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Indexes: `(company_id, vehicle_id)`, `(company_id, file_asset_id)`

#### `fleet.driver_document` → physical table `fleet_driver_document`

Join table storing file associations for driver records. Company-scoped.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id UUID NOT NULL`
- `driver_id UUID NOT NULL`
- `file_asset_id UUID NOT NULL`
- `document_type VARCHAR(50) NOT NULL DEFAULT 'document'` (photo / license_front / license_back / id_document / medical_certificate / other)
- `label VARCHAR(200)`
- `enabled BOOLEAN NOT NULL DEFAULT true`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Indexes: `(company_id, driver_id)`, `(company_id, file_asset_id)`

#### `fleet.maintenance_document` → physical table `fleet_maintenance_document`

Join table storing file associations for maintenance records. Company-scoped.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id UUID NOT NULL`
- `maintenance_id UUID NOT NULL`
- `file_asset_id UUID NOT NULL`
- `document_type VARCHAR(50) NOT NULL DEFAULT 'document'` (photo / receipt / invoice / report / other)
- `label VARCHAR(200)`
- `enabled BOOLEAN NOT NULL DEFAULT true`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Indexes: `(company_id, maintenance_id)`, `(company_id, file_asset_id)`

### Modified models

#### `fleet.vehicle` (existing `fleet_vehicle` table — additive ALTER TABLE columns)

New columns to add:
- `economic_group_number VARCHAR(4)` (nullable — e.g., "0001")
- `economic_individual_number VARCHAR(4)` (nullable — e.g., "0023")
- `vehicle_type_id UUID` (nullable — FK reference to fleet_vehicle_type.id)
- `vehicle_brand_id UUID` (nullable — FK reference to fleet_vehicle_brand.id)
- `photo_asset_id UUID` (nullable — FileAsset.id reference for primary vehicle photo)

Existing columns remain unchanged. The text `brand` column is kept for backward compatibility. When `vehicle_brand_id` is set, the UI uses the catalog brand name; otherwise falls back to `brand` text. This is resolved at the API layer when returning vehicle data.

Computed display field (API layer, not stored): `economic_number` is returned as `{economic_group_number}-{economic_individual_number}` when both are present, otherwise as whichever part is non-null, otherwise null.

#### `fleet.maintenance` (existing `fleet_maintenance` table — additive ALTER TABLE columns)

New columns to add:
- `maintenance_type_id UUID` (nullable — FK reference to fleet_maintenance_type.id; replaces the free-text `type` in the UI but the old `type` column is kept for backward compat)
- `title VARCHAR(255)` (nullable — short summary, e.g., "Cambio de aceite 10,000 km")
- `status VARCHAR(32) NOT NULL DEFAULT 'scheduled'` (scheduled / in_progress / completed / cancelled)
- `driver_id UUID` (nullable — driver performing or responsible for the service)
- `started_at TIMESTAMPTZ` (nullable)
- `odometer_km INTEGER` (nullable — odometer reading at service time)
- `provider VARCHAR(200)` (nullable — workshop or service provider name)
- `currency VARCHAR(10) NOT NULL DEFAULT 'MXN'` (ISO currency code)
- `enabled BOOLEAN NOT NULL DEFAULT true` (soft-delete — this column did not exist in the original table)

The existing `type` column (VARCHAR(64)) is retained for backward compatibility. The `maintenance_type_id` is the preferred reference when set.
The existing `completed_date` column is retained; `started_at` is a new separate column for the start timestamp (more precise than a date field).

---

## 11. Prisma impact

New Prisma models: **none** — all new and modified tables use Atlas ORM raw SQL.

Modified Prisma models: **none**.

New Prisma migration required: **No**.

Migration safety notes:
- Existing `fleet_vehicle` and `fleet_maintenance` tables are modified via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements placed in `modules/custom/custom.fleet/migrations/V002_vehicle_expansion.sql` and `modules/custom/custom.fleet/migrations/V003_maintenance_expansion.sql`. These migration files are NOT managed by Prisma — they are manual SQL files applied once during the implementation plan.
- The `ADD COLUMN IF NOT EXISTS` syntax is idempotent; re-running the migration is safe.
- No columns are dropped or renamed in this spec.
- New entity tables (`fleet_driver`, `fleet_vehicle_type`, `fleet_vehicle_brand`, `fleet_maintenance_type`, `fleet_vehicle_document`, `fleet_driver_document`, `fleet_maintenance_document`) are provisioned by the Atlas ORM on module re-sync + re-install after the new models are added to the module manifest.
- `apps/api/src/services/files-service.js` is updated to add fleet entity types to `ALLOWED_FILE_ENTITY_TYPES`. This is a code change, not a schema migration.
- `prisma/seed.js` is updated to add new permission records.
- `prisma/schema.prisma` is NOT modified.

---

## 12. API contract

All fleet endpoints require authentication. The Route Loader mounts the fleet router automatically when `custom.fleet` is installed and enabled.

### Vehicle endpoints (enhanced)

#### GET /fleet/vehicles
Permission: `fleet.vehicles.read`
Query: `page`, `pageSize`, `search`, `status`, `vehicle_type_id`, `vehicle_brand_id`, `sortBy`, `sortDir`
Response: `{ data: EnrichedVehicle[], pagination: { page, pageSize, total } }`

`EnrichedVehicle` shape (existing fields plus):
```json
{
  "economic_group_number": "0001",
  "economic_individual_number": "0023",
  "economic_number": "0001-0023",
  "vehicle_type_id": "uuid or null",
  "vehicle_type_name": "Pickup or null",
  "vehicle_brand_id": "uuid or null",
  "vehicle_brand_name": "Toyota or null",
  "photo_asset_id": "uuid or null"
}
```

#### POST /fleet/vehicles
Permission: `fleet.vehicles.create`
Body: `{ plate, economic_group_number?, economic_individual_number?, vehicle_type_id?, vehicle_brand_id?, brand?, model_name, year, color?, status?, driver_id?, photo_asset_id?, notes? }`
Response: `{ data: EnrichedVehicle }` 201

#### GET /fleet/vehicles/:id
Permission: `fleet.vehicles.read`
Response: `{ data: EnrichedVehicle }` — includes resolved type name, brand name.

#### PATCH /fleet/vehicles/:id
Permission: `fleet.vehicles.update`
Body: partial vehicle fields (same as POST, all optional)
Response: `{ data: EnrichedVehicle }`

#### PATCH /fleet/vehicles/:id/enabled
Permission: `fleet.vehicles.delete`
Body: `{ enabled: boolean }`
Response: `{ data: EnrichedVehicle }`

#### GET /fleet/vehicles/:id/documents
Permission: `fleet.vehicles.read`
Response: `{ data: VehicleDocument[] }` where each item includes resolved `fileAsset` metadata.

#### POST /fleet/vehicles/:id/documents
Permission: `fleet.vehicles.update`
Body: `{ file_asset_id: uuid, document_type: string, label?: string }`
Response: `{ data: VehicleDocument }` 201

#### DELETE /fleet/vehicles/:id/documents/:docId
Permission: `fleet.vehicles.update`
Soft-disables the association (sets `enabled = false`). Does not delete the FileAsset.
Response: `{ data: { id, enabled: false } }`

---

### Maintenance endpoints (full CRUD + expanded)

#### GET /fleet/maintenance
Permission: `fleet.maintenance.read`
Query: `page`, `pageSize`, `vehicleId`, `driverId`, `status`, `maintenanceTypeId`, `sortBy`, `sortDir`
Response: `{ data: EnrichedMaintenance[], pagination }`

`EnrichedMaintenance` shape (existing fields plus):
```json
{
  "maintenance_type_id": "uuid or null",
  "maintenance_type_name": "Preventivo or null",
  "title": "string or null",
  "status": "scheduled",
  "driver_id": "uuid or null",
  "started_at": "ISO datetime or null",
  "odometer_km": 15000,
  "provider": "Taller XYZ or null",
  "currency": "MXN",
  "enabled": true,
  "vehicle_plate": "ABC-123"
}
```

#### POST /fleet/maintenance
Permission: `fleet.maintenance.create`
Body: `{ vehicle_id, maintenance_type_id?, type?, title?, description, scheduled_date, driver_id?, started_at?, completed_date?, odometer_km?, provider?, cost?, currency?, notes?, status? }`
Response: `{ data: EnrichedMaintenance }` 201

#### GET /fleet/maintenance/:id
Permission: `fleet.maintenance.read`
Response: `{ data: EnrichedMaintenance }`

#### PATCH /fleet/maintenance/:id
Permission: `fleet.maintenance.update`
Body: partial maintenance fields
Response: `{ data: EnrichedMaintenance }`

#### PATCH /fleet/maintenance/:id/enabled
Permission: `fleet.maintenance.delete`
Body: `{ enabled: boolean }`
Response: `{ data: EnrichedMaintenance }`

#### GET /fleet/maintenance/:id/documents
Permission: `fleet.maintenance.read`
Response: `{ data: MaintenanceDocument[] }` with resolved fileAsset metadata.

#### POST /fleet/maintenance/:id/documents
Permission: `fleet.maintenance.update`
Body: `{ file_asset_id: uuid, document_type: string, label?: string }`
Response: `{ data: MaintenanceDocument }` 201

#### DELETE /fleet/maintenance/:id/documents/:docId
Permission: `fleet.maintenance.update`
Soft-disables the association.
Response: `{ data: { id, enabled: false } }`

---

### Driver endpoints (new)

#### GET /fleet/drivers
Permission: `fleet.drivers.read`
Query: `page`, `pageSize`, `search`, `status`, `sortBy`, `sortDir`
Response: `{ data: Driver[], pagination }`

`Driver` shape:
```json
{
  "id": "uuid",
  "company_id": "uuid",
  "first_name": "string",
  "last_name": "string",
  "full_name": "first_name + last_name (computed at API layer)",
  "phone": "string",
  "email": "string or null",
  "photo_asset_id": "uuid or null",
  "license_number": "string",
  "license_type": "string",
  "license_expiry_date": "YYYY-MM-DD",
  "status": "active",
  "notes": "string or null",
  "enabled": true,
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

#### POST /fleet/drivers
Permission: `fleet.drivers.create`
Body: `{ first_name, last_name, phone, email?, photo_asset_id?, license_number, license_type, license_expiry_date, status?, notes? }`
Response: `{ data: Driver }` 201

#### GET /fleet/drivers/:id
Permission: `fleet.drivers.read`
Response: `{ data: Driver }`

#### PATCH /fleet/drivers/:id
Permission: `fleet.drivers.update`
Body: partial driver fields
Response: `{ data: Driver }`

#### PATCH /fleet/drivers/:id/enabled
Permission: `fleet.drivers.delete`
Body: `{ enabled: boolean }`
Response: `{ data: Driver }`

#### GET /fleet/drivers/:id/documents
Permission: `fleet.drivers.read`
Response: `{ data: DriverDocument[] }` with resolved fileAsset metadata.

#### POST /fleet/drivers/:id/documents
Permission: `fleet.drivers.update`
Body: `{ file_asset_id: uuid, document_type: string, label?: string }`
Response: `{ data: DriverDocument }` 201

#### DELETE /fleet/drivers/:id/documents/:docId
Permission: `fleet.drivers.update`
Response: `{ data: { id, enabled: false } }`

---

### Catalog endpoints (new)

#### GET /fleet/catalogs/vehicle-types
Permission: `fleet.catalogs.read`
Query: `page`, `pageSize`, `search`
Response: `{ data: VehicleType[], pagination }`

#### POST /fleet/catalogs/vehicle-types
Permission: `fleet.catalogs.create`
Body: `{ name, description? }`
Response: `{ data: VehicleType }` 201

#### PATCH /fleet/catalogs/vehicle-types/:id
Permission: `fleet.catalogs.update`
Body: `{ name?, description? }`
Response: `{ data: VehicleType }`

#### PATCH /fleet/catalogs/vehicle-types/:id/enabled
Permission: `fleet.catalogs.delete`
Body: `{ enabled: boolean }`
Response: `{ data: VehicleType }`

#### GET /fleet/catalogs/vehicle-brands
Permission: `fleet.catalogs.read`
Response: `{ data: VehicleBrand[], pagination }`

#### POST /fleet/catalogs/vehicle-brands
Permission: `fleet.catalogs.create`
Body: `{ name }`
Response: `{ data: VehicleBrand }` 201

#### PATCH /fleet/catalogs/vehicle-brands/:id
Permission: `fleet.catalogs.update`
Body: `{ name? }`
Response: `{ data: VehicleBrand }`

#### PATCH /fleet/catalogs/vehicle-brands/:id/enabled
Permission: `fleet.catalogs.delete`
Body: `{ enabled: boolean }`
Response: `{ data: VehicleBrand }`

#### GET /fleet/catalogs/maintenance-types
Permission: `fleet.catalogs.read`
Response: `{ data: MaintenanceType[], pagination }`

#### POST /fleet/catalogs/maintenance-types
Permission: `fleet.catalogs.create`
Body: `{ name, description? }`
Response: `{ data: MaintenanceType }` 201

#### PATCH /fleet/catalogs/maintenance-types/:id
Permission: `fleet.catalogs.update`
Body: `{ name?, description? }`
Note: System records (`is_system = true`) cannot have `name` updated; return 409.
Response: `{ data: MaintenanceType }`

#### PATCH /fleet/catalogs/maintenance-types/:id/enabled
Permission: `fleet.catalogs.delete`
Body: `{ enabled: boolean }`
Note: System records (`is_system = true`) cannot be disabled; return 409.
Response: `{ data: MaintenanceType }`

---

## 13. SDK contract

No new SDK domains. Fleet routes are called directly by the blueprint renderer via `schema.apiPath`.

The `@atlas/sdk` package's `fleet` domain remains N/A. All CRUD calls originate from `AtlasCrudView` using the declared `apiPath`.

For document-specific endpoints (`/fleet/vehicles/:id/documents`, etc.), the frontend accesses these directly. If the blueprint renderer does not support sub-resource endpoints in Phase 8, document management is handled via direct `fetch` calls within an `AtlasCrudView` extension or a custom component registered via `ComponentRegistry`.

---

## 14. Validator contract

All validators are module-local in `modules/custom/custom.fleet/validators/index.js`. No changes to `packages/validators/src/index.js`.

New schemas to add:

- `createVehicleExpandedSchema` — adds: `economic_group_number` (string, max 4, optional), `economic_individual_number` (string, max 4, optional), `vehicle_type_id` (UUID, optional), `vehicle_brand_id` (UUID, optional), `photo_asset_id` (UUID, optional). Extends existing `createVehicleSchema`.
- `updateVehicleExpandedSchema` — all fields optional, same constraints.

- `createDriverSchema` — validates: `first_name` (string, 1–100), `last_name` (string, 1–100), `phone` (string, 5–30), `email` (email format, optional), `photo_asset_id` (UUID, optional), `license_number` (string, 1–50), `license_type` (string, 1–50), `license_expiry_date` (ISO date), `status` (enum: active/inactive/suspended, default 'active'), `notes` (max 5000, optional).
- `updateDriverSchema` — all fields optional.

- `createMaintenanceExpandedSchema` — adds to existing maintenance schema: `maintenance_type_id` (UUID, optional), `title` (string, 1–255, optional), `status` (enum: scheduled/in_progress/completed/cancelled, default 'scheduled'), `driver_id` (UUID, optional), `started_at` (ISO datetime, optional), `odometer_km` (integer, min 0, optional), `provider` (string, max 200, optional), `currency` (string, 3 chars, default 'MXN').
- `updateMaintenanceExpandedSchema` — all fields optional.

- `createVehicleTypeSchema` — validates: `name` (string, 1–100), `description` (string, max 500, optional).
- `updateVehicleTypeSchema` — all fields optional.

- `createVehicleBrandSchema` — validates: `name` (string, 1–100).
- `updateVehicleBrandSchema` — `name` optional.

- `createMaintenanceTypeSchema` — validates: `name` (string, 1–100), `description` (string, max 500, optional).
- `updateMaintenanceTypeSchema` — all fields optional.

- `createDocumentAssociationSchema` — validates: `file_asset_id` (UUID, required), `document_type` (string, max 50, optional, default 'document'), `label` (string, max 200, optional).

---

## 15. Module manifest impact

`modules/custom/custom.fleet/module.manifest.js` must be updated. This is a necessary exception to the AME3 "manifest not modified" rule from Phase 3 — that rule applied to the platform wiring phase, not to module feature expansion.

Module key: `custom.fleet` (unchanged)
Version bump: `"0.1.0"` → `"0.2.0"`
Dependencies: unchanged (`[{ key: "atlas.core" }]`)
Kind: `FEATURE`, lifecycle: `uninstallable: true` (unchanged)

**New permissions to add:**
```js
{ key: "fleet.drivers.read", name: "Ver choferes" },
{ key: "fleet.drivers.create", name: "Crear choferes" },
{ key: "fleet.drivers.update", name: "Editar choferes" },
{ key: "fleet.drivers.delete", name: "Desactivar choferes" },
{ key: "fleet.catalogs.read", name: "Ver catálogos de flota" },
{ key: "fleet.catalogs.create", name: "Crear entradas de catálogo" },
{ key: "fleet.catalogs.update", name: "Editar catálogos de flota" },
{ key: "fleet.catalogs.delete", name: "Desactivar entradas de catálogo" },
```

**New models to add:**
```js
models: [
  "./models/vehicle.model.js",       // existing
  "./models/maintenance.model.js",   // existing (updated softDelete: true)
  "./models/driver.model.js",        // new
  "./models/vehicle-type.model.js",  // new
  "./models/vehicle-brand.model.js", // new
  "./models/maintenance-type.model.js", // new
  "./models/vehicle-document.model.js", // new
  "./models/driver-document.model.js",  // new
  "./models/maintenance-document.model.js", // new
],
```

**New views to add:**
All maintenance, driver, and catalog views listed in Section 17.

**Updated ownedModels:**
```js
ownedModels: [
  "fleet.vehicle", "fleet.maintenance",
  "fleet.driver", "fleet.vehicle_type", "fleet.vehicle_brand",
  "fleet.maintenance_type", "fleet.vehicle_document",
  "fleet.driver_document", "fleet.maintenance_document"
],
```

**Updated ownedTables:**
```js
ownedTables: [
  "fleet_vehicle", "fleet_maintenance", "fleet_driver",
  "fleet_vehicle_type", "fleet_vehicle_brand", "fleet_maintenance_type",
  "fleet_vehicle_document", "fleet_driver_document", "fleet_maintenance_document"
],
```

**Updated acl.models:**
```js
models: {
  Vehicle: { read: "fleet.vehicles.read", create: "fleet.vehicles.create", update: "fleet.vehicles.update", delete: "fleet.vehicles.delete" },
  Maintenance: { read: "fleet.maintenance.read", create: "fleet.maintenance.create", update: "fleet.maintenance.update", delete: "fleet.maintenance.delete" },
  Driver: { read: "fleet.drivers.read", create: "fleet.drivers.create", update: "fleet.drivers.update", delete: "fleet.drivers.delete" },
  VehicleType: { read: "fleet.catalogs.read", create: "fleet.catalogs.create", update: "fleet.catalogs.update", delete: "fleet.catalogs.delete" },
  VehicleBrand: { read: "fleet.catalogs.read", create: "fleet.catalogs.create", update: "fleet.catalogs.update", delete: "fleet.catalogs.delete" },
  MaintenanceType: { read: "fleet.catalogs.read", create: "fleet.catalogs.create", update: "fleet.catalogs.update", delete: "fleet.catalogs.delete" },
}
```

---

## 16. Navigation impact

Current navigation (retained):
| Label | Path | Icon | Layout | permissionKey |
|---|---|---|---|---|
| Vehículos | /app/m/custom.fleet/vehicles | Truck | main | fleet.vehicles.read |
| Mantenimiento | /app/m/custom.fleet/maintenance | Wrench | main | fleet.maintenance.read |

New navigation items:
| Label (Spanish) | Path | Icon | Layout | permissionKey |
|---|---|---|---|---|
| Choferes | /app/m/custom.fleet/drivers | UserCheck | main | fleet.drivers.read |
| Catálogos | /app/m/custom.fleet/catalogs/vehicle-types | BookOpen | main | fleet.catalogs.read |

Note: The Catálogos entry lands on the vehicle types catalog. Within that screen, navigation between catalog types (vehicle types, vehicle brands, maintenance types) is managed through the catalog table's own action bar or navigation tabs. If a tabbed catalog layout is needed, that is a future enhancement.

---

## 17. Blueprint impact

### Modified AtlasView blueprints

#### `fleet.vehicle.table` (update)
Add columns: `economic_number` (computed display field), `vehicle_type_name`, `vehicle_brand_name`.
Add filter: `vehicle_type_id` (select from catalog), `vehicle_brand_id` (select from catalog).

#### `fleet.vehicle.form` (update)
Add fields to section 1: `economic_group_number` (text, max 4), `economic_individual_number` (text, max 4), `vehicle_type_id` (select), `vehicle_brand_id` (select).
Add section: "Foto del vehículo" with `photo_asset_id` (file field).
Remove driver_id section (replaced by section in new layout) or restructure for clarity.

#### `fleet.vehicle.detail` (update)
Add fields to section 1: economic numbers display.
Add section: "Foto" (photo display).
Add section: "Documentos" (document list — requires custom component or renderer extension).

### New AtlasView blueprints

#### Maintenance views (new)
- `fleet.maintenance.table` — kind: TABLE, apiPath: `/fleet/maintenance`
- `fleet.maintenance.form` — kind: FORM, apiPath: `/fleet/maintenance`
- `fleet.maintenance.detail` — kind: DETAIL, apiPath: `/fleet/maintenance`
- `fleet.maintenance.page` — kind: PAGE, path: `/maintenance`

#### Driver views (new)
- `fleet.driver.table` — kind: TABLE, apiPath: `/fleet/drivers`
- `fleet.driver.form` — kind: FORM, apiPath: `/fleet/drivers`
- `fleet.driver.detail` — kind: DETAIL, apiPath: `/fleet/drivers`
- `fleet.driver.page` — kind: PAGE, path: `/drivers`

#### Catalog views (new, one set per catalog)
- `fleet.catalog.vehicle_types.table` — kind: TABLE, apiPath: `/fleet/catalogs/vehicle-types`
- `fleet.catalog.vehicle_types.form` — kind: FORM, apiPath: `/fleet/catalogs/vehicle-types`
- `fleet.catalog.vehicle_brands.table` — kind: TABLE, apiPath: `/fleet/catalogs/vehicle-brands`
- `fleet.catalog.vehicle_brands.form` — kind: FORM, apiPath: `/fleet/catalogs/vehicle-brands`
- `fleet.catalog.maintenance_types.table` — kind: TABLE, apiPath: `/fleet/catalogs/maintenance-types`
- `fleet.catalog.maintenance_types.form` — kind: FORM, apiPath: `/fleet/catalogs/maintenance-types`

Note: Document management views (vehicle documents, driver documents, maintenance documents) are not defined as standalone AtlasView blueprints in Phase 8. Document lists are embedded within the detail view sections. If the blueprint renderer gains sub-resource rendering support in a future spec, a dedicated `DOCUMENTS` blueprint kind can be added.

### Blueprint renderer limitations relevant to this spec

The current renderer (as of 2026-05-13) supports:
- TABLE: columns, search, sort, filters (select/text), row actions, primary field link, status badge, view modes (table/list/cards).
- FORM: sections with fields, field types: text, number, decimal, select, textarea, date, color, boolean/switch, email, phone, markdown.
- DETAIL: section cards with fields.

**NOT supported yet (out of scope for this spec):**
- `file` field type in FORM (file upload via blueprint renderer).
- `relation` field type with live API search-as-you-type.
- Sub-resource document lists within detail views.
- `rightPreview` panel.
- `bulkActions` in table.

**Impact on Phase 8:** Photo upload and document management cannot be driven purely by the blueprint renderer's current field type support. The `photo_asset_id` and document attachment features will require one of:
1. A custom component registered via `ComponentRegistry` (e.g., `custom.fleet:VehiclePhotoUploader`), or
2. A direct `fetch`-based form enhancement within the form sections.

This spec designates Option 1 (custom component registry approach) as the preferred path for Phase 8. The implementation plan for Phase 7 (document/media integration) must define the component contract. If implementation discovers that custom component registration is more complex than expected, the fallback is to use a simple file-asset-id text input field (paste the UUID from the files module) and defer the upload UX to a future spec.

---

## 18. RBAC/permissions

### Existing permissions (unchanged)
| Permission key | Guards endpoint(s) | Gates navigation |
|---|---|---|
| `fleet.access` | Module access gate | No |
| `fleet.vehicles.read` | GET /fleet/vehicles, GET /fleet/vehicles/:id | Yes — Vehículos |
| `fleet.vehicles.create` | POST /fleet/vehicles | No |
| `fleet.vehicles.update` | PATCH /fleet/vehicles/:id | No |
| `fleet.vehicles.delete` | PATCH /fleet/vehicles/:id/enabled | No |
| `fleet.maintenance.read` | GET /fleet/maintenance, detail | Yes — Mantenimiento |
| `fleet.maintenance.create` | POST /fleet/maintenance | No |
| `fleet.maintenance.update` | PATCH /fleet/maintenance/:id | No |
| `fleet.maintenance.delete` | PATCH /fleet/maintenance/:id/enabled | No |

### New permissions
| Permission key | Guards endpoint(s) | Gates navigation |
|---|---|---|
| `fleet.drivers.read` | GET /fleet/drivers, GET /fleet/drivers/:id, GET /fleet/drivers/:id/documents | Yes — Choferes |
| `fleet.drivers.create` | POST /fleet/drivers | No |
| `fleet.drivers.update` | PATCH /fleet/drivers/:id, POST /fleet/drivers/:id/documents, DELETE /fleet/drivers/:id/documents/:docId | No |
| `fleet.drivers.delete` | PATCH /fleet/drivers/:id/enabled | No |
| `fleet.catalogs.read` | GET /fleet/catalogs/* | Yes — Catálogos |
| `fleet.catalogs.create` | POST /fleet/catalogs/* | No |
| `fleet.catalogs.update` | PATCH /fleet/catalogs/*/:id | No |
| `fleet.catalogs.delete` | PATCH /fleet/catalogs/*/:id/enabled | No |

Document endpoints for vehicles and maintenance reuse existing vehicle/maintenance permissions:
- `fleet.vehicles.read` guards GET /fleet/vehicles/:id/documents.
- `fleet.vehicles.update` guards POST and DELETE /fleet/vehicles/:id/documents/*.
- `fleet.maintenance.read` guards GET /fleet/maintenance/:id/documents.
- `fleet.maintenance.update` guards POST and DELETE /fleet/maintenance/:id/documents/*.

---

## 19. Multi-company behavior

All new tables include `company_id UUID NOT NULL` (companyScoped: true). Every query in every service function must include `AND company_id = $safeCompanyId`.

Catalog tables (vehicle_type, vehicle_brand, maintenance_type) are company-scoped. Each company maintains its own catalog. Seeded maintenance type records are created per-company on first use (not globally). The seed strategy: catalogs are seeded when a fleet module is installed and when the first company is onboarded — or on demand via a POST /fleet/catalogs/maintenance-types/seed endpoint (guarded by `fleet.catalogs.create`).

Driver records are company-scoped. A driver record in company A is not visible to company B.

Document join tables are company-scoped. Cross-entity lookups (e.g., FileAsset.id from a document association) are resolved via `prisma.fileAsset.findMany({ where: { id: { in: fileAssetIds } } })` without a company filter — FileAssets are not inherently company-scoped in the existing architecture. The company guard is enforced at the join table level (the join table is company-scoped, so only a company's own associations can be queried).

---

## 20. Files/storage impact

Yes — this spec introduces file/storage usage in the fleet module.

**Bucket:** `atlas-files` (existing, no new bucket required).

**Object key prefix convention:**
Files uploaded for fleet entities use the existing `buildModuleObjectKey` function in `files-service.js`:
```
modules/custom-fleet/{EntityType}/{entityId}/{timestamp}-{random}.{ext}
```
Where `EntityType` is one of: `FleetVehicle`, `FleetDriver`, `FleetMaintenance`.

**ALLOWED_FILE_ENTITY_TYPES update (files-service.js):**
The following entity types must be added to the `ALLOWED_FILE_ENTITY_TYPES` constant in `apps/api/src/services/files-service.js`:
```js
"FleetVehicle",
"FleetDriver",
"FleetMaintenance",
```
Without this change, `POST /files/upload` returns 400 for fleet entity types.

**File upload flow:**
1. Frontend uploads file via existing `POST /files/upload` with `entityType: "FleetVehicle"`, `entityId: vehicleId`, etc.
2. Files service creates a `FileAsset` Prisma record and uploads to Supabase Storage.
3. Response includes `{ data: { id: "file-asset-uuid", ... } }`.
4. Frontend stores the returned `file_asset_id` in the fleet record via PATCH endpoint or POST /documents endpoint.
5. Fleet API stores the UUID in its tables (no FK constraint at DB level — these are soft references).

**FileAsset metadata resolution:**
When fleet endpoints return document lists, they query `prisma.fileAsset.findMany({ where: { id: { in: fileAssetIds } } })` and merge metadata into the response. The injected `prisma` client in the fleet service has access to all Prisma models including `FileAsset`.

**Files module integration:** The fleet module does NOT call the files service directly. It relies on the frontend to upload files via the existing `/files` API and then pass the resulting `file_asset_id` to fleet endpoints.

---

## 21. Export/import requirements

N/A — no CSV, PDF, or Excel exports are in scope for this spec. No bulk import. Both are deferred to a future enhancement.

---

## 22. Audit log requirements

All new CRUD actions are logged to the `AuditLog` Prisma model via the injected `prisma.auditLog.create` pattern.

| Action key | Trigger | Payload |
|---|---|---|
| `fleet.driver.create` | POST /fleet/drivers — success | `after: { id, first_name, last_name, license_number, companyId }` |
| `fleet.driver.update` | PATCH /fleet/drivers/:id — success | `before: {...}, after: {...}` |
| `fleet.driver.disable` | PATCH /fleet/drivers/:id/enabled with enabled=false | `after: { id, enabled: false }` |
| `fleet.vehicle.document.add` | POST /fleet/vehicles/:id/documents | `after: { id, vehicle_id, file_asset_id, document_type }` |
| `fleet.vehicle.document.remove` | DELETE /fleet/vehicles/:id/documents/:docId | `after: { id, enabled: false }` |
| `fleet.driver.document.add` | POST /fleet/drivers/:id/documents | `after: { id, driver_id, file_asset_id, document_type }` |
| `fleet.driver.document.remove` | DELETE /fleet/drivers/:id/documents/:docId | `after: { id, enabled: false }` |
| `fleet.maintenance.document.add` | POST /fleet/maintenance/:id/documents | `after: { id, maintenance_id, file_asset_id, document_type }` |
| `fleet.maintenance.document.remove` | DELETE /fleet/maintenance/:id/documents/:docId | `after: { id, enabled: false }` |
| `fleet.catalog.vehicle_type.create` | POST /fleet/catalogs/vehicle-types | `after: { id, name }` |
| `fleet.catalog.vehicle_brand.create` | POST /fleet/catalogs/vehicle-brands | `after: { id, name }` |
| `fleet.catalog.maintenance_type.create` | POST /fleet/catalogs/maintenance-types | `after: { id, name }` |
| `fleet.vehicle.create` | POST /fleet/vehicles (expanded) | updated after payload |
| `fleet.vehicle.update` | PATCH /fleet/vehicles/:id (expanded) | updated before/after payloads |
| `fleet.maintenance.create` | POST /fleet/maintenance (expanded) | updated after payload |
| `fleet.maintenance.update` | PATCH /fleet/maintenance/:id (expanded) | updated before/after payloads |

Existing audit entries for vehicle and maintenance CRUD remain and are updated to include the new fields in the before/after payload.

---

## 23. Edge cases

1. **Driver assigned to a vehicle, then soft-deleted**: `PATCH /fleet/vehicles/:id/enabled` sets `enabled = false`. The `driver_id` reference on the vehicle record remains. When the vehicle is re-enabled, the driver assignment is still in place. `GET /fleet/drivers/:id` must still return the soft-disabled vehicle record in the driver's assigned vehicles (if that endpoint is implemented in future).

2. **Catalog item soft-disabled while referenced by fleet records**: Vehicle with `vehicle_type_id` pointing to a disabled vehicle type still returns the type name by resolving from the catalog table without an `enabled = true` filter on the JOIN side. The UI receives `vehicle_type_name: "Pickup [inactivo]"` — the service appends `[inactivo]` to the name when the catalog row has `enabled = false`. Same for vehicle brands and maintenance types.

3. **Economic number with leading zeros**: Both `economic_group_number` and `economic_individual_number` are stored as VARCHAR, not INTEGER, to preserve leading zeros. A value of `"0001"` is stored and returned as `"0001"`, not `1`. The API validator accepts strings of 1–4 digits (`/^[0-9]{1,4}$/`). The `economic_number` computed field is `{group}-{individual}` when both are present, `{group}` when only group is present, null when both are null.

4. **Vehicle with no economic number**: The `economic_number` column in the table blueprint is optional. When null, the table cell renders as empty/dash. No validation error.

5. **Maintenance record before additive column migration runs**: If someone calls the maintenance API before `enabled`, `status`, `maintenance_type_id`, etc. columns are added, the service's queries will fail with PostgreSQL error code `42P01` (column doesn't exist) or similar. Mitigation: additive migration is the first step in the implementation plan, executed before any service code changes.

6. **Maintenance `softDelete: false` in model definition vs new `enabled` column**: The existing `maintenance.model.js` has `softDelete: false`. After ALTER TABLE adds `enabled BOOLEAN NOT NULL DEFAULT true`, the model definition should be updated to `softDelete: true`. The `getMaintenanceEnabledColumnSupport()` runtime check in fleet-service.js already handles the case where the column does not exist — after the migration runs, this check will return `true` and the soft-delete behavior will activate.

7. **`fleet_maintenance_type` catalog not seeded for a company**: If a maintenance type catalog is empty for a company, the maintenance form select will be empty. The API allows `maintenance_type_id: null` (optional). The maintenance type select in the form shows an "Agregar primero un tipo de mantenimiento" empty state message with a link to the catalogs screen.

8. **FileAsset ID passed to fleet API that does not exist in `FileAsset` table**: Fleet service stores the UUID directly without validating it exists in `FileAsset`. When resolving document metadata, `prisma.fileAsset.findMany` returns partial results — missing assets are returned as `{ file_asset_id: uuid, fileAsset: null }`. The UI renders a "Archivo no disponible" placeholder.

9. **files-service.js ALLOWED_FILE_ENTITY_TYPES not updated before fleet uploads attempted**: Upload returns 400 `"Tipo de entidad no permitido."`. Mitigation: files-service update is Task 1 in the implementation plan.

10. **System maintenance type deletion attempt**: API returns 409 `"Los tipos de mantenimiento del sistema no pueden ser desactivados."` for records where `is_system = true`. The UI hides the Desactivar action for system records by checking an `is_system` field in the table response.

11. **License number uniqueness**: `license_number` is unique per `(company_id, license_number)`. If a driver is imported twice, or a typo is corrected, the unique violation returns 409 `"Ya existe un chofer con ese número de licencia."`.

12. **Vehicle brand_id and brand text field coexistence**: A vehicle may have `brand = "Toyota"` (old text) and `vehicle_brand_id = null` (no catalog entry), or `vehicle_brand_id = uuid` pointing to a catalog entry named "Toyota". The API returns both. The UI shows `vehicle_brand_name` if `vehicle_brand_id` is set, otherwise falls back to `brand`. On update, if `vehicle_brand_id` is provided, `brand` may optionally be updated to match (service normalizes this on write).

13. **api/index.js file size**: The current `modules/custom/custom.fleet/api/index.js` is 326 lines. Adding maintenance, driver, and catalog routes in a single file would exceed the 1000-line limit. The implementation plan splits the router into domain-specific route files before adding new routes.

---

## 24. Risks

1. **Risk: Additive ALTER TABLE migration on production fleet tables causes data loss.** The `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements are purely additive — they add nullable columns with defaults. No data is modified or deleted. No column renames. Mitigation: all migration SQL uses `ADD COLUMN IF NOT EXISTS` and has a `DEFAULT` clause. Migration is idempotent.

2. **Risk: `fleet_maintenance` enabled column does not exist during migration window, breaking maintenance API calls.** The `getMaintenanceEnabledColumnSupport()` runtime check in `fleet-service.js` already handles this gracefully — if the column is missing, soft-delete operations return 409. Mitigation: additive migration runs as the first implementation task before service code changes.

3. **Risk: Blueprint renderer does not support `file` field type or `relation` field type with live search.** Neither is supported as of 2026-05-13. Mitigation: photo and document attachment UI uses custom components registered via ComponentRegistry, bypassing the renderer's field type system. If ComponentRegistry proves too complex, a fallback UUID text input is used for Phase 8.

4. **Risk: Fleet module manifest update (new permissions, models, views) breaks existing installed instances.** The manifest is re-synced via `POST /modules/sync`. If new permissions are declared in the manifest but not in the seed, they won't be assignable. Mitigation: `prisma/seed.js` update is part of the implementation plan.

5. **Risk: api/index.js or fleet-service.js grows past 1000 lines.** The current `fleet-service.js` is 630 lines. Adding maintenance expansion, driver service, and catalog service in a single file would exceed 1500 lines. Mitigation: implementation plan splits the API into `vehicles-routes.js`, `maintenance-routes.js`, `drivers-routes.js`, `catalogs-routes.js` and services into `vehicle-service.js`, `maintenance-service.js`, `driver-service.js`, `catalog-service.js`. Each under 400 lines.

6. **Risk: FileAsset resolution via injected Prisma client in the fleet service introduces a Prisma dependency in the module service.** The fleet service already receives `prisma` as an injected dependency — using `prisma.fileAsset.findMany` is consistent with this pattern. However, it means fleet services depend on the Prisma schema `FileAsset` model existing. Mitigation: this dependency is explicit and documented. If the FileAsset model changes, fleet services must be updated. Future AME3 module isolation may abstract this via a platform-provided file resolution service.

7. **Risk: Catalog seeding per-company is complex.** The maintenance type catalog requires 14 default entries per company. If seeding runs once at module install, it only seeds for existing companies. New companies onboarded later won't have default catalog entries. Mitigation: provide a `POST /fleet/catalogs/maintenance-types/seed` endpoint that seeds defaults for the current company (idempotent, checks `is_system = true` entries before inserting). Future: hook into company onboarding flow.

8. **Risk: Two files for the same entity type (existing `fleet.vehicle.table` and updated version) cause sync conflicts.** The module manifest still references `./views/vehicle.table.js`. If that file is updated in place, `POST /modules/sync` will upsert the existing AtlasView row (same key). Mitigation: in-place update is correct behavior — no conflict.

---

## 25. Acceptance criteria

1. Given a user with `fleet.vehicles.create`, when they POST `/fleet/vehicles` with `economic_group_number: "0001"` and `economic_individual_number: "0023"`, then the response includes `economic_number: "0001-0023"` and the values are stored in `fleet_vehicle`.

2. Given a user with `fleet.vehicles.read`, when they GET `/fleet/vehicles`, then the response includes `vehicle_type_name` and `vehicle_brand_name` resolved from the catalog tables.

3. Given a user with `fleet.drivers.create`, when they POST `/fleet/drivers` with valid driver data, then the response is 201 with the driver record including `full_name` computed from first and last name.

4. Given a user without `fleet.drivers.create`, when they POST `/fleet/drivers`, then the response is 403.

5. Given a user with `fleet.drivers.read`, when they navigate to `/app/m/custom.fleet/drivers`, then `BlueprintCrudScreen` renders an `AtlasTable` populated by GET /fleet/drivers.

6. Given a user with `fleet.maintenance.create`, when they POST `/fleet/maintenance` with `status: "scheduled"` and a valid `maintenance_type_id`, then the response is 201 and the record is returned with `maintenance_type_name` resolved.

7. Given a user with `fleet.maintenance.read`, when they navigate to `/app/m/custom.fleet/maintenance`, then `BlueprintCrudScreen` renders the maintenance list (not the empty state).

8. Given a user with `fleet.catalogs.read`, when they navigate to `/app/m/custom.fleet/catalogs/vehicle-types`, then the vehicle type catalog list is rendered via blueprint renderer.

9. Given `files-service.js` has `FleetVehicle` in `ALLOWED_FILE_ENTITY_TYPES`, when a user uploads a file with `entityType: "FleetVehicle"`, then the upload succeeds with 201.

10. Given a user with `fleet.vehicles.update`, when they POST `/fleet/vehicles/:id/documents` with a valid `file_asset_id`, then the document association is created and GET `/fleet/vehicles/:id/documents` returns the association with resolved file metadata.

11. Given a system maintenance type (`is_system = true`), when a user with `fleet.catalogs.delete` attempts to PATCH `/fleet/catalogs/maintenance-types/:id/enabled` with `{ enabled: false }`, then the response is 409.

12. Given the implementation plan tasks are all complete, when `pnpm --filter @atlas/desktop build:web` runs, then it exits 0.

13. Given `fleet_vehicle` has the additive columns applied, when `node --check` is run on all modified service and route files, then all exit 0.

14. Given `POST /modules/sync` runs after the manifest update, then the response includes all 9 fleet models and all new views in the sync payload.

15. Given a user with `fleet.vehicles.update`, when they PATCH `/fleet/vehicles/:id/enabled` with `{ enabled: false }`, then the vehicle is excluded from the default `GET /fleet/vehicles` list.

16. Given a driver with `license_number` that already exists for the same company, when a second POST `/fleet/drivers` with the same `license_number` is attempted, then the response is 409 `"Ya existe un chofer con ese número de licencia."`.

17. Given no edits to `prisma/schema.prisma` or `prisma/migrations/`, all acceptance criteria above must pass. Zero Prisma schema or migration edits is a hard requirement.

---

## 26. Verification plan

```bash
# 1. Syntax check — all new/modified .js files
node --check modules/custom/custom.fleet/models/driver.model.js
node --check modules/custom/custom.fleet/models/vehicle-type.model.js
node --check modules/custom/custom.fleet/models/vehicle-brand.model.js
node --check modules/custom/custom.fleet/models/maintenance-type.model.js
node --check modules/custom/custom.fleet/models/vehicle-document.model.js
node --check modules/custom/custom.fleet/models/driver-document.model.js
node --check modules/custom/custom.fleet/models/maintenance-document.model.js
node --check modules/custom/custom.fleet/api/vehicle-service.js
node --check modules/custom/custom.fleet/api/maintenance-service.js
node --check modules/custom/custom.fleet/api/driver-service.js
node --check modules/custom/custom.fleet/api/catalog-service.js
node --check modules/custom/custom.fleet/api/index.js
node --check modules/custom/custom.fleet/validators/index.js
node --check apps/api/src/services/files-service.js
# Expected: all exit 0

# 2. Prisma validation — schema unchanged
pnpm exec prisma validate
pnpm exec prisma migrate status
# Expected: schema valid, no pending Prisma migrations

# 3. API boot
pnpm dev:api &
curl -f http://localhost:4010/health
# Expected: { "ok": true, ... }

# 4. Fleet file upload entity type
TOKEN=<admin_bearer_token>
curl -s -X POST http://localhost:4010/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.jpg" \
  -F "entityType=FleetVehicle" \
  -F "entityId=$(uuidgen)" | jq '.data.id'
# Expected: non-null UUID

# 5. Driver CRUD smoke
curl -s -X POST http://localhost:4010/fleet/drivers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Juan","last_name":"Garcia","phone":"5551234567","license_number":"LIC-001","license_type":"B","license_expiry_date":"2027-12-31"}' \
  | jq '.data.full_name'
# Expected: "Juan Garcia"

curl -s http://localhost:4010/fleet/drivers \
  -H "Authorization: Bearer $TOKEN" | jq '.pagination.total'
# Expected: >= 1

# 6. Vehicle catalog enrichment
curl -s -X POST http://localhost:4010/fleet/catalogs/vehicle-types \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Pickup"}' | jq '.data.id'
# Store the returned id as VT_ID

curl -s -X POST http://localhost:4010/fleet/vehicles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"plate\":\"EXP-001\",\"brand\":\"Toyota\",\"model_name\":\"Hilux\",\"year\":2024,\"economic_group_number\":\"0001\",\"economic_individual_number\":\"0001\",\"vehicle_type_id\":\"$VT_ID\"}" \
  | jq '{economic_number: .data.economic_number, type_name: .data.vehicle_type_name}'
# Expected: { "economic_number": "0001-0001", "vehicle_type_name": "Pickup" }

# 7. Maintenance CRUD smoke
curl -s -X POST http://localhost:4010/fleet/maintenance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"vehicle_id\":\"$VEHICLE_ID\",\"description\":\"Cambio de aceite\",\"scheduled_date\":\"2026-06-01\",\"status\":\"scheduled\"}" \
  | jq '.data.status'
# Expected: "scheduled"

curl -s http://localhost:4010/fleet/maintenance \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
# Expected: >= 1

# 8. Blueprint renderer — maintenance navigation
# Navigate to http://localhost:5173/app/m/custom.fleet/maintenance
# Expected: maintenance table renders with data (not empty-state "no view found")

# 9. Driver navigation renders
# Navigate to http://localhost:5173/app/m/custom.fleet/drivers
# Expected: driver table renders

# 10. Catalog navigation renders
# Navigate to http://localhost:5173/app/m/custom.fleet/catalogs/vehicle-types
# Expected: vehicle types table renders

# 11. Permission fail-closed — drivers
curl -s -X POST http://localhost:4010/fleet/drivers \
  -H "Authorization: Bearer $NO_PERM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Test","last_name":"User","phone":"5550000000","license_number":"LIC-999","license_type":"A","license_expiry_date":"2027-01-01"}' \
  | jq '.error // .status'
# Expected: 403 or error message

# 12. Desktop build
pnpm --filter @atlas/desktop build:web
# Expected: exits 0

# 13. No Prisma changes
git diff --name-only HEAD | grep -E "^(prisma/schema\.prisma|prisma/migrations/)"
# Expected: empty output

# 14. Sync after manifest update
curl -s -X POST http://localhost:4010/modules/sync \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
# Expected: custom.fleet discovered with 9 models and all new views

# 15. system maintenance type protection
curl -s -X PATCH "http://localhost:4010/fleet/catalogs/maintenance-types/$SYSTEM_TYPE_ID/enabled" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}' | jq '.error'
# Expected: error message about system types
```

---

## 27. Rollback plan

### New tables (provisioned by Atlas ORM)
Tables `fleet_driver`, `fleet_vehicle_type`, `fleet_vehicle_brand`, `fleet_maintenance_type`, `fleet_vehicle_document`, `fleet_driver_document`, `fleet_maintenance_document` are provisioned by the Atlas ORM on module install. Rolling back:
1. Run `POST /modules/custom.fleet/cleanup` with `{ confirmation: "ACEPTO" }` — drops owned tables.
2. Or manually: `DROP TABLE IF EXISTS fleet_driver, fleet_vehicle_type, fleet_vehicle_brand, fleet_maintenance_type, fleet_vehicle_document, fleet_driver_document, fleet_maintenance_document;`

### Additive columns on existing tables
The ALTER TABLE migration files added columns to `fleet_vehicle` and `fleet_maintenance`. These are non-destructive. Rolling back:
1. Run the corresponding ALTER TABLE DROP COLUMN statements (manual SQL, requires DBA access).
2. No data loss from dropping nullable columns that were newly added (no data was ever stored in them if rollback happens immediately).
3. A rollback migration SQL file should be documented alongside each migration file.

### Code changes
All new service and route files are additive. Rolling back means reverting via `git revert` or `git checkout` on the specific files. The Route Loader will fail to import the updated `api/index.js` if its imports reference deleted files — but fail-soft error handling will mark the module as `routeLoader: ERROR` and the API remains healthy.

### Manifest rollback
Reverting the manifest to version `0.1.0` and re-running `POST /modules/sync` will remove the new AtlasView records and update AtlasModel entries. Permissions remain in the database but become unreferenced. They can be cleaned up via `DELETE FROM "Permission" WHERE key LIKE 'fleet.drivers.%' OR key LIKE 'fleet.catalogs.%';` (manual, DBA step).

Prisma migrations involved: **none** (no Prisma migrations in this spec).

---

## 28. Future enhancements

1. **Fleet analytics dashboard** — vehicle utilization by driver, maintenance cost trends, upcoming maintenance alerts (based on scheduled dates or odometer intervals).
2. **Fuel tracking** — fuel fill-up log (date, liters, cost, odometer, driver), fuel consumption per vehicle chart.
3. **Insurance policy management** — policy number, insurer, effective/expiry dates, premium, linked documents.
4. **Automated maintenance scheduling alerts** — configurable rules: "alert 7 days before `license_expiry_date`", "alert when odometer > service_interval_km".
5. **HR integration for drivers** — link `fleet_driver.person_id` to an `atlas.hr` employee record once HR module is migrated to AME3.
6. **Shared/global catalogs** — instance-wide vehicle types and brands that are visible to all companies (vs current per-company catalogs). Requires a `company_id IS NULL` pattern or a separate global catalog table.
7. **Atlas ORM additive column migration** — Atlas ORM migration engine gains `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` support, eliminating the need for manual migration SQL files for column additions.
8. **Blueprint renderer `file` field type** — renderer gains native file upload support via `FormFields`'s `DropzoneField`, enabling photo and document upload directly from FORM blueprints without custom component registration.
9. **Blueprint renderer `relation` field type with live search** — FORM fields of type `relation` render a search-as-you-type ComboBox that queries the related entity's list endpoint.
10. **Bulk import** — CSV upload for vehicles, drivers, and maintenance records with column mapping and validation preview.
11. **Advanced reporting engine** — exportable fleet reports: vehicle inventory PDF, maintenance cost Excel, driver license expiry report.
12. **Mobile driver portal** — dedicated mobile-optimized interface for drivers to view their assigned vehicle and submit maintenance requests.

---

## Appendix A: Additive migration strategy decision

### Problem

The Atlas ORM migration engine uses `CREATE TABLE IF NOT EXISTS` — a fully idempotent statement for table creation, but one that does not add new columns to existing tables. Phase 3 AME3 spec (section 23, edge case 3; section 28, item 1) explicitly identified this as a known limitation and deferred additive column migration.

This spec is the first case that requires adding columns to already-provisioned fleet tables (`fleet_vehicle`, `fleet_maintenance`). A clear, safe approach is needed.

### Options considered

**Option A — New tables only; companion table for vehicle expansion**
Create `fleet_vehicle_extension` with a 1:1 FK to `fleet_vehicle` instead of altering the existing table. Complex JOINs required. Rejected: adds unnecessary query complexity.

**Option B — Dev reset (module cleanup + reinstall)**
Use `POST /modules/custom.fleet/cleanup` to drop tables and reinstall. Acceptable only in development where no production data exists. Rejected as the primary approach because it requires verifying no data exists and communicating risk to the team.

**Option C — Manual ALTER TABLE migration files (chosen)**
Place idempotent `ADD COLUMN IF NOT EXISTS` SQL in `modules/custom/custom.fleet/migrations/` files. The implementation plan includes an explicit task to run these scripts once. Files are committed to the repository as documentation artifacts.

Advantages:
- Idempotent (re-runnable)
- Non-destructive (no data loss)
- Documented in version control
- Applicable to both dev and production

**Option D — Atlas ORM additive migration engine (future)**
Extend the platform migration engine to detect schema drift and emit `ALTER TABLE ADD COLUMN IF NOT EXISTS`. This is the canonical long-term solution, deferred to a future spec (see Section 28, item 7).

### Chosen approach: Option C

Migration files live at:
- `modules/custom/custom.fleet/migrations/V002_vehicle_expansion.sql`
- `modules/custom/custom.fleet/migrations/V003_maintenance_expansion.sql`

Each file begins with a comment block documenting its purpose, date, and spec reference. Files use `ADD COLUMN IF NOT EXISTS` syntax. Files are applied once during the implementation plan. The platform does not auto-apply these files — they are applied manually as documented in the implementation plan Task 2.

Rollback companion files:
- `modules/custom/custom.fleet/migrations/V002_vehicle_expansion_rollback.sql`
- `modules/custom/custom.fleet/migrations/V003_maintenance_expansion_rollback.sql`

---

## Appendix B: Files module integration decision

### Decision: reuse Atlas Files, do not build parallel file infrastructure

The `atlas.files` module provides:
- Supabase Storage bucket `atlas-files` for file objects
- `FileAsset` Prisma model for file metadata
- `POST /files/upload` endpoint with entity type allowlist
- `GET /files` and `GET /files/:id` for metadata and signed URLs
- `files-service.js` with all upload/download/rename/bulk operations

The fleet module will reuse this infrastructure by:
1. Adding fleet entity types to `ALLOWED_FILE_ENTITY_TYPES` in `files-service.js`.
2. Storing `FileAsset.id` UUIDs in fleet tables (as nullable UUID columns for single files, and in join tables for multi-document associations).
3. Resolving file metadata at the API layer by querying `prisma.fileAsset.findMany` with the collected IDs.

This decision avoids duplicating file upload logic, storage bucket configuration, and file metadata management. The only coupling introduced is: (a) `files-service.js` entity type allowlist update, and (b) the fleet service using the injected `prisma` client to query `FileAsset` rows.

The document join tables (`fleet_vehicle_document`, `fleet_driver_document`, `fleet_maintenance_document`) exist to manage the many-to-one relationship between fleet entities and their associated files, and to track document type labels (license scan, receipt, etc.).
