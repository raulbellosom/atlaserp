-- CreateEnum
CREATE TYPE "FinanceApplicationStatus" AS ENUM ('APPLIED', 'REVERSED');

-- AlterEnum
ALTER TYPE "FinanceDocumentEventType" ADD VALUE 'REVERSE';

-- AlterTable
ALTER TABLE "FinanceDocumentApplication" ADD COLUMN     "effectiveFxRate" DECIMAL(65,30),
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedById" TEXT,
ADD COLUMN     "sourceAmount" DECIMAL(65,30),
ADD COLUMN     "status" "FinanceApplicationStatus" NOT NULL DEFAULT 'APPLIED',
ADD COLUMN     "targetAmount" DECIMAL(65,30);

-- CreateIndex
CREATE INDEX "FinanceDocumentApplication_companyId_status_idx" ON "FinanceDocumentApplication"("companyId", "status");

-- AddForeignKey
ALTER TABLE "FinanceDocumentApplication" ADD CONSTRAINT "FinanceDocumentApplication_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
