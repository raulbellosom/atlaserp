-- CreateTable
CREATE TABLE "BrandingConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "logoFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandingConfig_companyId_key" ON "BrandingConfig"("companyId");

-- AddForeignKey
ALTER TABLE "BrandingConfig" ADD CONSTRAINT "BrandingConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
