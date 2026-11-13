CREATE TYPE "student_transfer_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "student_transfer_audit_action" AS ENUM ('CREATED', 'APPROVED', 'REJECTED');

CREATE TABLE "student_transfer_requests" (
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "source_class_ref" VARCHAR(80) NOT NULL,
  "destination_class_ref" VARCHAR(80) NOT NULL,
  "status" "student_transfer_status" NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 1,
  "requested_by_membership_id" UUID NOT NULL,
  "requested_by_user_id" UUID NOT NULL,
  "reviewed_by_membership_id" UUID,
  "reviewed_by_user_id" UUID,
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMPTZ(6),
  CONSTRAINT "student_transfer_requests_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
  CONSTRAINT "transfer_classes_check" CHECK (
    length(btrim("source_class_ref")) > 0 AND length(btrim("destination_class_ref")) > 0
    AND "source_class_ref" <> "destination_class_ref"
  ),
  CONSTRAINT "transfer_review_check" CHECK (
    ("status" = 'PENDING' AND "version" = 1 AND "reviewed_at" IS NULL
      AND "reviewed_by_user_id" IS NULL AND "reviewed_by_membership_id" IS NULL)
    OR ("status" <> 'PENDING' AND "version" = 2 AND "reviewed_at" IS NOT NULL
      AND "reviewed_by_membership_id" IS NOT NULL AND "reviewed_by_user_id" IS NOT NULL
      AND "reviewed_by_user_id" <> "requested_by_user_id"
      AND "reviewed_at" >= "requested_at")
  ),
  FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students" ("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("tenant_id", "requested_by_membership_id", "campus_id") REFERENCES "membership_campuses" ("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("tenant_id", "reviewed_by_membership_id", "campus_id") REFERENCES "membership_campuses" ("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "student_transfer_one_pending" ON "student_transfer_requests" ("tenant_id", "campus_id", "student_id") WHERE "status" = 'PENDING';
CREATE INDEX "student_transfer_queue_idx" ON "student_transfer_requests" ("tenant_id", "campus_id", "status", "requested_at");

CREATE TABLE "student_transfer_audit_events" (
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "request_id" UUID NOT NULL,
  "actor_membership_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "action" "student_transfer_audit_action" NOT NULL,
  "request_version" INTEGER NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_transfer_audit_events_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
  CONSTRAINT "student_transfer_audit_version_key" UNIQUE ("tenant_id", "campus_id", "request_id", "request_version"),
  CHECK (("action" = 'CREATED' AND "request_version" = 1) OR ("action" <> 'CREATED' AND "request_version" = 2)),
  FOREIGN KEY ("tenant_id", "campus_id", "request_id") REFERENCES "student_transfer_requests" ("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("tenant_id", "actor_membership_id", "campus_id") REFERENCES "membership_campuses" ("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE FUNCTION "prevent_student_transfer_audit_mutation"() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'student transfer audit events are append-only' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER "student_transfer_audit_append_only" BEFORE UPDATE OR DELETE ON "student_transfer_audit_events"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_student_transfer_audit_mutation"();
CREATE TRIGGER "student_transfer_audit_no_truncate" BEFORE TRUNCATE ON "student_transfer_audit_events"
FOR EACH STATEMENT EXECUTE FUNCTION "prevent_student_transfer_audit_mutation"();
