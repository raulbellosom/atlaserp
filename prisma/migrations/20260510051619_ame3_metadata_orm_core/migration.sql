-- CreateTable
CREATE TABLE "AtlasModel" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "pluralLabel" TEXT,
    "companyScoped" BOOLEAN NOT NULL DEFAULT true,
    "schema" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtlasModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasField" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "readonly" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" JSONB,
    "options" JSONB,
    "relation" JSONB,
    "validation" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AtlasField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasView" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "modelName" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "schema" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtlasView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleMigration" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleMigration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AtlasModel_name_key" ON "AtlasModel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasModel_tableName_key" ON "AtlasModel"("tableName");

-- CreateIndex
CREATE INDEX "AtlasModel_moduleKey_idx" ON "AtlasModel"("moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasField_modelId_name_key" ON "AtlasField"("modelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasView_key_key" ON "AtlasView"("key");

-- CreateIndex
CREATE INDEX "AtlasView_moduleKey_idx" ON "AtlasView"("moduleKey");

-- CreateIndex
CREATE INDEX "AtlasView_modelName_idx" ON "AtlasView"("modelName");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleMigration_moduleKey_filename_key" ON "ModuleMigration"("moduleKey", "filename");

-- AddForeignKey
ALTER TABLE "AtlasField" ADD CONSTRAINT "AtlasField_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AtlasModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtlasView" ADD CONSTRAINT "AtlasView_modelName_fkey" FOREIGN KEY ("modelName") REFERENCES "AtlasModel"("name") ON DELETE SET NULL ON UPDATE CASCADE;
