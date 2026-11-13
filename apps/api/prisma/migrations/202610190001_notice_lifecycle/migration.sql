CREATE TYPE "notice_template_code" AS ENUM (
  'INSTITUTION_ANNOUNCEMENT',
  'CLASS_ACTIVITY'
);

CREATE TYPE "notice_target" AS ENUM ('INSTITUTION', 'CLASS');

CREATE TYPE "notice_status" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'RETURNED',
  'APPROVED',
  'PUBLISHED',
  'REVOKED'
);

CREATE TYPE "notice_receipt_status" AS ENUM ('READ', 'ACKNOWLEDGED');

CREATE TABLE "notices" (
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "template_code" "notice_template_code" NOT NULL,
  "target" "notice_target" NOT NULL,
  "class_ref" VARCHAR(80),
  "status" "notice_status" NOT NULL DEFAULT 'DRAFT',
  "published" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_membership_id" UUID NOT NULL,
  "reviewed_by_membership_id" UUID,
  "published_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "notices_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
  CONSTRAINT "notices_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "notices_class_ref_check" CHECK (
    "class_ref" IS NULL OR length(btrim("class_ref")) BETWEEN 1 AND 80
  ),
  CONSTRAINT "notices_template_scope_check" CHECK (
    ("template_code" = 'INSTITUTION_ANNOUNCEMENT' AND "target" = 'INSTITUTION' AND "class_ref" IS NULL)
    OR
    ("template_code" = 'CLASS_ACTIVITY' AND "target" = 'CLASS' AND "class_ref" IS NOT NULL)
  ),
  CONSTRAINT "notices_published_status_check" CHECK (
    ("status" = 'PUBLISHED' AND "published" = true)
    OR ("status" <> 'PUBLISHED' AND "published" = false)
  ),
  CONSTRAINT "notices_campus_fkey" FOREIGN KEY ("tenant_id", "campus_id")
    REFERENCES "campuses" ("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "notices_creator_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id", "campus_id")
    REFERENCES "membership_campuses" ("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "notices_reviewer_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id", "campus_id")
    REFERENCES "membership_campuses" ("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "notices_tenant_campus_status_updated_at_idx"
  ON "notices"("tenant_id", "campus_id", "status", "updated_at");
CREATE INDEX "notices_tenant_campus_creator_updated_at_idx"
  ON "notices"("tenant_id", "campus_id", "created_by_membership_id", "updated_at");
CREATE INDEX "notices_tenant_campus_target_class_status_idx"
  ON "notices"("tenant_id", "campus_id", "target", "class_ref", "status");

CREATE TABLE "notice_receipts" (
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "notice_id" UUID NOT NULL,
  "guardian_user_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "notice_receipt_status" NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "notice_receipts_pkey" PRIMARY KEY (
    "tenant_id", "campus_id", "notice_id", "guardian_user_id", "version"
  ),
  CONSTRAINT "notice_receipts_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "notice_receipts_notice_fkey" FOREIGN KEY ("tenant_id", "campus_id", "notice_id")
    REFERENCES "notices" ("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "notice_receipts_guardian_fkey" FOREIGN KEY ("guardian_user_id")
    REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "notice_receipts_tenant_campus_guardian_status_updated_at_idx"
  ON "notice_receipts"("tenant_id", "campus_id", "guardian_user_id", "status", "updated_at");
