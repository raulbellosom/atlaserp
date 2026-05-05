-- Phase 8.1 finance core migration
-- Assumption: no legacy finance data needs to be preserved.

-- Remove legacy transaction model first to release foreign key constraints.
DROP TABLE IF EXISTS "FinanceTransaction";

-- Rebuild FinanceAccount with company scope and account catalog fields.
DROP TABLE IF EXISTS "FinanceAccount";

CREATE TABLE "FinanceAccount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "parentAccountId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MXN',
  "initialBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceJournalEntry" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdById" TEXT,
  "entryNumber" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "concept" TEXT NOT NULL,
  "reference" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'MXN',
  "sourceType" TEXT NOT NULL DEFAULT 'manual',
  "metadata" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceJournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceJournalLine" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "contactId" TEXT,
  "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'MXN',
  "fxRate" DECIMAL(65,30),
  "baseAmount" DECIMAL(65,30),
  "note" TEXT,
  "metadata" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceJournalLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceFxRate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "baseCurrency" TEXT NOT NULL,
  "quoteCurrency" TEXT NOT NULL,
  "rateDate" TIMESTAMP(3) NOT NULL,
  "rate" DECIMAL(65,30) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "metadata" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceFxRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceAccount_companyId_code_key" ON "FinanceAccount"("companyId", "code");
CREATE INDEX "FinanceAccount_companyId_enabled_idx" ON "FinanceAccount"("companyId", "enabled");
CREATE INDEX "FinanceAccount_companyId_type_idx" ON "FinanceAccount"("companyId", "type");

CREATE UNIQUE INDEX "FinanceJournalEntry_companyId_entryNumber_key" ON "FinanceJournalEntry"("companyId", "entryNumber");
CREATE INDEX "FinanceJournalEntry_companyId_occurredAt_idx" ON "FinanceJournalEntry"("companyId", "occurredAt");
CREATE INDEX "FinanceJournalEntry_enabled_occurredAt_idx" ON "FinanceJournalEntry"("enabled", "occurredAt");

CREATE INDEX "FinanceJournalLine_entryId_idx" ON "FinanceJournalLine"("entryId");
CREATE INDEX "FinanceJournalLine_accountId_idx" ON "FinanceJournalLine"("accountId");
CREATE INDEX "FinanceJournalLine_contactId_idx" ON "FinanceJournalLine"("contactId");

CREATE UNIQUE INDEX "FinanceFxRate_companyId_baseCurrency_quoteCurrency_rateDate_key"
ON "FinanceFxRate"("companyId", "baseCurrency", "quoteCurrency", "rateDate");
CREATE INDEX "FinanceFxRate_companyId_rateDate_idx" ON "FinanceFxRate"("companyId", "rateDate");
CREATE INDEX "FinanceFxRate_companyId_baseCurrency_quoteCurrency_idx"
ON "FinanceFxRate"("companyId", "baseCurrency", "quoteCurrency");

ALTER TABLE "FinanceAccount"
  ADD CONSTRAINT "FinanceAccount_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceAccount"
  ADD CONSTRAINT "FinanceAccount_parentAccountId_fkey"
  FOREIGN KEY ("parentAccountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinanceJournalEntry"
  ADD CONSTRAINT "FinanceJournalEntry_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceJournalLine"
  ADD CONSTRAINT "FinanceJournalLine_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "FinanceJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceJournalLine"
  ADD CONSTRAINT "FinanceJournalLine_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinanceJournalLine"
  ADD CONSTRAINT "FinanceJournalLine_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinanceFxRate"
  ADD CONSTRAINT "FinanceFxRate_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
