# Phase 1B Governance and API Framework Authority V12

This authority supersedes V11 for the owner-authorized Task 08 Stage B
implementation. V11 and earlier authorities remain HISTORICAL/FROZEN and are
not modified.

## Authority

```text
AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V12
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V12.md
AUTHORITY_STATUS=OWNER_AUTHORIZED_ACTIVE
FORMALIZATION_STATUS=TASK08_STAGE_B_IMPLEMENTATION_AUTHORIZED
AUTHORITY_OWNER_DECISION=AUTHORIZE_TASK08_STAGE_B_IMPLEMENTATION
AUTHORITY_OWNER_APPROVAL_SOURCE=PROJECT_OWNER_EXPLICIT_TASK08_STAGE_B_IMPLEMENTATION_2026-09-03
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V11.md
AUTHORITY_SUPERSEDES_SHA256=1C077A438C96FD4E658547667BB9FF835CB7406F76155E6E706CA6D3D723E3E4
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
PHASE_1B_ACTIVE_TASK=TASK_08_STAGE_B_IMPLEMENTATION
TASK_01_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_02_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_03_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_04_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_05_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_06_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_06_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md
TASK_06_ACCEPTANCE_SHA256=0B690B77CF4C08653FAE3495ABB9B218C640E8C4F02121CC14DEE0557850F68C
TASK_06_STAGE_C2_STATUS=ACCEPTED
TASK_07_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_07_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_07_ACCEPTANCE.md
TASK_07_ACCEPTANCE_SHA256=AF03F69188E33FB90D9D75EF5E98494B57D1D4D0A1152807F20E5E1C2A0E5B3E
TASK_07_STAGE_C2_STATUS=ACCEPTED
TASK_08_STATUS=STAGE_B_IMPLEMENTATION_AUTHORIZED
TASK_08_OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK08_STAGE_B_IMPLEMENTATION_2026-09-03
TASK_08_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_08_STAGE_B_STATUS=AUTHORIZED_IMPLEMENTATION_SCOPE
TASK_08_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_08_STAGE_C1_STATUS=NOT_STARTED
TASK_08_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_08_STAGE_C2_STATUS=NOT_STARTED
TASK_08_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_08_PLUS_STARTED=NO
TASK_08_PLUS_AUTHORIZATION=NOT_GRANTED
```

Task 08 Stage B is independently authorized by
`PROJECT_OWNER_EXPLICIT_TASK08_STAGE_B_IMPLEMENTATION_2026-09-03`. Stage A
formalization and its owner review are prerequisites, but Stage A is not the
source of implementation authority. Task 08 C1 and C2 remain separately
unauthorized, and no Task 09+ work is authorized.

## Task 08 Stage B boundary

The exact Stage B implementation and test write set is:

```text
TASK_08_STAGE_B_EXACT_FILES=apps/api/src/modules/activities/activity.service.ts|apps/api/src/modules/meals/meal.service.ts|apps/api/src/routes/public-activities.route.ts|apps/admin-web/src/pages/meals.tsx|apps/api/src/modules/activities/activity.test.ts
TASK_08_STAGE_B_SCOPE=DATE_BOUNDED_ACTIVITIES_AND_MEALS|PUBLISHED_PUBLIC_PROJECTION|SCOPED_ADMIN_WRITES|FAIL_CLOSED_AUTH_AND_VALIDATION|SYNTHETIC_ONLY
```

The implementation must use the existing Fastify, auth, tenant-scope, and
in-memory patterns. The server owns tenant and campus scope, active membership,
capability, publication, ownership, and version trust. Client claims cannot
widen scope or authorize a write. Public responses use explicit allowlists and
must not expose private, management, audit, tenant, campus, version, or unsafe
media details. Invalid dates, inverted ranges, unpublished records, foreign
tenant or campus access, inactive membership, missing capability, unsafe media,
and stale versions fail closed without an unintended state change or success
audit event.

All fixtures and examples are synthetic and obviously fictional. No real
login, provider, network, service, production database, migration, credential,
or personal data is permitted. If the existing architecture requires a path
outside the exact Stage B set, execution must stop BLOCKED rather than expand
this authority.

## Frozen history and lifecycle

```text
V11_POLICY=HISTORICAL/FROZEN|DO_NOT_MODIFY
TASK01_TO_TASK07_EVIDENCE_POLICY=FROZEN|DO_NOT_MODIFY
TASK08_STAGE_B_POLICY=OWNER_AUTHORIZED_IMPLEMENTATION_ONLY
TASK_08_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_08_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_08_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_08_PLUS_STARTED=NO
TASK_08_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=AFTER_TASK08_STAGE_B_BEFORE_TASK08_C1
STOP_REASON=TASK08_STAGE_B_OWNER_REVIEW_GATE
```

V12 is a whole-file authority with no self-reference. Its actual SHA-256 is
recorded only in the external execution receipt and synchronized active
references after the file is stable. V11, all earlier authorities, Task 01-07
acceptance and review evidence, and the six existing Task 04/05 untracked
evidence paths remain frozen and untouched.
