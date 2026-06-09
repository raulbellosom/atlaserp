-- CreateTable: task_mention — stores @[userId] mentions extracted from task comments
CREATE TABLE "task_mention" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "comment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_mention_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_mention_comment_id_user_id_key" ON "task_mention"("comment_id", "user_id");
CREATE INDEX "task_mention_comment_id_idx" ON "task_mention"("comment_id");
CREATE INDEX "task_mention_user_id_idx" ON "task_mention"("user_id");

ALTER TABLE "task_mention" ADD CONSTRAINT "task_mention_comment_id_fkey"
    FOREIGN KEY ("comment_id") REFERENCES "task_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_mention" ADD CONSTRAINT "task_mention_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
