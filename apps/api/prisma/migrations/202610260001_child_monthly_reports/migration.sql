CREATE TABLE "child_monthly_reports" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "class_ref" VARCHAR(80) NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "learning_participation" "monthly_feedback_supplement" NOT NULL,
    "daily_habits" "monthly_feedback_supplement" NOT NULL,
    "activity_participation" "monthly_feedback_supplement" NOT NULL,
    "family_school_collaboration" "monthly_feedback_supplement" NOT NULL,
    "status" "monthly_feedback_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "source_version" INTEGER NOT NULL DEFAULT 1,
    "publication_version" INTEGER NOT NULL DEFAULT 0,
    "sources" JSONB NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "reviewed_by_membership_id" UUID,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "child_monthly_reports_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
    CONSTRAINT "child_monthly_versions_check" CHECK ("version" > 0 AND "source_version" > 0 AND "publication_version" >= 0),
    CONSTRAINT "child_monthly_month_check" CHECK ("month" ~ '^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$'),
    CONSTRAINT "child_monthly_sources_check" CHECK (jsonb_typeof("sources") = 'array'),
    CONSTRAINT "child_monthly_review_check" CHECK ("status" NOT IN ('CONFIRMED', 'PUBLISHED') OR "reviewed_by_membership_id" IS NOT NULL),
    CONSTRAINT "child_monthly_publication_check" CHECK ("status" <> 'PUBLISHED' OR "publication_version" > 0),
    CONSTRAINT "child_monthly_campus_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "child_monthly_student_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "child_monthly_creator_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "child_monthly_reviewer_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "child_monthly_updater_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "child_monthly_student_month_key" ON "child_monthly_reports"("tenant_id", "campus_id", "student_id", "month");
CREATE UNIQUE INDEX "child_monthly_report_student_key" ON "child_monthly_reports"("tenant_id", "campus_id", "id", "student_id");
CREATE INDEX "child_monthly_class_status_idx" ON "child_monthly_reports"("tenant_id", "campus_id", "class_ref", "status");

CREATE TABLE "child_monthly_events" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "source_version" INTEGER NOT NULL,
    "status" "monthly_feedback_status" NOT NULL,
    "action" VARCHAR(24) NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "child_monthly_events_pkey" PRIMARY KEY ("tenant_id", "campus_id", "report_id", "version"),
    CONSTRAINT "child_monthly_event_versions_check" CHECK ("version" > 0 AND "source_version" > 0),
    CONSTRAINT "child_monthly_event_report_fkey" FOREIGN KEY ("tenant_id", "campus_id", "report_id") REFERENCES "child_monthly_reports"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "child_monthly_event_actor_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "child_monthly_receipts" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "guardian_relationship_id" UUID NOT NULL,
    "guardian_user_id" UUID NOT NULL,
    "guardian_relationship_version" INTEGER NOT NULL,
    "publication_version" INTEGER NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "child_monthly_receipts_pkey" PRIMARY KEY ("tenant_id", "campus_id", "report_id", "guardian_relationship_id", "guardian_relationship_version", "publication_version"),
    CONSTRAINT "child_monthly_receipt_versions_check" CHECK ("guardian_relationship_version" > 0 AND "publication_version" > 0),
    CONSTRAINT "child_monthly_receipt_report_fkey" FOREIGN KEY ("tenant_id", "campus_id", "report_id", "student_id") REFERENCES "child_monthly_reports"("tenant_id", "campus_id", "id", "student_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "child_monthly_receipt_relationship_fkey" FOREIGN KEY ("tenant_id", "campus_id", "guardian_relationship_id", "student_id", "guardian_user_id") REFERENCES "guardian_relationships"("tenant_id", "campus_id", "id", "student_id", "guardian_user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "child_monthly_receipt_relationship_version_idx" ON "child_monthly_receipts"("tenant_id", "campus_id", "guardian_relationship_id", "guardian_relationship_version", "publication_version");
