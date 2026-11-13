CREATE TYPE "fee_document_type" AS ENUM ('FEE_ITEM', 'BILL', 'RECEIPT', 'AGREEMENT');
CREATE TYPE "fee_document_status" AS ENUM ('AVAILABLE', 'PAID', 'VOIDED', 'EXPIRED', 'REVOKED');
CREATE TYPE "fee_ledger_entry_type" AS ENUM ('CHARGE', 'PAYMENT', 'REFUND');
CREATE TYPE "fee_document_audit_action" AS ENUM ('CREATED', 'UPDATED', 'REVOKED');

CREATE TABLE "fee_documents" (
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "document_type" "fee_document_type" NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "period" VARCHAR(7) NOT NULL,
  "amount_minor" BIGINT,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'CNY',
  "valid_from" DATE NOT NULL,
  "valid_to" DATE NOT NULL,
  "status" "fee_document_status" NOT NULL DEFAULT 'AVAILABLE',
  "summary" VARCHAR(500) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_documents_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
  CONSTRAINT "fee_documents_period_format" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT "fee_documents_amount_range" CHECK ("amount_minor" IS NULL OR "amount_minor" BETWEEN 0 AND 9007199254740991),
  CONSTRAINT "fee_documents_date_order" CHECK ("valid_to" >= "valid_from"),
  CONSTRAINT "fee_documents_positive_version" CHECK ("version" > 0),
  CONSTRAINT "fee_documents_currency_cny" CHECK ("currency" = 'CNY'),
  CONSTRAINT "fee_documents_campus_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fee_documents_student_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fee_documents_creator_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "fee_documents_scope_student_status_created_idx"
  ON "fee_documents" ("tenant_id", "campus_id", "student_id", "status", "created_at" DESC);

CREATE TABLE "fee_ledger_entries" (
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "entry_type" "fee_ledger_entry_type" NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'CNY',
  "period" VARCHAR(7) NOT NULL,
  "occurred_on" DATE NOT NULL,
  "created_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_ledger_entries_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
  CONSTRAINT "fee_ledger_entries_period_format" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT "fee_ledger_entries_amount_positive" CHECK ("amount_minor" BETWEEN 1 AND 9007199254740991),
  CONSTRAINT "fee_ledger_entries_currency_cny" CHECK ("currency" = 'CNY'),
  CONSTRAINT "fee_ledger_entries_document_fkey" FOREIGN KEY ("tenant_id", "campus_id", "document_id") REFERENCES "fee_documents"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fee_ledger_entries_student_fkey" FOREIGN KEY ("tenant_id", "campus_id", "student_id") REFERENCES "students"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fee_ledger_entries_creator_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "fee_ledger_entries_scope_student_date_idx"
  ON "fee_ledger_entries" ("tenant_id", "campus_id", "student_id", "occurred_on" DESC);

CREATE TABLE "fee_document_audit_events" (
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL,
  "actor_membership_id" UUID NOT NULL,
  "action" "fee_document_audit_action" NOT NULL,
  "document_version" INTEGER NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_document_audit_events_pkey" PRIMARY KEY ("tenant_id", "campus_id", "id"),
  CONSTRAINT "fee_document_audit_events_positive_version" CHECK ("document_version" > 0),
  CONSTRAINT "fee_document_audit_events_document_version_key" UNIQUE ("tenant_id", "campus_id", "document_id", "document_version"),
  CONSTRAINT "fee_document_audit_events_campus_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fee_document_audit_events_document_fkey" FOREIGN KEY ("tenant_id", "campus_id", "document_id") REFERENCES "fee_documents"("tenant_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fee_document_audit_events_actor_fkey" FOREIGN KEY ("tenant_id", "actor_membership_id", "campus_id") REFERENCES "membership_campuses"("tenant_id", "membership_id", "campus_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "fee_document_audit_events_scope_time_idx"
  ON "fee_document_audit_events" ("tenant_id", "campus_id", "occurred_at" DESC);

CREATE FUNCTION "reject_fee_history_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'fee history is append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "fee_ledger_entries_append_only"
  BEFORE UPDATE OR DELETE ON "fee_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "reject_fee_history_mutation"();

CREATE TRIGGER "fee_ledger_entries_no_truncate"
  BEFORE TRUNCATE ON "fee_ledger_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION "reject_fee_history_mutation"();

CREATE TRIGGER "fee_document_audit_events_append_only"
  BEFORE UPDATE OR DELETE ON "fee_document_audit_events"
  FOR EACH ROW EXECUTE FUNCTION "reject_fee_history_mutation"();

CREATE TRIGGER "fee_document_audit_events_no_truncate"
  BEFORE TRUNCATE ON "fee_document_audit_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "reject_fee_history_mutation"();
