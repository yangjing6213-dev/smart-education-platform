-- Source invalidation returns a report without attributing it to a human reviewer.
-- Only human-confirmed reports require a reviewer; drafts/submissions must not retain one.
ALTER TABLE "staff_daily_reports"
  DROP CONSTRAINT "staff_daily_reports_review_state_check",
  ADD CONSTRAINT "staff_daily_reports_review_state_check" CHECK (
    ("status" IN ('DRAFT', 'SUBMITTED') AND "reviewed_by_membership_id" IS NULL)
    OR "status" = 'RETURNED'
    OR ("status" = 'CONFIRMED' AND "reviewed_by_membership_id" IS NOT NULL)
  );
