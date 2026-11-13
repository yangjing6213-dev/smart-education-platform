-- CreateEnum
CREATE TYPE "pickup_exception_category" AS ENUM ('NO_AUTHORIZATION', 'INFORMATION_MISMATCH', 'INVALID_CREDENTIAL', 'OVERDUE');

-- CreateEnum
CREATE TYPE "pickup_exception_status" AS ENUM ('OPEN', 'FOLLOWING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "pickup_exception_outcome" AS ENUM ('CONTACT_GUARDIAN', 'INFORMATION_RECHECKED', 'ARRANGEMENT_CONFIRMED');

-- CreateTable
CREATE TABLE "pickup_exceptions" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_ref" VARCHAR(80) NOT NULL,
    "date" DATE NOT NULL,
    "category" "pickup_exception_category" NOT NULL,
    "status" "pickup_exception_status" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by_membership_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "outcome" "pickup_exception_outcome",

    CONSTRAINT "pickup_exceptions_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateIndex
CREATE INDEX "pickup_exceptions_tenant_id_campus_id_class_ref_date_status_idx" ON "pickup_exceptions"("tenant_id", "campus_id", "class_ref", "date", "status");

-- CreateIndex
CREATE INDEX "pickup_exceptions_tenant_id_campus_id_student_id_date_idx" ON "pickup_exceptions"("tenant_id", "campus_id", "student_id", "date");

-- AddForeignKey
ALTER TABLE "pickup_exceptions" ADD CONSTRAINT "pickup_exceptions_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_exceptions" ADD CONSTRAINT "pickup_exceptions_tenant_id_campus_id_student_id_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_exceptions" ADD CONSTRAINT "pickup_exceptions_tenant_id_created_by_membership_id_campu_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_exceptions" ADD CONSTRAINT "pickup_exceptions_tenant_id_reviewed_by_membership_id_camp_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add domain checks not expressible in the Prisma schema.
ALTER TABLE "pickup_exceptions"
  ADD CONSTRAINT "pickup_exceptions_positive_version_check"
  CHECK ("version" >= 1);

ALTER TABLE "pickup_exceptions"
  ADD CONSTRAINT "pickup_exceptions_review_state_check"
  CHECK (
    ("status" = 'OPEN' AND "reviewed_by_membership_id" IS NULL AND "reviewed_at" IS NULL AND "outcome" IS NULL)
    OR ("status" IN ('FOLLOWING', 'RESOLVED') AND "reviewed_by_membership_id" IS NOT NULL AND "reviewed_at" IS NOT NULL AND "outcome" IS NOT NULL)
  );

ALTER TABLE "pickup_exceptions"
  ADD CONSTRAINT "pickup_exceptions_review_time_check"
  CHECK ("reviewed_at" IS NULL OR "reviewed_at" >= "created_at");