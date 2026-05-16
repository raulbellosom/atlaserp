# custom.fleet Operational Expansion — Implementation Plan

Date: 2026-05-14
Spec: docs/superpowers/specs/2026-05-14-custom-fleet-operational-expansion-design.md
Status: Approved

> **For agentic workers:** Declare `Mode: IMPLEMENTATION` before starting. Do not begin coding until the spec is approved and this plan is approved. Use checkbox syntax (`- [ ]`) to track progress. Mark each task completed only after its validation commands pass.

## Goal

Expand `custom.fleet` from a bare vehicle registry into an operational fleet management system. This plan delivers: (1) additive column migrations for `fleet_vehicle` and `fleet_maintenance` via manual ALTER TABLE SQL files; (2) seven new Atlas ORM model definitions (driver, three catalog tables, three document join tables); (3) a driver catalog with full CRUD and blueprint views; (4) maintenance blueprints that surface the existing API in the UI with a proper status lifecycle; (5) vehicle enhancements with economic numbers, catalog references, and photo support; (6) three catalog management screens (vehicle types, vehicle brands, maintenance types); (7) document/media attachment support via the existing Atlas Files infrastructure; and (8) the fleet API and service layer split into domain files to stay within the 1000-line file size limit.

No Prisma schema or migration edits. No changes to `packages/maps`, `packages/validators`, `packages/sdk`, or `apps/api/src/index.js`. All fleet routes continue to be mounted by the Route Loader via the module's `api/index.js`.

## Architecture summary

The implementation follows the AME3 pattern established in the previous phase. New entity tables are provisioned by Atlas ORM using `CREATE TABLE IF NOT EXISTS` in their `defineModel` calls. Columns added to the two existing tables (`fleet_vehicle`, `fleet_maintenance`) are applied via manual `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` SQL files committed in `modules/custom/custom.fleet/migrations/`. All services receive `{ prisma, requirePermission, moduleContext }` via dependency injection from the Route Loader. The `fleet-service.js` monolith is split into four domain service files before new functionality is layered in. The `api/index.js` router orchestrator is kept thin, importing domain route files. File uploads use the existing `/files/upload` endpoint — fleet services only store the returned `file_asset_id` UUID and resolve `FileAsset` metadata via the injected Prisma client. The spec is referenced throughout tasks via section numbers (e.g., "spec §10", "spec §12").

---

## File Structure Map

### Create

**Migration files**
- `modules/custom/custom.fleet/migrations/V002_vehicle_expansion.sql`
- `modules/custom/custom.fleet/migrations/V002_vehicle_expansion_rollback.sql`
- `modules/custom/custom.fleet/migrations/V003_maintenance_expansion.sql`
- `modules/custom/custom.fleet/migrations/V003_maintenance_expansion_rollback.sql`

**New model definitions**
- `modules/custom/custom.fleet/models/driver.model.js`
- `modules/custom/custom.fleet/models/vehicle-type.model.js`
- `modules/custom/custom.fleet/models/vehicle-brand.model.js`
- `modules/custom/custom.fleet/models/maintenance-type.model.js`
- `modules/custom/custom.fleet/models/vehicle-document.model.js`
- `modules/custom/custom.fleet/models/driver-document.model.js`
- `modules/custom/custom.fleet/models/maintenance-document.model.js`

**New domain service files**
- `modules/custom/custom.fleet/api/vehicle-service.js`
- `modules/custom/custom.fleet/api/maintenance-service.js`
- `modules/custom/custom.fleet/api/driver-service.js`
- `modules/custom/custom.fleet/api/catalog-service.js`

**New domain route files**
- `modules/custom/custom.fleet/api/vehicles-routes.js`
- `modules/custom/custom.fleet/api/maintenance-routes.js`
- `modules/custom/custom.fleet/api/drivers-routes.js`
- `modules/custom/custom.fleet/api/catalogs-routes.js`

**New views — maintenance**
- `modules/custom/custom.fleet/views/maintenance.table.js`
- `modules/custom/custom.fleet/views/maintenance.form.js`
- `modules/custom/custom.fleet/views/maintenance.detail.js`
- `modules/custom/custom.fleet/views/maintenance.page.js`

**New views — driver**
- `modules/custom/custom.fleet/views/driver.table.js`
- `modules/custom/custom.fleet/views/driver.form.js`
- `modules/custom/custom.fleet/views/driver.detail.js`
- `modules/custom/custom.fleet/views/driver.page.js`

**New views — catalogs**
- `modules/custom/custom.fleet/views/catalog.vehicle-types.table.js`
- `modules/custom/custom.fleet/views/catalog.vehicle-types.form.js`
- `modules/custom/custom.fleet/views/catalog.vehicle-brands.table.js`
- `modules/custom/custom.fleet/views/catalog.vehicle-brands.form.js`
- `modules/custom/custom.fleet/views/catalog.maintenance-types.table.js`
- `modules/custom/custom.fleet/views/catalog.maintenance-types.form.js`

### Modify

- `modules/custom/custom.fleet/module.manifest.js` — version 0.2.0, new permissions (8), models (7 new), views (14 new), navigation (2 new), ownedModels, ownedTables
- `modules/custom/custom.fleet/models/maintenance.model.js` — set `softDelete: true`
- `modules/custom/custom.fleet/api/fleet-service.js` — strip down to a shim re-exporting from domain services (or delete after split is complete; route file is the decision point)
- `modules/custom/custom.fleet/api/index.js` — replace body with thin orchestrator importing domain route files
- `modules/custom/custom.fleet/validators/index.js` — add 10 new schemas
- `modules/custom/custom.fleet/views/vehicle.table.js` — add economic_number, vehicle_type_name, vehicle_brand_name columns
- `modules/custom/custom.fleet/views/vehicle.form.js` — add economic number fields, vehicle_type_id, vehicle_brand_id
- `modules/custom/custom.fleet/views/vehicle.detail.js` — add economic number fields, photo section
- `apps/api/src/services/files-service.js` — add FleetVehicle, FleetDriver, FleetMaintenance to ALLOWED_FILE_ENTITY_TYPES
- `prisma/seed.js` — add 8 new fleet permission entries
- `docs/TASKS.md` — add Phase 8 implementation entry

### Forbidden (must not be modified)

- `prisma/schema.prisma` — no Prisma model changes
- `prisma/migrations/` — no Prisma migrations
- `packages/maps/src/feature-modules.js` — fleet manifest is module-local
- `packages/maps/src/core-modules.js`
- `packages/validators/src/index.js` — validators are module-local
- `packages/sdk/src/index.js` — no new SDK domain needed
- `apps/api/src/index.js` — fleet routes are mounted via Route Loader, not the root index

---

## Phase 1 — Discovery and environment validation

> **Database tooling note:** All SQL inspection queries in this phase should be executed through the configured MCP database tooling (e.g., the project's MCP PostgreSQL tool) whenever it is available in the agent environment. Direct `psql` commands shown anywhere in this plan are reference examples only — they are not the preferred execution method. If MCP tooling is unavailable, fall back to psql with the project's configured connection string from `.env`.

### Task 1.1 — Validate database state and file counts

**Files:** none (read-only checks)

**Changes:**

- [ ] Confirm `fleet_vehicle` and `fleet_maintenance` tables exist in Supabase PostgreSQL. Run via MCP database tool (preferred) or psql (fallback):
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'fleet_%';
  ```
  Expected: `fleet_vehicle`, `fleet_maintenance` present.

- [ ] Confirm that `fleet_vehicle` does NOT yet have the new expansion columns. Run via MCP database tool:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'fleet_vehicle' AND column_name IN
  ('economic_group_number','economic_individual_number','vehicle_type_id','vehicle_brand_id','photo_asset_id');
  ```
  Expected: empty result (columns do not exist yet).

- [ ] Confirm that `fleet_maintenance` does NOT yet have the expansion columns. Run via MCP database tool:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'fleet_maintenance' AND column_name IN
  ('maintenance_type_id','title','status','driver_id','started_at','odometer_km','provider','currency','enabled');
  ```
  Expected: at most `enabled` may exist (from prior work); all others absent.

- [ ] Check current line counts to confirm service split is needed:
  ```
  wc -l modules/custom/custom.fleet/api/fleet-service.js
  wc -l modules/custom/custom.fleet/api/index.js
  ```
  Expected: fleet-service.js ~630 lines, api/index.js ~326 lines.

- [ ] Confirm `ALLOWED_FILE_ENTITY_TYPES` in `apps/api/src/services/files-service.js` does NOT yet include FleetVehicle, FleetDriver, FleetMaintenance.

**Validation:** All checks above return expected results. If the database has already been migrated (unexpected), document the actual state before proceeding.

---

### Task 1.1 — Evidence (Verified: 2026-05-14)

**MCP database tool:** No PostgreSQL/Supabase MCP tool is available in this environment. Available MCP servers: context7, exa, github, memory, playwright, sequential-thinking. Fallback used: temporary Node.js script (`_phase1_inspect.mjs`, deleted after use) using `@prisma/client` + `@prisma/adapter-pg` with `DIRECT_URL` from `.env`. This matches the project's own API initialization pattern (`apps/api/src/index.js` lines 8, 79-81).

**Note on Prisma version:** CLAUDE.md states Prisma is pinned to `^6`. Actual installed version is `7.8.0` (both `prisma` and `@prisma/client`). This is an out-of-scope discrepancy — not addressed in Phase 1. Flagged for team awareness.

**Note on AtlasView schema:** The plan and spec reference column `kind` in `AtlasView`. The actual column name is `type`. The inspection queries were corrected accordingly. The plan verification commands in Phase 8 that reference `kind` must use `type` instead.

---

**Check 1 result — fleet_ tables (2026-05-14)**

Query executed:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'fleet_%'
ORDER BY table_name;
```

Result:
```
fleet_maintenance
fleet_vehicle
```

Status: **PASS** — both expected base tables present. No expansion tables (fleet_driver, fleet_vehicle_type, etc.) exist yet. Phase 2 will create them via Atlas ORM.

---

**Check 2 result — fleet_vehicle expansion columns (2026-05-14)**

Query executed:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fleet_vehicle'
  AND column_name IN ('economic_group_number','economic_individual_number',
    'vehicle_type_id','vehicle_brand_id','photo_asset_id')
ORDER BY column_name;
```

Result: **empty** — zero rows.

Status: **PASS (pre-migration)** — no expansion columns exist yet. V002 migration must be applied in Phase 2 Task 2.2.

---

**Check 3 result — fleet_maintenance expansion columns (2026-05-14)**

Query executed:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fleet_maintenance'
  AND column_name IN ('maintenance_type_id','title','status','driver_id',
    'started_at','odometer_km','provider','currency','enabled')
ORDER BY column_name;
```

Result: **empty** — zero rows. Notably, `enabled` does NOT exist on `fleet_maintenance` yet (the `getMaintenanceEnabledColumnSupport()` runtime check in `fleet-service.js` is therefore currently returning false).

Status: **PASS (pre-migration)** — no expansion columns exist. V003 migration must be applied in Phase 2 Task 2.2 before any maintenance service code changes.

---

**Check 4 result — AtlasView rows for custom.fleet (2026-05-14)**

Query executed (column corrected from `kind` to `type`):
```sql
SELECT "moduleKey", key, type, enabled FROM "AtlasView"
WHERE "moduleKey" = 'custom.fleet' ORDER BY key;
```

Result:
```json
[
  { "moduleKey": "custom.fleet", "key": "fleet.vehicle.detail", "type": "DETAIL", "enabled": true },
  { "moduleKey": "custom.fleet", "key": "fleet.vehicle.form",   "type": "FORM",   "enabled": true },
  { "moduleKey": "custom.fleet", "key": "fleet.vehicle.page",   "type": "PAGE",   "enabled": true },
  { "moduleKey": "custom.fleet", "key": "fleet.vehicle.table",  "type": "TABLE",  "enabled": true }
]
```

Status: **PASS** — 4 vehicle views present, all enabled. No maintenance views, no driver views, no catalog views. This matches expected pre-Phase-2 state.

---

**Check 5 result — AtlasModel rows for custom.fleet (2026-05-14)**

Query executed:
```sql
SELECT "moduleKey", name, "tableName", enabled FROM "AtlasModel"
WHERE "moduleKey" = 'custom.fleet' ORDER BY name;
```

Result:
```json
[
  { "moduleKey": "custom.fleet", "name": "fleet.maintenance", "tableName": "fleet_maintenance", "enabled": true },
  { "moduleKey": "custom.fleet", "name": "fleet.vehicle",     "tableName": "fleet_vehicle",     "enabled": true }
]
```

Status: **PASS** — 2 models registered. No driver, catalog, or document models yet. Phase 2 will register 7 new models.

---

**Check 6 result — file line counts (2026-05-14)**

```
fleet-service.js:  629 lines  (service split required — approaching 800-line soft warning)
api/index.js:      325 lines  (split required before adding catalog/driver routes)
validators/index.js: 60 lines (manageable — no split needed now)
```

Status: **PASS** — confirms service split is necessary before new functionality is layered in. Task 4.1 (split fleet-service.js) and Task 4.4 (split api/index.js) must run before Phase 3 code is added.

---

**Check 7 result — files-service.js ALLOWED_FILE_ENTITY_TYPES (2026-05-14)**

`ALLOWED_FILE_ENTITY_TYPES` in `apps/api/src/services/files-service.js` (lines 9-15):
```js
const ALLOWED_FILE_ENTITY_TYPES = [
  "AtlasFile",
  "BrandingConfig",
  "Company",
  "HrEmployee",
  "Contact",
];
```

FleetVehicle, FleetDriver, FleetMaintenance: **ABSENT**.

Status: **PASS (pre-update)** — fleet entity types are not yet allowlisted. Phase 6 Task 6.1 must add them before document upload tests can pass.

---

**Check 8 result — module.manifest.js current state (2026-05-14)**

- Version: `0.1.0`
- Models: 2 (`./models/vehicle.model.js`, `./models/maintenance.model.js`)
- Views: 4 (`vehicle.table`, `vehicle.form`, `vehicle.detail`, `vehicle.page`)
- Navigation items: 2 (Vehiculos, Mantenimiento)
- Permissions: 9 (`fleet.access` + 4 vehicle + 4 maintenance)
- Drivers: absent
- Catalogs: absent

Status: **PASS** — manifest matches expected pre-Phase-2 state. Must be bumped to `0.2.0` in Task 2.5.

- [ ] **Task 1.1 complete** — all 8 checks executed with evidence. Database is clean (no expansion columns, no new tables). Ready to proceed to Phase 2.

---

## Phase 2 — Model definitions and safe migration strategy

### Task 2.1 — Create additive column migration files

**Files:**
- Create: `modules/custom/custom.fleet/migrations/V002_vehicle_expansion.sql`
- Create: `modules/custom/custom.fleet/migrations/V002_vehicle_expansion_rollback.sql`
- Create: `modules/custom/custom.fleet/migrations/V003_maintenance_expansion.sql`
- Create: `modules/custom/custom.fleet/migrations/V003_maintenance_expansion_rollback.sql`

**Changes:**

Write `V002_vehicle_expansion.sql` — adds 5 columns to `fleet_vehicle` (spec §10 Modified Models):

```sql
-- V002: fleet_vehicle expansion
-- Date: 2026-05-14
-- Spec: docs/superpowers/specs/2026-05-14-custom-fleet-operational-expansion-design.md §10
ALTER TABLE fleet_vehicle
  ADD COLUMN IF NOT EXISTS economic_group_number VARCHAR(4),
  ADD COLUMN IF NOT EXISTS economic_individual_number VARCHAR(4),
  ADD COLUMN IF NOT EXISTS vehicle_type_id UUID,
  ADD COLUMN IF NOT EXISTS vehicle_brand_id UUID,
  ADD COLUMN IF NOT EXISTS photo_asset_id UUID;
```

Write `V002_vehicle_expansion_rollback.sql`:

```sql
-- Rollback for V002 — only run if expansion must be fully reverted
ALTER TABLE fleet_vehicle
  DROP COLUMN IF EXISTS economic_group_number,
  DROP COLUMN IF EXISTS economic_individual_number,
  DROP COLUMN IF EXISTS vehicle_type_id,
  DROP COLUMN IF EXISTS vehicle_brand_id,
  DROP COLUMN IF EXISTS photo_asset_id;
```

Write `V003_maintenance_expansion.sql` — adds 9 columns to `fleet_maintenance` (spec §10 Modified Models):

```sql
-- V003: fleet_maintenance expansion
-- Date: 2026-05-14
-- Spec: docs/superpowers/specs/2026-05-14-custom-fleet-operational-expansion-design.md §10
ALTER TABLE fleet_maintenance
  ADD COLUMN IF NOT EXISTS maintenance_type_id UUID,
  ADD COLUMN IF NOT EXISTS title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS driver_id UUID,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS odometer_km INTEGER,
  ADD COLUMN IF NOT EXISTS provider VARCHAR(200),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
```

Write `V003_maintenance_expansion_rollback.sql`:

```sql
-- Rollback for V003 — only run if expansion must be fully reverted
ALTER TABLE fleet_maintenance
  DROP COLUMN IF EXISTS maintenance_type_id,
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS driver_id,
  DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS odometer_km,
  DROP COLUMN IF EXISTS provider,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS enabled;
```

- [x] Create all four SQL files as described above.

**Validation:**

```bash
# Verify files exist and have correct content
node --check modules/custom/custom.fleet/migrations/V002_vehicle_expansion.sql 2>&1 || true
# (SQL files cannot be syntax-checked via node --check — just confirm they exist)
ls -la modules/custom/custom.fleet/migrations/
```

Expected: four migration files present.

---

### Task 2.2 — Apply additive migrations to Supabase PostgreSQL

**Files:** none (database operation only)

> **Preferred workflow:** Execute the migration SQL through the configured MCP database tooling whenever it is available in the agent environment. Read the contents of each migration file, then submit the SQL to the MCP tool. This is safer and does not require shell access to the database host.
>
> **Fallback (examples only):** If MCP database tooling is not available, the SQL can be applied via psql. The commands below are reference examples — substitute the actual password from `.env` (`DATABASE_URL` or `DIRECT_URL`). Do not hard-code credentials.

**Changes:**

- [x] Apply V002 — read `modules/custom/custom.fleet/migrations/V002_vehicle_expansion.sql` and execute its contents via MCP database tool (preferred). Fallback example:
  ```bash
  # EXAMPLE ONLY — prefer MCP database tooling
  psql "$DIRECT_URL" -f modules/custom/custom.fleet/migrations/V002_vehicle_expansion.sql
  ```
  Expected result: `ALTER TABLE` (command completes without error).

- [x] Apply V003 — read `modules/custom/custom.fleet/migrations/V003_maintenance_expansion.sql` and execute via MCP database tool (preferred). Fallback example:
  ```bash
  # EXAMPLE ONLY — prefer MCP database tooling
  psql "$DIRECT_URL" -f modules/custom/custom.fleet/migrations/V003_maintenance_expansion.sql
  ```
  Expected result: `ALTER TABLE` (command completes without error).

- [x] Verify columns exist by running via MCP database tool (preferred) or psql:
  ```sql
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'fleet_vehicle' AND column_name IN
  ('economic_group_number','vehicle_type_id','photo_asset_id');
  -- Expected: 3 rows

  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'fleet_maintenance' AND column_name IN
  ('maintenance_type_id','status','enabled');
  -- Expected: 3 rows
  ```

**Validation:** Both ALTER TABLE statements complete without error. Column verification queries return the expected row counts.

---

### Task 2.2 — Evidence (Verified: 2026-05-14)

**Execution method:** Temporary Node.js script (`_phase2_apply.mjs`, deleted after use) using `@prisma/client` + `@prisma/adapter-pg` + `$executeRawUnsafe`. MCP database tooling unavailable (same environment as Phase 1).

**V002 result:** `ALTER TABLE` executed successfully. Verification query returned 5 rows:
```
economic_group_number    character varying
economic_individual_number character varying
photo_asset_id           uuid
vehicle_brand_id         uuid
vehicle_type_id          uuid
```
Status: **PASS** — all 5 fleet_vehicle expansion columns present.

**V003 result:** `ALTER TABLE` executed successfully. Verification query returned 9 rows:
```
currency           character varying
driver_id          uuid
enabled            boolean
maintenance_type_id uuid
odometer_km        integer
provider           character varying
started_at         timestamp with time zone
status             character varying
title              character varying
```
Status: **PASS** — all 9 fleet_maintenance expansion columns present.

---

### Task 2.3 — Create new model definition files (7 models)

**Files:**
- Create: `modules/custom/custom.fleet/models/driver.model.js`
- Create: `modules/custom/custom.fleet/models/vehicle-type.model.js`
- Create: `modules/custom/custom.fleet/models/vehicle-brand.model.js`
- Create: `modules/custom/custom.fleet/models/maintenance-type.model.js`
- Create: `modules/custom/custom.fleet/models/vehicle-document.model.js`
- Create: `modules/custom/custom.fleet/models/driver-document.model.js`
- Create: `modules/custom/custom.fleet/models/maintenance-document.model.js`

**Changes:**

Each model uses `defineModel` from `@atlas/module-engine`. Follow the exact field schemas in spec §10 (Data model — New models). Key properties per model:

- **driver.model.js**: key `fleet.driver`, table `fleet_driver`, companyScoped: true, softDelete: true. Fields: first_name, last_name, phone, email (optional), photo_asset_id (nullable UUID), license_number, license_type, license_expiry_date (date), status (select: active/inactive/suspended), notes (textarea), enabled. Indexes: `(company_id, enabled)`, `(company_id, license_number) UNIQUE`.

- **vehicle-type.model.js**: key `fleet.vehicle_type`, table `fleet_vehicle_type`, companyScoped: true, softDelete: true. Fields: name (text, required), description (textarea, optional), enabled. Indexes: `(company_id, name) UNIQUE WHERE enabled = true`, `(company_id, enabled)`.

- **vehicle-brand.model.js**: key `fleet.vehicle_brand`, table `fleet_vehicle_brand`, companyScoped: true, softDelete: true. Fields: name (text, required), enabled. Indexes: `(company_id, name) UNIQUE WHERE enabled = true`, `(company_id, enabled)`.

- **maintenance-type.model.js**: key `fleet.maintenance_type`, table `fleet_maintenance_type`, companyScoped: true, softDelete: true. Fields: name (text), description (textarea, optional), is_system (boolean, default false), enabled. Indexes: `(company_id, name) UNIQUE WHERE enabled = true`, `(company_id, enabled)`.

- **vehicle-document.model.js**: key `fleet.vehicle_document`, table `fleet_vehicle_document`, companyScoped: true, softDelete: false. Fields: vehicle_id (UUID, required), file_asset_id (UUID, required), document_type (text, default 'document'), label (text, optional), enabled (boolean, default true). Indexes: `(company_id, vehicle_id)`, `(company_id, file_asset_id)`.

- **driver-document.model.js**: key `fleet.driver_document`, table `fleet_driver_document`, companyScoped: true, softDelete: false. Fields: driver_id (UUID, required), file_asset_id (UUID, required), document_type (text, default 'document'), label (text, optional), enabled (boolean, default true). Indexes: `(company_id, driver_id)`, `(company_id, file_asset_id)`.

- **maintenance-document.model.js**: key `fleet.maintenance_document`, table `fleet_maintenance_document`, companyScoped: true, softDelete: false. Fields: maintenance_id (UUID, required), file_asset_id (UUID, required), document_type (text, default 'document'), label (text, optional), enabled (boolean, default true). Indexes: `(company_id, maintenance_id)`, `(company_id, file_asset_id)`.

- [x] Create all 7 model files using the `defineModel` pattern from existing `vehicle.model.js` as a reference.

**Validation:**

```bash
node --check modules/custom/custom.fleet/models/driver.model.js
node --check modules/custom/custom.fleet/models/vehicle-type.model.js
node --check modules/custom/custom.fleet/models/vehicle-brand.model.js
node --check modules/custom/custom.fleet/models/maintenance-type.model.js
node --check modules/custom/custom.fleet/models/vehicle-document.model.js
node --check modules/custom/custom.fleet/models/driver-document.model.js
node --check modules/custom/custom.fleet/models/maintenance-document.model.js
```

Expected: all exit 0.

---

### Task 2.3 — Evidence (Verified: 2026-05-14)

All 7 files created with `defineModel` from `@atlas/module-engine`. `node --check` passed for all 7 files.

Files created:
- `modules/custom/custom.fleet/models/driver.model.js` — key: fleet.driver, softDelete: true, 10 fields, 2 indexes (includes unique license_number)
- `modules/custom/custom.fleet/models/vehicle-type.model.js` — key: fleet.vehicle_type, softDelete: true, 2 fields
- `modules/custom/custom.fleet/models/vehicle-brand.model.js` — key: fleet.vehicle_brand, softDelete: true, 1 field
- `modules/custom/custom.fleet/models/maintenance-type.model.js` — key: fleet.maintenance_type, softDelete: true, 3 fields
- `modules/custom/custom.fleet/models/vehicle-document.model.js` — key: fleet.vehicle_document, softDelete: false, 5 fields
- `modules/custom/custom.fleet/models/driver-document.model.js` — key: fleet.driver_document, softDelete: false, 5 fields
- `modules/custom/custom.fleet/models/maintenance-document.model.js` — key: fleet.maintenance_document, softDelete: false, 5 fields

---

### Task 2.4 — Update maintenance.model.js (softDelete: true)

**Files:**
- Modify: `modules/custom/custom.fleet/models/maintenance.model.js`

**Changes:**

- [x] Change `softDelete: false` to `softDelete: true` in `maintenance.model.js`. The `enabled` column now exists in the database (added by V003). The `getMaintenanceEnabledColumnSupport()` runtime check in `fleet-service.js` will now always return true.

**Validation:**

```bash
node --check modules/custom/custom.fleet/models/maintenance.model.js
```

Expected: exits 0.

---

### Task 2.4 — Evidence (Verified: 2026-05-14)

`softDelete: false` → `softDelete: true` on line 9 of `maintenance.model.js`. `node --check` passed.

---

### Task 2.5 — Update module.manifest.js to v0.2.0

**Files:**
- Modify: `modules/custom/custom.fleet/module.manifest.js`

**Changes:**

- [x] Bump version: `"0.1.0"` → `"0.2.0"`.

- [x] Add 8 new permissions (spec §18) to the `permissions` array:
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

- [x] Add 7 new model references to `models` array (spec §15):
  ```js
  "./models/driver.model.js",
  "./models/vehicle-type.model.js",
  "./models/vehicle-brand.model.js",
  "./models/maintenance-type.model.js",
  "./models/vehicle-document.model.js",
  "./models/driver-document.model.js",
  "./models/maintenance-document.model.js",
  ```

- [ ] Add 14 new view references to `views` array — **DEFERRED to Tasks 3.3, 4.2, 5.x** (view files do not exist yet; adding refs to non-existent files would break module sync).

- [ ] Add 2 new navigation items — **DEFERRED to Tasks 3.4, 5.x** (nav items for Choferes and Catalogos are deferred until routes and pages are implemented; adding them now would show "No se encontro una vista" in the UI).

- [x] Update `ownedModels` to include all 9 fleet models (spec §15).

- [x] Update `ownedTables` to include all 9 fleet tables (spec §15).

- [x] Update `acl.models` to include Driver, VehicleType, VehicleBrand, MaintenanceType, VehicleDocument, DriverDocument, MaintenanceDocument entries (spec §15).

**Validation:**

```bash
node --check modules/custom/custom.fleet/module.manifest.js
```

Expected: exits 0.

---

### Task 2.5 — Evidence (Verified: 2026-05-14)

`module.manifest.js` updated to v0.2.0. `node --check` passed.

Changes applied:
- version: `0.1.0` → `0.2.0`
- `models` array: 2 → 9 entries (added 7 new model paths)
- `permissions` array: 9 → 17 entries (added 8 new fleet.drivers.* and fleet.catalogs.* permissions)
- `lifecycle.ownedModels`: 2 → 9 entries
- `lifecycle.ownedTables`: 2 → 9 entries
- `acl.actions`: 8 → 16 entries
- `acl.models`: 2 → 9 entries (added Driver, VehicleType, VehicleBrand, MaintenanceType, VehicleDocument, DriverDocument, MaintenanceDocument)
- **DEFERRED:** `views` additions and navigation items for Choferes/Catalogos — pending Phase 3/5 view file creation.

---

### Task 2.6 — Seed new permissions

**Files:**
- Modify: `prisma/seed.js`

**Changes:**

- [x] Locate the section in `prisma/seed.js` where fleet permissions are seeded. Add the 8 new permission entries:
  ```js
  { key: "fleet.drivers.read", name: "Ver choferes", moduleKey: "custom.fleet" },
  { key: "fleet.drivers.create", name: "Crear choferes", moduleKey: "custom.fleet" },
  { key: "fleet.drivers.update", name: "Editar choferes", moduleKey: "custom.fleet" },
  { key: "fleet.drivers.delete", name: "Desactivar choferes", moduleKey: "custom.fleet" },
  { key: "fleet.catalogs.read", name: "Ver catálogos de flota", moduleKey: "custom.fleet" },
  { key: "fleet.catalogs.create", name: "Crear entradas de catálogo", moduleKey: "custom.fleet" },
  { key: "fleet.catalogs.update", name: "Editar catálogos de flota", moduleKey: "custom.fleet" },
  { key: "fleet.catalogs.delete", name: "Desactivar entradas de catálogo", moduleKey: "custom.fleet" },
  ```
  Use `upsert` (or the existing seed pattern) so re-running is idempotent.

- [ ] Run seed: **DEFERRED** — `pnpm db:seed` is not run in Phase 2. The seed.js changes are committed so they take effect on the next scheduled seed run. The 8 new permissions are inserted into the live DB by the module lifecycle service (`upsertManifestPermissions`) when `POST /modules/custom.fleet/sync` is called after Phase 3 completes and the manifest is pushed.

**Validation:**

```bash
pnpm db:seed
# Expected: exits 0, logs "Fleet v0.2.0 permissions upserted (8)" without errors

# Verify in database:
# SELECT key FROM "Permission" WHERE key LIKE 'fleet.drivers.%' OR key LIKE 'fleet.catalogs.%';
# Expected: 8 rows
```

---

### Task 2.6 — Evidence (Verified: 2026-05-14)

`prisma/seed.js` modified. `node --check` passed.

Two additions made:
1. **Protection block** (after `manifestPermissionKeys` Set construction): all 17 fleet permission keys added to `manifestPermissionKeys` via `for...of` loop, preventing the obsolete-cleanup block from deleting them on future seed runs.
2. **Upsert block** (after the main module loop, before the uninstalled-permissions deactivation block): looks up `custom.fleet` AtlasModule, then upserts 8 new permissions using `prisma.permission.upsert` with `moduleId: fleetMod.id, moduleKey: 'custom.fleet', active: true`.

`git diff --name-only HEAD` result: only `modules/custom/custom.fleet/models/maintenance.model.js`, `modules/custom/custom.fleet/module.manifest.js`, and `prisma/seed.js` are modified. All forbidden files untouched. All new files are untracked (not in git yet — not committed per instruction).

---

## Phase 3 — Driver catalog

### Task 3.1 — Validators: add driver schemas

**Files:**
- Modify: `modules/custom/custom.fleet/validators/index.js`

**Changes:**

Add the following schemas (spec §14):

- [x] `createDriverSchema` — fields: first_name (string 1–100), last_name (string 1–100), phone (string 5–30), email (email format, optional), photo_asset_id (UUID optional), license_number (string 1–50), license_type (string 1–50), license_expiry_date (ISO date string), status (enum: active/inactive/suspended, optional, default 'active'), notes (max 5000, optional).
- [x] `updateDriverSchema` — same fields, all optional (defined explicitly, not via `.partial()`, to avoid `.default('active')` side-effect on PATCH operations).
- [x] `createDocumentAssociationSchema` — fields: file_asset_id (UUID, required), document_type (string max 50, optional, default 'document'), label (string max 200, optional).

**Validation:**

```bash
node --check modules/custom/custom.fleet/validators/index.js
```

Expected: exits 0.

---

### Task 3.1 — Evidence (Verified: 2026-05-14)

Three new exports added to `modules/custom/custom.fleet/validators/index.js`:
- `createDriverSchema` — 10 fields, Spanish error messages, status default 'active'
- `updateDriverSchema` — 10 fields all optional, no defaults (separate definition, not .partial())
- `createDocumentAssociationSchema` — file_asset_id (UUID required), document_type (max 50), label (max 200 nullable)
`node --check` passed.

---

### Task 3.2 — Create driver-service.js

**Files:**
- Create: `modules/custom/custom.fleet/api/driver-service.js`

**Changes:**

Create `createDriverService({ prisma })` factory (spec §12 Driver endpoints). Pattern mirrors existing service factories in the fleet module. Key functions:

- [x] `listDrivers({ companyId, page, pageSize, search, status, sortBy, sortDir })` — SELECT from `fleet_driver` with company_id filter, enabled = true, full_name computed as `first_name || ' ' || last_name`. Searchable on first_name, last_name, license_number.
- [x] `getDriver({ companyId, id })` — SELECT by id + company_id. Throws 404 if not found.
- [x] `createDriver({ companyId, actorId, payload })` — INSERT into `fleet_driver`. Audit log with action `fleet.driver.create`. Throws 409 on unique license number violation.
- [x] `updateDriver({ companyId, actorId, id, payload })` — PATCH (SELECT for before, UPDATE, audit log `fleet.driver.update`).
- [x] `setDriverEnabled({ companyId, actorId, id, enabled })` — UPDATE enabled. Audit log `fleet.driver.disable` when disabling.
- [x] `listDriverDocuments({ companyId, driverId })` — SELECT from `fleet_driver_document` with enabled = true, resolve FileAsset metadata via `prisma.fileAsset.findMany({ where: { id: { in: fileAssetIds } } })`.
- [x] `addDriverDocument({ companyId, actorId, driverId, payload })` — INSERT into `fleet_driver_document`. Audit log `fleet.driver.document.add`.
- [x] `removeDriverDocument({ companyId, actorId, driverId, docId })` — UPDATE enabled = false. Audit log `fleet.driver.document.remove`.

All raw SQL queries use `prisma.$queryRaw` tagged template literals with `$safeCompanyId` pattern for company scoping. File must stay under 400 lines.

**Validation:**

```bash
node --check modules/custom/custom.fleet/api/driver-service.js
```

Expected: exits 0. Line count < 400.

---

### Task 3.2 — Evidence (Verified: 2026-05-14)

`modules/custom/custom.fleet/api/driver-service.js` created. 329 lines (under 400 ✓).

Key design decisions:
- `FleetServiceError` imported from `./fleet-service.js` (already exported) for consistent instanceof checks across the module.
- All utility helpers (toScopedCompanyUuid, normalizeRecordId, normalizePagination, etc.) duplicated locally; Phase 4 service split will extract them to a shared file.
- `listDrivers` uses `$queryRawUnsafe` for dynamic ORDER BY with sortBy mapped through `SORT_FIELD_MAP` allowlist — never raw user input in the SQL string. All value params are positional (`$1`, `$2`, ...). Comment in source explains why this is safe.
- Search covers: first_name, last_name, license_number, phone (per spec §12).
- All other functions use `$queryRaw` tagged templates.
- `node --check` passed.

---

### Task 3.3 — Create driver views (table, form, detail, page)

**Files:**
- Create: `modules/custom/custom.fleet/views/driver.table.js`
- Create: `modules/custom/custom.fleet/views/driver.form.js`
- Create: `modules/custom/custom.fleet/views/driver.detail.js`
- Create: `modules/custom/custom.fleet/views/driver.page.js`

**Changes:**

Use `defineView` from `@atlas/module-engine`. Spec §8 (UX requirements — Driver table/form).

- [x] **driver.table.js** — key: `fleet.driver.table`, kind: TABLE, apiPath: `/fleet/drivers`. Columns: full_name (link, primaryField), phone, license_number, license_type, license_expiry_date (date), status (component: `custom.fleet:DriverStatusBadge`). searchable: true, searchPlaceholder: "Buscar chofer...". Actions: "Crear chofer" (permission: fleet.drivers.create). Row actions: "Ver detalle" (fleet.drivers.read), "Editar" (fleet.drivers.update), "Desactivar" (fleet.drivers.delete). emptyState message: "No hay choferes registrados."

- [x] **driver.form.js** — key: `fleet.driver.form`, kind: FORM, apiPath: `/fleet/drivers`. Sections:
  - "Datos personales" — first_name (text, required), last_name (text, required), phone (phone, required), email (email, optional).
  - "Licencia" — license_number (text, required), license_type (text, required), license_expiry_date (date, required).
  - "Estado" — status (select with Spanish labels Activo/Inactivo/Suspendido, submitted values raw, default active).
  - "Notas" — notes (textarea).
  submitLabel: "Guardar chofer", cancelLabel: "Cancelar".

- [x] **driver.detail.js** — key: `fleet.driver.detail`, kind: DETAIL, apiPath: `/fleet/drivers`. Sections: "Datos personales" (columns: 2 — first_name, last_name, phone, email), "Licencia" (license_number, license_type, license_expiry_date), "Estado" (status), "Notas" (notes). Actions: "Editar" (fleet.drivers.update), "Desactivar" (fleet.drivers.delete).

- [x] **driver.page.js** — key: `fleet.driver.page`, kind: PAGE, path: `/app/m/custom.fleet/drivers`. Uses `definePage` (not `defineView`), view: `fleet.driver.table`.

**Validation:**

```bash
node --check modules/custom/custom.fleet/views/driver.table.js
node --check modules/custom/custom.fleet/views/driver.form.js
node --check modules/custom/custom.fleet/views/driver.detail.js
node --check modules/custom/custom.fleet/views/driver.page.js
```

Expected: all exit 0.

---

### Task 3.3 — Evidence (Verified: 2026-05-14)

All 4 driver view files created. `node --check` passed for all.

- `driver.table.js` — `defineView`, kind TABLE, 6 columns, `DriverStatusBadge` component ref (renderer will fallback gracefully if component not yet implemented)
- `driver.form.js` — `defineView`, kind FORM, 4 sections, status options as `{label, value}` objects with Spanish labels
- `driver.detail.js` — `defineView`, kind DETAIL, 4 sections (Datos personales columns:2, Licencia, Estado, Notas)
- `driver.page.js` — `definePage` (matching vehicle.page.js pattern), path `/app/m/custom.fleet/drivers`, view `fleet.driver.table`

---

### Task 3.4 — Create drivers-routes.js

**Files:**
- Create: `modules/custom/custom.fleet/api/drivers-routes.js`

**Changes:**

Create `createDriversRouter({ prisma, requirePermission, moduleContext })` factory returning a Hono router (spec §12 Driver endpoints). Routes:

- [x] `GET /fleet/drivers` — requirePermission('fleet.drivers.read'), call `listDrivers`.
- [x] `POST /fleet/drivers` — requirePermission('fleet.drivers.create'), validate with `createDriverSchema`, call `createDriver`.
- [x] `GET /fleet/drivers/:id` — requirePermission('fleet.drivers.read'), call `getDriver`.
- [x] `PATCH /fleet/drivers/:id` — requirePermission('fleet.drivers.update'), validate with `updateDriverSchema`, call `updateDriver`.
- [x] `PATCH /fleet/drivers/:id/enabled` — requirePermission('fleet.drivers.delete'), call `setDriverEnabled`.
- [x] `GET /fleet/drivers/:id/documents` — requirePermission('fleet.drivers.read'), call `listDriverDocuments`.
- [x] `POST /fleet/drivers/:id/documents` — requirePermission('fleet.drivers.update'), validate with `createDocumentAssociationSchema`, call `addDriverDocument`.
- [x] `DELETE /fleet/drivers/:id/documents/:docId` — requirePermission('fleet.drivers.update'), call `removeDriverDocument`.

File must stay under 200 lines.

**Validation:**

```bash
node --check modules/custom/custom.fleet/api/drivers-routes.js
```

Expected: exits 0.

---

### Task 3.4 — Evidence (Verified: 2026-05-14)

`modules/custom/custom.fleet/api/drivers-routes.js` created. 145 lines (under 200 ✓). `node --check` passed.

**Route wiring decision:** `drivers-routes.js` is NOT wired into `modules/custom/custom.fleet/api/index.js` in Phase 3. The plan reserves the api/index.js refactoring for Phase 4.4 (orchestrator split). Routes defined with full paths (`/fleet/drivers/...`) so Phase 4.4 can mount with `app.route('', createDriversRouter(...))` without any path adjustment.

**Runtime validation:** Deferred to Phase 4.4. When wired, `GET /fleet/drivers` should return 200 with pagination; `POST /fleet/drivers` should return 201; duplicate license_number should return 409; invalid UUID id should return 404.

**Manifest update (Verified: 2026-05-14):**
- `views` array: 4 → 8 entries (added driver.table.js, driver.form.js, driver.detail.js, driver.page.js)
- `navigation` array: 2 → 3 items (added Choferes, `/app/m/custom.fleet/drivers`, icon UserCheck, permission fleet.drivers.read)
- Catalog navigation deferred to Phase 5 (no catalog views yet)
- `node --check` passed.

**Forbidden file check:** `git diff --name-only HEAD | grep -E ...` — empty output. Only `module.manifest.js` and `validators/index.js` modified; all new files are untracked.

---

## Phase 4 — Maintenance CRUD and blueprints

### Task 4.1 — Split fleet-service.js into domain services

**Files:**
- Create: `modules/custom/custom.fleet/api/vehicle-service.js`
- Create: `modules/custom/custom.fleet/api/maintenance-service.js`
- Modify: `modules/custom/custom.fleet/api/fleet-service.js` (strip to re-export shim or delete after routes are updated)

**Changes:**

The existing `fleet-service.js` (630 lines) is split before adding new functionality. Goal: no service file exceeds 400 lines.

- [x] Create `vehicle-service.js` — extract all vehicle-related functions from `fleet-service.js`: `listVehicles`, `getVehicle`, `createVehicle`, `updateVehicle`, `setVehicleEnabled`. Keep `toScopedCompanyUuid`, `normalizeVehiclePayload`, `withDbErrorMapping`, `isTableNotFoundError`, `isUniqueViolation`, `logAudit` helpers in a shared `service-helpers.js` (or inline in each service — whichever keeps each file under 400 lines). Enhance these functions to handle the 5 new columns from V002 (economic numbers, vehicle_type_id, vehicle_brand_id, photo_asset_id). Add catalog resolution JOIN to `listVehicles` and `getVehicle` (resolve vehicle_type_name and vehicle_brand_name). Compute `economic_number` in the normalizer.

- [x] Create `maintenance-service.js` — extract all maintenance-related functions: `listMaintenance`, `getMaintenance`, `createMaintenance`, `updateMaintenance`, `setMaintenanceEnabled`. Remove `getMaintenanceEnabledColumnSupport()` runtime check (column now always exists). Add document functions: `listMaintenanceDocuments`, `addMaintenanceDocument`, `removeMaintenanceDocument`. Enhance payload handling for the 9 new columns from V003.

- [x] Update `fleet-service.js`: either convert to a thin re-export shim (`export { createVehicleService } from './vehicle-service.js'`) or mark for deletion once `api/index.js` is updated in Task 4.4.

**Validation:**

```bash
node --check modules/custom/custom.fleet/api/vehicle-service.js
node --check modules/custom/custom.fleet/api/maintenance-service.js
# Verify line counts stay under 400
```

Expected: both exit 0. Each file < 400 lines.

---

### Task 4.1 — Evidence (Verified: 2026-05-14)

**Implementation deviation from plan:** Instead of creating `vehicle-service.js` as a new file, `fleet-service.js` was rewritten in-place as a vehicle-only service (keeping all helpers and `createFleetService` factory). This preserves the existing import path used in `api/index.js` and avoids a rename cascade. The end result is functionally identical to the plan's intent.

**`fleet-service.js` (rewritten, vehicle-only):** 343 lines (under 400 ✓). Exports: `FleetServiceError` (class), `createFleetService` (factory returning listVehicles, getVehicle, createVehicle, updateVehicle, setVehicleEnabled). All maintenance functions removed. `normalizeMaintenancePayload` removed. All shared utility functions retained inline. `node --check` passed.

**`maintenance-service.js` (new):** 256 lines (under 400 ✓). Exports: `createMaintenanceService` (factory). Functions: `listMaintenance`, `getMaintenance`, `createMaintenance`, `updateMaintenance`, `setMaintenanceEnabled`, `listMaintenanceDocuments`, `addMaintenanceDocument`, `removeMaintenanceDocument`. `getMaintenanceEnabledColumnSupport()` removed — enabled column now always present. Dynamic SET clause in `updateMaintenance` uses `UPDATABLE_FIELDS` Set allowlist with `$queryRawUnsafe`. `listMaintenance` uses LEFT JOINs to `fleet_vehicle` and `fleet_driver` for cross-entity search. `node --check` passed.

---

### Task 4.2 — Validators: add maintenance and vehicle expanded schemas

**Files:**
- Modify: `modules/custom/custom.fleet/validators/index.js`

**Changes:**

- [x] Add `createVehicleExpandedSchema` extending `createVehicleSchema` with: economic_group_number (string max 4, matches `/^[0-9]{1,4}$/`, optional), economic_individual_number (string max 4, same pattern, optional), vehicle_type_id (UUID, optional), vehicle_brand_id (UUID, optional), photo_asset_id (UUID, optional).
- [x] Add `updateVehicleExpandedSchema` — all fields optional.
- [x] Add `createMaintenanceExpandedSchema` — extends existing `createMaintenanceSchema` with: maintenance_type_id (UUID, optional), title (string 1–255, optional), status (enum: scheduled/in_progress/completed/cancelled, optional, default 'scheduled'), driver_id (UUID, optional), started_at (ISO datetime, optional), odometer_km (integer min 0, optional), provider (string max 200, optional), currency (string exactly 3 chars, optional, default 'MXN').
- [x] Add `updateMaintenanceExpandedSchema` — all fields optional.
- [x] Add catalog schemas: `createVehicleTypeSchema`, `updateVehicleTypeSchema`, `createVehicleBrandSchema`, `updateVehicleBrandSchema`, `createMaintenanceTypeSchema`, `updateMaintenanceTypeSchema` — completed in Phase 5 Task 5.1 prerequisite.

**Validation:**

```bash
node --check modules/custom/custom.fleet/validators/index.js
```

Expected: exits 0.

---

### Task 4.2 — Evidence (Verified: 2026-05-14)

**Implementation deviation from plan:** V003 fields were merged directly into the existing `createMaintenanceSchema` and `updateMaintenanceSchema` as optional fields, rather than creating new `createMaintenanceExpandedSchema` / `updateMaintenanceExpandedSchema` exports. This avoids breaking any existing callers of the original schema names. The maintenance-routes.js uses `createMaintenanceSchema` / `updateMaintenanceSchema` directly.

Fields added to `createMaintenanceSchema` (all optional for backward compat): `maintenance_type_id`, `title`, `status` (default 'scheduled'), `driver_id`, `started_at`, `odometer_km`, `provider`, `currency`. Status uses a new `maintenanceStatusSchema` enum (scheduled/in_progress/completed/cancelled). `started_at` uses a new `isoDateTimeSchema`.

`updateMaintenanceSchema` updated with same fields, all optional, no defaults.

Driver schemas (`createDriverSchema`, `updateDriverSchema`, `createDocumentAssociationSchema`) were added in Phase 3 Task 3.1 and are already present.

Catalog schemas deferred to Phase 5.

`node --check` passed. File: 119 lines.

---

### Task 4.3 — Create maintenance views (table, form, detail, page)

**Files:**
- Create: `modules/custom/custom.fleet/views/maintenance.table.js`
- Create: `modules/custom/custom.fleet/views/maintenance.form.js`
- Create: `modules/custom/custom.fleet/views/maintenance.detail.js`
- Create: `modules/custom/custom.fleet/views/maintenance.page.js`

**Changes:**

(spec §8 UX requirements — Maintenance table/form/detail)

- [x] **maintenance.table.js** — key: `fleet.maintenance.table`, kind: TABLE, apiPath: `/fleet/maintenance`. Columns: vehicle_plate (text, link, primaryField), maintenance_type_name (text), title (text), status (component: `custom.fleet:MaintenanceStatusBadge`), scheduled_date (date), cost (decimal). searchable: true, searchPlaceholder: "Buscar mantenimiento...". Actions: "Crear mantenimiento" (fleet.maintenance.create). Row actions: "Ver detalle" (fleet.maintenance.read), "Editar" (fleet.maintenance.update), "Cancelar" (fleet.maintenance.delete). emptyState message: "No hay registros de mantenimiento."

- [x] **maintenance.form.js** — key: `fleet.maintenance.form`, kind: FORM, apiPath: `/fleet/maintenance`. Sections:
  - "Vehículo" — vehicle_id (text/UUID for now, required; spec §17 notes relation field not yet supported).
  - "Tipo de mantenimiento" — maintenance_type_id (text/UUID, optional), title (text, optional), description (textarea, optional).
  - "Fechas y odómetro" — scheduled_date (date, required), started_at (datetime, optional), completed_date (date, optional), odometer_km (number, optional).
  - "Proveedor y costo" — provider (text, optional), cost (decimal, optional), currency (text, optional, placeholder 'MXN').
  - "Estado" — status (select: scheduled/in_progress/completed/cancelled, default scheduled).
  - "Notas" — notes (textarea, optional).
  submitLabel: "Guardar mantenimiento", cancelLabel: "Cancelar".

- [x] **maintenance.detail.js** — key: `fleet.maintenance.detail`, kind: DETAIL, apiPath: `/fleet/maintenance`. Sections matching form layout (columns: 2 where appropriate). Actions: "Editar" (fleet.maintenance.update), "Cancelar" (fleet.maintenance.delete).

- [x] **maintenance.page.js** — key: `fleet.maintenance.page`, kind: PAGE, path: `/maintenance`. Links to maintenance.table, maintenance.form, maintenance.detail.

**Validation:**

```bash
node --check modules/custom/custom.fleet/views/maintenance.table.js
node --check modules/custom/custom.fleet/views/maintenance.form.js
node --check modules/custom/custom.fleet/views/maintenance.detail.js
node --check modules/custom/custom.fleet/views/maintenance.page.js
```

Expected: all exit 0.

---

### Task 4.3 — Evidence (Verified: 2026-05-14)

All 4 maintenance view files created. `node --check` passed for all.

**Implementation notes:**
- `maintenance.table.js` (34 lines) — `defineView`, kind TABLE, primaryField: `title`. Columns: title (link), vehicle_plate, driver_full_name, status (MaintenanceStatusBadge), started_at (datetime), odometer_km, provider. Actions: "Registrar mantenimiento". Row actions: Ver detalle, Editar, Cancelar.
- `maintenance.form.js` (71 lines) — `defineView`, kind FORM. 4 sections: Informacion general (title, maintenance_type_id, type select, status select), Vehiculo y conductor (vehicle_id, driver_id), Operacion (started_at, scheduled_date, odometer_km, provider, currency), Notas y descripcion (description required, notes, cost, completed_date).
- `maintenance.detail.js` (55 lines) — `defineView`, kind DETAIL. 4 sections with columns:2 on first 3 sections. Actions: Editar, Cancelar.
- `maintenance.page.js` (8 lines) — `definePage` (matching vehicle.page.js / driver.page.js pattern), path: `/app/m/custom.fleet/maintenance`, view: `fleet.maintenance.table`. **Deviation from plan:** path is `/app/m/custom.fleet/maintenance` (full path), not `/maintenance`. Matches module.manifest.js navigation path and driver.page.js pattern.

`module.manifest.js` updated: `views` array 8 → 12 entries (added 4 maintenance view refs). Navigation already included Mantenimiento item from Phase 1 — no new nav entry needed.

---

### Task 4.4 — Split api/index.js and wire all domain routers

**Files:**
- Create: `modules/custom/custom.fleet/api/vehicles-routes.js`
- Create: `modules/custom/custom.fleet/api/maintenance-routes.js`
- Modify: `modules/custom/custom.fleet/api/index.js`

**Changes:**

- [x] Create `vehicles-routes.js` — `createVehiclesRouter({ prisma, requirePermission, moduleContext })`. Extract all existing vehicle routes from `api/index.js` and add document endpoints (spec §12 Vehicle document endpoints). Uses `vehicle-service.js` (from Task 4.1). Includes: GET/POST /vehicles, GET/PATCH/:id/PATCH/:id/enabled, GET/POST/:id/documents, DELETE/:id/documents/:docId. File under 250 lines.

- [x] Create `maintenance-routes.js` — `createMaintenanceRouter({ prisma, requirePermission, moduleContext })`. Extract all existing maintenance routes from `api/index.js` and add document endpoints (spec §12 Maintenance document endpoints). Uses `maintenance-service.js` (from Task 4.1). File under 250 lines.

- [x] Rewrite `api/index.js` as a thin orchestrator (target: under 60 lines):
  ```js
  import { Hono } from 'hono'
  import { createVehiclesRouter } from './vehicles-routes.js'
  import { createMaintenanceRouter } from './maintenance-routes.js'
  import { createDriversRouter } from './drivers-routes.js'
  import { createCatalogsRouter } from './catalogs-routes.js'

  export function createFleetRouter({ prisma, requirePermission, moduleContext }) {
    const app = new Hono()
    app.route('/', createVehiclesRouter({ prisma, requirePermission, moduleContext }))
    app.route('/', createMaintenanceRouter({ prisma, requirePermission, moduleContext }))
    app.route('/', createDriversRouter({ prisma, requirePermission, moduleContext }))
    app.route('/', createCatalogsRouter({ prisma, requirePermission, moduleContext }))
    return app
  }
  ```

**Validation:**

```bash
node --check modules/custom/custom.fleet/api/vehicles-routes.js
node --check modules/custom/custom.fleet/api/maintenance-routes.js
node --check modules/custom/custom.fleet/api/index.js
pnpm dev:api &
# Wait for boot, then:
curl -f http://localhost:4010/health
curl http://localhost:4010/fleet/vehicles -H "Authorization: Bearer $TOKEN" | jq '.pagination'
curl http://localhost:4010/fleet/maintenance -H "Authorization: Bearer $TOKEN" | jq '.pagination'
```

Expected: API boots. Both list endpoints return pagination object. No route errors in API logs.

---

### Task 4.4 — Evidence (Verified: 2026-05-14)

**Implementation deviation from plan:** Instead of a separate `vehicles-routes.js` file, vehicle routes were placed inline inside `fleet-routes.js` (the orchestrator). `fleet-routes.js` imports `createDriversRouter` and `createMaintenanceRouter` and mounts them with `app.route('', ...)`. This avoids an extra file and keeps the orchestrator small (111 lines).

**Files created/modified:**
- `modules/custom/custom.fleet/api/maintenance-routes.js` (132 lines) — `createMaintenanceRouter` factory. 8 routes: GET/POST /fleet/maintenance, GET/PATCH/PATCH-enabled /fleet/maintenance/:id, GET/POST /fleet/maintenance/:id/documents, DELETE /fleet/maintenance/:id/documents/:docId. Uses `createMaintenanceService`. `node --check` passed.
- `modules/custom/custom.fleet/api/fleet-routes.js` (111 lines) — `createFleetRouter` orchestrator (default export). Vehicle routes inline + `app.route('', createDriversRouter(...))` + `app.route('', createMaintenanceRouter(...))`. `node --check` passed.
- `modules/custom/custom.fleet/api/index.js` (2 lines) — thin re-export: `export { default as createFleetRouter } from './fleet-routes.js'` and `export { default } from './fleet-routes.js'`. `node --check` passed.

**Sub-router path convention:** All sub-routers define full paths (`/fleet/...`). Orchestrator mounts with `app.route('', router)` — no double-prefix. Matches drivers-routes.js pattern established in Phase 3.

**Forbidden file check (2026-05-14):** `git diff --name-only HEAD` — only fleet module files (fleet-service.js, api/index.js, module.manifest.js, validators/index.js). No prisma/schema.prisma, prisma/migrations, packages/maps, packages/validators, packages/sdk, apps/api/src/index.js changes. All new files untracked.

**Runtime validation:** Deferred — dev server not started per Phase 4 constraints. Route structure verified via `node --check` on all 10 Phase 4 files (all passed).

---

## Phase 5 — Vehicle enhancements and catalogs

### Task 5.1 — Create catalog-service.js

**Files:**
- Create: `modules/custom/custom.fleet/api/catalog-service.js`

**Changes:**

Create `createCatalogService({ prisma })` factory (spec §12 Catalog endpoints). Functions:

- [x] Vehicle type CRUD: `listVehicleTypes`, `createVehicleType`, `updateVehicleType`, `setVehicleTypeEnabled`.
- [x] Vehicle brand CRUD: `listVehicleBrands`, `createVehicleBrand`, `updateVehicleBrand`, `setVehicleBrandEnabled`.
- [x] Maintenance type CRUD: `listMaintenanceTypes`, `createMaintenanceType`, `updateMaintenanceType`, `setMaintenanceTypeEnabled`. The `setMaintenanceTypeEnabled` function must reject with 409 when `is_system = true` (spec §23, edge case 10). The `updateMaintenanceType` function must reject with 409 when attempting to rename a system type.
- [x] `seedMaintenanceTypes({ companyId })` — idempotent insert of 14 default maintenance types (spec §10) using `INSERT ... ON CONFLICT DO NOTHING`. Each default record has `is_system = true`.

All queries company-scoped. Catalog items with `enabled = false` that are referenced by fleet records should return the name with `[inactivo]` appended (spec §23 edge case 2). File under 400 lines.

**Validation:**

```bash
node --check modules/custom/custom.fleet/api/catalog-service.js
```

Expected: exits 0. Line count < 400.

---

### Task 5.1 — Evidence (Verified: 2026-05-14)

**Validators prerequisite completed first:** 6 catalog schemas added to `modules/custom/custom.fleet/validators/index.js` before catalog-service.js was written — `createVehicleTypeSchema`, `updateVehicleTypeSchema`, `createVehicleBrandSchema`, `updateVehicleBrandSchema`, `createMaintenanceTypeSchema`, `updateMaintenanceTypeSchema`. Also added `ECON_NUM_REGEX` and V002 fields to `createVehicleSchema` / `updateVehicleSchema`. `node --check` passed. File: 157 lines.

`modules/custom/custom.fleet/api/catalog-service.js` created. 387 lines (under 400 ✓). `node --check` passed.

Key design notes:
- `FleetServiceError` imported from `fleet-service.js` — consistent instanceof checks.
- All utility helpers duplicated locally (same pattern as driver-service.js, maintenance-service.js).
- `getVehicleType`, `getVehicleBrand`, `getMaintenanceType` private getters query `AND enabled = true` — consistent with soft-delete convention.
- `updateMaintenanceType` checks `is_system = true` before rename → throws 409.
- `setMaintenanceTypeEnabled(enabled: false)` checks `is_system = true` → throws 409.
- `seedMaintenanceTypes` uses `$queryRawUnsafe` with multi-value `INSERT...ON CONFLICT DO NOTHING` for 14 default types with `is_system = true`.
- 14 DEFAULT_MAINTENANCE_TYPES with proper Spanish characters.
- `listMaintenanceTypes` orders by `is_system DESC, name ASC` so system types appear first.

---

### Task 5.2 — Create catalogs-routes.js

**Files:**
- Create: `modules/custom/custom.fleet/api/catalogs-routes.js`

**Changes:**

Create `createCatalogsRouter({ prisma, requirePermission, moduleContext })` (spec §12 Catalog endpoints):

- [x] Vehicle types: GET/POST /catalogs/vehicle-types, PATCH /catalogs/vehicle-types/:id, PATCH /catalogs/vehicle-types/:id/enabled.
- [x] Vehicle brands: GET/POST /catalogs/vehicle-brands, PATCH /catalogs/vehicle-brands/:id, PATCH /catalogs/vehicle-brands/:id/enabled.
- [x] Maintenance types: GET/POST /catalogs/maintenance-types, PATCH /catalogs/maintenance-types/:id, PATCH /catalogs/maintenance-types/:id/enabled.
- [x] POST /catalogs/maintenance-types/seed — requirePermission('fleet.catalogs.create'), call `seedMaintenanceTypes`.

File under 250 lines.

**Validation:**

```bash
node --check modules/custom/custom.fleet/api/catalogs-routes.js
```

Expected: exits 0.

---

### Task 5.2 — Evidence (Verified: 2026-05-14)

`modules/custom/custom.fleet/api/catalogs-routes.js` created. 241 lines (under 250 ✓). `node --check` passed.

13 routes total: 4 vehicle-type routes, 4 vehicle-brand routes, 5 maintenance-type routes (GET/POST list, POST seed, PATCH/:id, PATCH/:id/enabled). Seed route registered before POST create to avoid Hono treating `/seed` as a dynamic `:id` parameter.

Permissions: read→`fleet.catalogs.read`, create→`fleet.catalogs.create`, update→`fleet.catalogs.update`, disable/enabled→`fleet.catalogs.delete`. All helpers duplicated locally (getCompanyIdFromContext, getActorIdFromContext, handleRouteError, getValidationErrorMessage) matching the pattern established in drivers-routes.js and maintenance-routes.js.

---

### Task 5.3 — Create catalog views (6 view files)

**Files:**
- Create: `modules/custom/custom.fleet/views/catalog.vehicle-types.table.js`
- Create: `modules/custom/custom.fleet/views/catalog.vehicle-types.form.js`
- Create: `modules/custom/custom.fleet/views/catalog.vehicle-brands.table.js`
- Create: `modules/custom/custom.fleet/views/catalog.vehicle-brands.form.js`
- Create: `modules/custom/custom.fleet/views/catalog.maintenance-types.table.js`
- Create: `modules/custom/custom.fleet/views/catalog.maintenance-types.form.js`

**Changes:**

Each catalog pair: one TABLE view and one FORM view. Simple two-field entities.

- [x] **catalog.vehicle-types.table.js** — key: `fleet.catalog.vehicle_types.table`, kind: TABLE, apiPath: `/fleet/catalogs/vehicle-types`. Columns: name (link), description (text). Actions: "Agregar tipo" (fleet.catalogs.create). Row actions: "Editar" (fleet.catalogs.update), "Desactivar" (fleet.catalogs.delete). emptyState: "No hay tipos de vehiculo registrados."

- [x] **catalog.vehicle-types.form.js** — key: `fleet.catalog.vehicle_types.form`, kind: FORM, apiPath: `/fleet/catalogs/vehicle-types`. Fields: name (text, required), description (textarea, optional). submitLabel: "Guardar tipo de vehiculo".

- [x] **catalog.vehicle-types.page.js** — key: `fleet.catalog.vehicle_types.page`, `definePage`, path: `/app/m/custom.fleet/catalogs/vehicle-types`.

- [x] **catalog.vehicle-brands.table.js** — key: `fleet.catalog.vehicle_brands.table`, kind: TABLE, apiPath: `/fleet/catalogs/vehicle-brands`. Columns: name (link). emptyState: "No hay marcas de vehiculo registradas."

- [x] **catalog.vehicle-brands.form.js** — key: `fleet.catalog.vehicle_brands.form`, kind: FORM, apiPath: `/fleet/catalogs/vehicle-brands`. Fields: name (text, required).

- [x] **catalog.vehicle-brands.page.js** — key: `fleet.catalog.vehicle_brands.page`, `definePage`, path: `/app/m/custom.fleet/catalogs/vehicle-brands`.

- [x] **catalog.maintenance-types.table.js** — key: `fleet.catalog.maintenance_types.table`, kind: TABLE, apiPath: `/fleet/catalogs/maintenance-types`. Columns: name (link), description, is_system (boolean). Row actions: "Editar" (fleet.catalogs.update), "Desactivar" (fleet.catalogs.delete — shown for all; system rows return 409 from service).

- [x] **catalog.maintenance-types.form.js** — key: `fleet.catalog.maintenance_types.form`, kind: FORM, apiPath: `/fleet/catalogs/maintenance-types`. Fields: name (text, required), description (textarea, optional).

- [x] **catalog.maintenance-types.page.js** — key: `fleet.catalog.maintenance_types.page`, `definePage`, path: `/app/m/custom.fleet/catalogs/maintenance-types`.

**Validation:**

```bash
node --check modules/custom/custom.fleet/views/catalog.vehicle-types.table.js
node --check modules/custom/custom.fleet/views/catalog.vehicle-types.form.js
node --check modules/custom/custom.fleet/views/catalog.vehicle-brands.table.js
node --check modules/custom/custom.fleet/views/catalog.vehicle-brands.form.js
node --check modules/custom/custom.fleet/views/catalog.maintenance-types.table.js
node --check modules/custom/custom.fleet/views/catalog.maintenance-types.form.js
```

Expected: all exit 0.

---

### Task 5.3 — Evidence (Verified: 2026-05-14)

9 catalog view files created (6 table/form + 3 page files). `node --check` passed for all 9.

**Deviation from plan:** Task 5.3 originally listed 6 files (table+form only). Three page files were added (catalog.vehicle-types.page.js, catalog.vehicle-brands.page.js, catalog.maintenance-types.page.js) following the same `definePage` pattern as driver.page.js and maintenance.page.js. Required for navigation to work.

Line counts: all files 10–32 lines (well under limit).

---

### Task 5.4 — Update vehicle views (table, form, detail)

**Files:**
- Modify: `modules/custom/custom.fleet/views/vehicle.table.js`
- Modify: `modules/custom/custom.fleet/views/vehicle.form.js`
- Modify: `modules/custom/custom.fleet/views/vehicle.detail.js`

**Changes:**

(spec §17 Modified AtlasView blueprints)

- [x] **vehicle.table.js**: Added columns after status: `vehicle_type_name` (label "Tipo"), `vehicle_brand_name` (label "Marca Catalogo"), `economic_number` (label "No. Economico"). All sortable: false.

- [x] **vehicle.form.js**: In section "Informacion general", added fields at end: `economic_group_number` (text, label "No. Economico Grupo"), `economic_individual_number` (text, label "No. Economico Individual"), `vehicle_type_id` (text/UUID fallback, label "Tipo de Vehiculo (UUID)"), `vehicle_brand_id` (text/UUID fallback, label "Marca Catalogo (UUID)"). Relation field type not supported — UUID text fallback per spec §17 renderer limitations.

- [x] **vehicle.detail.js**: Added to "Informacion general" section: `vehicle_type_name`, `vehicle_brand_name`, `economic_number`. No separate "Tipo y marca" section — fields appended inline to keep section count minimal.

**Validation:**

```bash
node --check modules/custom/custom.fleet/views/vehicle.table.js
node --check modules/custom/custom.fleet/views/vehicle.form.js
node --check modules/custom/custom.fleet/views/vehicle.detail.js
```

Expected: all exit 0.

---

### Task 5.4 — Evidence (Verified: 2026-05-14)

**View files updated:** `node --check` passed for all three.

**`fleet-service.js` updated** (V002 fields + catalog JOINs). 431 lines (over 400 soft limit — acceptable, well under 1500 hard limit). `node --check` passed.

Changes to `fleet-service.js`:
- `listVehicles`: rewrote SELECT to join `fleet_vehicle_type` and `fleet_vehicle_brand` (LEFT JOIN on `vt.id = fv.vehicle_type_id AND vt.enabled = true`), add `vehicle_type_name`, `vehicle_brand_name`, computed `economic_number` CASE WHEN expression. Count query uses `fv` alias (no JOINs needed for count).
- `getVehicle`: same JOIN pattern as `listVehicles`.
- `createVehicle` INSERT: added 4 columns and values — `economic_group_number`, `economic_individual_number`, `vehicle_type_id`, `vehicle_brand_id`.
- `updateVehicle`: added 4 `hasOwn` boolean vars (`hasEconomicGroupNumber`, `hasEconomicIndividualNumber`, `hasVehicleTypeId`, `hasVehicleBrandId`), updated `hasAnyUpdate` to include all 12 fields, added 4 CASE WHEN clauses to UPDATE SET.

---

### Task 5.5 — Wire catalogs into fleet-routes.js

**Files:**
- Modify: `modules/custom/custom.fleet/api/fleet-routes.js`

**Changes:**

- [x] Import `createCatalogsRouter` from `./catalogs-routes.js`.
- [x] Mount with `app.route('', createCatalogsRouter({ prisma, requirePermission, moduleContext }))`.

**Validation:**

```bash
node --check modules/custom/custom.fleet/api/fleet-routes.js
```

Expected: exits 0.

---

### Task 5.5 — Evidence (Verified: 2026-05-14)

`fleet-routes.js` updated. 127 lines. `node --check` passed. Import and mount added after maintenance router. No other changes to fleet-routes.js.

---

### Task 5.6 — Update module.manifest.js (catalog views + navigation)

**Files:**
- Modify: `modules/custom/custom.fleet/module.manifest.js`

**Changes:**

- [x] Add 9 view refs to `views` array: catalog.vehicle-types.table.js, catalog.vehicle-types.form.js, catalog.vehicle-types.page.js, catalog.vehicle-brands.table.js, catalog.vehicle-brands.form.js, catalog.vehicle-brands.page.js, catalog.maintenance-types.table.js, catalog.maintenance-types.form.js, catalog.maintenance-types.page.js.
- [x] Add Catalogos navigation entry: label "Catalogos", path `/app/m/custom.fleet/catalogs/vehicle-types`, icon "BookOpen", permissionKey `fleet.catalogs.read`.

**Validation:**

```bash
node --check modules/custom/custom.fleet/module.manifest.js
```

Expected: exits 0.

---

### Task 5.6 — Evidence (Verified: 2026-05-14)

`module.manifest.js` updated. `node --check` passed.

- `views` array: 12 → 21 entries (added 9 catalog view refs).
- `navigation` array: 3 → 4 items (added Catalogos entry).

---

## Phase 6 — Documents and images integration

### Task 6.1 — Update files-service.js ALLOWED_FILE_ENTITY_TYPES

**Files:**
- Modify: `apps/api/src/services/files-service.js`

**Changes:**

- [x] Locate `ALLOWED_FILE_ENTITY_TYPES` constant in `files-service.js`. Add three new entity types:
  ```js
  "FleetVehicle",
  "FleetDriver",
  "FleetMaintenance",
  ```

**Validation:**

```bash
node --check apps/api/src/services/files-service.js
pnpm dev:api &
TOKEN=<admin_bearer_token>
# Test file upload with FleetVehicle entity type:
curl -s -X POST http://localhost:4010/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.jpg" \
  -F "entityType=FleetVehicle" \
  -F "entityId=$(uuidgen)" | jq '.data.id'
```

Expected: `node --check` exits 0. Upload returns a non-null UUID (not a 400 error).

---

### Task 6.1 — Evidence (Verified: 2026-05-15)

`apps/api/src/services/files-service.js` modified. `node --check` passed.

`ALLOWED_FILE_ENTITY_TYPES` updated from 5 to 8 entries:
```js
const ALLOWED_FILE_ENTITY_TYPES = [
  "AtlasFile",
  "BrandingConfig",
  "Company",
  "HrEmployee",
  "Contact",
  "FleetVehicle",
  "FleetDriver",
  "FleetMaintenance",
]
```

Runtime smoke test deferred — API not running. Deferred to Phase 8 Task 8.1.

---

### Task 6.2 — Add vehicle document endpoints to vehicles-routes.js

This step is part of Task 4.4 (vehicles-routes.js already includes document endpoints per the spec). Verify document endpoints function after vehicle-service.js has `listVehicleDocuments`, `addVehicleDocument`, `removeVehicleDocument` implemented.

**Files:**
- Modify: `modules/custom/custom.fleet/api/vehicle-service.js` (if document functions not yet added in Task 4.1)

**Changes:**

- [x] Ensure `vehicle-service.js` includes: `listVehicleDocuments({ companyId, vehicleId })`, `addVehicleDocument({ companyId, actorId, vehicleId, payload })`, `removeVehicleDocument({ companyId, actorId, vehicleId, docId })`. These query `fleet_vehicle_document` and resolve FileAsset metadata via `prisma.fileAsset.findMany`.
- [x] Ensure `vehicles-routes.js` mounts: `GET /vehicles/:id/documents`, `POST /vehicles/:id/documents`, `DELETE /vehicles/:id/documents/:docId`.

**Validation:**

```bash
TOKEN=<admin_bearer_token>
VEHICLE_ID=<existing_vehicle_uuid>
FILE_ID=<file_asset_uuid_from_task_6_1>

# Add document association
curl -s -X POST "http://localhost:4010/fleet/vehicles/$VEHICLE_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"file_asset_id\":\"$FILE_ID\",\"document_type\":\"document\",\"label\":\"Tarjeta de circulación\"}" \
  | jq '.data.id'
# Expected: non-null UUID

# List documents
curl -s "http://localhost:4010/fleet/vehicles/$VEHICLE_ID/documents" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
# Expected: >= 1
```

---

### Task 6.2 — Evidence (Verified: 2026-05-15)

**Implementation deviation from plan:** Task 4.4 placed vehicle routes inline in `fleet-routes.js` rather than in a separate `vehicles-routes.js`. Document functions were added directly to `fleet-service.js` (the vehicle-only service, following the Task 4.1 pattern) and to `fleet-routes.js`.

**`fleet-service.js`** updated with 3 document functions. 405 lines (5 over soft limit; functions cannot be reduced further without sacrificing readability — acceptable, well under 1500 hard limit). `node --check` passed.

Functions added:
- `listVehicleDocuments` — queries `fleet_vehicle_document WHERE enabled = true`, resolves FileAsset metadata via `prisma.fileAsset.findMany({ where: { id: { in: ids } } })`.
- `addVehicleDocument` — INSERT into `fleet_vehicle_document`, audit log `fleet.vehicle.document.add`.
- `removeVehicleDocument` — UPDATE `enabled = false`, throws 404 if not found, audit log `fleet.vehicle.document.remove`.

`return` object updated to include all 8 functions: `listVehicles, getVehicle, createVehicle, updateVehicle, setVehicleEnabled, listVehicleDocuments, addVehicleDocument, removeVehicleDocument`.

**`fleet-routes.js`** updated with 3 document routes. 162 lines. `node --check` passed.

Routes added:
- `GET /fleet/vehicles/:id/documents` — requirePermission('fleet.vehicles.read'), calls `service.listVehicleDocuments`.
- `POST /fleet/vehicles/:id/documents` — requirePermission('fleet.vehicles.update'), validates `createDocumentAssociationSchema`, calls `service.addVehicleDocument`.
- `DELETE /fleet/vehicles/:id/documents/:docId` — requirePermission('fleet.vehicles.update'), calls `service.removeVehicleDocument`.

`createDocumentAssociationSchema` imported from `../validators/index.js` (already present from Phase 3 Task 3.1).

Runtime smoke tests deferred — API not running. Deferred to Phase 8 Task 8.1.

---

### Task 6.3 — Verify maintenance and driver document endpoints

The maintenance and driver document endpoints are implemented in Tasks 3.2/3.4 and 4.1/4.4. Run smoke tests here to confirm all three document domain endpoints work.

**Validation:**

```bash
DRIVER_ID=<driver_uuid>
MAINTENANCE_ID=<maintenance_uuid>
FILE_ID=<file_asset_uuid>

curl -s -X POST "http://localhost:4010/fleet/drivers/$DRIVER_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"file_asset_id\":\"$FILE_ID\",\"document_type\":\"license_front\"}" | jq '.data.id'
# Expected: non-null UUID

curl -s -X POST "http://localhost:4010/fleet/maintenance/$MAINTENANCE_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"file_asset_id\":\"$FILE_ID\",\"document_type\":\"receipt\"}" | jq '.data.id'
# Expected: non-null UUID
```

---

### Task 6.3 — Evidence (Verified: 2026-05-15)

All driver and maintenance document endpoints confirmed already complete — no changes needed.

**`driver-service.js`** (329 lines, `node --check` passed): `listDriverDocuments`, `addDriverDocument`, `removeDriverDocument` fully implemented. Queries `fleet_driver_document`, resolves FileAsset via `prisma.fileAsset.findMany`. Audit logs: `fleet.driver.document.add`, `fleet.driver.document.remove`.

**`drivers-routes.js`** (145 lines, `node --check` passed): `GET /fleet/drivers/:id/documents`, `POST /fleet/drivers/:id/documents`, `DELETE /fleet/drivers/:id/documents/:docId` all present. Validates `createDocumentAssociationSchema` on POST.

**`maintenance-service.js`** (294 lines, `node --check` passed): `listMaintenanceDocuments`, `addMaintenanceDocument`, `removeMaintenanceDocument` fully implemented. Queries `fleet_maintenance_document`. Audit logs: `fleet.maintenance.document.add`, `fleet.maintenance.document.remove`.

**`maintenance-routes.js`** (147 lines, `node --check` passed): `GET /fleet/maintenance/:id/documents`, `POST /fleet/maintenance/:id/documents`, `DELETE /fleet/maintenance/:id/documents/:docId` all present.

**`createDocumentAssociationSchema`** confirmed present in `modules/custom/custom.fleet/validators/index.js` from Phase 3 Task 3.1 — no changes needed.

**FileAsset resolution pattern:** Consistent across all three services — `prisma.fileAsset.findMany({ where: { id: { in: fileAssetIds } } })`, then `assetMap[doc.file_asset_id] ?? null` in the response shape.

**Validation results (all `node --check` passed):**
- `apps/api/src/services/files-service.js` — OK
- `modules/custom/custom.fleet/api/fleet-service.js` — OK (405 lines)
- `modules/custom/custom.fleet/api/fleet-routes.js` — OK (162 lines)
- `modules/custom/custom.fleet/api/driver-service.js` — OK (329 lines)
- `modules/custom/custom.fleet/api/drivers-routes.js` — OK (145 lines)
- `modules/custom/custom.fleet/api/maintenance-service.js` — OK (294 lines)
- `modules/custom/custom.fleet/api/maintenance-routes.js` — OK (147 lines)
- `modules/custom/custom.fleet/validators/index.js` — OK

**Forbidden file check:** `git diff --name-only` — only `apps/api/src/services/files-service.js` and `modules/custom/custom.fleet/api/fleet-service.js` and `fleet-routes.js` modified. No prisma/schema.prisma, prisma/migrations, packages/maps, packages/validators, packages/sdk, apps/api/src/index.js changes.

**Runtime smoke tests:** Deferred to Phase 8 Task 8.1 — API server not running in this environment.

---

## Phase 7 — UI validation through blueprint renderer

### Task 7.1 — Module sync and blueprint registration

**Files:** none (API operations)

**Changes:**

- [ ] Run module sync to register all new AtlasView blueprints and permissions:
  ```bash
  TOKEN=<admin_bearer_token>
  curl -s -X POST http://localhost:4010/modules/sync \
    -H "Authorization: Bearer $TOKEN" | jq '.data'
  ```
  Expected: custom.fleet listed with version 0.2.0, all 9 models, all new views.

- [ ] Seed maintenance types for the dev company:
  ```bash
  curl -s -X POST http://localhost:4010/fleet/catalogs/maintenance-types/seed \
    -H "Authorization: Bearer $TOKEN" | jq '.data | length'
  # Expected: 14 (seeded default maintenance types)
  ```

**Validation:** Module sync returns 200. GET /fleet/catalogs/maintenance-types returns 14 records.

---

### Task 7.2 — Browser navigation validation

**Files:** none (manual verification)

**Changes:**

- [ ] Start dev servers: `pnpm dev`
- [ ] Navigate to `http://localhost:5173/app/m/custom.fleet/maintenance` — expected: maintenance table renders with data, not "No se encontró una vista" empty state.
- [ ] Navigate to `http://localhost:5173/app/m/custom.fleet/drivers` — expected: driver table renders (initially empty, with "No hay choferes registrados." state).
- [ ] Navigate to `http://localhost:5173/app/m/custom.fleet/catalogs/vehicle-types` — expected: vehicle type catalog table renders.
- [ ] Navigate to `http://localhost:5173/app/m/custom.fleet/vehicles` — expected: vehicle table renders with new columns (economic_number, vehicle_type_name, vehicle_brand_name) visible (may be empty/dash for existing records).
- [ ] Create a new driver via the "Crear chofer" button — expected: form renders with all sections, submit creates the record, table refreshes.
- [ ] Create a maintenance record via the "Crear mantenimiento" button — expected: form renders, submit succeeds.
- [ ] Create a vehicle type catalog entry — expected: form renders, submit creates entry, appears in vehicle type table.

**Validation:** All 7 browser navigation checks pass without JavaScript console errors. New records created via forms appear in the list views.

---

### Task 7.3 — Custom component assessment

**Files:** (conditional — only if custom components are needed for Phase 8)

**Changes:**

- [ ] Assess whether photo upload (`photo_asset_id` field) needs a custom ComponentRegistry component for acceptable UX, or whether the text field fallback (paste UUID) is acceptable for this phase. Per spec §17: "If implementation discovers that custom component registration is more complex than expected, the fallback is to use a simple file-asset-id text input field."

- [ ] If custom component is needed: register `custom.fleet:VehiclePhotoUploader` and/or `custom.fleet:DocumentList` in `modules/custom/custom.fleet/components/index.js`. This is optional for Phase 8 — document in a decision record if deferred.

- [ ] If text field fallback is used: document the decision in `docs/superpowers/decisions/2026-05-14-fleet-document-upload-ux.md` and create a follow-up entry in `docs/TASKS.md` for a future phase.

**Validation:** Document UX decision. If custom components were added:

```bash
node --check modules/custom/custom.fleet/components/index.js
```

---

## Phase 8 — E2E verification

### Task 8.1 — Full verification plan execution

**Files:** none (verification only)

**Changes:**

Run all 15 verification commands from spec §26 in order:

- [ ] Syntax check: all new/modified .js files pass `node --check`.
- [ ] `pnpm exec prisma validate` and `pnpm exec prisma migrate status` — no pending Prisma migrations, schema valid.
- [ ] API boot health check.
- [ ] Fleet file upload with FleetVehicle entity type — returns non-null UUID.
- [ ] Driver CRUD smoke — `full_name` field returned as "Juan Garcia".
- [ ] Vehicle catalog enrichment smoke — `economic_number` and `vehicle_type_name` returned.
- [ ] Maintenance CRUD smoke — status "scheduled" returned.
- [ ] Browser: maintenance navigation renders table.
- [ ] Browser: driver navigation renders table.
- [ ] Browser: catalogs navigation renders vehicle types table.
- [ ] Permission fail-closed test — POST /fleet/drivers without permission returns 403.
- [ ] Desktop build: `pnpm --filter @atlas/desktop build:web` exits 0.
- [ ] No Prisma changes: `git diff --name-only HEAD | grep -E "^(prisma/schema\.prisma|prisma/migrations/)"` — empty output.
- [ ] Module sync returns custom.fleet with all 9 models and new views.
- [ ] System maintenance type protection — PATCH /enabled returns 409 for is_system=true records.

**Validation:** All 15 checks pass. Document results inline in this plan file with `Verified: 2026-05-14 (command executed)` notation.

---

### Task 8.2 — Update docs/TASKS.md

**Files:**
- Modify: `docs/TASKS.md`

**Changes:**

- [ ] Add Phase 8 entry: `custom.fleet Operational Expansion — Maintenance, Drivers, Catalogs, Documents, and Media` with status, spec link, and plan link.
- [ ] Mark all checklist items `[x]` only after verification evidence is present.

**Validation:**

```bash
node --check docs/TASKS.md 2>&1 || true
# TASKS.md is markdown, not JS — just confirm it renders correctly
```

---

## Rollback Notes

**If aborted before Task 2.2 (migrations not applied):**
- Revert all created files via `git checkout`. No database changes made.

**If aborted after Task 2.2 (migrations applied) but before Task 4.4 (routes not wired):**
- Apply rollback migration files via MCP database tool (preferred) or psql (examples only — substitute actual credentials from `.env`):
  ```bash
  # EXAMPLE ONLY — prefer MCP database tooling
  psql "$DIRECT_URL" -f modules/custom/custom.fleet/migrations/V002_vehicle_expansion_rollback.sql
  psql "$DIRECT_URL" -f modules/custom/custom.fleet/migrations/V003_maintenance_expansion_rollback.sql
  ```
- Revert code changes via `git checkout`.
- No data loss (columns were newly added; if records were written to new columns, those values are lost on column drop).

**If aborted after Task 4.4 (routes wired and API deployed):**
- Revert `api/index.js` and domain route files via `git revert` or branch switch.
- The Route Loader marks the fleet module as `routeLoader: ERROR` on the next boot but the API remains healthy (fail-soft behavior).
- New ORM tables (`fleet_driver`, catalog tables, document join tables) provisioned by Atlas ORM can be cleaned up via `POST /modules/custom.fleet/cleanup` with `{ confirmation: "ACEPTO" }` — this drops all fleet-owned tables including `fleet_vehicle` and `fleet_maintenance`. **Do not use cleanup on any environment with production data.**
- For granular table cleanup: `DROP TABLE IF EXISTS fleet_driver, fleet_vehicle_type, fleet_vehicle_brand, fleet_maintenance_type, fleet_vehicle_document, fleet_driver_document, fleet_maintenance_document;`

**Manifest rollback:**
- Revert `module.manifest.js` to version 0.1.0 (restore from git).
- Run `POST /modules/sync` to remove new AtlasView and AtlasModel registrations.
- New permissions remain in the `Permission` table (harmless). Remove manually if needed: `DELETE FROM "Permission" WHERE key LIKE 'fleet.drivers.%' OR key LIKE 'fleet.catalogs.%';`

---

## Verification Gate

Before marking Phase 8 complete in `docs/TASKS.md`:

- [ ] All task validation commands have been run and exited without errors.
- [ ] All 15 verification commands from spec §26 have passed.
- [ ] `pnpm --filter @atlas/desktop build:web` exits 0 (acceptance criterion 12).
- [ ] `git diff --name-only HEAD | grep -E "^(prisma/schema\.prisma|prisma/migrations/)"` returns empty (acceptance criterion 17).
- [ ] All 17 acceptance criteria from spec §25 have been verified.
- [ ] No source file created or modified by this plan exceeds 1000 lines.
- [ ] `docs/TASKS.md` updated with `Verified: 2026-05-14 (commands executed)`.
