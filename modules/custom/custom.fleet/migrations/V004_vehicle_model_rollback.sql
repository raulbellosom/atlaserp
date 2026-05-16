-- V004 rollback: remove vehicle_model_id from fleet_vehicle and drop fleet_vehicle_model

ALTER TABLE fleet_vehicle DROP COLUMN IF EXISTS vehicle_model_id;
DROP TABLE IF EXISTS fleet_vehicle_model CASCADE;
