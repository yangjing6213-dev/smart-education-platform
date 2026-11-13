-- CreateEnum
CREATE TYPE "staff_task_code" AS ENUM ('DAILY_CHECK', 'TEMPORARY_SUPPORT', 'STUDENT_FOLLOW_UP', 'ACTIVITY_SETUP', 'SAFETY_RESPONSE');

-- CreateEnum
CREATE TYPE "staff_task_target_type" AS ENUM ('CLASS', 'STUDENT', 'ACTIVITY', 'CAMPUS');

-- CreateEnum
CREATE TYPE "staff_task_priority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

-- CreateEnum
CREATE TYPE "staff_task_status" AS ENUM ('ASSIGNED', 'CLAIMED', 'IN_PROGRESS', 'COMPLETED', 'CHECKED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "staff_task_result" AS ENUM ('COMPLETED_AS_PLANNED', 'FOLLOW_UP_REQUIRED', 'BLOCKED');

-- CreateTable
CREATE TABLE "work_tasks" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "class_ref" VARCHAR(80) NOT NULL,
    "code" "staff_task_code" NOT NULL,
    "target_type" "staff_task_target_type" NOT NULL,
    "target_ref" VARCHAR(80) NOT NULL,
    "student_id" UUID,
    "due_date" DATE NOT NULL,
    "priority" "staff_task_priority" NOT NULL,
    "status" "staff_task_status" NOT NULL DEFAULT 'ASSIGNED',
    "result" "staff_task_result",
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "assignee_membership_id" UUID NOT NULL,
    "claimed_by_membership_id" UUID,
    "completed_by_membership_id" UUID,
    "checked_by_membership_id" UUID,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_tasks_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateIndex
CREATE INDEX "work_tasks_tenant_id_campus_id_assignee_membership_id_statu_idx" ON "work_tasks"("tenant_id", "campus_id", "assignee_membership_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "work_tasks_tenant_id_campus_id_class_ref_due_date_idx" ON "work_tasks"("tenant_id", "campus_id", "class_ref", "due_date");

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_tenant_id_campus_id_student_id_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_tenant_id_created_by_membership_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_tenant_id_assignee_membership_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "assignee_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_tenant_id_claimed_by_membership_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "claimed_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_tenant_id_completed_by_membership_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "completed_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_tenant_id_checked_by_membership_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "checked_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_tenant_id_updated_by_membership_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add domain checks not expressible in the Prisma schema.
ALTER TABLE "work_tasks"
  ADD CONSTRAINT "work_tasks_positive_version_check"
  CHECK ("version" >= 1);

ALTER TABLE "work_tasks"
  ADD CONSTRAINT "work_tasks_student_target_check"
  CHECK (
    ("target_type" = 'STUDENT' AND "student_id" IS NOT NULL AND "target_ref" = "student_id"::text)
    OR ("target_type" <> 'STUDENT' AND "student_id" IS NULL)
  );