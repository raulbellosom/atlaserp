-- V009: normalize fleet reference ids to UUID after legacy text drift
-- Date: 2026-05-24
-- Safe: idempotent casts guarded by information_schema checks

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_driver'
      AND column_name = 'photo_asset_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE fleet_driver
      ALTER COLUMN photo_asset_id TYPE uuid
      USING NULLIF(BTRIM(photo_asset_id), '')::uuid;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_driver'
      AND column_name = 'hr_employee_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE fleet_driver
      ALTER COLUMN hr_employee_id TYPE uuid
      USING NULLIF(BTRIM(hr_employee_id), '')::uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_driver_document'
      AND column_name = 'driver_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE fleet_driver_document
      ALTER COLUMN driver_id TYPE uuid
      USING NULLIF(BTRIM(driver_id), '')::uuid;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_driver_document'
      AND column_name = 'file_asset_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE fleet_driver_document
      ALTER COLUMN file_asset_id TYPE uuid
      USING NULLIF(BTRIM(file_asset_id), '')::uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_vehicle_document'
      AND column_name = 'vehicle_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE fleet_vehicle_document
      ALTER COLUMN vehicle_id TYPE uuid
      USING NULLIF(BTRIM(vehicle_id), '')::uuid;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_vehicle_document'
      AND column_name = 'file_asset_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE fleet_vehicle_document
      ALTER COLUMN file_asset_id TYPE uuid
      USING NULLIF(BTRIM(file_asset_id), '')::uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_maintenance_document'
      AND column_name = 'maintenance_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE fleet_maintenance_document
      ALTER COLUMN maintenance_id TYPE uuid
      USING NULLIF(BTRIM(maintenance_id), '')::uuid;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_maintenance_document'
      AND column_name = 'file_asset_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE fleet_maintenance_document
      ALTER COLUMN file_asset_id TYPE uuid
      USING NULLIF(BTRIM(file_asset_id), '')::uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_report_part'
      AND column_name = 'report_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE fleet_report_part
      ALTER COLUMN report_id TYPE uuid
      USING NULLIF(BTRIM(report_id), '')::uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_report_document'
      AND column_name = 'report_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE fleet_report_document
      ALTER COLUMN report_id TYPE uuid
      USING NULLIF(BTRIM(report_id), '')::uuid;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_report_document'
      AND column_name = 'file_asset_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE fleet_report_document
      ALTER COLUMN file_asset_id TYPE uuid
      USING NULLIF(BTRIM(file_asset_id), '')::uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_report'
      AND column_name = 'finalized_by_profile_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE fleet_report
      ALTER COLUMN finalized_by_profile_id TYPE uuid
      USING NULLIF(BTRIM(finalized_by_profile_id), '')::uuid;
  END IF;
END $$;

