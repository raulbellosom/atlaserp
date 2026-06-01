-- CreateTable
CREATE TABLE "activity" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "link" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "source" TEXT NOT NULL DEFAULT 'explicit',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_company_id_created_at_idx" ON "activity" ("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_company_id_entity_type_entity_id_created_at_idx" ON "activity" ("company_id", "entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_company_id_type_created_at_idx" ON "activity" ("company_id", "type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_company_id_actor_id_created_at_idx" ON "activity" ("company_id", "actor_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
