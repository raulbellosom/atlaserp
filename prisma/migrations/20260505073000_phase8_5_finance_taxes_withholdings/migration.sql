-- CreateEnum
CREATE TYPE "FinanceTaxKind" AS ENUM ('TRANSFER', 'WITHHOLDING');

-- CreateTable
CREATE TABLE "FinanceTaxRate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FinanceTaxKind" NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "direction" "FinanceDocumentDirection",
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDocumentTaxLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "taxRateId" TEXT,
    "taxKey" TEXT NOT NULL,
    "taxName" TEXT NOT NULL,
    "kind" "FinanceTaxKind" NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "baseAmount" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceDocumentTaxLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTaxRate_companyId_key_key" ON "FinanceTaxRate"("companyId", "key");

-- CreateIndex
CREATE INDEX "FinanceTaxRate_companyId_kind_idx" ON "FinanceTaxRate"("companyId", "kind");

-- CreateIndex
CREATE INDEX "FinanceTaxRate_companyId_direction_idx" ON "FinanceTaxRate"("companyId", "direction");

-- CreateIndex
CREATE INDEX "FinanceDocumentTaxLine_companyId_documentId_idx" ON "FinanceDocumentTaxLine"("companyId", "documentId");

-- CreateIndex
CREATE INDEX "FinanceDocumentTaxLine_companyId_kind_idx" ON "FinanceDocumentTaxLine"("companyId", "kind");

-- AddForeignKey
ALTER TABLE "FinanceTaxRate" ADD CONSTRAINT "FinanceTaxRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentTaxLine" ADD CONSTRAINT "FinanceDocumentTaxLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentTaxLine" ADD CONSTRAINT "FinanceDocumentTaxLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FinanceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentTaxLine" ADD CONSTRAINT "FinanceDocumentTaxLine_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "FinanceTaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
