-- atlas.pfm — Finanzas personales (Phase 2: recurring rules)

-- CreateEnum
CREATE TYPE "pfm_recurring_amount_mode" AS ENUM ('FIXED', 'VARIABLE');

-- CreateTable
CREATE TABLE "pfm_recurring_rule" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "category_id" UUID,
    "direction" "pfm_movement_direction" NOT NULL,
    "amount_mode" "pfm_recurring_amount_mode" NOT NULL,
    "amount" DECIMAL(15,2),
    "rrule" JSONB NOT NULL,
    "auto_post" BOOLEAN NOT NULL DEFAULT false,
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "end_on" DATE,
    "calendar_event_id" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_recurring_rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pfm_recurring_rule_next_run_at_enabled_idx" ON "pfm_recurring_rule"("next_run_at", "enabled");

-- CreateIndex
CREATE INDEX "pfm_recurring_rule_wallet_id_enabled_idx" ON "pfm_recurring_rule"("wallet_id", "enabled");

-- AddForeignKey
ALTER TABLE "pfm_recurring_rule" ADD CONSTRAINT "pfm_recurring_rule_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "pfm_wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Idempotent materialization guard: one movement per (rule, day)
CREATE UNIQUE INDEX "pfm_movement_recurring_rule_id_occurred_on_key"
  ON "pfm_movement"("recurring_rule_id", "occurred_on")
  WHERE "recurring_rule_id" IS NOT NULL;
