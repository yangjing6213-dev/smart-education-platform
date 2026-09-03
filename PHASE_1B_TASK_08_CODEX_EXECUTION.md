# Phase 1B Task 08 Codex Execution Contract

This contract records Task 08 Stage A formalization and the independently
authorized Stage B repair and continuation boundary. Stage B is bounded to the
eight exact implementation/test files below; C1 and C2 remain unauthorized.

## Contract status and authorization

```text
TASK_ID=PHASE_1B_TASK_08
TASK_NAME=ACTIVITIES_AND_MEALS
TASK_STAGE=STAGE_B_IMPLEMENTATION
TASK_STATUS=IMPLEMENTATION_IN_PROGRESS
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
TARGET_BRANCH=CURRENT_CHECKOUT_NO_NEW_BRANCH_OR_WORKTREE
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=5804cfee86dfae5033d5320b903e208b2bf2cceb
OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK08_STAGE_B_IMPLEMENTATION_2026-09-03
STAGE_A_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK08_STAGE_A_FORMALIZATION_2026-09-03
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V13.md
ACTIVE_GOVERNANCE_SHA256=E0CE8BD3AD0566C59563A5FA8E376B43BB64A6B82F09883C707EAF079BCCC98B
TASK_05_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
TASK_05_ACCEPTANCE_SHA256=640BCF9B2B5C33ED1499E1F5C35E58608872953DCF0059A33086312FC260ECDD
TASK_05_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_08_STARTED=YES_STAGE_B_REPAIR_AND_CONTINUATION
TASK_08_STAGE_A_AUTHORIZATION=GRANTED
TASK_08_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_08_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_08_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_08_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_08_PLUS_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_08_PLUS_STARTED=NO
```

The current V13 authority supersedes V12 for this repair and continuation. V12
and V11 remain HISTORICAL/FROZEN. The direct owner authorization above is
independent from Stage A and explicitly grants only the V13 Task 08 Stage B
repair and continuation boundary.

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

The V13 Stage B boundary authorizes the five core files above plus the API
server entry, admin entry, and public meals route needed to close the existing
integration gap. Stage C1 may create only its separately authorized review, detached
manifest, and deterministic ZIP. Stage C2 may create only its separately
authorized acceptance record. Neither authorization exists in this contract.

## Lifecycle and owner gates

```text
STAGE_A=CONTRACT_AND_PLAN_FORMALIZATION_COMPLETE
STAGE_A_OWNER_REVIEW_GATE=PASSED
STAGE_B=OWNER_AUTHORIZED_IMPLEMENTATION_AND_TESTS
STAGE_C1=SEPARATE_OWNER_AUTHORIZATION_REQUIRED_FOR_REVIEW_MANIFEST_AND_ZIP
STAGE_C1_OWNER_REVIEW_GATE=AFTER_STAGE_C1_BEFORE_STAGE_C2
STAGE_C2=SEPARATE_ACCEPTANCE_RECORD_ONLY_AFTER_EXPLICIT_OWNER_PASS
TASK_08_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_08_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_08_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_08_STAGE_C2_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=AFTER_TASK08_STAGE_B_BEFORE_TASK08_C1
STOP_REASON=TASK08_STAGE_B_OWNER_REVIEW_GATE
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

Stage B checks the eight exact implementation/test files, current V13 and
frozen dependency anchors, plus existing read-only quality checks. Any
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
GIT_ADD_STAGE_COMMIT_PUSH_PR_DEPLOY=NO
TASK08_STAGE_B_C1_C2_ACCEPTANCE_ARTIFACTS=NO
TASK01_TO_TASK07_FREEZENS_OR_V1_TO_V11_MODIFICATION=NO
LEGACY_UNTRACKED_EVIDENCE_READ_OR_MODIFICATION=NO
```

The contract and plan themselves are UTF-8 without BOM, LF-only, and contain
exactly one trailing LF. Neither file records its own actual SHA-256.
