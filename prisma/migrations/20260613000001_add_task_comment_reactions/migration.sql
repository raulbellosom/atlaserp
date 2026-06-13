CREATE TABLE "task_comment_reaction" (
  "id"         UUID        NOT NULL DEFAULT uuidv7(),
  "comment_id" UUID        NOT NULL,
  "user_id"    UUID        NOT NULL,
  "emoji"      VARCHAR(10) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "task_comment_reaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_comment_reaction_comment_id_user_id_emoji_key"
  ON "task_comment_reaction"("comment_id", "user_id", "emoji");

CREATE INDEX "task_comment_reaction_comment_id_idx"
  ON "task_comment_reaction"("comment_id");

ALTER TABLE "task_comment_reaction"
  ADD CONSTRAINT "task_comment_reaction_comment_id_fkey"
  FOREIGN KEY ("comment_id") REFERENCES "task_comment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_comment_reaction"
  ADD CONSTRAINT "task_comment_reaction_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
