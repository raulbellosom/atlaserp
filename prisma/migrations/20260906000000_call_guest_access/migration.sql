-- =============================================================================
-- Atlas Calls — external guest access (links, codes, invites, lobby, chat)
-- =============================================================================

CREATE TABLE "call_link" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "conversation_id" UUID NOT NULL,
  "token" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "require_lobby" BOOLEAN NOT NULL DEFAULT true,
  "max_uses" INTEGER,
  "use_count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_link_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "call_link_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "user_profile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "call_link_token_key" ON "call_link"("token");
CREATE UNIQUE INDEX "call_link_code_key" ON "call_link"("code");
CREATE UNIQUE INDEX "call_link_one_live_per_conversation_idx"
  ON "call_link"("conversation_id") WHERE "revoked_at" IS NULL;
CREATE INDEX "call_link_conversation_id_idx" ON "call_link"("conversation_id");

CREATE TABLE "call_invite" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "link_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "email_normalized" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "invited_by_user_id" UUID NOT NULL,
  "sent_at" TIMESTAMP(3),
  "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_invite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "call_invite_link_id_fkey"
    FOREIGN KEY ("link_id") REFERENCES "call_link"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "call_invite_invited_by_user_id_fkey"
    FOREIGN KEY ("invited_by_user_id") REFERENCES "user_profile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "call_invite_token_key" ON "call_invite"("token");
CREATE INDEX "call_invite_link_id_email_normalized_idx"
  ON "call_invite"("link_id", "email_normalized");

CREATE TABLE "call_guest" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "call_id" UUID NOT NULL,
  "link_id" UUID,
  "invite_id" UUID,
  "display_name" TEXT NOT NULL,
  "email" TEXT,
  "session_token_hash" TEXT NOT NULL,
  "livekit_identity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'LOBBY',
  "admitted_by_user_id" UUID,
  "join_ip" TEXT,
  "user_agent" TEXT,
  "admitted_at" TIMESTAMP(3),
  "left_at" TIMESTAMP(3),
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_guest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "call_guest_status_check"
    CHECK ("status" IN ('LOBBY','ADMITTED','LEFT','KICKED','DENIED')),
  CONSTRAINT "call_guest_call_id_fkey"
    FOREIGN KEY ("call_id") REFERENCES "call"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "call_guest_link_id_fkey"
    FOREIGN KEY ("link_id") REFERENCES "call_link"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "call_guest_invite_id_fkey"
    FOREIGN KEY ("invite_id") REFERENCES "call_invite"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "call_guest_admitted_by_user_id_fkey"
    FOREIGN KEY ("admitted_by_user_id") REFERENCES "user_profile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "call_guest_call_id_livekit_identity_key"
  ON "call_guest"("call_id", "livekit_identity");
CREATE INDEX "call_guest_call_id_status_idx" ON "call_guest"("call_id", "status");
CREATE INDEX "call_guest_session_token_hash_idx" ON "call_guest"("session_token_hash");

CREATE TABLE "call_message" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "call_id" UUID NOT NULL,
  "sender_kind" TEXT NOT NULL,
  "sender_user_id" UUID,
  "sender_guest_id" UUID,
  "sender_name" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_message_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "call_message_sender_kind_check"
    CHECK ("sender_kind" IN ('user','guest','system')),
  CONSTRAINT "call_message_call_id_fkey"
    FOREIGN KEY ("call_id") REFERENCES "call"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "call_message_sender_user_id_fkey"
    FOREIGN KEY ("sender_user_id") REFERENCES "user_profile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "call_message_sender_guest_id_fkey"
    FOREIGN KEY ("sender_guest_id") REFERENCES "call_guest"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "call_message_call_id_created_at_idx"
  ON "call_message"("call_id", "created_at");

CREATE TABLE "call_guest_join_attempt" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "ip" TEXT NOT NULL,
  "link_id" UUID,
  "outcome" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_guest_join_attempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "call_guest_join_attempt_ip_created_at_idx"
  ON "call_guest_join_attempt"("ip", "created_at");

-- Realtime publication (guarded, same pattern as the calls migration)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "call_guest";
    ALTER PUBLICATION supabase_realtime ADD TABLE "call_message";
  END IF;
END $$;

GRANT SELECT ON TABLE "call_link" TO authenticated;
GRANT SELECT ON TABLE "call_guest" TO authenticated;
GRANT SELECT ON TABLE "call_message" TO authenticated;

ALTER TABLE "call_link" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_invite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_guest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_guest_join_attempt" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "call_link_member_select" ON "call_link"
  FOR SELECT TO authenticated USING (chat_is_member(conversation_id));
CREATE POLICY "call_guest_member_select" ON "call_guest"
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM "call" c WHERE c.id = call_id AND chat_is_member(c.conversation_id))
  );
CREATE POLICY "call_message_member_select" ON "call_message"
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM "call" c WHERE c.id = call_id AND chat_is_member(c.conversation_id))
  );

CREATE POLICY "call_link_service_all" ON "call_link"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "call_invite_service_all" ON "call_invite"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "call_guest_service_all" ON "call_guest"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "call_message_service_all" ON "call_message"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "call_guest_join_attempt_service_all" ON "call_guest_join_attempt"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
