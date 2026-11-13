-- CreateEnum
CREATE TYPE "care_record_status" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'CONFIRMED', 'CANCELLED', 'EXCEPTION_PENDING');

-- CreateEnum
CREATE TYPE "care_arrival" AS ENUM ('ARRIVED_AS_PLANNED', 'LATE', 'ABSENT');

-- CreateEnum
CREATE TYPE "care_homework" AS ENUM ('COMPLETED', 'IN_PROGRESS', 'NEEDS_SUPPORT');

-- CreateEnum
CREATE TYPE "care_meal" AS ENUM ('FINISHED', 'PARTIAL', 'NOT_RECORDED');

-- CreateEnum
CREATE TYPE "care_rest" AS ENUM ('RESTED', 'QUIET_ACTIVITY', 'NOT_RECORDED');

-- CreateEnum
CREATE TYPE "care_activity" AS ENUM ('PARTICIPATED', 'OBSERVED', 'NOT_RECORDED');

-- CreateEnum
CREATE TYPE "care_wellbeing" AS ENUM ('ROUTINE', 'CHECK_IN', 'FOLLOW_UP');

-- CreateTable
CREATE TABLE "care_records" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_ref" TEXT NOT NULL,
    "service_date" DATE NOT NULL,
    "arrival" "care_arrival" NOT NULL,
    "homework" "care_homework" NOT NULL,
    "meal" "care_meal" NOT NULL,
    "rest" "care_rest" NOT NULL,
    "activity" "care_activity" NOT NULL,
    "wellbeing" "care_wellbeing" NOT NULL,
    "status" "care_record_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "reviewed_by_membership_id" UUID,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publication_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "care_records_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateTable
CREATE TABLE "care_record_revisions" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "care_record_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "arrival" "care_arrival" NOT NULL,
    "homework" "care_homework" NOT NULL,
    "meal" "care_meal" NOT NULL,
    "rest" "care_rest" NOT NULL,
    "activity" "care_activity" NOT NULL,
    "wellbeing" "care_wellbeing" NOT NULL,
    "status" "care_record_status" NOT NULL,
    "reviewed_by_membership_id" UUID,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "published" BOOLEAN NOT NULL,
    "publication_version" INTEGER NOT NULL,

    CONSTRAINT "care_record_revisions_pkey" PRIMARY KEY ("tenant_id","campus_id","care_record_id","version")
);

-- CreateIndex
CREATE INDEX "care_records_tenant_id_campus_id_student_id_service_date_idx" ON "care_records"("tenant_id", "campus_id", "student_id", "service_date");

-- CreateIndex
CREATE INDEX "care_record_revisions_tenant_id_campus_id_updated_at_idx" ON "care_record_revisions"("tenant_id", "campus_id", "updated_at");

-- AddForeignKey
ALTER TABLE "care_records" ADD CONSTRAINT "care_records_tenant_id_campus_id_student_id_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_records" ADD CONSTRAINT "care_records_tenant_id_created_by_membership_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_records" ADD CONSTRAINT "care_records_tenant_id_reviewed_by_membership_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_records" ADD CONSTRAINT "care_records_tenant_id_updated_by_membership_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_record_revisions" ADD CONSTRAINT "care_record_revisions_tenant_id_campus_id_care_record_id_fkey" FOREIGN KEY ("tenant_id", "campus_id", "care_record_id") REFERENCES "care_records"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_record_revisions" ADD CONSTRAINT "care_record_revisions_tenant_id_reviewed_by_membership_id__fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_record_revisions" ADD CONSTRAINT "care_record_revisions_tenant_id_updated_by_membership_id_c_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express this predicate; canceled records may be replaced, active records may not.
CREATE UNIQUE INDEX "care_records_active_student_date_key" ON "care_records"("tenant_id", "campus_id", "student_id", "service_date") WHERE "status" <> 'CANCELLED';
