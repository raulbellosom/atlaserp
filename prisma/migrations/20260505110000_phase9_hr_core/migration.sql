-- CreateTable
CREATE TABLE "HrEmployee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "workEmail" TEXT,
    "personalEmail" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "managerName" TEXT,
    "hireDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "notesMarkdown" TEXT,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrEmployee_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "HrEmployee_companyId_enabled_idx" ON "HrEmployee"("companyId", "enabled");
CREATE INDEX "HrEmployee_companyId_lastName_firstName_idx" ON "HrEmployee"("companyId", "lastName", "firstName");
