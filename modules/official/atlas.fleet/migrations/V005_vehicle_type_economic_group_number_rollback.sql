-- V005 rollback: remove economic_group_number from fleet_vehicle_type

ALTER TABLE fleet_vehicle_type DROP COLUMN IF EXISTS economic_group_number;
