CREATE TABLE "document_template" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "source_type" TEXT NOT NULL,
  "published_version_id" UUID,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "document_template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_template_version" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "template_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "blocks" JSONB NOT NULL,
  "created_by_id" UUID,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "document_template_version_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_template_version_status_check"
    CHECK ("status" IN ('draft', 'published'))
);

CREATE TABLE "generated_document" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "version_id" UUID NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" UUID NOT NULL,
  "file_asset_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "metadata" JSONB,
  "generated_by_id" UUID,
  "generated_at" TIMESTAMP(3),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "generated_document_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "generated_document_status_check"
    CHECK ("status" IN ('pending', 'ready', 'failed'))
);

CREATE UNIQUE INDEX "document_template_company_id_key_key"
  ON "document_template"("company_id", "key");
CREATE INDEX "document_template_company_id_source_type_enabled_idx"
  ON "document_template"("company_id", "source_type", "enabled");
CREATE INDEX "document_template_published_version_id_idx"
  ON "document_template"("published_version_id");

CREATE UNIQUE INDEX "document_template_version_template_id_version_number_key"
  ON "document_template_version"("template_id", "version_number");
CREATE INDEX "document_template_version_template_id_status_idx"
  ON "document_template_version"("template_id", "status");

CREATE INDEX "generated_document_company_id_generated_at_idx"
  ON "generated_document"("company_id", "generated_at");
CREATE INDEX "generated_document_company_id_source_type_source_id_idx"
  ON "generated_document"("company_id", "source_type", "source_id");
CREATE INDEX "generated_document_template_id_version_id_idx"
  ON "generated_document"("template_id", "version_id");
CREATE INDEX "generated_document_file_asset_id_idx"
  ON "generated_document"("file_asset_id");

ALTER TABLE "document_template_version"
  ADD CONSTRAINT "document_template_version_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "document_template"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_template"
  ADD CONSTRAINT "document_template_published_version_id_fkey"
  FOREIGN KEY ("published_version_id")
  REFERENCES "document_template_version"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_document"
  ADD CONSTRAINT "generated_document_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "document_template"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "generated_document"
  ADD CONSTRAINT "generated_document_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "document_template_version"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "generated_document"
  ADD CONSTRAINT "generated_document_file_asset_id_fkey"
  FOREIGN KEY ("file_asset_id") REFERENCES "file_asset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
