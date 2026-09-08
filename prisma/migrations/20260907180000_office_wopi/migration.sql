ALTER TABLE "file_asset"
  ADD COLUMN "content_revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "office_lock" TEXT,
  ADD COLUMN "office_lock_expires_at" TIMESTAMP(3);

CREATE TABLE "file_asset_version" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "file_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "bucket" TEXT NOT NULL,
  "object_key" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "checksum" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "file_asset_version_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "file_asset_version_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "file_asset_version_file_id_revision_key" ON "file_asset_version"("file_id", "revision");
-- Recovery pointers are accessible only through the privileged Atlas API.
ALTER TABLE "file_asset_version" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "file_asset_version" FROM anon, authenticated;

-- Other module routes also mutate FileAsset. Protect them at the database
-- boundary, including association changes concurrent with an Office save.
CREATE FUNCTION atlas_guard_office_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.office_lock IS NOT NULL AND OLD.office_lock_expires_at > clock_timestamp()
     AND current_setting('atlas.office_write', true) IS DISTINCT FROM 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'office_document_locked' USING ERRCODE = '55000';
    END IF;
    IF (NEW.object_key, NEW.original_name, NEW.mime_type, NEW.enabled, NEW.entity_id, NEW.entity_type, NEW.module_key, NEW.metadata, NEW.visibility, NEW.bucket, NEW.size_bytes, NEW.checksum)
       IS DISTINCT FROM
       (OLD.object_key, OLD.original_name, OLD.mime_type, OLD.enabled, OLD.entity_id, OLD.entity_type, OLD.module_key, OLD.metadata, OLD.visibility, OLD.bucket, OLD.size_bytes, OLD.checksum) THEN
      RAISE EXCEPTION 'office_document_locked' USING ERRCODE = '55000';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER file_asset_office_guard BEFORE UPDATE OR DELETE ON file_asset
FOR EACH ROW EXECUTE FUNCTION atlas_guard_office_document();
