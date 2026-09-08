# Phase 1B Governance and API Framework Authority V20

This authority supersedes V19 for the active Task 12 C2 accepted/frozen state.
V19 and all earlier authorities remain HISTORICAL/FROZEN and are not modified.

## Authority

```text
AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V20
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V20.md
AUTHORITY_STATUS=AUTHORIZED_V20_PENDING_OWNER_REVIEW
AUTHORITY_OWNER_DECISION=SYNC_TASK12_C2_GRANTED_ACCEPTED_AND_FROZEN
AUTHORITY_OWNER_APPROVAL_SOURCE=PROJECT_OWNER_EXPLICIT_TASK12_C2_ACCEPTANCE_AND_V20_SYNC_2026-09-08
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V19.md
AUTHORITY_SUPERSEDES_SHA256=9A6C417329E8A95372DBC39D1EF1F83F1A634E10C456FCA9F9C01AF6D6DA7D19
CURRENT_HEAD_BEFORE_V20=5e5c8963acc4cd5d46b27e2236fa0c4802558654
AUTHORITY_SHA256=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
AUTHORITY_SHA256_SCOPE=WHOLE_FILE
AUTHORITY_ENCODING=UTF-8
AUTHORITY_BOM=NO
AUTHORITY_LINE_ENDING=LF
AUTHORITY_TRAILING_LF=EXACTLY_ONE
```

## Current active governance

```text
PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_12_ACCEPTED_AND_FROZEN
PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03|TASK_04|TASK_05|TASK_06|TASK_07|TASK_08|TASK_09|TASK_12
TASK_01_TO_TASK_09_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_09_STATUS=ACCEPTED_AND_FROZEN
TASK_10_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_10_STAGE_B_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_10_STAGE_B_STATUS=NOT_STARTED_OWNER_AUTHORIZATION_REQUIRED
TASK_11_STARTED=NO
TASK_11_AUTHORIZATION=NOT_GRANTED
PHASE_1B_ACTIVE_TASK=TASK_12_ACCEPTED_AND_FROZEN
TASK_12_STARTED=YES_STAGE_C2_ACCEPTED
TASK_12_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_12_STAGE_B_COMMIT=e0cefee6417835ee7af24f572dfa76c82a5c3e63
TASK_12_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_C1_AUTHORIZATION=GRANTED
TASK_12_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_C2_AUTHORIZATION=GRANTED
TASK_12_STAGE_C2_STATUS=ACCEPTED
TASK_12_STATUS=ACCEPTED_AND_FROZEN
TASK_12_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_12_ACCEPTANCE.md
TASK_12_ACCEPTANCE_SHA256=909A8153FA681F3C5951B236755A0147049F0FA13A9828F8BBB0381D2AA04908
TASK_12_C2_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_12_ACCEPTANCE.md
TASK_12_C2_ACCEPTANCE_SHA256=909A8153FA681F3C5951B236755A0147049F0FA13A9828F8BBB0381D2AA04908
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
```

Task 12 is **File upload and COS adapter boundary**. Its C2 acceptance is an
acceptance-only record based on the owner-reviewed Stage B implementation and
the owner-reviewed C1 evidence. The C1 review, detached manifest, deterministic
ZIP, and acceptance record remain protected evidence inputs and are not modified
or repackaged by this synchronization.

## Preserved implementation boundary

The Task 12 Stage B implementation remains limited to its approved four files
and keeps the storage port/provider-fake boundary, server-derived tenant and
campus scope, active membership/capability checks, checksum and scan rules, and
fail-closed access behavior. COS credentials remain outside source and fixtures.

The implementation has a residual route integration gap: `apps/api/src/server.ts`
does not register `registerFileIntentRoutes`. Module-level route evidence must
not be presented as global endpoint reachability. Route repair is not authorized
by V20 and is not part of this governance synchronization.

## Dependency and future-task boundary

Task 12 retains the dependency order `T02 -> T03 -> T05`. Task 10 retains the
dependency order `T05 -> T08 -> T12`, but Task 10 Stage B remains
`NOT_GRANTED` and `NOT_STARTED_OWNER_AUTHORIZATION_REQUIRED`. Task 11 and
Task 13+ remain not started and not granted. Task 12 acceptance does not
automatically authorize Task 10, Task 11, Task 12 route repair, or Task 13+.
Each future task requires its own contract, stable authority, owner review, and
separate implementation authorization.

## Historical and protected evidence

V19 and earlier authorities remain HISTORICAL/FROZEN. Task 01-09 contracts,
acceptance records, C1 evidence, frozen packages, Task 12 C1 evidence and C2
acceptance, the Task 10 Stage A files, and all existing protected untracked
evidence remain unchanged. The old `scripts/verify_task_06.mjs` verifier remains
an independent historical blocker and must not be repaired, bypassed, or
rewritten as PASS.

## Active reference and commit boundary

```text
V20_ACTIVE_REFERENCE_EXACT_FILES=AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md
V20_EXACT_REPOSITORY_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V20.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md
V20_WRITE_POLICY=EXACT_WHITELIST_ONLY
V20_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
V20_COMMIT_POLICY=ONE_ATOMIC_GOVERNANCE_SYNC_COMMIT
NODE_AND_DOTNET_SHA256=REQUIRED_FOR_ALL_V20_SYNC_FILES
TEXT_FORMAT=UTF8_NO_BOM_LF_EXACTLY_ONE_TRAILING_LF
EXPLICIT_PATH_STAGING_ONLY=YES
NETWORK_DEPENDENCY_SERVICE_DATABASE_MIGRATION=NO
BRANCH_WORKTREE_GOAL_PUSH_PR_DEPLOY=NO
OLD_TASK06_VERIFIER=INDEPENDENT_HISTORICAL_BLOCKER_UNCHANGED
TASK_10_STAGE_B=NOT_GRANTED
TASK_11=NOT_STARTED_AND_NOT_GRANTED
TASK_12_ROUTE_REPAIR=NOT_GRANTED
TASK_13_PLUS=NOT_STARTED_AND_NOT_GRANTED
```

V20 becomes the active authority only after the exact ten-path governance
commit passes its independent verification. This synchronization does not
start Task 10 Stage B, Task 11, Task 12 route repair, or Task 13+.

```text
OWNER_REVIEW_GATE=V20_GOVERNANCE_SYNC_BEFORE_TASK10_STAGE_B
STOP_REASON=V20_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```
