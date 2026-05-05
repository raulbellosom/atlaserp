-- CreateTable
CREATE TABLE "HrDepartment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HrDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrJobTitle" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HrJobTitle_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "HrEmployee"
  ADD COLUMN "supervisorEmployeeId" TEXT,
  ADD COLUMN "departmentId" TEXT,
  ADD COLUMN "jobTitleId" TEXT,
  ADD COLUMN "profileImageFileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HrDepartment_companyId_name_key" ON "HrDepartment"("companyId", "name");
CREATE INDEX "HrDepartment_companyId_enabled_idx" ON "HrDepartment"("companyId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "HrJobTitle_companyId_name_key" ON "HrJobTitle"("companyId", "name");
CREATE INDEX "HrJobTitle_companyId_enabled_idx" ON "HrJobTitle"("companyId", "enabled");

-- CreateIndex
CREATE INDEX "HrEmployee_companyId_supervisorEmployeeId_idx" ON "HrEmployee"("companyId", "supervisorEmployeeId");
CREATE INDEX "HrEmployee_companyId_departmentId_idx" ON "HrEmployee"("companyId", "departmentId");
CREATE INDEX "HrEmployee_companyId_jobTitleId_idx" ON "HrEmployee"("companyId", "jobTitleId");

-- AddForeignKey
ALTER TABLE "HrDepartment"
  ADD CONSTRAINT "HrDepartment_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrJobTitle"
  ADD CONSTRAINT "HrJobTitle_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrEmployee"
  ADD CONSTRAINT "HrEmployee_supervisorEmployeeId_fkey"
  FOREIGN KEY ("supervisorEmployeeId") REFERENCES "HrEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HrEmployee"
  ADD CONSTRAINT "HrEmployee_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "HrDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HrEmployee"
  ADD CONSTRAINT "HrEmployee_jobTitleId_fkey"
  FOREIGN KEY ("jobTitleId") REFERENCES "HrJobTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HrEmployee"
  ADD CONSTRAINT "HrEmployee_profileImageFileId_fkey"
  FOREIGN KEY ("profileImageFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
