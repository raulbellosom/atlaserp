-- Atlas Calendar migration: add_atlas_calendar
-- Applied manually due to Atlas ORM drift on fleet/ledger tables

CREATE TYPE "calendar_share_role" AS ENUM ('VIEWER', 'EDITOR', 'MANAGER');
CREATE TYPE "calendar_attendee_status" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "calendar_calendar" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "owner_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#6B46C1',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calendar_calendar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_share" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "calendar_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "calendar_share_role" NOT NULL DEFAULT 'VIEWER',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calendar_share_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_event" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "calendar_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "start_at" TIMESTAMP(3) NOT NULL,
  "end_at" TIMESTAMP(3),
  "all_day" BOOLEAN NOT NULL DEFAULT false,
  "location" TEXT,
  "video_url" TEXT,
  "color" TEXT,
  "recurrence_rule" JSONB,
  "source_module" TEXT,
  "source_entity_id" UUID,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calendar_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_event_file" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "event_id" UUID NOT NULL,
  "file_asset_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calendar_event_file_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_event_attendee" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "event_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "calendar_attendee_status" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calendar_event_attendee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_reminder" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "event_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "minutes_before" INTEGER NOT NULL,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calendar_reminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_notification" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "user_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'REMINDER',
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calendar_notification_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "calendar_calendar_owner_id_idx" ON "calendar_calendar"("owner_id");
CREATE UNIQUE INDEX "calendar_share_calendar_id_user_id_key" ON "calendar_share"("calendar_id", "user_id");
CREATE INDEX "calendar_event_calendar_id_idx" ON "calendar_event"("calendar_id");
CREATE INDEX "calendar_event_start_at_idx" ON "calendar_event"("start_at");
CREATE INDEX "calendar_event_source_module_source_entity_id_idx" ON "calendar_event"("source_module", "source_entity_id");
CREATE UNIQUE INDEX "calendar_event_file_event_id_file_asset_id_key" ON "calendar_event_file"("event_id", "file_asset_id");
CREATE UNIQUE INDEX "calendar_event_attendee_event_id_user_id_key" ON "calendar_event_attendee"("event_id", "user_id");
CREATE UNIQUE INDEX "calendar_reminder_event_id_user_id_minutes_before_key" ON "calendar_reminder"("event_id", "user_id", "minutes_before");
CREATE INDEX "calendar_notification_user_id_read_at_idx" ON "calendar_notification"("user_id", "read_at");

-- Foreign keys
ALTER TABLE "calendar_calendar" ADD CONSTRAINT "calendar_calendar_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calendar_share" ADD CONSTRAINT "calendar_share_calendar_id_fkey"
  FOREIGN KEY ("calendar_id") REFERENCES "calendar_calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_share" ADD CONSTRAINT "calendar_share_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_calendar_id_fkey"
  FOREIGN KEY ("calendar_id") REFERENCES "calendar_calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_event_file" ADD CONSTRAINT "calendar_event_file_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "calendar_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_file" ADD CONSTRAINT "calendar_event_file_file_asset_id_fkey"
  FOREIGN KEY ("file_asset_id") REFERENCES "file_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calendar_event_attendee" ADD CONSTRAINT "calendar_event_attendee_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "calendar_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_attendee" ADD CONSTRAINT "calendar_event_attendee_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calendar_reminder" ADD CONSTRAINT "calendar_reminder_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "calendar_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_reminder" ADD CONSTRAINT "calendar_reminder_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calendar_notification" ADD CONSTRAINT "calendar_notification_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_notification" ADD CONSTRAINT "calendar_notification_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "calendar_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
