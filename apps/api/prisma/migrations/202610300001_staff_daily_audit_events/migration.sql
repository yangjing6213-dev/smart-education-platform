CREATE TYPE "staff_daily_audit_action" AS ENUM (
  'CREATED',
  'EDITED',
  'SUBMITTED',
  'RESUBMITTED',
  'REVIEW_CONFIRMED',
  'REVIEW_RETURNED',
  'CONFIRMATION_WITHDRAWN',
  'SOURCES_INVALIDATED'
);

CREATE TABLE "staff_daily_report_audit_events" (
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "report_id" UUID NOT NULL,
  "actor_membership_id" UUID,
  "initiated_by_membership_id" UUID NOT NULL,
  "action" "staff_daily_audit_action" NOT NULL,
  "report_version" INTEGER NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "staff_daily_report_audit_events_pkey"
    PRIMARY KEY ("tenant_id", "campus_id", "id"),
  CONSTRAINT "staff_daily_report_audit_events_report_version_key"
    UNIQUE ("tenant_id", "campus_id", "report_id", "report_version"),
  CONSTRAINT "staff_daily_report_audit_events_version_check"
    CHECK ("report_version" > 0),
  CONSTRAINT "staff_daily_report_audit_events_actor_check"
    CHECK (
      ("action" = 'SOURCES_INVALIDATED' AND "actor_membership_id" IS NULL)
      OR ("action" <> 'SOURCES_INVALIDATED' AND "actor_membership_id" = "initiated_by_membership_id")
    )
);

ALTER TABLE "staff_daily_report_audit_events"
  ADD CONSTRAINT "staff_daily_report_audit_events_report_fkey"
  FOREIGN KEY ("tenant_id", "campus_id", "report_id")
  REFERENCES "staff_daily_reports" ("tenant_id", "campus_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_daily_report_audit_events"
  ADD CONSTRAINT "staff_daily_report_audit_events_actor_fkey"
  FOREIGN KEY ("tenant_id", "actor_membership_id", "campus_id")
  REFERENCES "membership_campuses" ("tenant_id", "membership_id", "campus_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_daily_report_audit_events"
  ADD CONSTRAINT "staff_daily_report_audit_events_initiator_fkey"
  FOREIGN KEY ("tenant_id", "initiated_by_membership_id", "campus_id")
  REFERENCES "membership_campuses" ("tenant_id", "membership_id", "campus_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_staff_daily_report_audit_event_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'staff daily report audit events are append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "staff_daily_report_audit_events_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "staff_daily_report_audit_events"
FOR EACH STATEMENT
EXECUTE FUNCTION "prevent_staff_daily_report_audit_event_mutation"();
