-- CreateTable
CREATE TABLE "care_record_attendance_sources" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "care_record_id" UUID NOT NULL,
    "care_record_version" INTEGER NOT NULL,
    "student_id" UUID NOT NULL,
    "service_date" DATE NOT NULL,
    "source_id" UUID NOT NULL,
    "source_version" INTEGER NOT NULL,

    CONSTRAINT "care_record_attendance_sources_pkey" PRIMARY KEY ("tenant_id","campus_id","care_record_id","care_record_version","source_id")
);

-- CreateTable
CREATE TABLE "care_record_meal_plan_sources" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "care_record_id" UUID NOT NULL,
    "care_record_version" INTEGER NOT NULL,
    "student_id" UUID NOT NULL,
    "service_date" DATE NOT NULL,
    "source_id" UUID NOT NULL,
    "source_version" INTEGER NOT NULL,

    CONSTRAINT "care_record_meal_plan_sources_pkey" PRIMARY KEY ("tenant_id","campus_id","care_record_id","care_record_version","source_id")
);

-- CreateTable
CREATE TABLE "care_record_pickup_record_sources" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "care_record_id" UUID NOT NULL,
    "care_record_version" INTEGER NOT NULL,
    "student_id" UUID NOT NULL,
    "service_date" DATE NOT NULL,
    "source_id" UUID NOT NULL,

    CONSTRAINT "care_record_pickup_record_sources_pkey" PRIMARY KEY ("tenant_id","campus_id","care_record_id","care_record_version","source_id")
);

-- CreateIndex
CREATE INDEX "care_record_attendance_sources_tenant_id_campus_id_source_i_idx" ON "care_record_attendance_sources"("tenant_id", "campus_id", "source_id");

-- CreateIndex
CREATE INDEX "care_record_meal_plan_sources_tenant_id_campus_id_source_id_idx" ON "care_record_meal_plan_sources"("tenant_id", "campus_id", "source_id");

-- CreateIndex
CREATE INDEX "care_record_pickup_record_sources_tenant_id_campus_id_sourc_idx" ON "care_record_pickup_record_sources"("tenant_id", "campus_id", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "care_records_tenant_id_campus_id_id_student_id_service_date_key" ON "care_records"("tenant_id", "campus_id", "id", "student_id", "service_date");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plans_tenant_id_campus_id_id_service_date_key" ON "meal_plans"("tenant_id", "campus_id", "id", "service_date");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_records_tenant_id_campus_id_id_student_id_service_da_key" ON "pickup_records"("tenant_id", "campus_id", "id", "student_id", "service_date");

-- AddForeignKey
ALTER TABLE "care_record_attendance_sources" ADD CONSTRAINT "care_record_attendance_sources_care_record_fkey" FOREIGN KEY ("tenant_id", "campus_id", "care_record_id", "student_id", "service_date") REFERENCES "care_records"("tenant_id", "campus_id", "id", "student_id", "service_date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_record_attendance_sources" ADD CONSTRAINT "care_record_attendance_sources_revision_fkey" FOREIGN KEY ("tenant_id", "campus_id", "care_record_id", "care_record_version") REFERENCES "care_record_revisions"("tenant_id", "campus_id", "care_record_id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_record_attendance_sources" ADD CONSTRAINT "care_record_attendance_sources_source_fkey" FOREIGN KEY ("tenant_id", "campus_id", "source_id", "student_id", "service_date") REFERENCES "attendance_records"("tenant_id", "campus_id", "id", "student_id", "service_date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_record_meal_plan_sources" ADD CONSTRAINT "care_record_meal_plan_sources_care_record_fkey" FOREIGN KEY ("tenant_id", "campus_id", "care_record_id", "student_id", "service_date") REFERENCES "care_records"("tenant_id", "campus_id", "id", "student_id", "service_date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_record_meal_plan_sources" ADD CONSTRAINT "care_record_meal_plan_sources_revision_fkey" FOREIGN KEY ("tenant_id", "campus_id", "care_record_id", "care_record_version") REFERENCES "care_record_revisions"("tenant_id", "campus_id", "care_record_id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_record_meal_plan_sources" ADD CONSTRAINT "care_record_meal_plan_sources_source_fkey" FOREIGN KEY ("tenant_id", "campus_id", "source_id", "service_date") REFERENCES "meal_plans"("tenant_id", "campus_id", "id", "service_date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_record_pickup_record_sources" ADD CONSTRAINT "care_record_pickup_record_sources_care_record_fkey" FOREIGN KEY ("tenant_id", "campus_id", "care_record_id", "student_id", "service_date") REFERENCES "care_records"("tenant_id", "campus_id", "id", "student_id", "service_date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_record_pickup_record_sources" ADD CONSTRAINT "care_record_pickup_record_sources_revision_fkey" FOREIGN KEY ("tenant_id", "campus_id", "care_record_id", "care_record_version") REFERENCES "care_record_revisions"("tenant_id", "campus_id", "care_record_id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_record_pickup_record_sources" ADD CONSTRAINT "care_record_pickup_record_sources_source_fkey" FOREIGN KEY ("tenant_id", "campus_id", "source_id", "student_id", "service_date") REFERENCES "pickup_records"("tenant_id", "campus_id", "id", "student_id", "service_date") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Protect revision and observed source versions from invalid values.
ALTER TABLE "care_record_attendance_sources" ADD CONSTRAINT "care_record_attendance_sources_positive_care_record_version_check" CHECK ("care_record_version" >= 1);
ALTER TABLE "care_record_meal_plan_sources" ADD CONSTRAINT "care_record_meal_plan_sources_positive_care_record_version_check" CHECK ("care_record_version" >= 1);
ALTER TABLE "care_record_pickup_record_sources" ADD CONSTRAINT "care_record_pickup_record_sources_positive_care_record_version_check" CHECK ("care_record_version" >= 1);
ALTER TABLE "care_record_attendance_sources" ADD CONSTRAINT "care_record_attendance_sources_positive_source_version_check" CHECK ("source_version" >= 1);
ALTER TABLE "care_record_meal_plan_sources" ADD CONSTRAINT "care_record_meal_plan_sources_positive_source_version_check" CHECK ("source_version" >= 1);
