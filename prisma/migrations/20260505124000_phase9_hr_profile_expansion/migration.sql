-- AlterTable
ALTER TABLE "HrEmployee"
ADD COLUMN "employeeCode" TEXT,
ADD COLUMN "emergencyContactName" TEXT,
ADD COLUMN "emergencyContactPhone" TEXT,
ADD COLUMN "employmentType" TEXT,
ADD COLUMN "workLocation" TEXT,
ADD COLUMN "terminationDate" TIMESTAMP(3);
