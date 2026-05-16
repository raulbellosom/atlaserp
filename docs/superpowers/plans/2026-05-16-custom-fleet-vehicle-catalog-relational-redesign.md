# custom.fleet Vehicle Catalog Relational Redesign — Implementation Plan

Date: 2026-05-16
Spec: docs/superpowers/specs/2026-05-16-custom-fleet-vehicle-catalog-relational-redesign-design.md
Status: Draft

> **For agentic workers:** Declare `Mode: IMPLEMENTATION` before starting. Do not begin coding until the spec is approved and this plan is approved. Use checkbox syntax (`- [ ]`) to track progress. Mark each task completed only after its validation commands pass.

## Goal

Introduce a normalized `fleet_vehicle_model` catalog entity into `custom.fleet`, move `economic_group_number` from the vehicle record to the vehicle type, and wire the new model selector into the vehicle form. This plan delivers: (1) module-local SQL migration files for `fleet_vehicle_model` (new table) and additive columns on `fleet_vehicle_type` and `fleet_vehicle`; (2) a new Atlas ORM model definition for `fleet_vehicle_model`; (3) four new vehicle model catalog API endpoints in `catalog-service.js` + `catalogs-routes.js`; (4) updated vehicle type and vehicle service functions to accept and return new fields; (5) new validator schemas for vehicle model CRUD and updated schemas for vehicle type + vehicle; (6) three new blueprint view files (table, form, page) for the vehicle model catalog; (7) updated vehicle form, table, and detail view blueprints; (8) manifest updates including navigation entry; (9) a deterministic data backfill that creates `fleet_vehicle_model` rows from existing vehicle data and populates `vehicle_model_id`.

No Prisma schema or Prisma migration edits. No changes to `packages/maps`, `packages/validators`, `packages/sdk`, or `apps/api/src/index.js`. All fleet routes continue to be mounted by the Route Loader via the module's `api/index.js`.

## Architecture summary

The implementation follows the AME3 additive pattern established in Phase 5 (Operational Expansion). The new `fleet_vehicle_model` table is provisioned by Atlas ORM via `defineModel` and a `CREATE TABLE IF NOT EXISTS` SQL file. Additive columns (`economic_group_number` on `fleet_vehicle_type`; `vehicle_model_id` on `fleet_vehicle`) are applied via manual `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` SQL files committed in `modules/custom/custom.fleet/migrations/`. Vehicle model endpoints are added to the existing `catalog-service.js` (currently 387 lines) and `catalogs-routes.js` (currently 241 lines) — both files remain well under the 1000-line limit after additions and do not need to be split. The vehicle list and detail service functions receive a JOIN through `fleet_vehicle_model` → `fleet_vehicle_type` to derive `economic_number`; a CASE expression provides fallback to the legacy `vehicle_type_id` direct join for vehicles without `vehicle_model_id`. The spec is referenced throughout tasks via section numbers (e.g., "spec §10", "spec §12").

---

## File Structure Map

### Create

**Migration files**
- `modules/custom/custom.fleet/migrations/V004_vehicle_model.sql`
- `modules/custom/custom.fleet/migrations/V004_vehicle_model_rollback.sql`
- `modules/custom/custom.fleet/migrations/V005_vehicle_type_economic_group_number.sql`
- `modules/custom/custom.fleet/migrations/V005_vehicle_type_economic_group_number_rollback.sql`

**New model definition**
- `modules/custom/custom.fleet/models/vehicle-model.model.js`

**New blueprint views — vehicle model catalog**
- `modules/custom/custom.fleet/views/catalog.vehicle-models.table.js`
- `modules/custom/custom.fleet/views/catalog.vehicle-models.form.js`
- `modules/custom/custom.fleet/views/catalog.vehicle-models.page.js`

### Modify

- `modules/custom/custom.fleet/models/vehicle-type.model.js` — add `economic_group_number` field (text, nullable)
- `modules/custom/custom.fleet/models/vehicle.model.js` — add `vehicle_model_id` relation field; add comments marking legacy fields deprecated
- `modules/custom/custom.fleet/api/catalog-service.js` — add `listVehicleModels`, `createVehicleModel`, `updateVehicleModel`, `toggleVehicleModelEnabled`; update `listVehicleTypes`, `createVehicleType`, `updateVehicleType` to handle `economic_group_number`
- `modules/custom/custom.fleet/api/catalogs-routes.js` — add four vehicle model routes; update vehicle type routes to pass `economic_group_number`
- `modules/custom/custom.fleet/api/fleet-service.js` — update `listVehicles`, `getVehicle`, `createVehicle`, `updateVehicle` to handle `vehicle_model_id` and compute `economic_number`
- `modules/custom/custom.fleet/api/vehicles-routes.js` — *(rename from `fleet-routes.js` during implementation; update `api/index.js` import accordingly)* update vehicle routes to pass `vehicle_model_id` from request body
- `modules/custom/custom.fleet/validators/index.js` — add `createVehicleModelSchema`, `updateVehicleModelSchema`; extend `createVehicleTypeSchema`, `updateVehicleTypeSchema` with `economic_group_number`; extend `createVehicleSchema`, `updateVehicleSchema` with `vehicle_model_id`
- `modules/custom/custom.fleet/views/vehicle.form.js` — replace five legacy fields with `vehicle_model_id` relation selector; retain `plate`, `color`, `status`, `economic_individual_number`, `driver_id`, `notes`
- `modules/custom/custom.fleet/views/vehicle.table.js` — replace `brand`, `model_name`, `year` columns with `vehicle_model_name`, `vehicle_type_name`, `vehicle_brand_name`, `economic_number`
- `modules/custom/custom.fleet/views/vehicle.detail.js` — update to show `vehicle_model_name`, `vehicle_model_year`, `vehicle_brand_name`, `vehicle_type_name`, `economic_number`
- `modules/custom/custom.fleet/views/catalog.vehicle-types.form.js` — add `economic_group_number` text field
- `modules/custom/custom.fleet/module.manifest.js` — bump version to 0.3.0; add `vehicle-model.model.js` to models; add three catalog vehicle model views; add `fleet.vehicle_model` to `ownedModels`; add `fleet_vehicle_model` to `ownedTables`; add navigation entry "Modelos de vehículo"
- `docs/TASKS.md` — add relational redesign entry under custom.fleet roadmap

### Forbidden (must not be modified)

- `prisma/schema.prisma` — no Prisma model changes
- `prisma/migrations/` — no Prisma migrations
- `packages/maps/src/feature-modules.js` — fleet manifest is module-local
- `packages/maps/src/core-modules.js`
- `packages/validators/src/index.js` — validators are module-local
- `packages/sdk/src/index.js` — no new SDK domain needed
- `apps/api/src/index.js` — fleet routes are mounted via Route Loader, not the root index
- `packages/ui/src/atlas-renderer/` — no core renderer changes for module-specific behavior

---

## Phase 1 — Discovery and current schema audit

> **Database tooling note:** All SQL inspection queries in this phase should be executed through the configured MCP database tooling (e.g., the project's MCP PostgreSQL tool) whenever it is available in the agent environment. Direct SQL shown here is reference only. If MCP tooling is unavailable, use a temporary Node.js script with `@prisma/adapter-pg` + `DIRECT_URL` from `.env` (the pattern from prior phases) and delete the script after use.

### Task 1.1 — Validate migration application mechanism

**Files:** none (read-only inspection)

**Purpose:** Confirm exactly how module-local SQL migrations are applied so Phase 3 is accurate.

**Changes:**

- [ ] Read `apps/api/src/services/module-migration-service.js` and confirm:
  - `planModelMigrations` generates `CREATE TABLE IF NOT EXISTS` SQL from stored `AtlasModel` schemas using `generateCreateTableSql`. This is driven by the model schema stored in the `AtlasModel` table after sync, NOT from filesystem SQL files.
  - `applySqlMigration` applies a SQL string passed in-memory; it does NOT read files from disk.

- [ ] Read `apps/api/src/services/module-lifecycle-service.js` function `applyModuleOrmMigrations` and confirm:
  - It reads from `prisma.atlasModel.findMany({ where: { moduleKey } })`, maps to model schemas, calls `planModelMigrations`, then `applySqlMigration` for each plan.
  - This path handles **CREATE TABLE** for new entities only. It does NOT handle `ALTER TABLE` for additive columns.

- [ ] Inspect `modules/custom/custom.fleet/module.manifest.js` and confirm:
  - There is NO `migrations` array field in the manifest.
  - The `lifecycle` object contains only `ownedModels`, `ownedTables`, `ownedEntities`, `sharedEntities`. No file-based migration declaration.

- [ ] Inspect `modules/custom/custom.fleet/migrations/` and `modules/custom/custom.fleet/api/index.js` and confirm:
  - The V002/V003 SQL files are NOT referenced from `api/index.js` or from the lifecycle service. They are not auto-applied.
  - V002/V003 were applied via an explicit one-time script using `applySqlMigration`.

**Conclusion (pre-verified during plan authoring):**
- `fleet_vehicle_model` **CREATE TABLE**: Auto-handled by Atlas ORM during `POST /modules/sync`. Adding the model file to the manifest and syncing is sufficient.
- `ALTER TABLE fleet_vehicle ADD COLUMN vehicle_model_id` and `ALTER TABLE fleet_vehicle_type ADD COLUMN economic_group_number`: **NOT auto-applied**. Must be applied via an explicit one-time script following the V002/V003 pattern (write script → run via `applySqlMigration` → delete script). See Phase 3, Task 3.3.

**Validation:** Inspection confirms conclusions above. Document any deviation from expected findings before proceeding.

---

### Task 1.2 — Validate database state

**Files:** none (read-only checks)

**Changes:**

- [ ] Confirm `fleet_vehicle`, `fleet_vehicle_type`, `fleet_vehicle_brand` tables exist. Run via MCP database tool or inspection script:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'fleet_%'
  ORDER BY table_name;
  ```
  Expected: includes `fleet_vehicle`, `fleet_vehicle_type`, `fleet_vehicle_brand`, `fleet_maintenance`, `fleet_driver`, `fleet_driver_document`, `fleet_vehicle_document`, `fleet_maintenance_document`.

- [ ] Confirm `fleet_vehicle_model` does NOT yet exist:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'fleet_vehicle_model';
  ```
  Expected: empty result.

- [ ] Confirm `fleet_vehicle_type` does NOT yet have `economic_group_number`:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'fleet_vehicle_type' AND column_name = 'economic_group_number';
  ```
  Expected: empty result.

- [ ] Confirm `fleet_vehicle` does NOT yet have `vehicle_model_id`:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'fleet_vehicle' AND column_name = 'vehicle_model_id';
  ```
  Expected: empty result.

- [ ] Record current line counts:
  ```
  wc -l modules/custom/custom.fleet/api/catalog-service.js
  wc -l modules/custom/custom.fleet/api/catalogs-routes.js
  wc -l modules/custom/custom.fleet/api/fleet-service.js
  wc -l modules/custom/custom.fleet/api/vehicles-routes.js
  wc -l modules/custom/custom.fleet/validators/index.js
  wc -l modules/custom/custom.fleet/module.manifest.js
  ```
  Expected baseline (as of 2026-05-16): catalog-service.js ~387, catalogs-routes.js ~241, fleet-service.js ~405, vehicles-routes.js (renamed from fleet-routes.js) unknown, validators/index.js ~156, module.manifest.js ~212. If any file exceeds 800 lines, pause and split before adding new functionality.

- [ ] Count existing vehicle records to plan backfill scope:
  ```sql
  SELECT count(*) FROM fleet_vehicle;
  SELECT count(DISTINCT brand || '|' || coalesce(model_name,'') || '|' || coalesce(year::text,'') || '|' || coalesce(vehicle_type_id::text,'') || '|' || coalesce(vehicle_brand_id::text,''))
  FROM fleet_vehicle;
  ```
  Expected: counts recorded for backfill planning.

**Validation:** All schema checks match expected results. Line counts recorded. Proceed only if `fleet_vehicle_model` does not yet exist.

---

---

## Phase 2 — Domain design confirmation

### Task 2.1 — Review spec and confirm field decisions

**Files:** `docs/superpowers/specs/2026-05-16-custom-fleet-vehicle-catalog-relational-redesign-design.md`

**Changes:**

- [ ] Re-read spec §10 (Data model) and confirm:
  - `fleet_vehicle_model` requires `company_id`, `brand_id`, `type_id`, `name`, `year`, `enabled`, `created_at`, `updated_at`, `created_by_id`, `updated_by_id`
  - Unique index: `(company_id, brand_id, type_id, name, year)`
  - `economic_group_number` on `fleet_vehicle_type`: TEXT NULL, validator enforces 1–4 numeric digits
  - `vehicle_model_id` on `fleet_vehicle`: UUID NULL, FK `ON DELETE SET NULL`

- [ ] Re-read spec §12 (API contract) and confirm four vehicle model endpoints plus vehicle type and vehicle endpoint changes.

- [ ] Re-read spec §14 (Validator contract) and confirm schema additions.

- [ ] Re-read spec §17 (Blueprint impact) and confirm view changes including `vehicle.form.js` field replacement.

- [ ] Re-read spec §23 (Edge cases) and confirm JOIN fallback strategy for vehicles without `vehicle_model_id`.

**Validation:** No discrepancies found between spec and implementation plan. If any discrepancy is found, document it in this task before proceeding.

---

## Phase 3 — Module-local migration files

### Task 3.1 — Write V004: create fleet_vehicle_model table

**Files:** `modules/custom/custom.fleet/migrations/V004_vehicle_model.sql`

**Changes:**

- [ ] Create `V004_vehicle_model.sql` with:
  ```sql
  CREATE TABLE IF NOT EXISTS fleet_vehicle_model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    brand_id UUID NOT NULL REFERENCES fleet_vehicle_brand(id) ON DELETE RESTRICT,
    type_id UUID NOT NULL REFERENCES fleet_vehicle_type(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (char_length(name) <= 150),
    year INTEGER NOT NULL CHECK (year >= 1900 AND year <= 2100),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_id UUID,
    updated_by_id UUID
  );

  CREATE UNIQUE INDEX IF NOT EXISTS fleet_vehicle_model_company_brand_type_name_year_idx
    ON fleet_vehicle_model (company_id, brand_id, type_id, name, year);

  CREATE INDEX IF NOT EXISTS fleet_vehicle_model_company_brand_idx
    ON fleet_vehicle_model (company_id, brand_id);

  CREATE INDEX IF NOT EXISTS fleet_vehicle_model_company_type_idx
    ON fleet_vehicle_model (company_id, type_id);

  CREATE INDEX IF NOT EXISTS fleet_vehicle_model_company_enabled_idx
    ON fleet_vehicle_model (company_id, enabled);

  ALTER TABLE fleet_vehicle
    ADD COLUMN IF NOT EXISTS vehicle_model_id UUID REFERENCES fleet_vehicle_model(id) ON DELETE SET NULL;

  CREATE INDEX IF NOT EXISTS fleet_vehicle_model_id_idx
    ON fleet_vehicle (company_id, vehicle_model_id);
  ```

- [ ] Create `V004_vehicle_model_rollback.sql` with:
  ```sql
  ALTER TABLE fleet_vehicle DROP COLUMN IF EXISTS vehicle_model_id;
  DROP TABLE IF EXISTS fleet_vehicle_model CASCADE;
  ```
  > `CASCADE` ensures any dependent indexes and constraints are dropped with the table, making rollback unconditionally safe.

**Validation:**
```bash
node --check modules/custom/custom.fleet/migrations/V004_vehicle_model.sql
# (SQL file — node --check not applicable; verify manually that SQL is syntactically correct)
```

---

### Task 3.2 — Write V005: add economic_group_number to fleet_vehicle_type

**Files:** `modules/custom/custom.fleet/migrations/V005_vehicle_type_economic_group_number.sql`

**Changes:**

- [ ] Create `V005_vehicle_type_economic_group_number.sql` with:
  ```sql
  ALTER TABLE fleet_vehicle_type
    ADD COLUMN IF NOT EXISTS economic_group_number TEXT;
  ```

- [ ] Create `V005_vehicle_type_economic_group_number_rollback.sql` with:
  ```sql
  ALTER TABLE fleet_vehicle_type DROP COLUMN IF EXISTS economic_group_number;
  ```

**Validation:** SQL syntax review. Confirm `ADD COLUMN IF NOT EXISTS` is used (additive pattern).

---

### Task 3.3 — Apply additive column migrations via explicit script

> **Migration mechanism (confirmed in Task 1.1):**
> - `fleet_vehicle_model` CREATE TABLE → auto-generated by Atlas ORM from `defineModel` during `POST /modules/sync`. No manual step needed for this table.
> - `ALTER TABLE fleet_vehicle ADD COLUMN vehicle_model_id` → NOT auto-applied. Must be run explicitly.
> - `ALTER TABLE fleet_vehicle_type ADD COLUMN economic_group_number` → NOT auto-applied. Must be run explicitly.
> - The manifest has NO `migrations` array. SQL files in `migrations/` are not scanned automatically.
> - Pattern to follow: V002/V003 from the Operational Expansion phase — write a temporary script that reads the SQL and calls `applySqlMigration`, then delete the script.

**Files:** `scripts/_apply_fleet_v004_v005.mjs` (created and deleted in this task)

**Changes:**

- [ ] Write `scripts/_apply_fleet_v004_v005.mjs` using the same `@prisma/adapter-pg` + `DIRECT_URL` pattern established in prior phases:
  ```js
  // Read V004 and V005 SQL content, then for each:
  // await migrationSvc.applySqlMigration({ moduleKey: 'custom.fleet', filename, sql })
  // where migrationSvc is createModuleMigrationService({ prisma })
  ```
  The script reads `V004_vehicle_model.sql` and `V005_vehicle_type_economic_group_number.sql` from `modules/custom/custom.fleet/migrations/` using `fs.readFile`, then applies each via `applySqlMigration`. Apply V004 first (creates table and adds `vehicle_model_id` to fleet_vehicle), then V005 (adds `economic_group_number` to fleet_vehicle_type).

- [ ] Run the script:
  ```bash
  node scripts/_apply_fleet_v004_v005.mjs
  ```

- [ ] Verify columns and table exist:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'fleet_vehicle_type' AND column_name = 'economic_group_number';

  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'fleet_vehicle' AND column_name = 'vehicle_model_id';

  SELECT table_name FROM information_schema.tables
  WHERE table_name = 'fleet_vehicle_model';
  ```
  Expected: all three checks return one row each. (`fleet_vehicle_model` is created by Atlas ORM sync in Task 8.3; the `vehicle_model_id` FK column and `economic_group_number` are created by this script.)

- [ ] Delete the script after successful verification:
  ```bash
  rm scripts/_apply_fleet_v004_v005.mjs
  ```

**Validation:** All three SQL checks pass. Script deleted. No migration-related errors in `ModuleMigration` table (check with `SELECT * FROM "ModuleMigration" WHERE "moduleKey" = 'custom.fleet' ORDER BY "appliedAt" DESC LIMIT 5`).

---

## Phase 4 — API, service, and validator layer

### Task 4.1 — New validator schemas

**Files:** `modules/custom/custom.fleet/validators/index.js`

**Changes:**

- [ ] Add `createVehicleModelSchema` (spec §14):
  ```js
  export const createVehicleModelSchema = z.object({
    brand_id: z.string().uuid(),
    type_id: z.string().uuid(),
    name: z.string().min(1).max(150),
    year: z.number().int().min(1900).max(2100),
  })
  ```

- [ ] Add `updateVehicleModelSchema`:
  ```js
  export const updateVehicleModelSchema = z.object({
    brand_id: z.string().uuid().optional(),
    type_id: z.string().uuid().optional(),
    name: z.string().min(1).max(150).optional(),
    year: z.number().int().min(1900).max(2100).optional(),
  })
  ```

- [ ] Extend `createVehicleTypeSchema` and `updateVehicleTypeSchema`:
  ```js
  economic_group_number: z.string().regex(/^[0-9]{1,4}$/).nullable().optional()
  ```

- [ ] Extend `createVehicleSchema` and `updateVehicleSchema`:
  ```js
  vehicle_model_id: z.string().uuid().nullable().optional()
  ```

**Validation:**
```bash
node --check modules/custom/custom.fleet/validators/index.js
```

---

### Task 4.2 — Vehicle model catalog service functions

**Files:** `modules/custom/custom.fleet/api/catalog-service.js`

**Changes:**

- [ ] Add `listVehicleModels({ prisma, companyId, page, pageSize, search, brand_id, type_id, sortBy, sortDir })`:
  - Filters: `company_id`, `enabled: true` (default — accept optional `includeDisabled` param), optional `brand_id`, optional `type_id`, optional `search` against `name`
  - JOINs (via Prisma raw SQL or JavaScript join): resolve `brand_name` from `fleet_vehicle_brand.name` and `type_name` from `fleet_vehicle_type.name`
  - Returns paginated list with `{ data, total, page, pageSize }`
  - Each record includes: `id`, `company_id`, `brand_id`, `brand_name`, `type_id`, `type_name`, `name`, `year`, `enabled`, `created_at`, `updated_at`

- [ ] Add `createVehicleModel({ prisma, companyId, userId, data })`:
  - Validates with `createVehicleModelSchema`
  - Inserts via raw SQL `INSERT INTO fleet_vehicle_model ... ON CONFLICT DO NOTHING` or via the module's raw query pattern
  - Returns created row enriched with `brand_name`, `type_name`
  - On conflict: throw HTTP 409

- [ ] Add `updateVehicleModel({ prisma, companyId, id, data })`:
  - Validates with `updateVehicleModelSchema`
  - Updates matching `company_id` + `id`
  - Returns updated row enriched with `brand_name`, `type_name`
  - On conflict (duplicate unique combination): throw HTTP 409

- [ ] Add `toggleVehicleModelEnabled({ prisma, companyId, id, enabled })`:
  - Updates `enabled` and `updated_at` for matching `company_id` + `id`
  - Returns `{ id, enabled }`

- [ ] Update `listVehicleTypes` to include `economic_group_number` in SELECT
- [ ] Update `createVehicleType` to accept and insert `economic_group_number` from validated body
- [ ] Update `updateVehicleType` to accept and update `economic_group_number`

**Validation:**
```bash
node --check modules/custom/custom.fleet/api/catalog-service.js
wc -l modules/custom/custom.fleet/api/catalog-service.js
# Must be under 700 lines after additions
```

---

### Task 4.3 — Vehicle model catalog route handlers

**Files:** `modules/custom/custom.fleet/api/catalogs-routes.js`

**Changes:**

- [ ] Add `GET /fleet/catalogs/vehicle-models`:
  - Permission check: `fleet.catalogs.read`
  - Parse query params: `page`, `pageSize`, `search`, `brand_id`, `type_id`, `sortBy`, `sortDir`
  - Calls `listVehicleModels`
  - Returns 200 with paginated response

- [ ] Add `POST /fleet/catalogs/vehicle-models`:
  - Permission check: `fleet.catalogs.create`
  - Calls `createVehicleModel`
  - Returns 201 on success, 409 on duplicate

- [ ] Add `PATCH /fleet/catalogs/vehicle-models/:id`:
  - Permission check: `fleet.catalogs.update`
  - Calls `updateVehicleModel`
  - Returns 200, 404 if not found, 409 on duplicate

- [ ] Add `PATCH /fleet/catalogs/vehicle-models/:id/enabled`:
  - Permission check: `fleet.catalogs.delete`
  - Parses `{ enabled: boolean }` from body
  - Calls `toggleVehicleModelEnabled`
  - Returns 200

**Validation:**
```bash
node --check modules/custom/custom.fleet/api/catalogs-routes.js
wc -l modules/custom/custom.fleet/api/catalogs-routes.js
# Must be under 500 lines after additions
```

---

### Task 4.4 — Vehicle service: vehicle_model_id and economic_number

**Files:** `modules/custom/custom.fleet/api/fleet-service.js`

**Changes:**

- [ ] Update `listVehicles` to:
  - LEFT JOIN `fleet_vehicle_model vm ON v.vehicle_model_id = vm.id`
  - LEFT JOIN `fleet_vehicle_type vt ON COALESCE(vm.type_id, v.vehicle_type_id) = vt.id`
  - LEFT JOIN `fleet_vehicle_brand vb ON COALESCE(vm.brand_id, v.vehicle_brand_id) = vb.id`
  - SELECT derived fields: `vm.name AS vehicle_model_name`, `vm.year AS vehicle_model_year`, `vb.name AS vehicle_brand_name`, `vt.name AS vehicle_type_name`, `COALESCE(vt.economic_group_number, v.economic_group_number) AS economic_group_number`
  - Compute `economic_number` in service: `economic_group_number + '-' + economic_individual_number` when both are non-null; otherwise null

- [ ] Update `getVehicle` (single record) with same JOIN and enrichment logic.

- [ ] Update `createVehicle` to accept `vehicle_model_id` from validated body and insert it.

- [ ] Update `updateVehicle` to accept `vehicle_model_id` from validated body and update it.

**Validation:**
```bash
node --check modules/custom/custom.fleet/api/fleet-service.js
wc -l modules/custom/custom.fleet/api/fleet-service.js
# Must be under 700 lines after additions
```

---

### Task 4.5 — Vehicle routes: pass vehicle_model_id

**Files:** `modules/custom/custom.fleet/api/vehicles-routes.js`

> **Note:** The current file on disk is `fleet-routes.js`. This task includes renaming it to `vehicles-routes.js` for naming consistency with `catalogs-routes.js`, `drivers-routes.js`, and `maintenance-routes.js`. After renaming, update `modules/custom/custom.fleet/api/index.js` to import from `./vehicles-routes.js`.

**Changes:**

- [ ] Rename `fleet-routes.js` to `vehicles-routes.js`
- [ ] Update `api/index.js`: change `import ... from './fleet-routes.js'` to `./vehicles-routes.js'`
- [ ] In `POST /fleet/vehicles` body destructuring: include `vehicle_model_id`
- [ ] In `PATCH /fleet/vehicles/:id` body destructuring: include `vehicle_model_id`

**Validation:**
```bash
node --check modules/custom/custom.fleet/api/vehicles-routes.js
node --check modules/custom/custom.fleet/api/index.js
```

---

## Phase 5 — Blueprint and view layer

### Task 5.1 — New Atlas ORM model: fleet_vehicle_model

**Files:** `modules/custom/custom.fleet/models/vehicle-model.model.js`

**Changes:**

- [ ] Create `vehicle-model.model.js` following the `defineModel` pattern from existing model files (e.g., `vehicle.model.js`, `vehicle-type.model.js`):
  ```js
  import { defineModel } from '@atlas/module-engine'

  export default defineModel({
    key: 'vehicle_model',
    name: 'fleet.vehicle_model',
    label: 'Modelo de vehículo',
    tableName: 'fleet_vehicle_model',
    companyScoped: true,
    softDelete: true,
    fields: [
      { name: 'brand_id', type: 'relation', label: 'Marca', required: true },
      { name: 'type_id', type: 'relation', label: 'Tipo de vehículo', required: true },
      { name: 'name', type: 'text', label: 'Nombre del modelo', required: true, maxLength: 150 },
      { name: 'year', type: 'number', label: 'Año', required: true },
    ],
    indexes: [
      { fields: ['company_id', 'brand_id'] },
      { fields: ['company_id', 'type_id'] },
      { fields: ['company_id', 'enabled'] },
      { fields: ['company_id', 'brand_id', 'type_id', 'name', 'year'], unique: true },
    ],
  })
  ```
  > Actual property names confirmed from `vehicle.model.js` and `vehicle-type.model.js`: use `name` (not `key`) for fields, `tableName` (not `table`), and `name: 'fleet.vehicle_model'` for the namespaced identifier. Use `type: 'relation'` for FK fields — this is the pattern used for `driver_id` in `vehicle.model.js`.

**Validation:**
```bash
node --check modules/custom/custom.fleet/models/vehicle-model.model.js
```

---

### Task 5.2 — Update existing model definitions

**Files:** `modules/custom/custom.fleet/models/vehicle-type.model.js`, `modules/custom/custom.fleet/models/vehicle.model.js`

**Changes:**

- [ ] In `vehicle-type.model.js`: add field `{ key: 'economic_group_number', type: 'text', label: 'Número económico de grupo', required: false }`

- [ ] In `vehicle.model.js`: add field `{ key: 'vehicle_model_id', type: 'uuid', label: 'Modelo de vehículo', required: false, relatedModel: 'VehicleModel' }`. Add comment on legacy fields: `// legacy: replaced by vehicle_model_id — preserved for backward compatibility`

**Validation:**
```bash
node --check modules/custom/custom.fleet/models/vehicle-type.model.js
node --check modules/custom/custom.fleet/models/vehicle.model.js
```

---

### Task 5.3 — New blueprint views: vehicle model catalog

**Files:**
- `modules/custom/custom.fleet/views/catalog.vehicle-models.table.js`
- `modules/custom/custom.fleet/views/catalog.vehicle-models.form.js`
- `modules/custom/custom.fleet/views/catalog.vehicle-models.page.js`

**Changes:**

- [ ] Create `catalog.vehicle-models.table.js`:
  ```js
  import { defineView } from '@atlas/module-engine'

  export default defineView({
    key: 'fleet.catalog.vehicle_models.table',
    kind: 'TABLE',
    version: '0.1.0',
    schema: {
      entity: 'vehicle_model',
      component: 'AtlasTable',
      apiPath: '/fleet/catalogs/vehicle-models',
      columns: [
        { field: 'brand_name', label: 'Marca', sortable: true },
        { field: 'type_name', label: 'Tipo', sortable: true },
        { field: 'name', label: 'Nombre', sortable: true },
        { field: 'year', label: 'Año', sortable: true },
        { field: 'enabled', label: 'Estado', type: 'badge' },
      ],
      actions: [{ label: 'Agregar modelo', kind: 'create' }],
      rowActions: [
        { label: 'Ver', kind: 'view' },
        { label: 'Editar', kind: 'edit' },
        { label: 'Desactivar', kind: 'toggle-enabled' },
      ],
    },
  })
  ```

- [ ] Create `catalog.vehicle-models.form.js`:
  ```js
  import { defineView } from '@atlas/module-engine'

  export default defineView({
    key: 'fleet.catalog.vehicle_models.form',
    kind: 'FORM',
    version: '0.1.0',
    schema: {
      entity: 'vehicle_model',
      component: 'AtlasForm',
      apiPath: '/fleet/catalogs/vehicle-models',
      formMode: 'page',
      sections: [
        {
          label: 'Información del modelo',
          fields: [
            {
              field: 'brand_id',
              label: 'Marca',
              type: 'relation',
              required: true,
              relation: {
                apiPath: '/fleet/catalogs/vehicle-brands',
                labelField: 'name',
                clearable: false,
                disabledField: 'enabled',
              },
            },
            {
              field: 'type_id',
              label: 'Tipo de vehículo',
              type: 'relation',
              required: true,
              relation: {
                apiPath: '/fleet/catalogs/vehicle-types',
                labelField: 'name',
                clearable: false,
                disabledField: 'enabled',
              },
            },
            { field: 'name', label: 'Nombre del modelo', type: 'text', required: true },
            { field: 'year', label: 'Año', type: 'number', required: true },
          ],
        },
      ],
      submitLabel: 'Guardar modelo',
      cancelLabel: 'Cancelar',
    },
  })
  ```

- [ ] Create `catalog.vehicle-models.page.js` following the PAGE kind pattern from existing catalog page views (e.g., `catalog.vehicle-types.page.js` if it exists, or derive from maintenance/driver page pattern). Wire `tableViewKey: 'fleet.catalog.vehicle_models.table'` and `formViewKey: 'fleet.catalog.vehicle_models.form'`.

**Validation:**
```bash
node --check modules/custom/custom.fleet/views/catalog.vehicle-models.table.js
node --check modules/custom/custom.fleet/views/catalog.vehicle-models.form.js
node --check modules/custom/custom.fleet/views/catalog.vehicle-models.page.js
```

---

### Task 5.4 — Update vehicle form blueprint

**Files:** `modules/custom/custom.fleet/views/vehicle.form.js`

**Changes:**

- [ ] Replace the "Informacion general" section fields `brand`, `model_name`, `year`, `vehicle_type_id`, `vehicle_brand_id` with a single `vehicle_model_id` relation field:
  ```js
  {
    field: 'vehicle_model_id',
    label: 'Modelo de vehículo',
    type: 'relation',
    relation: {
      apiPath: '/fleet/catalogs/vehicle-models',
      labelField: ['brand_name', 'name', 'year'],
      labelSeparator: ' ',
      clearable: true,
      disabledField: 'enabled',
    },
  },
  ```
- [ ] Retain the following fields: `plate`, `color`, `status`, `economic_individual_number`, `driver_id`, `notes`.
- [ ] Do NOT include `economic_group_number` in the new vehicle form. That field moves to the vehicle type form only (Task 5.6). It remains in the DB and API for legacy data compatibility but is excluded from the new UI.
- [ ] Keep the "Asignacion" section with `driver_id` relation unchanged.

**Validation:**
```bash
node --check modules/custom/custom.fleet/views/vehicle.form.js
```

---

### Task 5.5 — Update vehicle table and detail blueprints

**Files:** `modules/custom/custom.fleet/views/vehicle.table.js`, `modules/custom/custom.fleet/views/vehicle.detail.js`

**Changes:**

- [ ] In `vehicle.table.js`: remove columns `brand`, `model_name`, `year`. Add columns:
  - `vehicle_model_name` label "Modelo"
  - `vehicle_type_name` label "Tipo"
  - `vehicle_brand_name` label "Marca"
  - `economic_number` label "No. Económico"

- [ ] In `vehicle.detail.js`: update to show `vehicle_model_name`, `vehicle_model_year`, `vehicle_brand_name`, `vehicle_type_name`, `economic_number`. Remove or demote raw `brand`, `model_name`, `year` fields.

**Validation:**
```bash
node --check modules/custom/custom.fleet/views/vehicle.table.js
node --check modules/custom/custom.fleet/views/vehicle.detail.js
```

---

### Task 5.6 — Update vehicle type form blueprint

**Files:** `modules/custom/custom.fleet/views/catalog.vehicle-types.form.js`

**Changes:**

- [ ] Add field `{ field: 'economic_group_number', label: 'Número económico de grupo', type: 'text' }` to the existing form section.

**Validation:**
```bash
node --check modules/custom/custom.fleet/views/catalog.vehicle-types.form.js
```

---

## Phase 6 — Data backfill

### Task 6.1 — Write and run backfill script

**Files:** `scripts/_backfill_vehicle_models.mjs` (deleted after use)

**Changes:**

- [ ] Write `scripts/_backfill_vehicle_models.mjs` that:
  1. Connects to the database using `@prisma/adapter-pg` + `DIRECT_URL` from `.env` (same pattern used in prior phases)
  2. Queries distinct combinations of `(company_id, vehicle_brand_id, vehicle_type_id, model_name, year)` from `fleet_vehicle` where all four FK/value fields are non-null
  3. For each distinct combination, inserts a `fleet_vehicle_model` row using `INSERT INTO fleet_vehicle_model ... ON CONFLICT (company_id, brand_id, type_id, name, year) DO NOTHING`
  4. After inserting, queries back each model's `id` and runs `UPDATE fleet_vehicle SET vehicle_model_id = <id> WHERE company_id = ... AND vehicle_brand_id = ... AND vehicle_type_id = ... AND model_name = ... AND year = ...`
  5. Reports counts: models created, vehicles updated, vehicles skipped (missing data)

- [ ] Run the script:
  ```bash
  node scripts/_backfill_vehicle_models.mjs
  ```

- [ ] Verify backfill results:
  ```sql
  SELECT count(*) FROM fleet_vehicle_model;
  SELECT count(*) FROM fleet_vehicle WHERE vehicle_model_id IS NOT NULL;
  SELECT count(*) FROM fleet_vehicle WHERE vehicle_model_id IS NULL;
  ```

- [ ] Delete the backfill script after successful verification:
  ```bash
  rm scripts/_backfill_vehicle_models.mjs
  ```

**Validation:** Script exits without error. Vehicle model count matches expected distinct combinations. Vehicles with full legacy data all have `vehicle_model_id` set.

---

## Phase 7 — Module manifest update

### Task 7.1 — Update module.manifest.js

**Files:** `modules/custom/custom.fleet/module.manifest.js`

**Changes:**

- [ ] Bump `version` from `'0.2.0'` to `'0.3.0'`

- [ ] Add to `models` array: `'./models/vehicle-model.model.js'`

- [ ] Add to `views` array:
  - `'./views/catalog.vehicle-models.table.js'`
  - `'./views/catalog.vehicle-models.form.js'`
  - `'./views/catalog.vehicle-models.page.js'`

- [ ] Add to `lifecycle.ownedModels`: `'fleet.vehicle_model'`

- [ ] Add to `lifecycle.ownedTables`: `'fleet_vehicle_model'`

- [ ] Add navigation entry under the catalogs group:
  ```js
  {
    label: 'Modelos de vehículo',
    path: '/app/m/custom.fleet/catalogs/vehicle-models',
    icon: 'Layers',
    layout: 'main',
    permissionKey: 'fleet.catalogs.read',
  }
  ```

- [ ] Add `VehicleModel` to `acl.models` with read/create/update/delete mapped to `fleet.catalogs.*` permissions

**Validation:**
```bash
node --check modules/custom/custom.fleet/module.manifest.js
```

---

## Phase 8 — Verification and sync

### Task 8.1 — Static syntax checks (all modified files)

**Files:** All files modified in Phases 3–7.

**Changes:**

- [ ] Run static checks on all modified `.js` files:
  ```bash
  node --check modules/custom/custom.fleet/models/vehicle-model.model.js
  node --check modules/custom/custom.fleet/models/vehicle-type.model.js
  node --check modules/custom/custom.fleet/models/vehicle.model.js
  node --check modules/custom/custom.fleet/views/catalog.vehicle-models.table.js
  node --check modules/custom/custom.fleet/views/catalog.vehicle-models.form.js
  node --check modules/custom/custom.fleet/views/catalog.vehicle-models.page.js
  node --check modules/custom/custom.fleet/views/vehicle.form.js
  node --check modules/custom/custom.fleet/views/vehicle.table.js
  node --check modules/custom/custom.fleet/views/vehicle.detail.js
  node --check modules/custom/custom.fleet/views/catalog.vehicle-types.form.js
  node --check modules/custom/custom.fleet/api/catalog-service.js
  node --check modules/custom/custom.fleet/api/catalogs-routes.js
  node --check modules/custom/custom.fleet/api/fleet-service.js
  node --check modules/custom/custom.fleet/api/vehicles-routes.js
  node --check modules/custom/custom.fleet/validators/index.js
  node --check modules/custom/custom.fleet/module.manifest.js
  ```
  All must exit with code 0.

**Validation:** Zero syntax errors across all files.

---

### Task 8.2 — Desktop build

**Files:** none (build check only)

**Changes:**

- [ ] Run desktop build:
  ```bash
  pnpm --filter @atlas/desktop build:web
  ```
  Expected: exits 0 with no TypeScript or Vite errors.

**Validation:** Build exits 0.

---

### Task 8.3 — API startup and module sync

**Files:** none (runtime verification)

**Changes:**

- [ ] Start API:
  ```bash
  pnpm dev:api
  ```
  Wait for: `"Atlas API running on http://localhost:4010"`

- [ ] Confirm health:
  ```bash
  curl -s http://localhost:4010/health
  ```
  Expected: `{ "status": "ok" }`

- [ ] Trigger module sync (requires a valid user JWT from the browser):
  ```bash
  curl -s -X POST http://localhost:4010/modules/sync \
    -H "Authorization: Bearer <user_jwt>"
  ```

- [ ] Verify `fleet.vehicle_model` AtlasModel row exists:
  ```sql
  SELECT "moduleKey", name, "tableName", enabled
  FROM "AtlasModel"
  WHERE "moduleKey" = 'custom.fleet'
    AND name = 'fleet.vehicle_model';
  ```

- [ ] Verify `fleet_vehicle_model` table was created by sync:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_name = 'fleet_vehicle_model';
  ```

- [ ] Verify new AtlasView rows exist:
  ```sql
  SELECT "moduleKey", key, type, enabled
  FROM "AtlasView"
  WHERE "moduleKey" = 'custom.fleet'
    AND key IN (
      'fleet.catalog.vehicle_models.table',
      'fleet.catalog.vehicle_models.form',
      'fleet.catalog.vehicle_models.page',
      'fleet.vehicle.form'
    );
  ```
  Expected: 4 rows returned.

- [ ] Verify `fleet.vehicle.form` schema contains `vehicle_model_id` relation field and does NOT contain `brand` or `model_name` fields:
  ```sql
  SELECT key, schema FROM "AtlasView"
  WHERE "moduleKey" = 'custom.fleet' AND key = 'fleet.vehicle.form';
  ```
  Inspect JSON: must include `"field":"vehicle_model_id"` with `"type":"relation"`. Must NOT include `"field":"brand"` or `"field":"model_name"`.

**Validation:** All sync verification queries return expected results.

---

### Task 8.4 — API contract smoke tests

**Files:** none (runtime verification)

**Changes:**

- [ ] `GET /fleet/catalogs/vehicle-models` → 200, `{ data: [], total: 0, page: 1, pageSize: 20 }` (or non-empty after backfill)

- [ ] `POST /fleet/catalogs/vehicle-models` with `{ brand_id, type_id, name: "Test Model", year: 2024 }` → 201, created record with `brand_name`, `type_name`

- [ ] Duplicate POST → 409

- [ ] `PATCH /fleet/catalogs/vehicle-models/:id` with `{ name: "Test Model Updated" }` → 200

- [ ] `PATCH /fleet/catalogs/vehicle-models/:id/enabled` with `{ enabled: false }` → 200, `{ id, enabled: false }`

- [ ] `GET /fleet/vehicles` → 200, records include `vehicle_model_name`, `vehicle_brand_name`, `vehicle_type_name`, `economic_number` fields (values may be null for records without model assignment)

- [ ] `PATCH /fleet/catalogs/vehicle-types/:id` with `{ economic_group_number: "02" }` → 200

- [ ] `GET /fleet/catalogs/vehicle-types` → 200, records include `economic_group_number` field

**Validation:** All smoke tests return expected status codes and response shapes.

---

### Task 8.5 — Browser verification

**Files:** none (manual browser check)

**Changes:**

- [ ] Hard refresh browser (Ctrl+Shift+R) to clear TanStack Query cache

- [ ] Navigate to Fleet → "Modelos de vehículo": catalog table loads, "Agregar modelo" button visible

- [ ] Create a new vehicle model: form shows Marca (relation), Tipo de vehículo (relation), Nombre del modelo, Año — no other fields

- [ ] Navigate to Fleet → Vehículos → Nuevo: form shows "Modelo de vehículo" relation selector; does NOT show separate brand, model name, year, vehicle type, vehicle brand inputs

- [ ] Navigate to Fleet → Catálogos → Tipos de vehículo → Editar any type: form shows "Número económico de grupo" text field

- [ ] Navigate to Fleet → Vehículos: table shows "Modelo", "Tipo", "Marca", "No. Económico" columns; no "Marca (texto)", "Modelo (texto)", "Año" columns

**Validation:** All browser checks pass without console errors.

---

### Task 8.6 — Documentation and TASKS.md update

**Files:** `docs/TASKS.md`

**Changes:**

- [ ] Add entry under `custom.fleet` roadmap:
  ```
  - [x] Phase 7 (Vehicle Catalog Relational Redesign): fleet_vehicle_model catalog,
        economic_group_number on vehicle type, vehicle_model_id FK on vehicle,
        updated vehicle form/table/detail views, backfill of existing records.
  ```

**Validation:** `docs/TASKS.md` updated.

---

### Task 8.7 — Commit

**Files:** All files created or modified in this plan.

**Changes:**

- [ ] Stage all new and modified files (do NOT stage the deleted backfill script):
  ```bash
  git add modules/custom/custom.fleet/
  git add docs/TASKS.md
  git status --short
  ```
  Confirm no unintended files are staged (no `.env`, no `scripts/_backfill_vehicle_models.mjs` if already deleted).

- [ ] Create commit:
  ```bash
  git commit -m "feat(fleet): add relational vehicle model catalog"
  ```

- [ ] Verify clean git status:
  ```bash
  git status --short
  ```
  Expected: clean working tree.

**Validation:** Commit created. Working tree clean.

---

## Follow-up: Blueprint Relation Inline Create

This plan does not implement inline model creation from within the vehicle form's `vehicle_model_id` combobox. The follow-up spec (Blueprint Relation Inline Create) will:

1. Add a generic "Crear nuevo" option to relation comboboxes in `AtlasForm` / `RelationSelectField`.
2. Open a modal with a stripped-down form for the related entity.
3. On success, automatically select the newly created record in the parent combobox.
4. The trigger and target view are configurable via blueprint metadata on the relation field descriptor.

This is the most impactful enhancement for operators registering new vehicles with models that do not yet exist in the catalog. Until the inline create spec is implemented, operators must first create the vehicle model in the catalog screen before creating the vehicle.

---

## Acceptance checklist (from spec §25)

All items must pass before the implementation is considered complete:

- [ ] AC1: POST `/fleet/catalogs/vehicle-models` returns 201 and a DB row exists
- [ ] AC2: "Modelos de vehículo" catalog screen is browsable, creatable, editable, soft-disableable
- [ ] AC3: Vehicle with type `economic_group_number = "02"` and `economic_individual_number = "015"` returns `economic_number = "02-015"`
- [ ] AC4: Vehicle with type having no `economic_group_number` returns `economic_number = null`
- [ ] AC5: Vehicle form shows `vehicle_model_id` selector, no separate brand/model/year/type/brand inputs
- [ ] AC6: Vehicle with `vehicle_model_id = NULL` is readable with no errors
- [ ] AC7: Disabled vehicle model is excluded from new option loads; existing vehicle references unaffected
- [ ] AC8: Duplicate vehicle model POST returns 409 with Spanish error message
- [ ] AC9: After module sync, `fleet.vehicle_model` in AtlasModel and three catalog views in AtlasView
- [ ] AC10: `pnpm --filter @atlas/desktop build:web` exits 0
- [ ] AC11: All pre-existing vehicle records remain readable after migration with no data loss
- [ ] AC12: Vehicle form loads when referenced model's brand is disabled
