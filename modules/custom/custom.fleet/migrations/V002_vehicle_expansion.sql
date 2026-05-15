-- V002: fleet_vehicle expansion — additive column migration
-- Date: 2026-05-14
-- Spec: docs/superpowers/specs/2026-05-14-custom-fleet-operational-expansion-design.md §10
-- Plan: docs/superpowers/plans/2026-05-14-custom-fleet-operational-expansion.md Task 2.1
-- Safe: ADD COLUMN IF NOT EXISTS is idempotent — safe to re-run.
-- Rollback: V002_vehicle_expansion_rollback.sql

ALTER TABLE fleet_vehicle
  ADD COLUMN IF NOT EXISTS economic_group_number VARCHAR(4),
  ADD COLUMN IF NOT EXISTS economic_individual_number VARCHAR(4),
  ADD COLUMN IF NOT EXISTS vehicle_type_id UUID,
  ADD COLUMN IF NOT EXISTS vehicle_brand_id UUID,
  ADD COLUMN IF NOT EXISTS photo_asset_id UUID;
