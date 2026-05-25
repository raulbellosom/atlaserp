# custom.fleet - Fleet Management Module

Atlas Module Engine v3 custom module used as the full end-to-end reference for external local modules.

Module key: `custom.fleet`  
Kind: `FEATURE`  
Status: `GA` (functional + verified)  
Manifest version: `0.4.0`

## Scope

- Fleet vehicles, drivers, maintenance records, and operational catalogs.
- Blueprint-driven CRUD pages (table/form/detail/page) with metadata-first rendering.
- Attachments integration for vehicles, drivers, and maintenance.
- Company-scoped data isolation and fail-closed RBAC permissions.

## Domain models (Atlas ORM)

- `fleet_vehicle`
- `fleet_driver`
- `fleet_maintenance`
- `fleet_vehicle_type`
- `fleet_vehicle_brand`
- `fleet_vehicle_model`
- `fleet_maintenance_type`
- `fleet_vehicle_document`
- `fleet_driver_document`
- `fleet_maintenance_document`

## Permissions

- Module gate: `fleet.access`
- Vehicles: `fleet.vehicles.{read,create,update,delete}`
- Drivers: `fleet.drivers.{read,create,update,delete}`
- Maintenance: `fleet.maintenance.{read,create,update,delete}`
- Catalogs: `fleet.catalogs.{read,create,update,delete}`

## Manifest migrations

The module declares SQL migrations under `manifest.migrations` with SHA-256 checksums:

- `./migrations/V002_vehicle_expansion.sql`
- `./migrations/V003_maintenance_expansion.sql`
- `./migrations/V004_vehicle_model.sql`
- `./migrations/V004b_vehicle_legacy_columns_nullable.sql` (`unsafe: true`)
- `./migrations/V005_vehicle_type_economic_group_number.sql`
- `./migrations/V006_report_tables.sql`
- `./migrations/V007_report_document_file_asset_id_text.sql` (`unsafe: true`)
- `./migrations/V008_driver_photo_hr_link.sql`
- `./migrations/V009_uuid_reference_columns.sql` (`unsafe: true`)

These are applied through AME3 module migration ledger (`ModuleMigration`) and are checksum-validated before execution.

## Completion status

- [x] Filesystem discovery via `modules/custom/` and runtime sync via `POST /modules/sync`
- [x] Route loader lifecycle reload/unload integration without API restart
- [x] Component registry lifecycle integration with active-module filtering
- [x] Atlas metadata sync with soft-disable for removed models/views/fields
- [x] Fleet service regression tests (happy path, validation errors, company scope)
- [x] Desktop build verification

## Operational note

This module follows the custom naming convention `<feature>_<entity>` (for example `fleet_vehicle`) and intentionally does not use the reserved `atlas_` prefix.
