CREATE TYPE "meal_period" AS ENUM ('BREAKFAST', 'LUNCH', 'SNACK', 'DINNER');

CREATE TYPE "meal_plan_status" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

CREATE TABLE "meal_plans" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "service_date" DATE NOT NULL,
    "meal_period" "meal_period" NOT NULL,
    "notes" VARCHAR(500) NOT NULL,
    "publish_status" "meal_plan_status" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMPTZ(6),
    "updated_by_membership_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("tenant_id","campus_id","id")
);

CREATE TABLE "meal_plan_items" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "meal_plan_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "item_name" VARCHAR(120) NOT NULL,

    CONSTRAINT "meal_plan_items_pkey" PRIMARY KEY ("tenant_id","campus_id","meal_plan_id","position")
);

CREATE INDEX "meal_plans_tenant_id_campus_id_service_date_meal_period_idx" ON "meal_plans"("tenant_id", "campus_id", "service_date", "meal_period");

ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_tenant_id_updated_by_membership_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_tenant_id_campus_id_meal_plan_id_fkey" FOREIGN KEY ("tenant_id", "campus_id", "meal_plan_id") REFERENCES "meal_plans"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce the current service's item position and non-empty-name bounds.
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_position_range_check" CHECK ("position" >= 0 AND "position" < 12);
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_name_not_empty_check" CHECK (char_length("item_name") >= 1);
