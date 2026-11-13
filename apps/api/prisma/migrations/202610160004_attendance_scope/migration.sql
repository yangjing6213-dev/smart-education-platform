-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('NOT_ARRIVED', 'ARRIVED', 'DEPARTED');

-- CreateTable
CREATE TABLE "attendance_records" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_ref" TEXT NOT NULL,
    "service_date" DATE NOT NULL,
    "status" "attendance_status" NOT NULL,
    "arrival_time" VARCHAR(5),
    "departure_time" VARCHAR(5),
    "corrected" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "recorded_by_membership_id" UUID NOT NULL,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateTable
CREATE TABLE "attendance_record_revisions" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "attendance_record_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "attendance_status" NOT NULL,
    "arrival_time" VARCHAR(5),
    "departure_time" VARCHAR(5),
    "corrected" BOOLEAN NOT NULL,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendance_record_revisions_pkey" PRIMARY KEY ("tenant_id","campus_id","attendance_record_id","version")
);

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_campus_id_service_date_idx" ON "attendance_records"("tenant_id", "campus_id", "service_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_tenant_id_campus_id_student_id_service_d_key" ON "attendance_records"("tenant_id", "campus_id", "student_id", "service_date");

-- CreateIndex
CREATE INDEX "attendance_record_revisions_tenant_id_campus_id_updated_at_idx" ON "attendance_record_revisions"("tenant_id", "campus_id", "updated_at");

-- Enforce the local attendance contract's strict HH:mm values (24-hour clock, no timezone).
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_arrival_time_hhmm_check" CHECK ("arrival_time" IS NULL OR "arrival_time" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_departure_time_hhmm_check" CHECK ("departure_time" IS NULL OR "departure_time" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "attendance_record_revisions" ADD CONSTRAINT "attendance_record_revisions_arrival_time_hhmm_check" CHECK ("arrival_time" IS NULL OR "arrival_time" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "attendance_record_revisions" ADD CONSTRAINT "attendance_record_revisions_departure_time_hhmm_check" CHECK ("departure_time" IS NULL OR "departure_time" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_campus_id_student_id_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_recorded_by_membership_id_cam_fkey" FOREIGN KEY ("tenant_id", "recorded_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_updated_by_membership_id_camp_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_record_revisions" ADD CONSTRAINT "attendance_record_revisions_tenant_id_campus_id_attendance_fkey" FOREIGN KEY ("tenant_id", "campus_id", "attendance_record_id") REFERENCES "attendance_records"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_record_revisions" ADD CONSTRAINT "attendance_record_revisions_tenant_id_updated_by_membershi_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;
