-- CreateEnum
CREATE TYPE "pickup_recipient" AS ENUM ('pickup-alpha', 'pickup-beta');

-- CreateEnum
CREATE TYPE "pickup_authorization_type" AS ENUM ('REGULAR', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "pickup_authorization_status" AS ENUM ('DRAFT', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "pickup_record_status" AS ENUM ('COMPLETED');

-- CreateTable
CREATE TABLE "pickup_authorizations" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "guardian_relationship_id" UUID NOT NULL,
    "guardian_user_id" UUID NOT NULL,
    "authorized_party_ref" "pickup_recipient" NOT NULL,
    "type" "pickup_authorization_type" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "status" "pickup_authorization_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pickup_authorizations_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateTable
CREATE TABLE "pickup_records" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "authorization_id" UUID NOT NULL,
    "authorization_version" INTEGER NOT NULL,
    "guardian_relationship_id" UUID NOT NULL,
    "guardian_user_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "attendance_record_id" UUID NOT NULL,
    "attendance_version" INTEGER NOT NULL,
    "authorized_party_ref" "pickup_recipient" NOT NULL,
    "service_date" DATE NOT NULL,
    "status" "pickup_record_status" NOT NULL DEFAULT 'COMPLETED',
    "student_checked" BOOLEAN NOT NULL,
    "recipient_checked" BOOLEAN NOT NULL,
    "authorization_checked" BOOLEAN NOT NULL,
    "checked_by_membership_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pickup_records_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateIndex
CREATE INDEX "pickup_authorizations_tenant_id_campus_id_guardian_relation_idx" ON "pickup_authorizations"("tenant_id", "campus_id", "guardian_relationship_id", "status");

-- CreateIndex
CREATE INDEX "pickup_authorizations_tenant_id_campus_id_student_id_start__idx" ON "pickup_authorizations"("tenant_id", "campus_id", "student_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_authorizations_tenant_id_campus_id_id_student_id_gua_key" ON "pickup_authorizations"("tenant_id", "campus_id", "id", "student_id", "guardian_relationship_id", "guardian_user_id");

-- CreateIndex
CREATE INDEX "pickup_records_tenant_id_campus_id_authorization_id_service_idx" ON "pickup_records"("tenant_id", "campus_id", "authorization_id", "service_date");

-- CreateIndex
CREATE INDEX "pickup_records_tenant_id_campus_id_checked_by_membership_id_idx" ON "pickup_records"("tenant_id", "campus_id", "checked_by_membership_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_records_tenant_id_campus_id_student_id_service_date_key" ON "pickup_records"("tenant_id", "campus_id", "student_id", "service_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_tenant_id_campus_id_id_student_id_servic_key" ON "attendance_records"("tenant_id", "campus_id", "id", "student_id", "service_date");

-- AddForeignKey
ALTER TABLE "pickup_authorizations" ADD CONSTRAINT "pickup_authorizations_tenant_id_campus_id_student_id_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_authorizations" ADD CONSTRAINT "pickup_authorizations_tenant_id_campus_id_guardian_relatio_fkey" FOREIGN KEY ("tenant_id", "campus_id", "guardian_relationship_id", "student_id", "guardian_user_id") REFERENCES "guardian_relationships"("tenant_id", "campus_id", "id", "student_id", "guardian_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_authorizations" ADD CONSTRAINT "pickup_authorizations_tenant_id_created_by_membership_id_c_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_authorizations" ADD CONSTRAINT "pickup_authorizations_tenant_id_updated_by_membership_id_c_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_records" ADD CONSTRAINT "pickup_records_tenant_id_campus_id_student_id_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_records" ADD CONSTRAINT "pickup_records_tenant_id_campus_id_authorization_id_studen_fkey" FOREIGN KEY ("tenant_id", "campus_id", "authorization_id", "student_id", "guardian_relationship_id", "guardian_user_id") REFERENCES "pickup_authorizations"("tenant_id", "campus_id", "id", "student_id", "guardian_relationship_id", "guardian_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_records" ADD CONSTRAINT "pickup_records_tenant_id_campus_id_attendance_record_id_st_fkey" FOREIGN KEY ("tenant_id", "campus_id", "attendance_record_id", "student_id", "service_date") REFERENCES "attendance_records"("tenant_id", "campus_id", "id", "student_id", "service_date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_records" ADD CONSTRAINT "pickup_records_tenant_id_checked_by_membership_id_campus_i_fkey" FOREIGN KEY ("tenant_id", "checked_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints retained from the validated local pickup flow.
ALTER TABLE "pickup_authorizations"
  ADD CONSTRAINT "pickup_authorizations_date_range_check"
  CHECK ("start_date" <= "end_date");

ALTER TABLE "pickup_authorizations"
  ADD CONSTRAINT "pickup_authorizations_time_format_check"
  CHECK (
    "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "start_time" <= "end_time"
  );

ALTER TABLE "pickup_authorizations"
  ADD CONSTRAINT "pickup_authorizations_temporary_single_day_check"
  CHECK ("type" <> 'TEMPORARY' OR "start_date" = "end_date");

ALTER TABLE "pickup_authorizations"
  ADD CONSTRAINT "pickup_authorizations_positive_version_check"
  CHECK ("version" >= 1);

ALTER TABLE "pickup_records"
  ADD CONSTRAINT "pickup_records_positive_versions_check"
  CHECK ("authorization_version" >= 1 AND "attendance_version" >= 1);

ALTER TABLE "pickup_records"
  ADD CONSTRAINT "pickup_records_checks_complete_check"
  CHECK ("student_checked" AND "recipient_checked" AND "authorization_checked");