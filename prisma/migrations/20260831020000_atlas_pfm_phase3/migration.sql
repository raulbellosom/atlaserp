-- atlas.pfm — Finanzas personales (Phase 3: receipt capture)

-- CreateEnum
CREATE TYPE "pfm_receipt_status" AS ENUM ('PROCESSING', 'PARSED', 'FAILED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "pfm_receipt" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "status" "pfm_receipt_status" NOT NULL DEFAULT 'PROCESSING',
    "provider" TEXT NOT NULL DEFAULT 'groq',
    "model" TEXT,
    "raw_response" JSONB,
    "parsed" JSONB,
    "movement_id" UUID,
    "error_reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pfm_receipt_status_enabled_idx" ON "pfm_receipt"("status", "enabled");

-- CreateIndex
CREATE INDEX "pfm_receipt_owner_id_created_at_idx" ON "pfm_receipt"("owner_id", "created_at");
