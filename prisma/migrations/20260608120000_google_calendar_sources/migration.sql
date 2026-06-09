CREATE TYPE "google_calendar_source_status" AS ENUM (
  'PENDING_INITIAL_SYNC',
  'ACTIVE',
  'DISABLED',
  'ERROR',
  'NEEDS_RESYNC'
);

CREATE TABLE "google_calendar_source" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "connection_id" UUID NOT NULL REFERENCES "google_calendar_connection"("id") ON DELETE CASCADE,
  "google_calendar_id" TEXT NOT NULL,
  "google_calendar_name" TEXT NOT NULL,
  "google_calendar_time_zone" TEXT NULL,
  "atlas_calendar_id" UUID NOT NULL REFERENCES "calendar_calendar"("id") ON DELETE RESTRICT,
  "sync_token" TEXT NULL,
  "sync_status" "google_calendar_source_status" NOT NULL DEFAULT 'PENDING_INITIAL_SYNC',
  "last_full_sync_at" TIMESTAMP(3) NULL,
  "last_incremental_sync_at" TIMESTAMP(3) NULL,
  "last_error_at" TIMESTAMP(3) NULL,
  "last_error_message" TEXT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "google_calendar_source_connection_id_google_calendar_id_key"
    UNIQUE ("connection_id", "google_calendar_id")
);

CREATE UNIQUE INDEX "google_calendar_source_atlas_calendar_id_key"
  ON "google_calendar_source" ("atlas_calendar_id");

CREATE INDEX "google_calendar_source_connection_id_enabled_idx"
  ON "google_calendar_source" ("connection_id", "enabled");
