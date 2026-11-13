CREATE TYPE "monthly_feedback_status" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'CONFIRMED', 'PUBLISHED', 'REVIEW_REQUIRED');
CREATE TYPE "monthly_feedback_supplement" AS ENUM ('KEEP_WATCHING', 'PROGRESSING', 'FOLLOW_UP');

CREATE TABLE "monthly_feedback_reports" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_ref" VARCHAR(80) NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "learning_participation" "monthly_feedback_supplement" NOT NULL,
    "daily_habits" "monthly_feedback_supplement" NOT NULL,
    "activity_participation" "monthly_feedback_supplement" NOT NULL,
    "family_school_collaboration" "monthly_feedback_supplement" NOT NULL,
    "status" "monthly_feedback_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "source_version" INTEGER NOT NULL DEFAULT 1,
    "sources" JSONB NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "reviewed_by_membership_id" UUID,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "monthly_feedback_reports_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
    CONSTRAINT "monthly_feedback_versions_check" CHECK ("version" > 0 AND "source_version" > 0),
    CONSTRAINT "monthly_feedback_month_check" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT "monthly_feedback_sources_check" CHECK (jsonb_typeof("sources") = 'array'),
    CONSTRAINT "monthly_feedback_review_check" CHECK ("status" NOT IN ('CONFIRMED', 'PUBLISHED') OR "reviewed_by_membership_id" IS NOT NULL),
    CONSTRAINT "monthly_feedback_campus_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "monthly_feedback_creator_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "monthly_feedback_reviewer_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "monthly_feedback_updater_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "monthly_feedback_reports_tenant_id_campus_id_class_ref_month_key" ON "monthly_feedback_reports"("tenant_id", "campus_id", "class_ref", "month");
CREATE INDEX "monthly_feedback_reports_tenant_id_campus_id_class_ref_status_idx" ON "monthly_feedback_reports"("tenant_id", "campus_id", "class_ref", "status");

CREATE TABLE "monthly_feedback_events" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "source_version" INTEGER NOT NULL,
    "status" "monthly_feedback_status" NOT NULL,
    "action" VARCHAR(24) NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "monthly_feedback_events_pkey" PRIMARY KEY ("tenant_id", "campus_id", "report_id", "version"),
    CONSTRAINT "monthly_feedback_event_versions_check" CHECK ("version" > 0 AND "source_version" > 0),
    CONSTRAINT "monthly_feedback_event_report_fkey" FOREIGN KEY ("tenant_id", "campus_id", "report_id") REFERENCES "monthly_feedback_reports"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "monthly_feedback_event_actor_fkey" FOREIGN KEY ("tenant_id", "actor_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
