# Phase 1B Task 08 Codex Execution Contract

This contract records the completed Task 08 Stage A, Stage B, Stage C1, and
Stage C2 lifecycle. Task 08 is accepted and frozen; Task 09+ remains
unauthorized.

## Contract status and authorization

```text
TASK_ID=PHASE_1B_TASK_08
TASK_NAME=ACTIVITIES_AND_MEALS
TASK_STAGE=STAGE_C2_ACCEPTANCE
TASK_STATUS=ACCEPTED_AND_FROZEN
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
TARGET_BRANCH=CURRENT_CHECKOUT_NO_NEW_BRANCH_OR_WORKTREE
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=91d63b1458494d5765a2e1d6d3364729796d97eb
OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK08_C1_PASS_AND_STAGE_C2_AUTHORIZATION_2026-09-03
STAGE_A_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK08_STAGE_A_FORMALIZATION_2026-09-03
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V14.md
ACTIVE_GOVERNANCE_SHA256=34323408892CC933F96DF1EA95F92F7A4F64D530B1851A24608BD78CE872B339
TASK_05_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
TASK_05_ACCEPTANCE_SHA256=640BCF9B2B5C33ED1499E1F5C35E58608872953DCF0059A33086312FC260ECDD
TASK_05_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_08_STARTED=YES_STAGE_C2_ACCEPTANCE
TASK_08_STAGE_A_AUTHORIZATION=GRANTED
TASK_08_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_08_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_08_STAGE_C1_STATUS=FINAL_EVIDENCE_READY_AND_OWNER_REVIEW_PASSED
TASK_08_STAGE_C1_AUTHORIZATION=GRANTED
TASK_08_STAGE_C2_STATUS=ACCEPTED
TASK_08_STAGE_C2_AUTHORIZATION=GRANTED
TASK_08_STATUS=ACCEPTED_AND_FROZEN
TASK_08_C2_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_08_ACCEPTANCE.md
TASK_08_C2_ACCEPTANCE_SHA256=CC55A5D600FB90E532835F42855DEFA66BCF305D727A4F874291B6A7A34FA2FD
TASK_08_PLUS_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_08_PLUS_STARTED=NO
```

The current V14 authority supersedes V13 for the completed Task 08 acceptance
state. V13, V12, and V11 remain HISTORICAL/FROZEN. The direct owner
authorization above records the separate C2 acceptance authorization; the C2
record is acceptance-only and does not authorize Task 09+.

## Objective and scope

Task 08 will define a typed, tenant- and campus-scoped activity and meal
content slice for date-bounded records. The future product behavior is:

- public activity and meal reads expose only an explicit published projection;
- authorized administrators can create, edit, publish, and unpublish records
  within a server-derived tenant and allowed-campus scope;
- invalid dates, unpublished entries, cross-campus writes, and unsafe media
  references fail closed;
- activity and meal structures carry typed date, tenant, and campus predicates;
- all examples and fixtures are synthetic and clearly non-real.

Task 08 depends on the accepted Task 05 content and publication model. It may
reuse its version, publication, stale-write, public-projection, membership,
capability, audit-boundary, and client-claim rules, but it may not modify Task
05 or any Task 01-07 frozen evidence.

## Security and data boundaries

The server derives identity, tenant, campus, active membership, and capability
from trusted request context and accepted membership records. Client-supplied
tenant IDs, campus IDs, role claims, publication claims, ownership claims,
date-range claims, media references, and version claims are inputs only, never
authorization sources.

Public reads must apply an explicit allowlist and published-only policy. They
must not expose private fields, draft content, membership data, tenant or
campus administration metadata, moderation data, internal version details,
audit internals, or unsafe file information. Foreign-tenant and foreign or
disallowed-campus access must fail closed.

Date validation must reject malformed dates, impossible calendar dates,
inverted ranges, and records outside the defined date-bounded contract before
state changes. Media references must use only the approved file-reference
contract and safe symbolic or validated references; arbitrary client URLs,
provider tokens, executable content, and unapproved cross-scope references are
not permitted.

No real names, contact details, child records, photographs, credentials,
production data, external providers, persistent production databases, or
network services may be used. Synthetic fixtures must be obviously fictional
and non-reversible to a real person.

## Stage A file boundary

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_08_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_08_PLAN.md
STAGE_A_WRITE_POLICY=CREATE_ONLY_THE_TWO_EXACT_FILES
STAGE_A_FORMAT_GATE=CHECK_ONLY_THE_TWO_STAGE_A_FILES
STAGE_A_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
```

No `docs/superpowers/plans` file, review, manifest, ZIP, screenshot, generated
output, acceptance record, or other repository file may be created in Stage A.
The future Stage B/C1/C2 files are not required for the Stage A format gate.

## Future implementation reference boundary

The following paths are design references only. They are not created in Stage
A and are not implementation authorization:

```text
FUTURE_IMPLEMENTATION_FILES=apps/api/src/modules/activities/activity.service.ts|apps/api/src/modules/meals/meal.service.ts|apps/api/src/routes/public-activities.route.ts|apps/admin-web/src/pages/meals.tsx|apps/api/src/modules/activities/activity.test.ts
```

The historical V13 Stage B boundary authorized the five core files above plus the API
server entry, admin entry, and public meals route needed to close the existing
integration gap. Stage C1 may create only its separately authorized review, detached
manifest, and deterministic ZIP. Stage C2 may create only its separately
authorized acceptance record. Those completed-stage boundaries do not grant
Task 09+ implementation authorization.

## Lifecycle and owner gates

```text
STAGE_A=CONTRACT_AND_PLAN_FORMALIZATION_COMPLETE
STAGE_A_OWNER_REVIEW_GATE=PASSED
STAGE_B=IMPLEMENTED_AND_VERIFIED
STAGE_C1=FINAL_EVIDENCE_READY_AND_OWNER_REVIEW_PASSED
STAGE_C1_OWNER_REVIEW_GATE=AFTER_STAGE_C1_BEFORE_STAGE_C2
STAGE_C2=ACCEPTED_AND_FROZEN_ACCEPTANCE_RECORD_ONLY
TASK_08_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_08_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_08_STAGE_C1_STATUS=FINAL_EVIDENCE_READY_AND_OWNER_REVIEW_PASSED
TASK_08_STAGE_C1_AUTHORIZATION=GRANTED
TASK_08_STAGE_C2_STATUS=ACCEPTED
TASK_08_STAGE_C2_AUTHORIZATION=GRANTED
TASK_08_STATUS=ACCEPTED_AND_FROZEN
TASK_08_PLUS_STARTED=NO
TASK_08_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK08_ACCEPTED_STOP_BEFORE_TASK09
STOP_REASON=TASK08_ACCEPTED_STOP_BEFORE_TASK09
```

Stage A does not run implementation, tests, services, browser checks, or
future-stage validators. It stops after the two documents and their read-only
format/hash/boundary checks, awaiting owner review.

## Verification and stop conditions

The Stage A verification set is read-only:

```text
Node crypto SHA-256 for both Stage A files
.NET SHA256 for both Stage A files over the same bytes
UTF-8 without BOM, CR=0, LF-only, exactly one trailing LF
No self-SHA reference in either Stage A file
git status --short --branch --untracked-files=all
git rev-parse HEAD
git diff --check
git diff --cached --check
git remote
git worktree list
```

The completed Task 08 stages were checked against the eight exact
implementation/test files, current governance, and frozen dependency anchors,
plus existing read-only quality checks. Any
non-whitelist change, missing frozen evidence, anchor drift, encoding/hash
failure, real data or secret, dependency activity, network/service activity,
or later-stage artifact is a fail-closed stop.

## Prohibited actions

```text
IMPLEMENTATION_CODE=YES_ONLY_IN_STAGE_B_EXACT_FILES
TEST_CODE=YES_ONLY_IN_STAGE_B_EXACT_FILES
SCHEMA_OR_MIGRATION=NO
DEPENDENCY_OR_LOCKFILE_CHANGE=NO
PACKAGE_OR_SCRIPT_CHANGE=NO
NETWORK_REGISTRY_EXTERNAL_API_PROVIDER=NO
SERVICE_DATABASE_BROWSER_OR_PRODUCTION_DATA=NO
BRANCH_OR_WORKTREE=NO
GOAL_OR_TASK_DISPATCH=NO
GIT_ADD_STAGE_COMMIT=GOVERNANCE_SYNC_ONLY
GIT_PUSH_PR_DEPLOY=NO
TASK08_STAGE_B_C1_C2_ACCEPTANCE_ARTIFACTS=FROZEN_AFTER_ACCEPTANCE
TASK01_TO_TASK07_FREEZENS_OR_V1_TO_V11_MODIFICATION=NO
LEGACY_UNTRACKED_EVIDENCE_READ_OR_MODIFICATION=NO
```

The contract and plan themselves are UTF-8 without BOM, LF-only, and contain
exactly one trailing LF. Neither file records its own actual SHA-256.
