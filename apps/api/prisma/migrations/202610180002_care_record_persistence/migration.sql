-- Persist class assignments, guardian receipts, and append-only care-record audit events.
CREATE TYPE "care_record_receipt_status" AS ENUM ('READ', 'ACKNOWLEDGED');
CREATE TYPE "care_record_audit_action" AS ENUM ('CREATED', 'EDITED', 'SUBMITTED', 'RESUBMITTED', 'REVIEW_CONFIRMED', 'REVIEW_RETURNED', 'PUBLISHED', 'RECEIPT_READ', 'RECEIPT_ACKNOWLEDGED');

CREATE TABLE "membership_classes" (
  "tenant_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "class_ref" VARCHAR(80) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_classes_pkey" PRIMARY KEY ("tenant_id", "membership_id", "campus_id", "class_ref"),
  CONSTRAINT "membership_classes_class_ref_check" CHECK (length(btrim("class_ref")) BETWEEN 1 AND 80),
  CONSTRAINT "membership_classes_membership_campus_fkey" FOREIGN KEY ("tenant_id", "membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "membership_classes_tenant_id_campus_id_class_ref_idx" ON "membership_classes"("tenant_id", "campus_id", "class_ref");

CREATE TABLE "care_record_receipts" (
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "care_record_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "service_date" DATE NOT NULL,
  "guardian_relationship_id" UUID NOT NULL,
  "guardian_user_id" UUID NOT NULL,
  "publication_version" INTEGER NOT NULL,
  "status" "care_record_receipt_status" NOT NULL,
  "read_at" TIMESTAMPTZ(6) NOT NULL,
  "acknowledged_at" TIMESTAMPTZ(6),
  CONSTRAINT "care_record_receipts_pkey" PRIMARY KEY ("tenant_id", "campus_id", "care_record_id", "guardian_relationship_id", "publication_version"),
  CONSTRAINT "care_record_receipts_positive_publication_version_check" CHECK ("publication_version" > 0),
  CONSTRAINT "care_record_receipts_acknowledgement_state_check" CHECK (("status" = 'READ' AND "acknowledged_at" IS NULL) OR ("status" = 'ACKNOWLEDGED' AND "acknowledged_at" IS NOT NULL AND "acknowledged_at" >= "read_at")),
  CONSTRAINT "care_record_receipts_care_record_fkey" FOREIGN KEY ("tenant_id", "campus_id", "care_record_id", "student_id", "service_date") REFERENCES "care_records"("tenant_id", "campus_id", "id", "student_id", "service_date") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "care_record_receipts_guardian_relationship_fkey" FOREIGN KEY ("tenant_id", "campus_id", "guardian_relationship_id", "student_id", "guardian_user_id") REFERENCES "guardian_relationships"("tenant_id", "campus_id", "id", "student_id", "guardian_user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "care_record_receipts_tenant_id_campus_id_guardian_relationship_id_publication_version_idx" ON "care_record_receipts"("tenant_id", "campus_id", "guardian_relationship_id", "publication_version");

CREATE TABLE "care_record_audit_events" (
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "care_record_id" UUID NOT NULL,
  "actor_membership_id" UUID NOT NULL,
  "action" "care_record_audit_action" NOT NULL,
  "version" INTEGER NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "care_record_audit_events_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
  CONSTRAINT "care_record_audit_events_positive_version_check" CHECK ("version" > 0),
  CONSTRAINT "care_record_audit_events_record_fkey" FOREIGN KEY ("tenant_id", "campus_id", "care_record_id") REFERENCES "care_records"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "care_record_audit_events_actor_fkey" FOREIGN KEY ("tenant_id", "actor_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "care_record_audit_events_tenant_id_campus_id_care_record_id_occurred_at_idx" ON "care_record_audit_events"("tenant_id", "campus_id", "care_record_id", "occurred_at");