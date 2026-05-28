-- V004b: make legacy fleet_vehicle columns nullable now that vehicle_model_id is the primary identifier
-- These columns remain for backward compat but are no longer required.
ALTER TABLE fleet_vehicle ALTER COLUMN brand DROP NOT NULL;
ALTER TABLE fleet_vehicle ALTER COLUMN model_name DROP NOT NULL;
ALTER TABLE fleet_vehicle ALTER COLUMN year DROP NOT NULL;
