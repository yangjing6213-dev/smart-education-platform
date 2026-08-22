# V0.1 Migration and Rollback Baseline

Status: approved design baseline for Phase 1B planning only.

## Migration discipline

Every schema change has a unique migration ID, owner, purpose, forward SQL, validation query, estimated lock impact, backup reference, and rollback or forward-fix decision. Migrations are additive first: add nullable structures, backfill in bounded batches, deploy compatible code, validate, and only then enforce constraints or remove obsolete structures.

## Preflight

Before applying a migration, verify a tested backup, database health, free space, active transaction age, application compatibility, maintenance window, and a named operator. The migration is halted when any preflight check fails.

## Rollback choices

- Code-only failure: deploy the previous immutable artifact while retaining compatible schema.
- Additive schema failure: stop, restore the previous artifact, and remove only the unreferenced addition after review.
- Data transformation failure: stop the batch, preserve the checkpoint, and run a reviewed corrective job; do not guess at data repair.
- Destructive change: not allowed in an unreviewed release; use a staged deprecation and a separate approval.

## Verification

After migration, run schema checks, tenant-scope checks, representative synthetic workflows, contract tests, and error-rate smoke checks. Record migration ID, artifact digest, operator, result, and rollback target. A backup is considered usable only after a restore verification in an isolated environment.

## Current-phase boundary

Batch B creates no database migration, database instance, backup, deployment, or rollback execution. This document is a plan and control baseline only.
