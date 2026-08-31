-- atlas.pfm — Finanzas personales (Phase 4: budgets, goals, credit cycle)

-- AlterTable: credit-card fields on pfm_wallet
ALTER TABLE "pfm_wallet"
  ADD COLUMN "credit_limit" DECIMAL(15,2),
  ADD COLUMN "statement_day" INTEGER,
  ADD COLUMN "payment_due_day" INTEGER,
  ADD COLUMN "credit_reminder_event_id" UUID;

-- CreateEnum
CREATE TYPE "pfm_budget_period" AS ENUM ('MONTHLY');

-- CreateTable
CREATE TABLE "pfm_budget" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "wallet_id" UUID,
    "period" "pfm_budget_period" NOT NULL DEFAULT 'MONTHLY',
    "amount" DECIMAL(15,2) NOT NULL,
    "alert_threshold" DECIMAL(4,3) NOT NULL DEFAULT 0.8,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pfm_goal" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target_amount" DECIMAL(15,2) NOT NULL,
    "target_date" DATE,
    "wallet_id" UUID,
    "current_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "color" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pfm_budget_owner_id_category_id_wallet_id_period_key"
  ON "pfm_budget"("owner_id", "category_id", "wallet_id", "period");
CREATE INDEX "pfm_budget_company_id_owner_id_enabled_idx" ON "pfm_budget"("company_id", "owner_id", "enabled");
CREATE INDEX "pfm_goal_company_id_owner_id_enabled_idx" ON "pfm_goal"("company_id", "owner_id", "enabled");
