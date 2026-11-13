CREATE TABLE "invite_auth_sessions" (
  "token_hash" CHAR(64) NOT NULL,
  "user_id" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invite_auth_sessions_pkey" PRIMARY KEY ("token_hash"),
  CONSTRAINT "invite_auth_sessions_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "invite_auth_sessions_user_id_expires_at_idx"
ON "invite_auth_sessions"("user_id", "expires_at");

CREATE INDEX "invite_auth_sessions_expires_at_idx"
ON "invite_auth_sessions"("expires_at");
