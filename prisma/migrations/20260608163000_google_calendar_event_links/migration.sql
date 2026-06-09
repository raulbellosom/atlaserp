CREATE TABLE "google_calendar_event_link" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "source_id" UUID NOT NULL REFERENCES "google_calendar_source"("id") ON DELETE CASCADE,
  "atlas_event_id" UUID NOT NULL REFERENCES "calendar_event"("id") ON DELETE CASCADE,
  "google_event_id" TEXT NOT NULL,
  "google_ical_uid" TEXT NULL,
  "google_recurring_event_id" TEXT NULL,
  "google_original_start_at" TIMESTAMP(3) NULL,
  "google_updated_at" TIMESTAMP(3) NULL,
  "google_status" TEXT NULL,
  "is_detached" BOOLEAN NOT NULL DEFAULT FALSE,
  "detached_at" TIMESTAMP(3) NULL,
  "cancelled_in_google_at" TIMESTAMP(3) NULL,
  "last_seen_at" TIMESTAMP(3) NULL,
  "raw_snapshot" JSONB NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "google_calendar_event_link_atlas_event_id_key"
    UNIQUE ("atlas_event_id"),
  CONSTRAINT "google_calendar_event_link_source_id_google_event_id_key"
    UNIQUE ("source_id", "google_event_id")
);

CREATE INDEX "google_calendar_event_link_source_recurring_original_idx"
  ON "google_calendar_event_link" ("source_id", "google_recurring_event_id", "google_original_start_at");
