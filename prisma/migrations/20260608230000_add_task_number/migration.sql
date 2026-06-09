-- Add task counter to project
ALTER TABLE "project" ADD COLUMN "task_counter" INTEGER NOT NULL DEFAULT 0;

-- Add task number to task (nullable — existing tasks will have NULL)
ALTER TABLE "task" ADD COLUMN "task_number" INTEGER;

-- Unique constraint per project
ALTER TABLE "task" ADD CONSTRAINT "task_project_id_task_number_key" UNIQUE ("project_id", "task_number");
