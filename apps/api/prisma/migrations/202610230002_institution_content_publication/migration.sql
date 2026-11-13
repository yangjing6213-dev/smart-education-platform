CREATE TABLE "institution_content_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID,
    "content_key" VARCHAR(128) NOT NULL,
    "content_type" VARCHAR(32) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "visibility" VARCHAR(16) NOT NULL,
    "body" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "synthetic_data" BOOLEAN NOT NULL DEFAULT TRUE,
    "editor_note" VARCHAR(2000) NOT NULL DEFAULT '',
    "moderation_state" VARCHAR(32) NOT NULL DEFAULT 'UNREVIEWED',
    "tenant_admin_note" VARCHAR(2000) NOT NULL DEFAULT '',
    "campus_admin_note" VARCHAR(2000) NOT NULL DEFAULT '',
    "updated_by" VARCHAR(128) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "institution_content_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "institution_content_records_type_check" CHECK ("content_type" IN ('INSTITUTION', 'HOME_BLOCK')),
    CONSTRAINT "institution_content_records_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED')),
    CONSTRAINT "institution_content_records_visibility_check" CHECK ("visibility" IN ('PUBLIC', 'MEMBERS', 'STAFF', 'ADMIN')),
    CONSTRAINT "institution_content_records_version_check" CHECK ("version" > 0),
    CONSTRAINT "institution_content_records_publication_check" CHECK (("status" = 'PUBLISHED') = ("published_at" IS NOT NULL)),
    CONSTRAINT "institution_content_records_tenant_id_id_key" UNIQUE ("tenant_id", "id")
);

CREATE UNIQUE INDEX "institution_content_records_tenant_profile_key"
ON "institution_content_records"("tenant_id", "content_key")
WHERE "campus_id" IS NULL;

CREATE UNIQUE INDEX "institution_content_records_campus_content_key"
ON "institution_content_records"("tenant_id", "campus_id", "content_key")
WHERE "campus_id" IS NOT NULL;

CREATE INDEX "institution_content_records_scope_type_status_published_idx"
ON "institution_content_records"("tenant_id", "campus_id", "content_type", "status", "published_at" DESC);

ALTER TABLE "institution_content_records"
ADD CONSTRAINT "institution_content_records_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "institution_content_records"
ADD CONSTRAINT "institution_content_records_tenant_id_campus_id_fkey"
FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "institution_content_publication_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID,
    "content_id" UUID NOT NULL,
    "content_key" VARCHAR(128) NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "resulting_version" INTEGER NOT NULL,
    "actor_reference" VARCHAR(128) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institution_content_publication_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "institution_content_publication_events_action_check" CHECK ("action" IN ('PUBLISHED', 'UNPUBLISHED')),
    CONSTRAINT "institution_content_publication_events_version_check" CHECK ("resulting_version" > 0)
);

CREATE INDEX "institution_content_publication_events_scope_time_idx"
ON "institution_content_publication_events"("tenant_id", "campus_id", "occurred_at" DESC);

ALTER TABLE "institution_content_publication_events"
ADD CONSTRAINT "institution_content_publication_events_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "institution_content_publication_events"
ADD CONSTRAINT "institution_content_publication_events_tenant_id_campus_id_fkey"
FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "institution_content_publication_events"
ADD CONSTRAINT "institution_content_publication_events_tenant_id_content_id_fkey"
FOREIGN KEY ("tenant_id", "content_id") REFERENCES "institution_content_records"("tenant_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_institution_content_publication_event_mutation"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'institution content publication events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "institution_content_publication_events_append_only"
BEFORE UPDATE OR DELETE ON "institution_content_publication_events"
FOR EACH ROW EXECUTE FUNCTION "reject_institution_content_publication_event_mutation"();
