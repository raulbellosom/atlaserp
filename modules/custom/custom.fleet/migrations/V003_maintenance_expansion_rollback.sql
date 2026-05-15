-- V003 rollback: drop expansion columns from fleet_maintenance
-- WARNING: Only run if the Phase 2 expansion must be fully reverted.
-- Any data stored in these columns will be lost.
-- Spec: docs/superpowers/specs/2026-05-14-custom-fleet-operational-expansion-design.md §27

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
