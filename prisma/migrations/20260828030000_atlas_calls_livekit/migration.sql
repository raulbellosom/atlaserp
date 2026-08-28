-- =============================================================================
-- Atlas Calls — LiveKit-backed voice/video calls for atlas.chat
-- =============================================================================

CREATE TYPE "CallKind" AS ENUM ('AUDIO', 'VIDEO');
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACTIVE', 'ENDED');
CREATE TYPE "CallParticipantStatus" AS ENUM (
  'INVITED', 'RINGING', 'JOINED', 'LEFT', 'DECLINED', 'MISSED'
);

CREATE TABLE "call" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "conversation_id" UUID NOT NULL,
  "calendar_event_id" UUID,
  "kind" "CallKind" NOT NULL,
  "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
  "initiated_by_user_id" UUID NOT NULL,
  "livekit_room_name" TEXT NOT NULL,
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "end_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "call_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "call_calendar_event_id_fkey"
    FOREIGN KEY ("calendar_event_id") REFERENCES "calendar_event"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "call_initiated_by_user_id_fkey"
    FOREIGN KEY ("initiated_by_user_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "call_livekit_room_name_key" ON "call"("livekit_room_name");
CREATE INDEX "call_conversation_id_idx" ON "call"("conversation_id");
CREATE INDEX "call_calendar_event_id_idx" ON "call"("calendar_event_id");
CREATE INDEX "call_initiated_by_user_id_idx" ON "call"("initiated_by_user_id");
CREATE UNIQUE INDEX "call_one_live_per_conversation_idx"
  ON "call"("conversation_id")
  WHERE "status" IN ('RINGING', 'ACTIVE');

CREATE TABLE "call_participant" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "call_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "CallParticipantStatus" NOT NULL DEFAULT 'INVITED',
  "livekit_identity" TEXT,
  "joined_at" TIMESTAMP(3),
  "left_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "call_participant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "call_participant_call_id_fkey"
    FOREIGN KEY ("call_id") REFERENCES "call"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "call_participant_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "call_participant_call_id_user_id_key"
  ON "call_participant"("call_id", "user_id");
CREATE INDEX "call_participant_user_id_status_idx"
  ON "call_participant"("user_id", "status");

-- Realtime needs the tables in the publication. The guarded block also keeps
-- local/shadow databases usable when Supabase's publication is absent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "call";
    ALTER PUBLICATION supabase_realtime ADD TABLE "call_participant";
  END IF;
END $$;

GRANT SELECT ON TABLE "call" TO authenticated;
GRANT SELECT ON TABLE "call_participant" TO authenticated;

ALTER TABLE "call" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_participant" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "call_member_select" ON "call"
  FOR SELECT TO authenticated
  USING (chat_is_member(conversation_id));

CREATE POLICY "call_participant_member_select" ON "call_participant"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "call" c
      WHERE c.id = call_id
        AND chat_is_member(c.conversation_id)
    )
  );

CREATE POLICY "call_service_all" ON "call"
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "call_participant_service_all" ON "call_participant"
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
