-- CreateEnum
CREATE TYPE "guardian_consent_scope" AS ENUM ('LEARNING_SUPPORT');

-- CreateEnum
CREATE TYPE "guardian_consent_version" AS ENUM ('LEARNING_DEMO_V2');

-- CreateEnum
CREATE TYPE "guardian_consent_notice_version" AS ENUM ('LEARNING_SUPPORT_NOTICE_V1');

-- CreateEnum
CREATE TYPE "guardian_consent_policy_version" AS ENUM ('AI_LEARNING_POLICY_SYNTHETIC_V1');

-- CreateEnum
CREATE TYPE "guardian_consent_status" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "guardian_consents" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "guardian_relationship_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "guardian_user_id" UUID NOT NULL,
    "scope" "guardian_consent_scope" NOT NULL,
    "consent_version" "guardian_consent_version" NOT NULL,
    "notice_version" "guardian_consent_notice_version" NOT NULL,
    "policy_version" "guardian_consent_policy_version" NOT NULL,
    "status" "guardian_consent_status" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "confirmed_at" TIMESTAMPTZ(6) NOT NULL,
    "withdrawn_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guardian_consents_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateIndex
CREATE INDEX "guardian_consents_tenant_id_campus_id_guardian_relationship_idx" ON "guardian_consents"("tenant_id", "campus_id", "guardian_relationship_id", "scope", "status");

-- CreateIndex
CREATE INDEX "guardian_consents_tenant_id_campus_id_student_id_status_idx" ON "guardian_consents"("tenant_id", "campus_id", "student_id", "status");

-- AddForeignKey
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_tenant_id_campus_id_student_id_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_guardian_user_id_fkey" FOREIGN KEY ("guardian_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_tenant_id_campus_id_guardian_relationshi_fkey" FOREIGN KEY ("tenant_id", "campus_id", "guardian_relationship_id", "student_id", "guardian_user_id") REFERENCES "guardian_relationships"("tenant_id", "campus_id", "id", "student_id", "guardian_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve revoked consent rows while allowing one current grant per exact scope.
CREATE UNIQUE INDEX "guardian_consents_one_active_scope"
  ON "guardian_consents" ("tenant_id", "campus_id", "guardian_relationship_id", "student_id", "scope")
  WHERE ("status" = 'ACTIVE');

ALTER TABLE "guardian_consents"
  ADD CONSTRAINT "guardian_consents_positive_version_check"
  CHECK ("version" >= 1);

ALTER TABLE "guardian_consents"
  ADD CONSTRAINT "guardian_consents_withdrawal_state_check"
  CHECK (("status" = 'ACTIVE' AND "withdrawn_at" IS NULL) OR ("status" = 'REVOKED' AND "withdrawn_at" IS NOT NULL));
