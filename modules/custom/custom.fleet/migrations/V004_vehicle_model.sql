-- V004: create fleet_vehicle_model catalog table and add vehicle_model_id FK to fleet_vehicle
-- Rollback: V004_vehicle_model_rollback.sql

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

CREATE UNIQUE INDEX IF NOT EXISTS fleet_vehicle_model_co_br_ty_na_yr_idx
  ON fleet_vehicle_model (company_id, brand_id, type_id, name, year);

CREATE INDEX IF NOT EXISTS fleet_vehicle_model_co_brand_idx
  ON fleet_vehicle_model (company_id, brand_id);

CREATE INDEX IF NOT EXISTS fleet_vehicle_model_co_type_idx
  ON fleet_vehicle_model (company_id, type_id);

CREATE INDEX IF NOT EXISTS fleet_vehicle_model_co_enabled_idx
  ON fleet_vehicle_model (company_id, enabled);

ALTER TABLE fleet_vehicle
  ADD COLUMN IF NOT EXISTS vehicle_model_id UUID REFERENCES fleet_vehicle_model(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fleet_vehicle_model_id_idx
  ON fleet_vehicle (company_id, vehicle_model_id);
