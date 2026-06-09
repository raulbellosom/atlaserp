-- V2.3: task_dependency, rrule on task, project_field, task_field_value

-- Task dependencies (blocker ↔ blocked)
CREATE TABLE "task_dependency" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_dependency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "task_dependency_blocker_id_blocked_id_key" ON "task_dependency"("blocker_id", "blocked_id");
CREATE INDEX "task_dependency_blocker_id_idx" ON "task_dependency"("blocker_id");
CREATE INDEX "task_dependency_blocked_id_idx" ON "task_dependency"("blocked_id");
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_blocker_id_fkey"
    FOREIGN KEY ("blocker_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_blocked_id_fkey"
    FOREIGN KEY ("blocked_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recurring task fields on task
ALTER TABLE "task" ADD COLUMN "rrule" TEXT;
ALTER TABLE "task" ADD COLUMN "rrule_next_at" TIMESTAMP(3);
CREATE INDEX "task_rrule_next_at_idx" ON "task"("rrule_next_at") WHERE "rrule" IS NOT NULL;

-- Custom fields per project
CREATE TABLE "project_field" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "options" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_field_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_field_project_id_idx" ON "project_field"("project_id");
ALTER TABLE "project_field" ADD CONSTRAINT "project_field_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Task field values (EAV)
CREATE TABLE "task_field_value" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "task_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "task_field_value_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "task_field_value_task_id_field_id_key" ON "task_field_value"("task_id", "field_id");
CREATE INDEX "task_field_value_task_id_idx" ON "task_field_value"("task_id");
ALTER TABLE "task_field_value" ADD CONSTRAINT "task_field_value_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_field_value" ADD CONSTRAINT "task_field_value_field_id_fkey"
    FOREIGN KEY ("field_id") REFERENCES "project_field"("id") ON DELETE CASCADE ON UPDATE CASCADE;
