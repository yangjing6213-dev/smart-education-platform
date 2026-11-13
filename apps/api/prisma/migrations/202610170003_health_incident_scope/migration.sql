-- CreateEnum
CREATE TYPE "health_incident_observation_code" AS ENUM ('ROUTINE_OBSERVATION', 'NEEDS_FOLLOW_UP', 'URGENT_REVIEW');

-- CreateEnum
CREATE TYPE "health_incident_disposition_code" AS ENUM ('OBSERVATION_RECHECKED', 'FOLLOW_UP_SCHEDULED', 'GUARDIAN_SUMMARY_PREPARED');

-- CreateEnum
CREATE TYPE "health_incident_summary_code" AS ENUM ('FOLLOW_UP_IN_PROGRESS', 'FOLLOW_UP_COMPLETED', 'PLEASE_CHECK_PAGE_LATER');

-- CreateEnum
CREATE TYPE "health_incident_status" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'CONFIRMED', 'EXCEPTION_PENDING', 'PUBLISHED', 'REVOKED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "health_incident_receipt_status" AS ENUM ('READ', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "health_incidents" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "guardian_relationship_id" UUID NOT NULL,
    "guardian_user_id" UUID NOT NULL,
    "guardian_relationship_version" INTEGER NOT NULL,
    "observation_code" "health_incident_observation_code" NOT NULL,
    "disposition_code" "health_incident_disposition_code" NOT NULL,
    "summary_code" "health_incident_summary_code",
    "status" "health_incident_status" NOT NULL DEFAULT 'DRAFT',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by_membership_id" UUID,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "health_incidents_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateTable
CREATE TABLE "health_incident_receipts" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "health_incident_receipt_status" NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "health_incident_receipts_pkey" PRIMARY KEY ("tenant_id","campus_id","incident_id")
);

-- CreateIndex
CREATE INDEX "health_incidents_tenant_id_campus_id_guardian_relationship__idx" ON "health_incidents"("tenant_id", "campus_id", "guardian_relationship_id", "status");

-- CreateIndex
CREATE INDEX "health_incidents_tenant_id_campus_id_status_updated_at_idx" ON "health_incidents"("tenant_id", "campus_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "health_incident_receipts_tenant_id_campus_id_status_updated_idx" ON "health_incident_receipts"("tenant_id", "campus_id", "status", "updated_at");

-- AddForeignKey
ALTER TABLE "health_incidents" ADD CONSTRAINT "health_incidents_tenant_id_campus_id_student_id_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_incidents" ADD CONSTRAINT "health_incidents_tenant_id_campus_id_guardian_relationship_fkey" FOREIGN KEY ("tenant_id", "campus_id", "guardian_relationship_id", "student_id", "guardian_user_id") REFERENCES "guardian_relationships"("tenant_id", "campus_id", "id", "student_id", "guardian_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_incidents" ADD CONSTRAINT "health_incidents_tenant_id_created_by_membership_id_campus_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_incidents" ADD CONSTRAINT "health_incidents_tenant_id_reviewed_by_membership_id_campu_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_incidents" ADD CONSTRAINT "health_incidents_tenant_id_updated_by_membership_id_campus_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_incident_receipts" ADD CONSTRAINT "health_incident_receipts_tenant_id_campus_id_incident_id_fkey" FOREIGN KEY ("tenant_id", "campus_id", "incident_id") REFERENCES "health_incidents"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Status and disclosure invariants for fixed-code health follow-up.
ALTER TABLE "health_incidents"
  ADD CONSTRAINT "health_incidents_positive_version_check"
  CHECK ("version" >= 1);

ALTER TABLE "health_incidents"
  ADD CONSTRAINT "health_incidents_relationship_version_check"
  CHECK ("guardian_relationship_version" >= 1);

ALTER TABLE "health_incidents"
  ADD CONSTRAINT "health_incidents_published_projection_check"
  CHECK ("published" = ("status" = 'PUBLISHED'));

ALTER TABLE "health_incidents"
  ADD CONSTRAINT "health_incidents_summary_publication_check"
  CHECK (
    ("status" = 'PUBLISHED' AND "summary_code" IS NOT NULL)
    OR ("status" <> 'PUBLISHED' AND "summary_code" IS NULL)
  );

ALTER TABLE "health_incidents"
  ADD CONSTRAINT "health_incidents_review_state_check"
  CHECK (
    ("status" IN ('RETURNED', 'CONFIRMED', 'EXCEPTION_PENDING', 'PUBLISHED', 'REVOKED') AND "reviewed_by_membership_id" IS NOT NULL)
    OR ("status" IN ('DRAFT', 'SUBMITTED', 'WITHDRAWN') AND "reviewed_by_membership_id" IS NULL)
  );

ALTER TABLE "health_incident_receipts"
  ADD CONSTRAINT "health_incident_receipts_positive_version_check"
  CHECK ("version" >= 1);