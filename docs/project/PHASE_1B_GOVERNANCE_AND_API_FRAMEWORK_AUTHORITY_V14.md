# Phase 1B Governance and API Framework Authority V14

This authority supersedes V13 for the completed Task 08 acceptance state.
V13 and all earlier authorities remain HISTORICAL/FROZEN and are not modified.

## Authority

```text
AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V14
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V14.md
AUTHORITY_STATUS=OWNER_ACCEPTED_ACTIVE
FORMALIZATION_STATUS=TASK08_C2_ACCEPTANCE_COMPLETE
AUTHORITY_OWNER_DECISION=RECORD_TASK08_C2_ACCEPTANCE_AND_CLOSE_TASK08
AUTHORITY_OWNER_APPROVAL_SOURCE=PROJECT_OWNER_EXPLICIT_TASK08_C1_PASS_AND_STAGE_C2_AUTHORIZATION_2026-09-03
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V13.md
AUTHORITY_SUPERSEDES_SHA256=E0CE8BD3AD0566C59563A5FA8E376B43BB64A6B82F09883C707EAF079BCCC98B
AUTHORITY_SHA256=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
AUTHORITY_SHA256_SCOPE=WHOLE_FILE
AUTHORITY_ENCODING=UTF-8
AUTHORITY_BOM=NO
AUTHORITY_LINE_ENDING=LF
AUTHORITY_TRAILING_LF=EXACTLY_ONE
```

## Current active governance

```text
BATCH_B_PROJECT_OWNER_ACCEPTANCE=PASS
PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_08_C2_ACCEPTANCE_ONLY
PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03|TASK_04|TASK_05|TASK_06|TASK_07|TASK_08
TASK_01_TO_TASK_07_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_06_STAGE_C2_STATUS=ACCEPTED
TASK_07_STAGE_C2_STATUS=ACCEPTED
TASK_08_STATUS=ACCEPTED_AND_FROZEN
TASK_08_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_08_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_08_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_08_STAGE_C1_STATUS=FINAL_EVIDENCE_READY_AND_OWNER_REVIEW_PASSED
TASK_08_STAGE_C1_AUTHORIZATION=GRANTED
TASK_08_STAGE_C2_STATUS=ACCEPTED
TASK_08_STAGE_C2_AUTHORIZATION=GRANTED
TASK_08_C2_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_08_ACCEPTANCE.md
TASK_08_C2_ACCEPTANCE_SHA256=CC55A5D600FB90E532835F42855DEFA66BCF305D727A4F874291B6A7A34FA2FD
TASK_08_C2_COMMIT=91d63b1458494d5765a2e1d6d3364729796d97eb
TASK_08_PLUS_STARTED=NO
TASK_08_PLUS_AUTHORIZATION=NOT_GRANTED
TASK_09_STARTED=NO
TASK_09_AUTHORIZATION=NOT_GRANTED
```

Task 08 Stage A, Stage B, and Stage C1 evidence were completed under their
separate owner gates. The Task 08 C2 acceptance is an acceptance record only;
it does not authorize implementation, deployment, or any later task. Its
verified whole-file SHA is recorded above without modifying the frozen record.

## Task 08 acceptance boundary

The accepted Task 08 implementation is the synthetic, in-memory activities
and meals slice delivered by the Stage B commit. It preserves explicit public
projections, published-only reads, server-derived tenant and campus scope,
active membership and capability checks, fail-closed invalid and cross-scope
operations, safe media references, stale-write protection, and no real data or
external integrations.

The accepted C1 evidence consists only of the Task 08 review, detached
manifest, and deterministic ZIP at their contract paths. These evidence files
remain separate from this authority and are not rewritten by the governance
synchronization.

```text
TASK_08_STAGE_B_COMMIT=497c9b7ffa107aba771bb6ffe988ff35998a259a
TASK_08_C1_REVIEW_PATH=docs/reviews/PHASE_1B_TASK_08_REVIEW.md
TASK_08_C1_MANIFEST_PATH=SHA256SUMS_PHASE_1B_TASK_08.txt
TASK_08_C1_ZIP_PATH=artifacts/review-package/student-care-platform-phase1b-task-08-review-pack-v1.0.zip
TASK_08_C1_EVIDENCE_POLICY=FROZEN|DO_NOT_MODIFY
TASK_08_C2_POLICY=ACCEPTANCE_RECORD_ONLY|FROZEN|DO_NOT_MODIFY
```

## API, data, and safety boundary

The API remains Fastify 5.12.1 on Node 24.14.0 with pnpm 11.22.0. All
institution and campus objects remain tenant and campus isolated. The server
derives trusted identity, membership, capability, publication, ownership, and
version scope. Client claims cannot widen access or authorize writes.

Only synthetic fixtures and clearly fictional examples are permitted. No real
login, provider, network service, production database, migration, credential,
personal data, or production deployment is authorized. The historical
`scripts/verify_task_06.mjs` V9 boundary failure remains an independent
historical blocker and is not modified or used to alter this authority.

## Lifecycle and next-task boundary

```text
TASK_08_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_08_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_08_STAGE_C1_STATUS=FINAL_EVIDENCE_READY_AND_OWNER_REVIEW_PASSED
TASK_08_STAGE_C2_STATUS=ACCEPTED
TASK_08_STATUS=ACCEPTED_AND_FROZEN
TASK_08_PLUS_STARTED=NO
TASK_08_PLUS_AUTHORIZATION=NOT_GRANTED
TASK_09_STARTED=NO
TASK_09_AUTHORIZATION=NOT_GRANTED
TASK_09_PLUS_POLICY=NO_IMPLEMENTATION_AUTHORIZATION
OWNER_REVIEW_GATE=TASK08_ACCEPTED_STOP_BEFORE_TASK09
STOP_REASON=TASK08_ACCEPTED_STOP_BEFORE_TASK09
```

V14 is a whole-file authority with no self-reference. Its actual SHA-256 is
recorded only outside the repository after the file is stable and all active
references are synchronized. V13 and earlier authorities, Task 01-07 frozen
evidence, Task 08 C1 evidence, Task 08 C2 acceptance, the old verifier, and
the six existing Task 04/05 untracked evidence paths remain untouched.
