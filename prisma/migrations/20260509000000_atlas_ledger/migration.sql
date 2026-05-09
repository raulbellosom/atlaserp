-- CreateEnum
CREATE TYPE "LedgerMovementDirection" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerMovementStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'otro',
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "initialBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdById" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "direction" "LedgerMovementDirection" NOT NULL,
    "movementType" TEXT,
    "number" TEXT,
    "name" TEXT,
    "reference" TEXT,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "balanceAfter" DECIMAL(65,30) NOT NULL,
    "status" "LedgerMovementStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "createdById" TEXT,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_companyId_name_key" ON "LedgerAccount"("companyId", "name");

-- CreateIndex
CREATE INDEX "LedgerAccount_companyId_enabled_idx" ON "LedgerAccount"("companyId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerMovement_accountId_sequenceNumber_key" ON "LedgerMovement"("accountId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "LedgerMovement_companyId_occurredAt_idx" ON "LedgerMovement"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "LedgerMovement_accountId_occurredAt_idx" ON "LedgerMovement"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "LedgerMovement_accountId_status_idx" ON "LedgerMovement"("accountId", "status");

-- CreateIndex
CREATE INDEX "LedgerMovement_companyId_status_idx" ON "LedgerMovement"("companyId", "status");

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerMovement" ADD CONSTRAINT "LedgerMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerMovement" ADD CONSTRAINT "LedgerMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
