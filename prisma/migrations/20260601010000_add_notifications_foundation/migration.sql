-- AlterTable
ALTER TABLE "notification"
ADD COLUMN "event_type" TEXT NOT NULL DEFAULT 'system.general',
ADD COLUMN "source_type" TEXT,
ADD COLUMN "source_id" TEXT,
ADD COLUMN "source_activity_id" UUID,
ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN "metadata" JSONB,
ADD COLUMN "dedupe_key" TEXT,
ADD COLUMN "expires_at" TIMESTAMP(3),
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "notification_delivery" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "notification_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscription" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "company_id" UUID,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "device_label" TEXT,
    "user_agent" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preference" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "push_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mute_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_company_id_created_at_idx" ON "notification" ("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_user_id_priority_created_at_idx" ON "notification" ("user_id", "priority", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_event_type_created_at_idx" ON "notification" ("event_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_dedupe_key_idx" ON "notification" ("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_delivery_notification_id_idx" ON "notification_delivery" ("notification_id");

-- CreateIndex
CREATE INDEX "notification_delivery_channel_status_created_at_idx" ON "notification_delivery" ("channel", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription" ("endpoint");

-- CreateIndex
CREATE INDEX "push_subscription_user_id_enabled_idx" ON "push_subscription" ("user_id", "enabled");

-- CreateIndex
CREATE INDEX "push_subscription_company_id_enabled_idx" ON "push_subscription" ("company_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preference_user_id_event_type_key" ON "notification_preference" ("user_id", "event_type");

-- CreateIndex
CREATE INDEX "notification_preference_user_id_idx" ON "notification_preference" ("user_id");

-- AddForeignKey
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
