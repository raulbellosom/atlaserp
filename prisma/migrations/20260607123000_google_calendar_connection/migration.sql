CREATE TYPE "google_calendar_connection_status" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "google_calendar_connection" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "user_id" UUID NOT NULL,
  "google_subject" TEXT NOT NULL,
  "google_email" TEXT NOT NULL,
  "access_token_encrypted" TEXT,
  "refresh_token_encrypted" TEXT,
  "token_expires_at" TIMESTAMP(3) NOT NULL,
  "scopes" JSONB NOT NULL,
  "status" "google_calendar_connection_status" NOT NULL DEFAULT 'ACTIVE',
  "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_sync_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "google_calendar_connection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_calendar_connection_user_id_key" ON "google_calendar_connection"("user_id");
CREATE INDEX "google_calendar_connection_status_idx" ON "google_calendar_connection"("status");

ALTER TABLE "google_calendar_connection" ADD CONSTRAINT "google_calendar_connection_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
