-- Restore uuidv7() DB-side defaults on all UUID id columns stripped by the colony migration.
DO $$
DECLARE col RECORD;
BEGIN
  FOR col IN
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'id'
      AND c.data_type = 'uuid'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT uuidv7()',
      col.table_schema, col.table_name, col.column_name
    );
  END LOOP;
END $$;
