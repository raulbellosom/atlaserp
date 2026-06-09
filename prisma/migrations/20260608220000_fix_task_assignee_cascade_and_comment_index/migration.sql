-- Fix: change user FK in project_task_assignee from CASCADE to RESTRICT
ALTER TABLE "project_task_assignee"
  DROP CONSTRAINT IF EXISTS "project_task_assignee_user_id_fkey";

ALTER TABLE "project_task_assignee"
  ADD CONSTRAINT "project_task_assignee_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fix: add missing index on task_comment.task_id
CREATE INDEX "task_comment_task_id_idx" ON "task_comment"("task_id");
