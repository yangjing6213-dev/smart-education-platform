-- CreateTable
CREATE TABLE "ai_institution_settings" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_institution_settings_pkey" PRIMARY KEY ("tenant_id","campus_id")
);

-- AddForeignKey
ALTER TABLE "ai_institution_settings" ADD CONSTRAINT "ai_institution_settings_campus_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_institution_settings" ADD CONSTRAINT "ai_institution_settings_updater_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_institution_settings" ADD CONSTRAINT "ai_institution_settings_positive_version_check" CHECK ("version" >= 1);
