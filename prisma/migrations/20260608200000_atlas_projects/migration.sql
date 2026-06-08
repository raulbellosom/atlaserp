CREATE TYPE "project_lifecycle_status" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "project_member_role" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');
CREATE TYPE "task_priority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "project" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "icon" TEXT,
  "owner_id" UUID NOT NULL,
  "start_date" TIMESTAMP(3),
  "due_date" TIMESTAMP(3),
  "calendar_id" UUID,
  "status" "project_lifecycle_status" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_company_id_idx" ON "project"("company_id");
CREATE INDEX "project_owner_id_idx" ON "project"("owner_id");

ALTER TABLE "project" ADD CONSTRAINT "project_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "project_member" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "project_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "project_member_role" NOT NULL DEFAULT 'MEMBER',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_member_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_member_project_id_user_id_key" ON "project_member"("project_id", "user_id");
CREATE INDEX "project_member_user_id_idx" ON "project_member"("user_id");

ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "task_status" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "project_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#64748b',
  "position" INTEGER NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_done" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "task_status_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_status_project_id_position_idx" ON "task_status"("project_id", "position");

ALTER TABLE "task_status" ADD CONSTRAINT "task_status_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "task" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "project_id" UUID NOT NULL,
  "status_id" UUID NOT NULL,
  "parent_task_id" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assignee_id" UUID,
  "priority" "task_priority" NOT NULL DEFAULT 'NONE',
  "start_date" TIMESTAMP(3),
  "due_date" TIMESTAMP(3),
  "calendar_event_id" UUID,
  "position" INTEGER NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_project_id_status_id_position_idx" ON "task"("project_id", "status_id", "position");
CREATE INDEX "task_assignee_id_idx" ON "task"("assignee_id");
CREATE INDEX "task_due_date_idx" ON "task"("due_date");

ALTER TABLE "task" ADD CONSTRAINT "task_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task" ADD CONSTRAINT "task_status_id_fkey"
  FOREIGN KEY ("status_id") REFERENCES "task_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task" ADD CONSTRAINT "task_parent_task_id_fkey"
  FOREIGN KEY ("parent_task_id") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
