# Phase 1B Governance and API Framework Authority V13

This authority supersedes V12 for the owner-authorized Task 08 Stage B repair
and continuation. V12 and all earlier authorities remain HISTORICAL/FROZEN and
are not modified.

## Authority

```text
AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V13
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V13.md
AUTHORITY_STATUS=OWNER_AUTHORIZED_ACTIVE
FORMALIZATION_STATUS=TASK08_STAGE_B_REPAIR_AND_CONTINUATION_AUTHORIZED
AUTHORITY_OWNER_DECISION=AUTHORIZE_TASK08_STAGE_B_REPAIR_AND_CONTINUATION
AUTHORITY_OWNER_APPROVAL_SOURCE=PROJECT_OWNER_EXPLICIT_TASK08_STAGE_B_REPAIR_AND_CONTINUATION_2026-09-04
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V12.md
AUTHORITY_SUPERSEDES_SHA256=860E8B29916633797812E4B5879036D81072959572509E1E4C4D742A6B8CCF4E
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
PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_08_STAGE_B_ONLY
PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03|TASK_04|TASK_05|TASK_06|TASK_07
PHASE_1B_ACTIVE_TASK=TASK_08_STAGE_B_REPAIR_AND_CONTINUATION
TASK_01_TO_TASK_07_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_06_STAGE_C2_STATUS=ACCEPTED
TASK_07_STAGE_C2_STATUS=ACCEPTED
TASK_08_STATUS=STAGE_B_REPAIR_AND_IMPLEMENTATION_IN_PROGRESS
TASK_08_OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK08_STAGE_B_REPAIR_AND_CONTINUATION_2026-09-04
TASK_08_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_08_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_08_STAGE_C1_STATUS=NOT_STARTED
TASK_08_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_08_STAGE_C2_STATUS=NOT_STARTED
TASK_08_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_08_PLUS_STARTED=NO
TASK_08_PLUS_AUTHORIZATION=NOT_GRANTED
```

Task 08 Stage B remains independently authorized by the explicit owner repair
and continuation evidence above. Stage A review is a prerequisite but is not
the source of implementation authority. The authorization does not grant C1,
C2, Task 09+, or any unrelated implementation.

## Task 08 Stage B exact boundary

The complete implementation and test whitelist is exactly:

```text
TASK_08_STAGE_B_EXACT_FILES=apps/api/src/modules/activities/activity.service.ts|apps/api/src/modules/meals/meal.service.ts|apps/api/src/routes/public-activities.route.ts|apps/admin-web/src/pages/meals.tsx|apps/api/src/modules/activities/activity.test.ts|apps/api/src/server.ts|apps/admin-web/src/main.ts|apps/api/src/routes/public-meals.route.ts
TASK_08_STAGE_B_SCOPE=DATE_BOUNDED_ACTIVITIES_AND_MEALS|PUBLISHED_PUBLIC_PROJECTION|SCOPED_ADMIN_WRITES|FAIL_CLOSED_AUTH_AND_VALIDATION|SERVER_ROUTE_REGISTRATION|ADMIN_ENTRY_INTEGRATION|SYNTHETIC_ONLY
TASK_08_STAGE_B_REPAIR_REASON=ACTIVITY_ROUTE_REGISTRATION|MEAL_HTTP_ROUTE|ADMIN_MEALS_ENTRY
```

The server owns tenant and campus scope, trusted identity, active membership,
capability, publication, ownership, and version trust. Client tenant, campus,
role, publication, ownership, version, and media claims cannot widen scope or
authorize a write. Public activity and meal responses use explicit allowlists,
published-only filtering, and safe media references. Private, management,
membership, audit, tenant, campus, internal version, synthetic marker, and
unsafe media details are never public output. Invalid dates, inverted ranges,
foreign tenant or campus access, inactive membership, missing capability,
forged scope claims, unsafe media, and stale versions fail closed without an
unintended state change or successful audit event.

All fixtures and examples are synthetic and obviously fictional. No real login,
provider, network, service, production database, migration, credential,
personal data, or production deployment is allowed.

## Lifecycle and frozen history

```text
V12_POLICY=HISTORICAL/FROZEN|DO_NOT_MODIFY
TASK01_TO_TASK07_EVIDENCE_POLICY=FROZEN|DO_NOT_MODIFY
TASK08_STAGE_B_POLICY=OWNER_AUTHORIZED_REPAIR_AND_IMPLEMENTATION_ONLY
TASK_08_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_08_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_08_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_08_PLUS_STARTED=NO
TASK_08_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=AFTER_TASK08_STAGE_B_BEFORE_TASK08_C1
STOP_REASON=TASK08_STAGE_B_OWNER_REVIEW_GATE
```

V13 is a whole-file authority with no self-reference. Its actual SHA-256 is
recorded only outside the repository after the file is stable and synchronized
active references are verified. V12, earlier authorities, Task 01-07 frozen
evidence, and the six existing Task 04/05 untracked evidence paths remain
untouched.
