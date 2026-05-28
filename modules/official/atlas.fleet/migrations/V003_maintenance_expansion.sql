-- V003: fleet_maintenance expansion — additive column migration
-- Date: 2026-05-14
-- Spec: docs/superpowers/specs/2026-05-14-custom-fleet-operational-expansion-design.md §10
-- Plan: docs/superpowers/plans/2026-05-14-custom-fleet-operational-expansion.md Task 2.1
-- Safe: ADD COLUMN IF NOT EXISTS is idempotent — safe to re-run.
-- Rollback: V003_maintenance_expansion_rollback.sql

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
