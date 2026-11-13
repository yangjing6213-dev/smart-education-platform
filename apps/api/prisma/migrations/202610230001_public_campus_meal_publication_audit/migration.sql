CREATE INDEX "campuses_public_profile_ref_idx" ON "campuses"("public_profile_ref");

CREATE TABLE "meal_publication_events" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "meal_plan_id" UUID NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "resulting_version" INTEGER NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_publication_events_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
    CONSTRAINT "meal_publication_events_action_check" CHECK ("action" IN ('PUBLISHED', 'UNPUBLISHED')),
    CONSTRAINT "meal_publication_events_version_check" CHECK ("resulting_version" > 0)
);

CREATE INDEX "meal_publication_events_tenant_id_campus_id_occurred_at_idx"
ON "meal_publication_events"("tenant_id", "campus_id", "occurred_at" DESC);

ALTER TABLE "meal_publication_events"
ADD CONSTRAINT "meal_publication_events_tenant_id_campus_id_fkey"
FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meal_publication_events"
ADD CONSTRAINT "meal_publication_events_tenant_id_campus_id_meal_plan_id_fkey"
FOREIGN KEY ("tenant_id", "campus_id", "meal_plan_id")
REFERENCES "meal_plans"("tenant_id", "campus_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meal_publication_events"
ADD CONSTRAINT "meal_publication_events_tenant_id_actor_membership_id_campus_id_fkey"
FOREIGN KEY ("tenant_id", "actor_membership_id", "campus_id")
REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
