# Phase 1B Task 08 Stage C1 Review

## Gate and scope

```text
TASK_ID=PHASE_1B_TASK_08
TASK_NAME=ACTIVITIES_AND_MEALS
STAGE=C1
STAGE_C1_STATUS=FINAL_EVIDENCE_READY
PROJECT_OWNER_ACCEPTANCE=WAITING_AT_OWNER_REVIEW_GATE
OWNER_AUTHORIZATION_SOURCE=EXPLICIT_OWNER_MESSAGE_IN_CURRENT_CONTROL_THREAD_2026-09-04
TARGET_BRANCH=feature/phase-1b-task-04-identity-membership
STAGE_B_IMPLEMENTATION_COMMIT=497c9b7ffa107aba771bb6ffe988ff35998a259a
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V13.md
ACTIVE_GOVERNANCE_SHA256=E0CE8BD3AD0566C59563A5FA8E376B43BB64A6B82F09883C707EAF079BCCC98B
TASK_08_STAGE_C1_AUTHORIZATION=GRANTED_FOR_THIS_C1_RUN
TASK_08_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_09_PLUS_AUTHORIZATION=NOT_GRANTED
```

This review records the explicitly authorized Task 08 Stage C1 evidence step.
It creates only the detached review, detached SHA-256 manifest, and
deterministic review ZIP. It does not create an acceptance record or authorize
Stage C2 or Task 09+.

## Stage B evidence reviewed

The Stage B implementation provides date-bounded activity and meal records,
published-only public projections, server-derived tenant and campus scope,
active membership and capability checks, fail-closed foreign-scope handling,
safe media references, and compare-and-save stale-version protection. Public
responses use explicit allowlists and omit private notes, tenant/campus
identifiers, internal versions, synthetic markers, and administrative fields.
All fixtures are synthetic.

The activity route is registered in the API server, the meal HTTP route is
registered, and the admin entry exposes `/admin/meals`. The targeted API,
activity/meal, admin, typecheck, lint, format, build, and HTTP-injection smoke
checks passed at the current Stage B head.

## Independent verification status

```text
TARGETED_STAGE_B_VERIFICATION=PASS
API_EXISTING_TESTS=44_PASS_0_FAIL
TASK_08_ACTIVITY_MEAL_ROUTE_ADMIN_TESTS=9_PASS_0_FAIL
ADMIN_EXISTING_TESTS=1_PASS_0_FAIL
TYPECHECK=PASS
LINT=PASS
FORMAT_CHECK=PASS
BUILD=PASS
HTTP_SMOKE=PASS_WITH_SERVER_LISTEN_NO
```

The repository-wide `corepack pnpm test` remains an independent historical
blocker. Its package-boundary test invokes `scripts/verify_task_06.mjs`, which
hard-codes the V9 authority and the old Task 06 base head. The owner accepted
this as a separate historical blocker; this C1 run does not modify that
verifier, its test, or any frozen evidence.

## Detached package

The manifest is detached from the ZIP and has one SHA-256 record for every
approved package member. The ZIP uses stored regular files, fixed DOS timestamp
`1980-01-01T00:00:00`, and the canonical case-folded Unicode ordinal path
order. The review, manifest, ZIP, Task 08 C2 acceptance, Task 04/05 evidence,
generated output, and unrelated files are excluded.

```text
REVIEW_PACKAGE=artifacts/review-package/student-care-platform-phase1b-task-08-review-pack-v1.0.zip
REVIEW_PACKAGE_MANIFEST=SHA256SUMS_PHASE_1B_TASK_08.txt
REVIEW_PACKAGE_MEMBER_COUNT=22
REVIEW_PACKAGE_MEMBER_ORDER=POSIX_RELATIVE_PATHS_CASEFOLDED_UNICODE_ORDINAL_ASCENDING
REVIEW_PACKAGE_FIXED_TIMESTAMP=1980-01-01T00:00:00
REVIEW_PACKAGE_DETERMINISTIC_REBUILD=PASS
REVIEW_PACKAGE_EXCLUSIONS=C1_REVIEW|C1_MANIFEST|C1_ZIP|TASK08_C2_ACCEPTANCE|TASK04_EVIDENCE|TASK05_EVIDENCE|GENERATED_OUTPUT|UNRELATED_FILES
```

The exact package members, in canonical order, are:

```text
AGENTS.md
apps/admin-web/src/main.ts
apps/admin-web/src/pages/meals.tsx
apps/api/src/modules/activities/activity.service.ts
apps/api/src/modules/activities/activity.test.ts
apps/api/src/modules/meals/meal.service.ts
apps/api/src/routes/public-activities.route.ts
apps/api/src/routes/public-meals.route.ts
apps/api/src/server.ts
docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md
docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md
docs/project/DECISION_BASELINE.md
docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V13.md
docs/project/PHASE_1B_TASK_08_PLAN.md
docs/project/SCOPE_AND_NON_SCOPE.md
package.json
PHASE_1B_TASK_08_CODEX_EXECUTION.md
PLANS.md
README.md
scripts/verify_task_06.mjs
tests/contracts/package-boundaries.test.mjs
tests/workspace/paths.test.mjs
```

## Frozen history and safety

```text
TASK01_TO_TASK07_FROZEN_EVIDENCE=UNCHANGED
TASK04_TASK05_UNTRACKED_EVIDENCE=RETAINED_UNTOUCHED
V13_AUTHORITY=UNCHANGED
OLD_TASK06_VERIFIER=UNCHANGED
NETWORK_ACCESS=NO
DEPENDENCY_INSTALL_EXECUTED=NO
SERVICE_STARTED=NO
DATABASE_OR_MIGRATION_EXECUTED=NO
PUSH_EXECUTED=NO
PR_CREATED=NO
DEPLOYMENT_EXECUTED=NO
```

The C1 artifacts are detached evidence only. They do not constitute owner
acceptance and do not authorize Stage C2.

## Stop

```text
TASK_08_STAGE_C1_AUTHORIZATION=GRANTED
TASK_08_STAGE_C2_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=AFTER_C1_BEFORE_C2
STOP_REASON=C1_OWNER_REVIEW_GATE_BEFORE_C2
```
