DROP INDEX IF EXISTS "binding_applications_tenant_campus_applicant_student_key";

CREATE INDEX "binding_applications_tenant_campus_applicant_student_idx"
ON "binding_applications" ("tenant_id", "campus_id", "applicant_user_id", "student_candidate_ref");

CREATE UNIQUE INDEX "binding_applications_one_pending_guardian_student_idx"
ON "binding_applications" ("tenant_id", "campus_id", "applicant_user_id", "student_candidate_ref")
WHERE "status" = 'PENDING';

CREATE TYPE "guardian_relationship_audit_action" AS ENUM ('ACTIVATED', 'RELEASED');

CREATE TABLE "guardian_relationship_audit_events" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "guardian_relationship_id" UUID NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "action" "guardian_relationship_audit_action" NOT NULL,
    "relationship_version" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_relationship_audit_events_pkey"
      PRIMARY KEY ("tenant_id", "campus_id", "id"),
    CONSTRAINT "guardian_relationship_audit_relationship_version_key"
      UNIQUE ("tenant_id", "campus_id", "guardian_relationship_id", "relationship_version"),
    CONSTRAINT "guardian_relationship_audit_event_version_check"
      CHECK (
        ("action" = 'ACTIVATED' AND "relationship_version" = 1)
        OR ("action" = 'RELEASED' AND "relationship_version" > 1)
      )
);

CREATE INDEX "guardian_relationship_audit_scope_time_idx"
ON "guardian_relationship_audit_events" ("tenant_id", "campus_id", "occurred_at" DESC);

ALTER TABLE "guardian_relationship_audit_events"
  ADD CONSTRAINT "guardian_relationship_audit_events_campus_fkey"
  FOREIGN KEY ("tenant_id", "campus_id")
  REFERENCES "campuses" ("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guardian_relationship_audit_events"
  ADD CONSTRAINT "guardian_relationship_audit_events_relationship_fkey"
  FOREIGN KEY ("tenant_id", "campus_id", "guardian_relationship_id")
  REFERENCES "guardian_relationships" ("tenant_id", "campus_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guardian_relationship_audit_events"
  ADD CONSTRAINT "guardian_relationship_audit_events_actor_fkey"
  FOREIGN KEY ("tenant_id", "actor_membership_id", "campus_id")
  REFERENCES "membership_campuses" ("tenant_id", "membership_id", "campus_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_guardian_relationship_audit_event_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'guardian relationship audit events are append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "guardian_relationship_audit_events_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "guardian_relationship_audit_events"
FOR EACH STATEMENT
EXECUTE FUNCTION "prevent_guardian_relationship_audit_event_mutation"();
