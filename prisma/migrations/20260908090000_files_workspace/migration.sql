-- AlterTable
ALTER TABLE "file_asset" ADD COLUMN     "access_scope" TEXT NOT NULL DEFAULT 'COMPANY',
ADD COLUMN     "creation_key" TEXT,
ALTER COLUMN "id" SET DEFAULT uuidv7();

-- CreateTable
CREATE TABLE "file_asset_share" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "file_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invited_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_asset_share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_asset_share_user_id_status_created_at_idx" ON "file_asset_share"("user_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "file_asset_share_file_id_user_id_key" ON "file_asset_share"("file_id", "user_id");

-- CreateIndex
CREATE INDEX "file_asset_entity_id_enabled_created_at_id_idx" ON "file_asset"("entity_id", "enabled", "created_at", "id");
CREATE INDEX "file_asset_entity_id_updated_at_id_idx" ON "file_asset"("entity_id", "updated_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "file_asset_uploaded_by_id_creation_key_key" ON "file_asset"("uploaded_by_id", "creation_key");

-- AddForeignKey
ALTER TABLE "file_asset_share" ADD CONSTRAINT "file_asset_share_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE file_asset ADD CONSTRAINT file_asset_access_scope_check CHECK (access_scope IN ('COMPANY', 'RESTRICTED'));
ALTER TABLE file_asset ADD CONSTRAINT file_asset_restricted_storage_check CHECK (
  access_scope <> 'RESTRICTED' OR
  (uploaded_by_id IS NOT NULL AND entity_id IS NOT NULL AND entity_type = 'AtlasFile' AND module_key = 'atlas.files' AND bucket = 'atlas-files' AND visibility <> 'PUBLIC')
);
ALTER TABLE file_asset_share ADD CONSTRAINT file_asset_share_role_check CHECK (role IN ('VIEWER', 'EDITOR'));
ALTER TABLE file_asset_share ADD CONSTRAINT file_asset_share_status_check CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED'));
ALTER TABLE file_asset_share ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON file_asset_share FROM anon, authenticated;
-- File metadata and object keys are served only through the authorized Atlas API.
ALTER TABLE file_asset ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON file_asset FROM anon, authenticated;

-- Restricted workspace documents keep their own access policy. They cannot be
-- attached to a source whose preview path has inherited authorization instead.
CREATE FUNCTION atlas_guard_restricted_attachment() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM file_asset WHERE id = (to_jsonb(NEW)->>COALESCE(TG_ARGV[0], 'file_asset_id'))::uuid AND access_scope = 'RESTRICTED' FOR SHARE) THEN
    RAISE EXCEPTION 'restricted_document_cannot_be_attached' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER inv_item_file_restricted_guard BEFORE INSERT OR UPDATE ON inv_item_file
FOR EACH ROW EXECUTE FUNCTION atlas_guard_restricted_attachment();
CREATE TRIGGER calendar_event_file_restricted_guard BEFORE INSERT OR UPDATE ON calendar_event_file
FOR EACH ROW EXECUTE FUNCTION atlas_guard_restricted_attachment();
CREATE TRIGGER generated_document_restricted_guard BEFORE INSERT OR UPDATE OF file_asset_id ON generated_document
FOR EACH ROW EXECUTE FUNCTION atlas_guard_restricted_attachment();
CREATE TRIGGER hr_employee_restricted_guard BEFORE INSERT OR UPDATE OF profile_image_file_id ON hr_employee
FOR EACH ROW EXECUTE FUNCTION atlas_guard_restricted_attachment('profile_image_file_id');
