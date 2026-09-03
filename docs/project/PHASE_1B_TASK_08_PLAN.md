# Phase 1B Task 08 Activities and Meals Plan

This plan records the completed Task 08 Stage A, Stage B, Stage C1, and Stage
C2 lifecycle. Task 08 is accepted and frozen; it does not authorize Task 09+.

## Current anchors

```text
TASK_ID=PHASE_1B_TASK_08
TASK_NAME=ACTIVITIES_AND_MEALS
STAGE=STAGE_C2_ACCEPTANCE
STATUS=ACCEPTED_AND_FROZEN
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=91d63b1458494d5765a2e1d6d3364729796d97eb
OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK08_C1_PASS_AND_STAGE_C2_AUTHORIZATION_2026-09-03
STAGE_A_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK08_STAGE_A_FORMALIZATION_2026-09-03
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V14.md
ACTIVE_GOVERNANCE_SHA256=34323408892CC933F96DF1EA95F92F7A4F64D530B1851A24608BD78CE872B339
TASK_05_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
TASK_05_ACCEPTANCE_SHA256=640BCF9B2B5C33ED1499E1F5C35E58608872953DCF0059A33086312FC260ECDD
TASK_05_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
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

V14 is the current active governance authority and supersedes V13, which is
HISTORICAL/FROZEN. Task 07 C2 and Task 08 C2 are accepted and frozen. Task 09+
remains unauthorized.

## Goal and bounded product contract

Task 08 defines date-bounded activity and meal content for the student-care
platform. The planned outputs, after later independent authorization, are
filtered public activity/meal reads and scoped administrator editing.

The public projection is explicit and allowlisted. A public response may
contain only the approved display fields, date or meal structure, approved
safe media reference, and publication-safe labels. It must not contain private
fields, draft values, membership relationships, tenant or campus identifiers,
management metadata, moderation details, internal versions, audit internals,
or unsafe media information.

## Scope

- Date-bounded activity records with typed start/end or single-date semantics.
- Typed meal records with defined meal date, meal type, and approved content
  fields.
- Public reads of published records only, filtered by server-derived scope and
  the accepted public projection.
- Scoped administrator create, edit, publish, and unpublish operations after
  active membership and capability checks.
- Tenant and campus predicates on every activity and meal identity, query,
  write, uniqueness rule, cache key, and audit boundary.
- Fail-closed validation for invalid dates, unpublished records,
  cross-campus writes, foreign tenants, disallowed campuses, and unsafe media
  references.
- Synthetic-only fixtures and examples.

## Non-goals

- No implementation code, test code, schema, migration, database, or durable
  audit infrastructure in Stage A.
- No real login, SMS, WeChat, OAuth/OIDC, external provider, production AI,
  production data, or persistent production storage.
- No arbitrary media upload, external URL fetching, provider token handling,
  or media moderation service.
- No calendar synchronization, attendance, payments, messaging, nutrition
  diagnosis, medical advice, or automated child profiling.
- No Task 08 Stage B, C1, C2, acceptance record, review, manifest, ZIP, or
  Task 09+ work.

## Trust, scope, and publication policy

The server owns the trust boundary. It derives actor identity, tenant, campus,
active membership, and capability from trusted context and membership records.
Client tenant, campus, role, publication, ownership, date-range, media, and
version claims are untrusted request data and cannot widen scope or authorize
an operation.

Every administrator write must prove an active membership and required
capability for the server-derived tenant and allowed campus. Foreign-tenant,
foreign-campus, and disallowed-campus writes fail closed without state change.
Public reads select only published records eligible for the resolved scope.
Draft, unpublished, private, or invalid records are omitted or denied without
leaking their existence or internal reason details.

Date validation occurs before any state transition. The later implementation
must reject malformed or impossible dates, inverted intervals, ambiguous date
formats, and records outside the accepted date-bounded model. Safe media
references must be validated against the approved file-reference contract;
arbitrary client URLs and untrusted provider metadata are never public output.

## Data model and verification intent

The later typed model must preserve these predicates at every boundary:

```text
ACTIVITY_PREDICATE=tenant_id AND campus_id AND valid_date_range
MEAL_PREDICATE=tenant_id AND campus_id AND valid_meal_date AND valid_meal_type
PUBLIC_PREDICATE=published AND server_resolved_scope AND explicit_projection
ADMIN_WRITE_PREDICATE=trusted_identity AND active_membership AND capability AND allowed_scope
MEDIA_PREDICATE=approved_reference_contract AND safe_reference
```

The planned negative cases include malformed and impossible dates, reversed
date ranges, draft/unpublished records, private fields, foreign tenants,
foreign or disallowed campuses, inactive membership, missing capability,
client-supplied scope claims, unsafe media references, and stale versions.
Each later implementation must preserve state and avoid successful audit output
when a command is denied.

All fixtures must use clearly fictional labels such as `SIMULATED_DATA` only
when the repository's existing language convention requires it; no fixture may
identify or reconstruct a real child, family, teacher, institution, or campus.

## Stage B implementation whitelist

These were the exact Stage B implementation/test paths authorized by V13 and
completed before the Task 08 C2 acceptance:

```text
STAGE_B_EXACT_FILES=apps/api/src/modules/activities/activity.service.ts|apps/api/src/modules/meals/meal.service.ts|apps/api/src/routes/public-activities.route.ts|apps/admin-web/src/pages/meals.tsx|apps/api/src/modules/activities/activity.test.ts|apps/api/src/server.ts|apps/admin-web/src/main.ts|apps/api/src/routes/public-meals.route.ts
STAGE_B_BOUNDARY=OWNER_AUTHORIZED_BY_PROJECT_OWNER_EXPLICIT_TASK08_STAGE_B_REPAIR_AND_CONTINUATION_2026-09-04
```

No other repository path is authorized by this Stage B plan. Shared API/admin
entry points, contracts, verifiers, package scripts, lockfiles, and quality
configuration remain outside this boundary. If implementation requires one,
stop BLOCKED and request a new explicit whitelist.

## Lifecycle and acceptance points

```text
STAGE_A=CONTRACT_AND_PLAN_FORMALIZATION_ONLY
STAGE_A_FORMAT_GATE=CHECK_ONLY_THE_TWO_STAGE_A_FILES
STAGE_A_OWNER_REVIEW_GATE=AFTER_READ_ONLY_FORMAT_AND_BOUNDARY_CHECKS
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

Later acceptance must prove explicit public projection, published-only public
reads, valid date and meal structures, server-derived tenant/campus scope,
active membership and capability enforcement, fail-closed cross-scope writes,
unsafe media rejection, stale-write safety, no private or administrative field
leakage, synthetic-only data, and no prohibited integrations.

## Stage A verification and stop conditions

The completed Task 08 stages checked the eight exact implementation/test files
and the existing read-only quality checks. C1 review, detached manifest, ZIP,
and the C2 acceptance record are now frozen evidence and are not regenerated by
this plan. Run:

```text
Node crypto SHA-256 over each Stage A file's exact bytes
.NET SHA256 over the same exact bytes
UTF-8 validation, no BOM, CR=0, LF-only, exactly one trailing LF
No self-SHA value in either file
git status --short --branch --untracked-files=all
git rev-parse HEAD
git diff --check
git diff --cached --check
git remote
git worktree list
```

The final boundary check must show exactly the two new Task 08 Stage A paths
plus the six already-known legacy untracked Task 04/05 paths. The six legacy
paths are existence/state inputs only and must not be read, modified, deleted,
moved, staged, packaged, or committed. The index must remain clean and no
other tracked or untracked path may be created by this task.

Any authorization conflict, V14 or Task 05 anchor drift, missing legacy
evidence, unexpected path, format/hash failure, real data or secret, or Task
09+ artifact is a fail-closed stop. No later task may expand this plan.

## File format and prohibited operations

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_08_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_08_PLAN.md
FILE_ENCODING=UTF-8
FILE_BOM=NO
FILE_LINE_ENDING=LF
FILE_TRAILING_LF=EXACTLY_ONE
FILE_SELF_SHA=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
GIT_POLICY=NO_ADD|NO_STAGE|NO_COMMIT|NO_PUSH|NO_PR|NO_DEPLOY
```

Dependency installation or updates, lockfile edits, network and registry
access, services, browser automation, database or migration activity,
branches, worktrees, `/goal`, Task 08 future artifacts, Task 09+ work, and
modification of Task 01-07 or V11 frozen evidence are prohibited.
