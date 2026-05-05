-- CreateEnum
CREATE TYPE "FinanceDocumentDirection" AS ENUM ('AR', 'AP');

-- CreateEnum
CREATE TYPE "FinanceDocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'ADVANCE', 'PAYMENT');

-- CreateEnum
CREATE TYPE "FinanceDocumentStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "FinanceDocumentEventType" AS ENUM ('ISSUE', 'APPLY', 'VOID', 'ADJUST');

-- CreateTable
CREATE TABLE "FinanceDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "direction" "FinanceDocumentDirection" NOT NULL,
    "docType" "FinanceDocumentType" NOT NULL,
    "status" "FinanceDocumentStatus" NOT NULL DEFAULT 'OPEN',
    "contactId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "reference" TEXT,
    "notesMarkdown" TEXT,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "openAmount" DECIMAL(65,30) NOT NULL,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDocumentApplication" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "targetDocumentId" TEXT NOT NULL,
    "appliedAmount" DECIMAL(65,30) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceDocumentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDocumentAccountingLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "eventType" "FinanceDocumentEventType" NOT NULL,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceDocumentAccountingLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceDocument_companyId_direction_status_idx" ON "FinanceDocument"("companyId", "direction", "status");

-- CreateIndex
CREATE INDEX "FinanceDocument_companyId_issueDate_idx" ON "FinanceDocument"("companyId", "issueDate");

-- CreateIndex
CREATE INDEX "FinanceDocument_companyId_dueDate_idx" ON "FinanceDocument"("companyId", "dueDate");

-- CreateIndex
CREATE INDEX "FinanceDocument_contactId_idx" ON "FinanceDocument"("contactId");

-- CreateIndex
CREATE INDEX "FinanceDocumentApplication_companyId_appliedAt_idx" ON "FinanceDocumentApplication"("companyId", "appliedAt");

-- CreateIndex
CREATE INDEX "FinanceDocumentApplication_companyId_sourceDocumentId_idx" ON "FinanceDocumentApplication"("companyId", "sourceDocumentId");

-- CreateIndex
CREATE INDEX "FinanceDocumentApplication_companyId_targetDocumentId_idx" ON "FinanceDocumentApplication"("companyId", "targetDocumentId");

-- CreateIndex
CREATE INDEX "FinanceDocumentAccountingLink_companyId_documentId_idx" ON "FinanceDocumentAccountingLink"("companyId", "documentId");

-- CreateIndex
CREATE INDEX "FinanceDocumentAccountingLink_companyId_journalEntryId_idx" ON "FinanceDocumentAccountingLink"("companyId", "journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceDocumentAccountingLink_documentId_journalEntryId_eve_key" ON "FinanceDocumentAccountingLink"("documentId", "journalEntryId", "eventType");

-- AddForeignKey
ALTER TABLE "FinanceDocument" ADD CONSTRAINT "FinanceDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocument" ADD CONSTRAINT "FinanceDocument_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentApplication" ADD CONSTRAINT "FinanceDocumentApplication_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentApplication" ADD CONSTRAINT "FinanceDocumentApplication_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "FinanceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentApplication" ADD CONSTRAINT "FinanceDocumentApplication_targetDocumentId_fkey" FOREIGN KEY ("targetDocumentId") REFERENCES "FinanceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentAccountingLink" ADD CONSTRAINT "FinanceDocumentAccountingLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentAccountingLink" ADD CONSTRAINT "FinanceDocumentAccountingLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FinanceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentAccountingLink" ADD CONSTRAINT "FinanceDocumentAccountingLink_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "FinanceJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
