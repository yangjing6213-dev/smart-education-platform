-- Existing manual revisions retain their original meaning; only new captures set this flag.
ALTER TABLE "care_record_revisions"
  ADD COLUMN "sources_captured" BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE "care_record_audit_action" ADD VALUE 'SOURCES_CHANGED';
