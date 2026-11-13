-- CreateEnum
CREATE TYPE "staff_daily_status" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "staff_daily_arrival_code" AS ENUM ('ARRIVED_AS_PLANNED', 'LATE', 'ABSENT');

-- CreateEnum
CREATE TYPE "staff_daily_homework_code" AS ENUM ('COMPLETED', 'IN_PROGRESS', 'NEEDS_SUPPORT');

-- CreateEnum
CREATE TYPE "staff_daily_activity_code" AS ENUM ('PARTICIPATED', 'OBSERVED', 'NOT_RECORDED');

-- CreateEnum
CREATE TYPE "staff_daily_classroom_code" AS ENUM ('ROUTINE', 'NEEDS_ATTENTION', 'NEEDS_FOLLOW_UP');

-- CreateEnum
CREATE TYPE "staff_daily_follow_up_code" AS ENUM ('NONE', 'OBSERVE_TOMORROW', 'OWNER_ATTENTION');

-- CreateTable
CREATE TABLE "staff_daily_reports" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "class_ref" VARCHAR(80) NOT NULL,
    "date" DATE NOT NULL,
    "arrival" "staff_daily_arrival_code" NOT NULL,
    "homework" "staff_daily_homework_code" NOT NULL,
    "activity" "staff_daily_activity_code" NOT NULL,
    "classroom" "staff_daily_classroom_code" NOT NULL,
    "follow_up" "staff_daily_follow_up_code" NOT NULL,
    "status" "staff_daily_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "reviewed_by_membership_id" UUID,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_daily_reports_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateTable
CREATE TABLE "staff_daily_report_work_task_sources" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "source_version" INTEGER NOT NULL,

    CONSTRAINT "staff_daily_report_work_task_sources_pkey" PRIMARY KEY ("tenant_id","campus_id","report_id","source_id")
);

-- CreateTable
CREATE TABLE "staff_daily_report_attendance_sources" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "source_version" INTEGER NOT NULL,

    CONSTRAINT "staff_daily_report_attendance_sources_pkey" PRIMARY KEY ("tenant_id","campus_id","report_id","source_id")
);

-- CreateTable
CREATE TABLE "staff_daily_report_care_record_sources" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "source_version" INTEGER NOT NULL,

    CONSTRAINT "staff_daily_report_care_record_sources_pkey" PRIMARY KEY ("tenant_id","campus_id","report_id","source_id")
);

-- CreateTable
CREATE TABLE "staff_daily_report_pickup_record_sources" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "source_version" INTEGER NOT NULL,

    CONSTRAINT "staff_daily_report_pickup_record_sources_pkey" PRIMARY KEY ("tenant_id","campus_id","report_id","source_id")
);

-- CreateTable
CREATE TABLE "staff_daily_report_pickup_exception_sources" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "source_version" INTEGER NOT NULL,

    CONSTRAINT "staff_daily_report_pickup_exception_sources_pkey" PRIMARY KEY ("tenant_id","campus_id","report_id","source_id")
);

-- CreateIndex
CREATE INDEX "staff_daily_reports_tenant_id_campus_id_class_ref_date_stat_idx" ON "staff_daily_reports"("tenant_id", "campus_id", "class_ref", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_daily_reports_tenant_id_campus_id_created_by_membersh_key" ON "staff_daily_reports"("tenant_id", "campus_id", "created_by_membership_id", "date");

-- CreateIndex
CREATE INDEX "staff_daily_report_work_task_sources_tenant_id_campus_id_so_idx" ON "staff_daily_report_work_task_sources"("tenant_id", "campus_id", "source_id");

-- CreateIndex
CREATE INDEX "staff_daily_report_attendance_sources_tenant_id_campus_id_s_idx" ON "staff_daily_report_attendance_sources"("tenant_id", "campus_id", "source_id");

-- CreateIndex
CREATE INDEX "staff_daily_report_care_record_sources_tenant_id_campus_id__idx" ON "staff_daily_report_care_record_sources"("tenant_id", "campus_id", "source_id");

-- CreateIndex
CREATE INDEX "staff_daily_report_pickup_record_sources_tenant_id_campus_i_idx" ON "staff_daily_report_pickup_record_sources"("tenant_id", "campus_id", "source_id");

-- CreateIndex
CREATE INDEX "staff_daily_report_pickup_exception_sources_tenant_id_campu_idx" ON "staff_daily_report_pickup_exception_sources"("tenant_id", "campus_id", "source_id");

-- AddForeignKey
ALTER TABLE "staff_daily_reports" ADD CONSTRAINT "staff_daily_reports_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_reports" ADD CONSTRAINT "staff_daily_reports_tenant_id_created_by_membership_id_cam_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_reports" ADD CONSTRAINT "staff_daily_reports_tenant_id_reviewed_by_membership_id_ca_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_reports" ADD CONSTRAINT "staff_daily_reports_tenant_id_updated_by_membership_id_cam_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_report_work_task_sources" ADD CONSTRAINT "staff_daily_report_work_task_sources_report_fkey" FOREIGN KEY ("tenant_id", "campus_id", "report_id") REFERENCES "staff_daily_reports"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_report_work_task_sources" ADD CONSTRAINT "staff_daily_report_work_task_sources_source_fkey" FOREIGN KEY ("tenant_id", "campus_id", "source_id") REFERENCES "work_tasks"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_report_attendance_sources" ADD CONSTRAINT "staff_daily_report_attendance_sources_report_fkey" FOREIGN KEY ("tenant_id", "campus_id", "report_id") REFERENCES "staff_daily_reports"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_report_attendance_sources" ADD CONSTRAINT "staff_daily_report_attendance_sources_source_fkey" FOREIGN KEY ("tenant_id", "campus_id", "source_id") REFERENCES "attendance_records"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_report_care_record_sources" ADD CONSTRAINT "staff_daily_report_care_record_sources_report_fkey" FOREIGN KEY ("tenant_id", "campus_id", "report_id") REFERENCES "staff_daily_reports"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_report_care_record_sources" ADD CONSTRAINT "staff_daily_report_care_record_sources_source_fkey" FOREIGN KEY ("tenant_id", "campus_id", "source_id") REFERENCES "care_records"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_report_pickup_record_sources" ADD CONSTRAINT "staff_daily_report_pickup_record_sources_report_fkey" FOREIGN KEY ("tenant_id", "campus_id", "report_id") REFERENCES "staff_daily_reports"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_report_pickup_record_sources" ADD CONSTRAINT "staff_daily_report_pickup_record_sources_source_fkey" FOREIGN KEY ("tenant_id", "campus_id", "source_id") REFERENCES "pickup_records"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_report_pickup_exception_sources" ADD CONSTRAINT "staff_daily_report_pickup_exception_sources_report_fkey" FOREIGN KEY ("tenant_id", "campus_id", "report_id") REFERENCES "staff_daily_reports"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_daily_report_pickup_exception_sources" ADD CONSTRAINT "staff_daily_report_pickup_exception_sources_source_fkey" FOREIGN KEY ("tenant_id", "campus_id", "source_id") REFERENCES "pickup_exceptions"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Keep the daily report state aligned with the reviewer reference.
ALTER TABLE "staff_daily_reports"
  ADD CONSTRAINT "staff_daily_reports_positive_version_check"
  CHECK ("version" >= 1);

ALTER TABLE "staff_daily_reports"
  ADD CONSTRAINT "staff_daily_reports_review_state_check"
  CHECK (
    ("status" IN ('DRAFT', 'SUBMITTED') AND "reviewed_by_membership_id" IS NULL)
    OR ("status" IN ('RETURNED', 'CONFIRMED') AND "reviewed_by_membership_id" IS NOT NULL)
  );

ALTER TABLE "staff_daily_report_work_task_sources"
  ADD CONSTRAINT "staff_daily_report_work_task_sources_positive_version_check"
  CHECK ("source_version" >= 1);

ALTER TABLE "staff_daily_report_attendance_sources"
  ADD CONSTRAINT "staff_daily_report_attendance_sources_positive_version_check"
  CHECK ("source_version" >= 1);

ALTER TABLE "staff_daily_report_care_record_sources"
  ADD CONSTRAINT "staff_daily_report_care_record_sources_positive_version_check"
  CHECK ("source_version" >= 1);

ALTER TABLE "staff_daily_report_pickup_record_sources"
  ADD CONSTRAINT "staff_daily_report_pickup_record_sources_positive_version_check"
  CHECK ("source_version" >= 1);

ALTER TABLE "staff_daily_report_pickup_exception_sources"
  ADD CONSTRAINT "staff_daily_report_pickup_exception_sources_positive_version_check"
  CHECK ("source_version" >= 1);
