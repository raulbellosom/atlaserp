-- V005: add economic_group_number column to fleet_vehicle_type
-- Rollback: V005_vehicle_type_economic_group_number_rollback.sql

ALTER TABLE fleet_vehicle_type
  ADD COLUMN IF NOT EXISTS economic_group_number TEXT;
