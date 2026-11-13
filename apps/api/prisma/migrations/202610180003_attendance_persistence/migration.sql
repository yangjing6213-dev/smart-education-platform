CREATE TYPE "attendance_correction_status" AS ENUM ('PENDING', 'APPROVED', 'RETURNED');
CREATE TYPE "attendance_correction_reason" AS ENUM ('TIME_ENTRY_ERROR', 'EVENT_ENTRY_ERROR', 'LATE_ENTRY');
CREATE TYPE "attendance_revision_action" AS ENUM (
  'MIGRATED',
  'CREATED',
  'ARRIVED',
  'DEPARTED',
  'CORRECTION_REQUESTED',
  'CORRECTION_APPROVED',
  'CORRECTION_RETURNED'
);

ALTER TABLE "attendance_record_revisions"
ADD COLUMN "action" "attendance_revision_action" NOT NULL DEFAULT 'MIGRATED';

ALTER TABLE "attendance_record_revisions"
ALTER COLUMN "action" DROP DEFAULT;

CREATE TABLE "attendance_corrections" (
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "attendance_record_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "service_date" DATE NOT NULL,
  "requested_by_membership_id" UUID NOT NULL,
  "reviewed_by_membership_id" UUID,
  "reason" "attendance_correction_reason" NOT NULL,
  "status" "attendance_correction_status" NOT NULL DEFAULT 'PENDING',
  "original_status" "attendance_status" NOT NULL,
  "original_arrival_time" VARCHAR(5),
  "original_departure_time" VARCHAR(5),
  "proposed_status" "attendance_status" NOT NULL,
  "proposed_arrival_time" VARCHAR(5),
  "proposed_departure_time" VARCHAR(5),
  "request_version" INTEGER NOT NULL,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
  CONSTRAINT "attendance_corrections_request_version_check" CHECK ("request_version" > 0),
  CONSTRAINT "attendance_corrections_original_arrival_time_hhmm_check" CHECK (
    "original_arrival_time" IS NULL OR "original_arrival_time" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$'
  ),
  CONSTRAINT "attendance_corrections_original_departure_time_hhmm_check" CHECK (
    "original_departure_time" IS NULL OR "original_departure_time" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$'
  ),
  CONSTRAINT "attendance_corrections_proposed_arrival_time_hhmm_check" CHECK (
    "proposed_arrival_time" IS NULL OR "proposed_arrival_time" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$'
  ),
  CONSTRAINT "attendance_corrections_proposed_departure_time_hhmm_check" CHECK (
    "proposed_departure_time" IS NULL OR "proposed_departure_time" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$'
  ),
  CONSTRAINT "attendance_corrections_original_status_times_check" CHECK (
    ("original_status" = 'NOT_ARRIVED' AND "original_arrival_time" IS NULL AND "original_departure_time" IS NULL) OR
    ("original_status" = 'ARRIVED' AND "original_arrival_time" IS NOT NULL AND "original_departure_time" IS NULL) OR
    ("original_status" = 'DEPARTED' AND "original_arrival_time" IS NOT NULL AND "original_departure_time" IS NOT NULL AND "original_departure_time" >= "original_arrival_time")
  ),
  CONSTRAINT "attendance_corrections_proposed_status_times_check" CHECK (
    ("proposed_status" = 'NOT_ARRIVED' AND "proposed_arrival_time" IS NULL AND "proposed_departure_time" IS NULL) OR
    ("proposed_status" = 'ARRIVED' AND "proposed_arrival_time" IS NOT NULL AND "proposed_departure_time" IS NULL) OR
    ("proposed_status" = 'DEPARTED' AND "proposed_arrival_time" IS NOT NULL AND "proposed_departure_time" IS NOT NULL AND "proposed_departure_time" >= "proposed_arrival_time")
  ),
  CONSTRAINT "attendance_corrections_review_state_check" CHECK (
    ("status" = 'PENDING' AND "reviewed_by_membership_id" IS NULL AND "reviewed_at" IS NULL) OR
    ("status" IN ('APPROVED', 'RETURNED') AND "reviewed_by_membership_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)
  ),
  CONSTRAINT "attendance_corrections_record_fkey" FOREIGN KEY (
    "tenant_id", "campus_id", "attendance_record_id", "student_id", "service_date"
  ) REFERENCES "attendance_records"(
    "tenant_id", "campus_id", "id", "student_id", "service_date"
  ) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attendance_corrections_requester_fkey" FOREIGN KEY (
    "tenant_id", "requested_by_membership_id", "campus_id"
  ) REFERENCES "membership_campuses"(
    "tenant_id", "membership_id", "campus_id"
  ) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attendance_corrections_reviewer_fkey" FOREIGN KEY (
    "tenant_id", "reviewed_by_membership_id", "campus_id"
  ) REFERENCES "membership_campuses"(
    "tenant_id", "membership_id", "campus_id"
  ) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "attendance_corrections_tenant_campus_record_status_idx"
ON "attendance_corrections"("tenant_id", "campus_id", "attendance_record_id", "status");

CREATE INDEX "attendance_corrections_tenant_campus_requester_created_idx"
ON "attendance_corrections"("tenant_id", "campus_id", "requested_by_membership_id", "created_at");

CREATE UNIQUE INDEX "attendance_corrections_one_pending_per_record"
ON "attendance_corrections"("tenant_id", "campus_id", "attendance_record_id")
WHERE "status" = 'PENDING';
