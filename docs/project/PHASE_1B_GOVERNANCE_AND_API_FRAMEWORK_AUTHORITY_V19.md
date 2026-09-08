# Phase 1B Governance and API Framework Authority V19

This authority supersedes V18 for the active Task 12 Stage C1 authorization
state. V18 and all earlier authorities remain HISTORICAL/FROZEN and are not
modified.

## Authority

```text
AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V19
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V19.md
AUTHORITY_STATUS=ACTIVE_V19
AUTHORITY_OWNER_DECISION=SYNC_TASK12_STAGE_B_OWNER_PASS_AND_AUTHORIZE_STAGE_C1
AUTHORITY_OWNER_APPROVAL_SOURCE=PROJECT_OWNER_EXPLICIT_V19_AND_TASK12_STAGE_C1_AUTHORIZATION_2026-09-08
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V18.md
AUTHORITY_SUPERSEDES_SHA256=20157D3F8B0DC997E380E75961BB308E66FCB0BD71214FACA2A713460BC7343E
CURRENT_HEAD_BEFORE_V19=e0cefee6417835ee7af24f572dfa76c82a5c3e63
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
PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_09_ACCEPTED_AND_TASK_12_STAGE_C1_AUTHORIZED
PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03|TASK_04|TASK_05|TASK_06|TASK_07|TASK_08|TASK_09
TASK_01_TO_TASK_09_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_09_STATUS=ACCEPTED_AND_FROZEN
TASK_09_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_09_ACCEPTANCE.md
TASK_09_ACCEPTANCE_SHA256=93BC037DEB90D179099F723D86A8409DD486C8D627C1337E734826BC7A70DC62
TASK_10_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_10_STAGE_B_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_10_STAGE_B_STATUS=NOT_STARTED_PENDING_TASK12_ACCEPTANCE
TASK_11_STARTED=NO
TASK_11_AUTHORIZATION=NOT_GRANTED
PHASE_1B_ACTIVE_TASK=TASK_12_STAGE_C1
TASK_12_STARTED=YES_STAGE_C1_AUTHORIZED
TASK_12_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_12_STAGE_B_COMMIT=e0cefee6417835ee7af24f572dfa76c82a5c3e63
TASK_12_STAGE_B_PARENT=b856fd809b2ee00e12907d1fd28a5c6186e6b8a2
TASK_12_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_C1_AUTHORIZATION=GRANTED
TASK_12_STAGE_C1_STATUS=AUTHORIZED_NOT_STARTED
TASK_12_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_12_STAGE_C2_STATUS=NOT_STARTED
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
```

Task 12 depends on accepted and frozen Tasks 02, 03, and 05 in the exact order
`T02 -> T03 -> T05`. Task 10 depends on `T05 -> T08 -> T12`; Task 10 Stage B
therefore remains not started until Task 12 has a separate accepted C2 record
and the project owner grants Task 10 Stage B implementation.

## Task 12 Stage B reviewed boundary

Task 12 is **File upload and COS adapter boundary**. The owner-reviewed Stage B
commit is limited to the following four files:

```text
TASK_12_STAGE_B_EXACT_FILES=apps/api/src/adapters/cos.storage.ts|apps/api/src/modules/files/file.service.ts|apps/api/src/modules/files/file.test.ts|apps/api/src/routes/file-intent.route.ts
TASK_12_STAGE_B_COMMIT_MESSAGE=feat: add scoped file storage adapter boundary
```

The implementation provides a deterministic in-memory storage port, validates
declared purpose, MIME, byte size, checksum, trusted membership and scope,
creates short-lived scope-bound upload intents, records scan state, and issues
scoped read tokens only for approved objects. Foreign scope, malformed or
unsigned access, expired intents or links, failed scans, and invalid metadata
must fail closed without a successful audit event or unintended state change.

The Stage B whitelist did not include `apps/api/src/server.ts`. The Task 12
route module is therefore independently testable but is not registered by the
global server factory. C1 must record this as a residual integration risk and
must not claim that the route is globally reachable.

## Task 12 Stage C1 authorization

Stage C1 may create exactly these three uncommitted evidence files:

```text
TASK_12_STAGE_C1_EXACT_FILES=docs/reviews/PHASE_1B_TASK_12_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_12.txt|artifacts/review-package/student-care-platform-phase1b-task-12-review-pack-v1.0.zip
TASK_12_STAGE_C1_GIT_POLICY=CREATE_UNCOMMITTED_EVIDENCE_ONLY
TASK_12_STAGE_C1_OWNER_GATE=AFTER_C1_BEFORE_C2
```

The detached manifest and deterministic ZIP use this exact member set:

```text
TASK_12_C1_MEMBER_COUNT=10
TASK_12_C1_MEMBER_ORDER=POSIX_RELATIVE_PATHS_CASEFOLDED_UNICODE_ORDINAL_ASCENDING
TASK_12_C1_FIRST_MEMBER=apps/api/package.json
TASK_12_C1_FIXED_TIMESTAMP=1980-01-01T00:00:00
TASK_12_C1_MEMBER_01=apps/api/package.json
TASK_12_C1_MEMBER_02=apps/api/src/adapters/cos.storage.ts
TASK_12_C1_MEMBER_03=apps/api/src/modules/files/file.service.ts
TASK_12_C1_MEMBER_04=apps/api/src/modules/files/file.test.ts
TASK_12_C1_MEMBER_05=apps/api/src/routes/file-intent.route.ts
TASK_12_C1_MEMBER_06=apps/api/src/server.ts
TASK_12_C1_MEMBER_07=docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md
TASK_12_C1_MEMBER_08=docs/project/PHASE_1B_TASK_12_PLAN.md
TASK_12_C1_MEMBER_09=package.json
TASK_12_C1_MEMBER_10=PHASE_1B_TASK_12_CODEX_EXECUTION.md
```

The ZIP must not contain the C1 review, detached manifest, ZIP itself, V19,
V18, any Task 01-11 review package or acceptance evidence, generated build
output, dependency directories, secrets, credentials, real personal data, or
unrelated files. It must contain no directory entries, unsafe paths, duplicate
members, or provider URLs and credentials. Member bytes, CRC values, manifest
SHA values, central-directory order, and a fresh in-memory deterministic rebuild
must all match.

## Active reference boundary

```text
V19_ACTIVE_REFERENCE_EXACT_FILES=AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md
V19_EXACT_REPOSITORY_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V19.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md
V19_WRITE_POLICY=EXACT_WHITELIST_ONLY
V19_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
V19_COMMIT_POLICY=ONE_ATOMIC_GOVERNANCE_SYNC_COMMIT
```

Task 09 and earlier contracts, plans, acceptance records, C1 evidence, review
packages, manifests, earlier authorities, and the old Task 06 verifier remain
HISTORICAL/FROZEN. The existing protected untracked Task 04/05/08/09 evidence
must not be read, modified, moved, deleted, staged, repackaged, or committed.
The Task 10 Stage A contract and plan remain protected and unchanged.

## Verification and stop gates

```text
NODE_AND_DOTNET_SHA256=REQUIRED_FOR_ALL_V19_SYNC_FILES_AND_C1_OUTPUTS
TEXT_FORMAT=UTF8_NO_BOM_LF_EXACTLY_ONE_TRAILING_LF
NO_SELF_SHA_IN_V19=YES
ACTIVE_REFERENCES_MUST_POINT_TO=V19_AND_EXTERNAL_V19_SHA256
GIT_DIFF_CHECK=REQUIRED
GIT_CACHED_DIFF_CHECK=REQUIRED
EXPLICIT_PATH_STAGING_ONLY=YES
NETWORK_DEPENDENCY_SERVICE_DATABASE_MIGRATION=NO
BRANCH_WORKTREE_GOAL_PUSH_PR_DEPLOY=NO
OLD_TASK06_VERIFIER=INDEPENDENT_HISTORICAL_BLOCKER_UNCHANGED
TASK_12_STAGE_C2=NOT_AUTHORIZED
TASK_13_PLUS=NOT_AUTHORIZED
```

V19 becomes active after its exact atomic governance commit passes verification.
The authorized C1 evidence may then be generated immediately. C1 must stop for
project-owner review and cannot create or imply C2 acceptance.

```text
OWNER_REVIEW_GATE=TASK12_STAGE_C1_BEFORE_C2
STOP_REASON=TASK12_STAGE_C1_OWNER_REVIEW_GATE_BEFORE_C2
```
