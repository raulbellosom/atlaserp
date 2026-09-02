-- CreateEnum
CREATE TYPE "pfm_assistant_role" AS ENUM ('USER', 'ASSISTANT', 'TOOL');

-- CreateTable
CREATE TABLE "pfm_assistant_thread" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_assistant_thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pfm_assistant_message" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "thread_id" UUID NOT NULL,
    "role" "pfm_assistant_role" NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pfm_assistant_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pfm_assistant_thread_owner_id_updated_at_idx" ON "pfm_assistant_thread"("owner_id", "updated_at");

-- CreateIndex
CREATE INDEX "pfm_assistant_message_thread_id_created_at_idx" ON "pfm_assistant_message"("thread_id", "created_at");

-- AddForeignKey
ALTER TABLE "pfm_assistant_message" ADD CONSTRAINT "pfm_assistant_message_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "pfm_assistant_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
