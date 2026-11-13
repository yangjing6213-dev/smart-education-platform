CREATE TABLE "pickup_credentials" (
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "authorization_id" UUID NOT NULL,
    "authorization_version" INTEGER NOT NULL,
    "credential_hash" VARCHAR(64) NOT NULL,
    "issued_by_membership_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "invalidated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_credentials_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
    CONSTRAINT "pickup_credentials_authorization_version_check" CHECK ("authorization_version" > 0),
    CONSTRAINT "pickup_credentials_hash_length_check" CHECK (length("credential_hash") = 64),
    CONSTRAINT "pickup_credentials_single_terminal_state_check" CHECK ("consumed_at" IS NULL OR "invalidated_at" IS NULL),
    CONSTRAINT "pickup_credentials_authorization_fkey" FOREIGN KEY ("tenant_id", "campus_id", "authorization_id") REFERENCES "pickup_authorizations"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pickup_credentials_issuer_fkey" FOREIGN KEY ("tenant_id", "issued_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "pickup_credentials_credential_hash_key" ON "pickup_credentials"("credential_hash");
CREATE INDEX "pickup_credentials_tenant_id_campus_id_authorization_id_created_at_idx" ON "pickup_credentials"("tenant_id", "campus_id", "authorization_id", "created_at");
CREATE INDEX "pickup_credentials_tenant_id_campus_id_expires_at_idx" ON "pickup_credentials"("tenant_id", "campus_id", "expires_at");
