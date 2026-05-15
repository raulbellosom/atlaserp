-- V002 rollback: drop expansion columns from fleet_vehicle
-- WARNING: Only run if the Phase 2 expansion must be fully reverted.
-- Any data stored in these columns will be lost.
-- Spec: docs/superpowers/specs/2026-05-14-custom-fleet-operational-expansion-design.md §27

ALTER TABLE fleet_vehicle
  DROP COLUMN IF EXISTS economic_group_number,
  DROP COLUMN IF EXISTS economic_individual_number,
  DROP COLUMN IF EXISTS vehicle_type_id,
  DROP COLUMN IF EXISTS vehicle_brand_id,
  DROP COLUMN IF EXISTS photo_asset_id;
