CREATE TYPE "leave_reason_category" AS ENUM ('FAMILY_ARRANGEMENT', 'TEMPORARY_MATTER');

CREATE TYPE "leave_request_status" AS ENUM ('SUBMITTED', 'RETURNED', 'CONFIRMED', 'WITHDRAWN');

CREATE UNIQUE INDEX "guardian_relationships_tenant_id_campus_id_id_student_id_gu_key"
ON "guardian_relationships"("tenant_id", "campus_id", "id", "student_id", "guardian_user_id");

CREATE TABLE "leave_requests" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "guardian_relationship_id" UUID NOT NULL,
    "requester_user_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason_category" "leave_reason_category" NOT NULL,
    "status" "leave_request_status" NOT NULL DEFAULT 'SUBMITTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
    CONSTRAINT "leave_requests_start_before_end_check" CHECK ("start_date" <= "end_date"),
    CONSTRAINT "leave_requests_version_positive_check" CHECK ("version" >= 1),
    CONSTRAINT "leave_requests_acknowledgement_state_check"
        CHECK (NOT "acknowledged" OR "status" IN ('CONFIRMED', 'RETURNED'))
);

CREATE TABLE "leave_request_revisions" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "leave_request_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason_category" "leave_reason_category" NOT NULL,
    "status" "leave_request_status" NOT NULL,
    "acknowledged" BOOLEAN NOT NULL,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leave_request_revisions_pkey" PRIMARY KEY ("tenant_id", "campus_id", "leave_request_id", "version"),
    CONSTRAINT "leave_request_revisions_start_before_end_check" CHECK ("start_date" <= "end_date"),
    CONSTRAINT "leave_request_revisions_version_positive_check" CHECK ("version" >= 1),
    CONSTRAINT "leave_request_revisions_acknowledgement_state_check"
        CHECK (NOT "acknowledged" OR "status" IN ('CONFIRMED', 'RETURNED'))
);

CREATE INDEX "leave_requests_tenant_id_campus_id_guardian_relationship_id_idx"
ON "leave_requests"("tenant_id", "campus_id", "guardian_relationship_id", "status");

CREATE INDEX "leave_requests_tenant_id_campus_id_student_id_start_date_idx"
ON "leave_requests"("tenant_id", "campus_id", "student_id", "start_date");

CREATE INDEX "leave_request_revisions_tenant_id_campus_id_updated_at_idx"
ON "leave_request_revisions"("tenant_id", "campus_id", "updated_at");

ALTER TABLE "leave_requests"
ADD CONSTRAINT "leave_requests_tenant_id_campus_id_student_id_fkey"
FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_requests"
ADD CONSTRAINT "leave_requests_tenant_id_campus_id_guardian_relationship_i_fkey"
FOREIGN KEY ("tenant_id", "campus_id", "guardian_relationship_id", "student_id", "requester_user_id")
REFERENCES "guardian_relationships"("tenant_id", "campus_id", "id", "student_id", "guardian_user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_requests"
ADD CONSTRAINT "leave_requests_requester_user_id_fkey"
FOREIGN KEY ("requester_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_requests"
ADD CONSTRAINT "leave_requests_tenant_id_updated_by_membership_id_campus_i_fkey"
FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id")
REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_request_revisions"
ADD CONSTRAINT "leave_request_revisions_tenant_id_campus_id_leave_request__fkey"
FOREIGN KEY ("tenant_id", "campus_id", "leave_request_id") REFERENCES "leave_requests"("tenant_id", "campus_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_request_revisions"
ADD CONSTRAINT "leave_request_revisions_tenant_id_updated_by_membership_id_fkey"
FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id")
REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
