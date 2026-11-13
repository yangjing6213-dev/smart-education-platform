-- CreateTable
CREATE TABLE "parent_learning_summary_snapshots" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_ref" VARCHAR(80) NOT NULL,
    "summary_date" DATE NOT NULL,
    "used_minutes" INTEGER NOT NULL,
    "session_count" INTEGER NOT NULL,
    "completed_sessions" INTEGER NOT NULL,
    "knowledge_points" JSONB NOT NULL DEFAULT '[]',
    "attention_count" INTEGER NOT NULL,
    "reviewed_by_membership_id" UUID NOT NULL,
    "reviewed_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parent_learning_summary_snapshots_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateTable
CREATE TABLE "parent_learning_controls" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "guardian_relationship_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "guardian_user_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_duration_minutes" INTEGER NOT NULL DEFAULT 15,
    "max_hint_level" INTEGER NOT NULL DEFAULT 3,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parent_learning_controls_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateTable
CREATE TABLE "parent_learning_contact_intents" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "guardian_relationship_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "guardian_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_learning_contact_intents_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

-- CreateIndex
CREATE INDEX "parent_learning_summary_snapshots_tenant_id_campus_id_stude_idx" ON "parent_learning_summary_snapshots"("tenant_id", "campus_id", "student_id", "reviewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "parent_learning_summary_snapshots_tenant_id_campus_id_stude_key" ON "parent_learning_summary_snapshots"("tenant_id", "campus_id", "student_id", "summary_date");

-- CreateIndex
CREATE INDEX "parent_learning_controls_tenant_id_campus_id_student_id_idx" ON "parent_learning_controls"("tenant_id", "campus_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "parent_learning_controls_tenant_id_campus_id_guardian_relat_key" ON "parent_learning_controls"("tenant_id", "campus_id", "guardian_relationship_id", "student_id", "guardian_user_id");

-- CreateIndex
CREATE INDEX "parent_learning_contact_intents_tenant_id_campus_id_student_idx" ON "parent_learning_contact_intents"("tenant_id", "campus_id", "student_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "parent_learning_contact_intents_tenant_id_campus_id_guardia_key" ON "parent_learning_contact_intents"("tenant_id", "campus_id", "guardian_relationship_id", "student_id", "guardian_user_id");

-- AddForeignKey
ALTER TABLE "parent_learning_summary_snapshots" ADD CONSTRAINT "parent_learning_summary_snapshots_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_learning_summary_snapshots" ADD CONSTRAINT "parent_learning_summary_snapshots_tenant_id_campus_id_stud_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_learning_summary_snapshots" ADD CONSTRAINT "parent_learning_summary_snapshots_tenant_id_reviewed_by_me_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_learning_controls" ADD CONSTRAINT "parent_learning_controls_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_learning_controls" ADD CONSTRAINT "parent_learning_controls_tenant_id_campus_id_guardian_rela_fkey" FOREIGN KEY ("tenant_id", "campus_id", "guardian_relationship_id", "student_id", "guardian_user_id") REFERENCES "guardian_relationships"("tenant_id", "campus_id", "id", "student_id", "guardian_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_learning_contact_intents" ADD CONSTRAINT "parent_learning_contact_intents_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_learning_contact_intents" ADD CONSTRAINT "parent_learning_contact_intents_tenant_id_campus_id_guardi_fkey" FOREIGN KEY ("tenant_id", "campus_id", "guardian_relationship_id", "student_id", "guardian_user_id") REFERENCES "guardian_relationships"("tenant_id", "campus_id", "id", "student_id", "guardian_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "parent_learning_summary_snapshots"
  ADD CONSTRAINT "parent_learning_summary_snapshots_counts_check"
  CHECK (
    "used_minutes" BETWEEN 0 AND 1440
    AND "session_count" BETWEEN 0 AND 100
    AND "completed_sessions" BETWEEN 0 AND "session_count"
    AND "attention_count" BETWEEN 0 AND "session_count"
    AND jsonb_typeof("knowledge_points") = 'array'
  );

ALTER TABLE "parent_learning_controls"
  ADD CONSTRAINT "parent_learning_controls_values_check"
  CHECK (
    "max_duration_minutes" IN (5, 10, 15)
    AND "max_hint_level" BETWEEN 0 AND 3
    AND "version" >= 1
  );
