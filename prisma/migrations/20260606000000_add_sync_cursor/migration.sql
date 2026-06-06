-- CreateTable
CREATE TABLE "sync_cursor" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "module_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "cursor" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_cursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_cursor_company_id_module_key_entity_type_key" ON "sync_cursor"("company_id", "module_key", "entity_type");

-- CreateIndex
CREATE INDEX "sync_cursor_company_id_idx" ON "sync_cursor"("company_id");
