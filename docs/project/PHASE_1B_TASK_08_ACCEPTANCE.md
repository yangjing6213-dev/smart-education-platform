# Phase 1B Task 08 Acceptance Record

```text
TASK_ID=PHASE_1B_TASK_08
TASK_NAME=ACTIVITIES_AND_MEALS
STAGE=C2
STATUS=ACCEPTED
PROJECT_OWNER_ACCEPTANCE=PASS
OWNER_ACCEPTANCE_SOURCE=EXPLICIT_OWNER_MESSAGE_IN_CURRENT_CONTROL_THREAD_2026-09-04
ACCEPTANCE_SCOPE=ACCEPTANCE_RECORD_ONLY
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V13.md
ACTIVE_GOVERNANCE_SHA256=E0CE8BD3AD0566C59563A5FA8E376B43BB64A6B82F09883C707EAF079BCCC98B
TARGET_BRANCH=feature/phase-1b-task-04-identity-membership
ACCEPTANCE_EVIDENCE_HEAD=497c9b7ffa107aba771bb6ffe988ff35998a259a
STAGE_B_IMPLEMENTATION_COMMIT=497c9b7ffa107aba771bb6ffe988ff35998a259a
STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
```

This record accepts the bounded Task 08 Stage B implementation after the
project owner's explicit C1 review pass and C2 authorization. C2 creates only
this acceptance record. It does not modify Stage B or C1 evidence, the active
V13 authority, the historical Task 06 verifier, or Task 01-07 frozen evidence.

## Stage C1 evidence

```text
C1_STATUS=FINAL_EVIDENCE_READY_AND_OWNER_REVIEW_PASSED
C1_OWNER_REVIEW=PASS
C1_OWNER_REVIEW_SOURCE=EXPLICIT_OWNER_MESSAGE_IN_CURRENT_CONTROL_THREAD_2026-09-04
C1_COMMIT=NOT_CREATED_IN_CURRENT_WORKTREE
C1_REVIEW_PATH=docs/reviews/PHASE_1B_TASK_08_REVIEW.md
C1_REVIEW_BYTES=4822
C1_REVIEW_SHA256=B18434AA3000BB569F665F0EC1FC9C7028802E36F9F4A8C4EC9E27D2A1192557
C1_MANIFEST_PATH=SHA256SUMS_PHASE_1B_TASK_08.txt
C1_MANIFEST_BYTES=2219
C1_MANIFEST_SHA256=49F2BC72E39E32535A9B7B5EC3ECE81259530C11EC6230D6845BAB495817BFDA
C1_ZIP_PATH=artifacts/review-package/student-care-platform-phase1b-task-08-review-pack-v1.0.zip
C1_ZIP_BYTES=220158
C1_ZIP_SHA256=FFF64543C329B6F3445A356C5D942831F9837A8A85291825230ECFF2E5841D86
C1_MEMBER_COUNT=22
C1_MEMBER_ORDER=POSIX_RELATIVE_PATHS_CASEFOLDED_UNICODE_ORDINAL_ASCENDING
C1_FIXED_TIMESTAMP=1980-01-01T00:00:00
C1_MANIFEST_MEMBER_SHA_VALIDATION=PASS
C1_ZIP_MEMBER_BYTE_VALIDATION=PASS
C1_ZIP_CRC_VALIDATION=PASS
C1_ZIP_DETERMINISTIC_REBUILD=PASS
C1_C1_ARTIFACT_EXCLUSION=PASS
```

The detached manifest covers exactly the 22 ZIP members. The C1 review,
manifest, ZIP, this C2 record, Task 04/05 evidence, generated output, and
unrelated files are excluded from the ZIP. All C1 text files are UTF-8 without
a BOM, LF-only, and have exactly one trailing LF. Node crypto and .NET
SHA-256 values match for each C1 artifact.

## Accepted scope and verification

Task 08 provides date-bounded activities and meals, versioned drafts,
published-only public projections, server-derived tenant and campus scope,
active membership and capability checks, safe media references, publication
transitions, publication audit events, and fail-closed stale-version and
foreign-scope handling. Public output omits private, administrative, scope,
version, synthetic-marker, and unsafe-media details. Fixtures are synthetic.

```text
TARGETED_STAGE_B_VERIFICATION=PASS
API_EXISTING_TESTS=44_PASS_0_FAIL
TASK_08_ACTIVITY_MEAL_ROUTE_ADMIN_TESTS=9_PASS_0_FAIL
ADMIN_EXISTING_TESTS=1_PASS_0_FAIL
TYPECHECK=PASS_EXIT_0
LINT=PASS_EXIT_0
FORMAT_CHECK=PASS_EXIT_0
BUILD=PASS_EXIT_0
HTTP_SMOKE=PASS_SERVER_LISTEN_NO
GIT_DIFF_CHECK=PASS_EXIT_0
GIT_CACHED_DIFF_CHECK=PASS_EXIT_0
```

The repository-wide `corepack pnpm test` has one known historical failure: the
Task 06 package-boundary test invokes `scripts/verify_task_06.mjs`, which still
hard-codes the V9 authority and the old Task 06 base head. The project owner
accepted this as an independent historical blocker. The verifier and its test
were not changed in Task 08.

## Frozen evidence and safety

```text
TASK01_TO_TASK07_FROZEN_EVIDENCE=UNCHANGED
TASK04_TASK05_UNTRACKED_EVIDENCE=RETAINED_UNTOUCHED
V13_AUTHORITY=UNCHANGED
OLD_TASK06_VERIFIER=UNCHANGED
TASK_08_STAGE_C2_STATUS=ACCEPTED
TASK_08_STAGE_C2_AUTHORIZATION=GRANTED
TASK_09_PLUS_STARTED=NO
TASK_09_PLUS_AUTHORIZATION=NOT_GRANTED
REAL_PERSONAL_DATA=NO
PRODUCTION_SECRETS=NO
NETWORK_OR_REGISTRY=NO
DEPENDENCY_INSTALL_OR_UPDATE=NO
SERVICE_STARTED=NO
DATABASE_OR_MIGRATION=NO
PUSH=NO
PR=NO
DEPLOYMENT=NO
```

This file is acceptance-record-only and intentionally does not contain its own
SHA-256. The C1 evidence remains separate. No Task 09+ activity is authorized.

```text
TASK_08_C2_RECORD=COMPLETE
STOP_REASON=TASK08_ACCEPTED_STOP_BEFORE_TASK09
```
