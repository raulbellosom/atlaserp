DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fleet_report_document'
      AND column_name = 'file_asset_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE fleet_report_document
      ALTER COLUMN file_asset_id TYPE text
      USING file_asset_id::text;
  END IF;
END $$;
