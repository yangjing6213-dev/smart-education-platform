-- Add an exact-scope key so a session cannot point at another guardian's consent.
CREATE UNIQUE INDEX "guardian_consents_session_scope_key"
  ON "guardian_consents" ("tenant_id", "campus_id", "id", "guardian_relationship_id", "student_id", "guardian_user_id");

CREATE TABLE "parent_learning_sessions" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "guardian_relationship_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "guardian_user_id" UUID NOT NULL,
    "consent_id" UUID NOT NULL,
    "consent_version" "guardian_consent_version" NOT NULL,
    "policy_version" "guardian_consent_policy_version" NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "duration_minutes" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "main_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_hint_at_attempt" INTEGER NOT NULL DEFAULT 0,
    "main_wrong_attempts" INTEGER NOT NULL DEFAULT 0,
    "answered_after_hint" BOOLEAN NOT NULL DEFAULT false,
    "main_correct" BOOLEAN NOT NULL DEFAULT false,
    "highest_hint_level" INTEGER NOT NULL DEFAULT -1,
    "visible_hint_level" INTEGER,
    "practice_one_answered" BOOLEAN NOT NULL DEFAULT false,
    "practice_one_correct" BOOLEAN,
    "practice_two_answered" BOOLEAN NOT NULL DEFAULT false,
    "practice_two_correct" BOOLEAN,
    "needs_teacher_follow_up" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parent_learning_sessions_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
    CONSTRAINT "parent_learning_sessions_state_check" CHECK (
      "status" IN ('ACTIVE', 'COMPLETED', 'CLOSED', 'EXPIRED')
      AND "version" >= 1
      AND "duration_minutes" IN (5, 10, 15)
      AND "started_at" < "ends_at"
      AND "main_attempts" BETWEEN 0 AND 5
      AND "main_wrong_attempts" BETWEEN 0 AND "main_attempts"
      AND "last_hint_at_attempt" BETWEEN 0 AND "main_attempts"
      AND "highest_hint_level" BETWEEN -1 AND 3
      AND ("visible_hint_level" IS NULL OR "visible_hint_level" BETWEEN 0 AND 3)
      AND "practice_one_answered" = ("practice_one_correct" IS NOT NULL)
      AND "practice_two_answered" = ("practice_two_correct" IS NOT NULL)
      AND (("status" = 'ACTIVE' AND "ended_at" IS NULL) OR ("status" <> 'ACTIVE' AND "ended_at" IS NOT NULL))
    )
);

CREATE INDEX "parent_learning_sessions_tenant_id_campus_id_guardian_user__idx"
  ON "parent_learning_sessions" ("tenant_id", "campus_id", "guardian_user_id", "status", "started_at");
CREATE INDEX "parent_learning_sessions_tenant_id_campus_id_student_id_sta_idx"
  ON "parent_learning_sessions" ("tenant_id", "campus_id", "student_id", "started_at");
CREATE INDEX "parent_learning_sessions_tenant_id_campus_id_guardian_relat_idx"
  ON "parent_learning_sessions" ("tenant_id", "campus_id", "guardian_relationship_id", "status");

ALTER TABLE "parent_learning_sessions"
  ADD CONSTRAINT "parent_learning_sessions_tenant_id_campus_id_fkey"
  FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses" ("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "parent_learning_sessions"
  ADD CONSTRAINT "parent_learning_sessions_tenant_id_campus_id_student_id_fkey"
  FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students" ("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "parent_learning_sessions"
  ADD CONSTRAINT "parent_learning_sessions_guardian_user_id_fkey"
  FOREIGN KEY ("guardian_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "parent_learning_sessions"
  ADD CONSTRAINT "parent_learning_sessions_tenant_id_campus_id_guardian_rela_fkey"
  FOREIGN KEY ("tenant_id", "campus_id", "guardian_relationship_id", "student_id", "guardian_user_id")
  REFERENCES "guardian_relationships" ("tenant_id", "campus_id", "id", "student_id", "guardian_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "parent_learning_sessions"
  ADD CONSTRAINT "parent_learning_sessions_tenant_id_campus_id_consent_id_gu_fkey"
  FOREIGN KEY ("tenant_id", "campus_id", "consent_id", "guardian_relationship_id", "student_id", "guardian_user_id")
  REFERENCES "guardian_consents" ("tenant_id", "campus_id", "id", "guardian_relationship_id", "student_id", "guardian_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
