-- prisma/migrations/20260913120000_add_call_recording/migration.sql
CREATE TABLE "call_recording" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "call_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STARTING',
    "started_by_user_id" UUID NOT NULL,
    "egress_id" TEXT,
    "playlist_object_key" TEXT,
    "size_bytes" BIGINT,
    "duration_ms" INTEGER,
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_recording_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "call_recording_call_id_idx" ON "call_recording"("call_id");
CREATE INDEX "call_recording_conversation_id_idx" ON "call_recording"("conversation_id");
CREATE INDEX "call_recording_status_idx" ON "call_recording"("status");
CREATE INDEX "call_recording_expires_at_idx" ON "call_recording"("expires_at");

ALTER TABLE "call_recording" ADD CONSTRAINT "call_recording_call_id_fkey"
    FOREIGN KEY ("call_id") REFERENCES "call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "call_recording" ADD CONSTRAINT "call_recording_started_by_user_id_fkey"
    FOREIGN KEY ("started_by_user_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
