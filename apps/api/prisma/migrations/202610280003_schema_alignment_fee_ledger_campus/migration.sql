-- Match the declared ledger campus relation without removing existing scope guards.
ALTER TABLE "fee_ledger_entries"
  ADD CONSTRAINT "fee_ledger_entries_tenant_id_campus_id_fkey"
  FOREIGN KEY ("tenant_id", "campus_id")
  REFERENCES "campuses" ("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "institution_content_records_scope_key_idx"
  ON "institution_content_records" ("tenant_id", "campus_id", "content_key");

CREATE INDEX "institution_content_publication_events_content_time_idx"
  ON "institution_content_publication_events" ("tenant_id", "content_id", "occurred_at" DESC);
