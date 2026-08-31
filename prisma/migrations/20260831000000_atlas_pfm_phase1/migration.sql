-- atlas.pfm — Finanzas personales (Phase 1)

-- CreateEnum
CREATE TYPE "pfm_wallet_kind" AS ENUM ('CASH', 'DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "pfm_wallet_member_role" AS ENUM ('VIEWER', 'EDITOR');

-- CreateEnum
CREATE TYPE "pfm_category_kind" AS ENUM ('EXPENSE', 'INCOME');

-- CreateEnum
CREATE TYPE "pfm_movement_direction" AS ENUM ('EXPENSE', 'INCOME');

-- CreateEnum
CREATE TYPE "pfm_movement_status" AS ENUM ('PENDING', 'POSTED', 'SKIPPED');

-- CreateTable
CREATE TABLE "pfm_wallet" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "pfm_wallet_kind" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "color" TEXT,
    "icon" TEXT,
    "ledger_account_id" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pfm_wallet_member" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "wallet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "pfm_wallet_member_role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfm_wallet_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pfm_category" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID,
    "name" TEXT NOT NULL,
    "kind" "pfm_category_kind" NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "parent_id" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pfm_movement" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "category_id" UUID,
    "direction" "pfm_movement_direction" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "occurred_on" DATE NOT NULL,
    "note" TEXT,
    "merchant" TEXT,
    "status" "pfm_movement_status" NOT NULL DEFAULT 'POSTED',
    "recurring_rule_id" UUID,
    "receipt_id" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pfm_ledger_enrichment" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "ledger_transaction_id" UUID NOT NULL,
    "category_id" UUID,
    "receipt_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_ledger_enrichment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pfm_wallet_company_id_owner_id_enabled_idx" ON "pfm_wallet"("company_id", "owner_id", "enabled");

-- CreateIndex
CREATE INDEX "pfm_wallet_ledger_account_id_idx" ON "pfm_wallet"("ledger_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "pfm_wallet_member_wallet_id_user_id_key" ON "pfm_wallet_member"("wallet_id", "user_id");

-- CreateIndex
CREATE INDEX "pfm_wallet_member_user_id_idx" ON "pfm_wallet_member"("user_id");

-- CreateIndex
CREATE INDEX "pfm_category_company_id_kind_enabled_idx" ON "pfm_category"("company_id", "kind", "enabled");

-- CreateIndex
CREATE INDEX "pfm_category_owner_id_idx" ON "pfm_category"("owner_id");

-- CreateIndex
CREATE INDEX "pfm_movement_wallet_id_status_occurred_on_idx" ON "pfm_movement"("wallet_id", "status", "occurred_on");

-- CreateIndex
CREATE INDEX "pfm_movement_wallet_id_occurred_on_idx" ON "pfm_movement"("wallet_id", "occurred_on");

-- CreateIndex
CREATE UNIQUE INDEX "pfm_ledger_enrichment_ledger_transaction_id_key" ON "pfm_ledger_enrichment"("ledger_transaction_id");

-- CreateIndex
CREATE INDEX "pfm_ledger_enrichment_wallet_id_idx" ON "pfm_ledger_enrichment"("wallet_id");

-- AddForeignKey
ALTER TABLE "pfm_wallet_member" ADD CONSTRAINT "pfm_wallet_member_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "pfm_wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pfm_movement" ADD CONSTRAINT "pfm_movement_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "pfm_wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
