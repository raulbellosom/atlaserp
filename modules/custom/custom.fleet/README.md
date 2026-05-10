# custom.fleet - Fleet Management Module

Atlas Module Engine v3 sample custom module.

Module key: `custom.fleet`  
Kind: FEATURE  
Version: 0.1.0

## Entities

- **Vehicle** (`fleet_vehicle`) - company vehicles with plate, brand, model, year, status.
- **Maintenance** (`fleet_maintenance`) - maintenance records linked to vehicles.

## Permissions

- `fleet.access` - module access gate
- `fleet.vehicles.{read,create,update,delete}` - vehicle CRUD
- `fleet.maintenance.{read,create,update,delete}` - maintenance CRUD

## Phase status

- [x] Phase 1: Manifest, models, views, page, component declared
- [ ] Phase 2: API routes, module discovery
- [ ] Phase 3: Atlas ORM table provisioning
- [ ] Phase 4: ComponentRegistry population
- [ ] Phase 6: Blueprint rendering

## Table naming

`fleet_vehicle`, `fleet_maintenance` - custom module convention: `<feature>_<entity>`.
No `atlas_` prefix (reserved for official Atlas modules).
