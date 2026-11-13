CREATE TABLE "invite_auth_accounts" (
  "user_id" UUID NOT NULL,
  "username" VARCHAR(64) NOT NULL,
  "normalized_username" VARCHAR(64) NOT NULL,
  "password_hash" VARCHAR(256) NOT NULL,
  "display_name" VARCHAR(80) NOT NULL,
  "password_changed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invite_auth_accounts_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "invite_auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "invite_auth_accounts_username_check" CHECK ("username" ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  CONSTRAINT "invite_auth_accounts_normalized_username_check" CHECK ("normalized_username" ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  CONSTRAINT "invite_auth_accounts_display_name_check" CHECK (length(btrim("display_name")) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX "invite_auth_accounts_normalized_username_key" ON "invite_auth_accounts"("normalized_username");

CREATE TABLE "identity_security_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "event_type" VARCHAR(48) NOT NULL,
  "outcome" VARCHAR(16) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identity_security_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "identity_security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "identity_security_events_user_type_time_idx" ON "identity_security_events"("user_id", "event_type", "created_at" DESC);

CREATE TABLE "user_profile_change_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "requested_display_name" VARCHAR(80) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 1,
  "reviewer_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMPTZ(6),
  CONSTRAINT "user_profile_change_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_profile_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_profile_change_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_profile_change_requests_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "user_profile_change_requests_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT "user_profile_change_requests_name_check" CHECK (length(btrim("requested_display_name")) BETWEEN 1 AND 80),
  CONSTRAINT "user_profile_change_requests_version_check" CHECK ("version" > 0)
);

CREATE INDEX "user_profile_change_requests_scope_status_time_idx" ON "user_profile_change_requests"("tenant_id", "status", "created_at");
CREATE INDEX "user_profile_change_requests_user_time_idx" ON "user_profile_change_requests"("user_id", "created_at" DESC);
CREATE UNIQUE INDEX "user_profile_change_requests_one_pending_per_tenant_user_key" ON "user_profile_change_requests"("tenant_id", "user_id") WHERE "status" = 'PENDING';
