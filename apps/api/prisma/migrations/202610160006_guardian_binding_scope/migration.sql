CREATE TYPE "binding_application_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');
CREATE TYPE "guardian_relationship_status" AS ENUM ('ACTIVE', 'RELEASED');

CREATE TABLE "binding_applications" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "applicant_user_id" UUID NOT NULL,
    "onboarding_scope_ref" UUID NOT NULL,
    "student_candidate_ref" UUID NOT NULL,
    "status" "binding_application_status" NOT NULL DEFAULT 'PENDING',
    "reason_category" VARCHAR(80),
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewed_by_membership_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "binding_applications_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

CREATE TABLE "guardian_relationships" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "binding_application_id" UUID NOT NULL,
    "guardian_user_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "guardian_relationship_status" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approved_by_membership_id" UUID NOT NULL,
    "approved_at" TIMESTAMPTZ(6) NOT NULL,
    "released_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guardian_relationships_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

CREATE INDEX "binding_applications_tenant_id_campus_id_applicant_user_id__idx" ON "binding_applications"("tenant_id", "campus_id", "applicant_user_id", "status");
CREATE UNIQUE INDEX "binding_applications_tenant_id_campus_id_onboarding_scope_r_key" ON "binding_applications"("tenant_id", "campus_id", "onboarding_scope_ref");
CREATE UNIQUE INDEX "binding_applications_tenant_id_campus_id_id_applicant_user__key" ON "binding_applications"("tenant_id", "campus_id", "id", "applicant_user_id");
CREATE INDEX "guardian_relationships_tenant_id_campus_id_guardian_user_id_idx" ON "guardian_relationships"("tenant_id", "campus_id", "guardian_user_id", "status");
CREATE INDEX "guardian_relationships_tenant_id_campus_id_student_id_statu_idx" ON "guardian_relationships"("tenant_id", "campus_id", "student_id", "status");
CREATE UNIQUE INDEX "guardian_relationships_tenant_id_campus_id_binding_applicat_key" ON "guardian_relationships"("tenant_id", "campus_id", "binding_application_id");

CREATE UNIQUE INDEX "guardian_relationships_active_guardian_student_unique_idx"
ON "guardian_relationships" ("tenant_id", "campus_id", "guardian_user_id", "student_id")
WHERE "status" = 'ACTIVE';

ALTER TABLE "binding_applications" ADD CONSTRAINT "binding_applications_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "binding_applications" ADD CONSTRAINT "binding_applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "binding_applications" ADD CONSTRAINT "binding_applications_tenant_id_reviewed_by_membership_id_c_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_guardian_user_id_fkey" FOREIGN KEY ("guardian_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_tenant_id_campus_id_student_id_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_tenant_id_campus_id_binding_applica_fkey" FOREIGN KEY ("tenant_id", "campus_id", "binding_application_id", "guardian_user_id") REFERENCES "binding_applications"("tenant_id", "campus_id", "id", "applicant_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_tenant_id_approved_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "approved_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "binding_applications" ADD CONSTRAINT "binding_applications_review_state_check" CHECK (
    ("status" IN ('APPROVED', 'REJECTED') AND "reviewed_at" IS NOT NULL AND "reviewed_by_membership_id" IS NOT NULL)
    OR
    ("status" NOT IN ('APPROVED', 'REJECTED') AND "reviewed_at" IS NULL AND "reviewed_by_membership_id" IS NULL)
);
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_release_state_check" CHECK (
    ("status" = 'RELEASED') = ("released_at" IS NOT NULL)
);
