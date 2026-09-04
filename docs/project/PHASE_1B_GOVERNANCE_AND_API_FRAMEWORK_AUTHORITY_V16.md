# Phase 1B Governance and API Framework Authority V16

This authority supersedes V15 for the Task 09 entry-repair state. V15 and
all earlier authorities remain HISTORICAL/FROZEN and are not modified.

## Authority

```text
AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V16
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V16.md
AUTHORITY_STATUS=ACTIVE_REPAIR_AUTHORIZATION
AUTHORITY_OWNER_DECISION=AUTHORIZE_TASK09_STAGE_B_ENTRY_REPAIR
AUTHORITY_OWNER_APPROVAL_SOURCE=Current explicit project-owner delegation for Task 09 Stage B entry repair dated 2026-09-04; no separate evidence identifier supplied
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V15.md
AUTHORITY_SUPERSEDES_SHA256=B9AFFF943AF2EFC7EEBA124DF97DFF9CACF6A13FFE07C6C2B75C515317E8D2A1
CURRENT_HEAD_BEFORE_V16=dbbda11521fd1e2ca49f05e31858c90200e976d6
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
PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_08_C2_ACCEPTANCE_AND_TASK_09_STAGE_B_ENTRY_REPAIR_ONLY
PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03|TASK_04|TASK_05|TASK_06|TASK_07|TASK_08
TASK_01_TO_TASK_08_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_08_STATUS=ACCEPTED_AND_FROZEN
TASK_08_STAGE_C2_STATUS=ACCEPTED
TASK_08_STAGE_C2_AUTHORIZATION=GRANTED
TASK_09_STARTED=YES_EXISTING_MODULE_EVIDENCE_ONLY
TASK_09_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_MODULE_EVIDENCE=EXISTS_IN_ORIGINAL_FOUR_FILES
TASK_09_STAGE_B_ENTRY_REPAIR_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_REPAIR_STATUS=NOT_STARTED
TASK_09_STAGE_B_STATUS=ENTRY_REPAIR_PENDING_REVIEW
TASK_09_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_09_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_10_PLUS_STARTED=NO
TASK_10_PLUS_AUTHORIZATION=NOT_GRANTED
```

The project owner authorized a minimal repair because the original four
Task 09 module files exist, but the API and admin-web entry points are not
connected. Authorization does not mean that the repair has started or passed.
The original module contract remains unchanged.

The historical `scripts/verify_task_06.mjs` boundary failure remains an
independent historical blocker. It is not repaired, weakened, bypassed, or
used to authorize a later task.

## Task 09 entry-repair boundary

Task 09 is **Newcomer guides** and depends on accepted and frozen Tasks 05 and
07 (`T05 -> T07`). The original four-file Stage B evidence remains fixed:

```text
TASK_09_STAGE_B_ORIGINAL_EXACT_FILES=apps/api/src/modules/guides/guide.service.ts|apps/api/src/routes/staff-guides.route.ts|apps/user-web/src/pages/staff-guides.tsx|apps/api/src/modules/guides/guide.test.ts
TASK_09_STAGE_B_ORIGINAL_FILES_POLICY=PRODUCTION_MODULES_FROZEN_GUIDE_TEST_ADDITIVE_REPAIR_ONLY
```

The exact repair whitelist is only:

```text
TASK_09_STAGE_B_REPAIR_EXACT_FILES=apps/api/src/server.ts|apps/admin-web/src/main.ts|apps/api/src/modules/guides/guide.test.ts|apps/admin-web/test/home-content.test.mjs
TASK_09_STAGE_B_REPAIR_WRITE_POLICY=EXACT_WHITELIST_ONLY
TASK_09_STAGE_B_REPAIR_STATUS=NOT_STARTED
```

The repair must make `server.ts` inject or construct `GuideService` and
`StaffGuideScopeResolver` options and call the existing
`registerStaffGuideRoutes`. It must add `/admin/staff-guides` to the existing
static admin-web entry pattern and render the existing staff-guide contract
with clearly synthetic data. The existing production module files and their
behavior remain unchanged; `guide.test.ts` may receive only additive
`buildServer` integration coverage. The repair must not alter the existing
`/staff/guides` module contract, add a network call, or create another file.

No other repository path is included in this repair authority. A required
shared entry point, contract, verifier, package script, lockfile, schema,
migration, dependency, or other path is a fail-closed blocker.

## Data and safety boundary

The existing Task 09 service remains responsible for server-derived tenant
and campus scope, active membership, capability checks, bounded search,
publication and version checks, approved file references, and fail-closed
denials. The repair only wires those existing contracts into the API server
and the local static admin-web route.

Only clearly synthetic fixtures and fictional labels are permitted. No real
personal data, credentials, production data, external provider, network
service, persistent production database, migration, deployment, or production
login is authorized.

## Lifecycle and stop point

```text
TASK_09_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_MODULE_EVIDENCE=EXISTS_IN_ORIGINAL_FOUR_FILES
TASK_09_STAGE_B_ENTRY_REPAIR_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_REPAIR_STATUS=NOT_STARTED
TASK_09_STAGE_B_STATUS=ENTRY_REPAIR_PENDING_REVIEW
TASK_09_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_09_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_09_STARTED=YES_EXISTING_MODULE_EVIDENCE_ONLY
TASK_10_PLUS_STARTED=NO
TASK_10_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK09_STAGE_B_REPAIR_BEFORE_C1
STOP_REASON=TASK09_STAGE_B_REPAIR_OWNER_REVIEW_GATE
```

The repair lifecycle is failing tests -> minimal entry repair -> focused
verification -> explicit repair commit -> owner review gate -> separate C1
authorization. C1, C2, and Task 10+ are not authorized by this authority.

## Verification and prohibited operations

```text
TDD_RED_BEFORE_PRODUCTION_CODE=REQUIRED
NODE_AND_DOTNET_SHA256=REQUIRED_FOR_CHANGED_TEXT_FILES
UTF8_NO_BOM_LF_EXACTLY_ONE_TRAILING_LF=REQUIRED
NETWORK_REGISTRY_EXTERNAL_API_PROVIDER=NO
DEPENDENCY_OR_LOCKFILE_CHANGE=NO
SERVICE_DATABASE_OR_MIGRATION=NO
BRANCH_OR_WORKTREE=NO
GOAL_OR_TASK_DISPATCH=NO
GIT_ADD_MUST_BE_EXPLICIT=YES
GIT_PUSH_PR_DEPLOY=NO
TASK_09_C1_C2=NO
TASK_10_PLUS=NO
TASK01_TO_TASK08_FREEZENS_OR_V1_TO_V15_MODIFICATION=NO
PROTECTED_UNTRACKED_EVIDENCE_READ_OR_MODIFICATION=NO
```

V16 has no self-referencing SHA. Its actual SHA is reported externally after
the file and all active references are stable and independently verified.
