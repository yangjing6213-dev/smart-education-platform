ALTER TYPE "care_record_audit_action" ADD VALUE 'WITHDRAWN';
ALTER TYPE "care_record_audit_action" ADD VALUE 'PUBLICATION_REVOKED';
ALTER TYPE "care_record_receipt_status" ADD VALUE 'UNREAD';

ALTER TABLE "care_record_receipts" ALTER COLUMN "read_at" DROP NOT NULL;
ALTER TABLE "care_record_receipts" DROP CONSTRAINT "care_record_receipts_acknowledgement_state_check";
ALTER TABLE "care_record_receipts"
  ADD CONSTRAINT "care_record_receipts_acknowledgement_state_check"
  CHECK (
    ("status"::text = 'UNREAD' AND "read_at" IS NULL AND "acknowledged_at" IS NULL)
    OR ("status"::text = 'READ' AND "read_at" IS NOT NULL AND "acknowledged_at" IS NULL)
    OR (
      "status"::text = 'ACKNOWLEDGED'
      AND "read_at" IS NOT NULL
      AND "acknowledged_at" IS NOT NULL
      AND "acknowledged_at" >= "read_at"
    )
  );
