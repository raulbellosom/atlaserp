-- CreateTable
CREATE TABLE "project_task_assignee" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_task_assignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comment" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" VARCHAR(5000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),

    CONSTRAINT "task_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_task_assignee_task_id_user_id_key" ON "project_task_assignee"("task_id", "user_id");

-- AddForeignKey
ALTER TABLE "project_task_assignee" ADD CONSTRAINT "project_task_assignee_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_assignee" ADD CONSTRAINT "project_task_assignee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
