CREATE TABLE "sync_mutation_log" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "idempotency_key" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "module_key" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "record_id" UUID,
  "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sync_mutation_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sync_mutation_log_idempotency_key_key" ON "sync_mutation_log"("idempotency_key");
CREATE INDEX "sync_mutation_log_idempotency_key_idx" ON "sync_mutation_log"("idempotency_key");
CREATE INDEX "sync_mutation_log_company_id_applied_at_idx" ON "sync_mutation_log"("company_id", "applied_at");
