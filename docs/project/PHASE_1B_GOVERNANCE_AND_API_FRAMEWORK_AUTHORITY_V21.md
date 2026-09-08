# Phase 1B Governance and API Framework Authority V21

This authority supersedes V20 for the owner-authorized Task 10 Stage B
implementation. V20 and all earlier authorities remain HISTORICAL/FROZEN and
are not modified.

## Authority

```text
AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V21
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V21.md
AUTHORITY_STATUS=ACTIVE_TASK10_STAGE_B_AUTHORIZED_PENDING_IMPLEMENTATION
AUTHORITY_OWNER_DECISION=AUTHORIZE_TASK10_STAGE_B_WITH_MINIMAL_USER_WEB_TOOLCHAIN
AUTHORITY_OWNER_APPROVAL_SOURCE=PROJECT_OWNER_EXPLICIT_TASK10_STAGE_B_AND_WHITELIST_EXPANSION_2026-09-08
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V20.md
AUTHORITY_SUPERSEDES_SHA256=364E3A1C92CEED9400288B2D158497FFD207DA73F6E3F19CA17475D4208C52FC
CURRENT_HEAD_BEFORE_V21=dc78c12c59e5be8d42468043e70c749ff00f59ea
AUTHORITY_SHA256=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
AUTHORITY_SHA256_SCOPE=WHOLE_FILE
AUTHORITY_ENCODING=UTF-8
AUTHORITY_BOM=NO
AUTHORITY_LINE_ENDING=LF
AUTHORITY_TRAILING_LF=EXACTLY_ONE
```

## Current active governance

```text
PHASE_1B_STARTED=YES_TASK10_STAGE_B_AUTHORIZED
PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03|TASK_04|TASK_05|TASK_06|TASK_07|TASK_08|TASK_09|TASK_12
TASK_01_TO_TASK_09_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_05_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_08_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_12_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_10_DEPENDENCY_ORDER=T05|T08|T12
TASK_10_DEPENDENCIES_SATISFIED=YES
TASK_10_NAME=TEACHING_RESOURCES_AND_SEARCH
TASK_10_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_10_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_10_STAGE_B_STATUS=AUTHORIZED_PENDING_IMPLEMENTATION
TASK_10_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_10_STAGE_C2_AUTHORIZATION=NOT_GRANTED
PHASE_1B_ACTIVE_TASK=TASK_10_STAGE_B
TASK_11_STARTED=NO
TASK_11_AUTHORIZATION=NOT_GRANTED
TASK_12_STATUS=ACCEPTED_AND_FROZEN
TASK_12_ROUTE_REPAIR_AUTHORIZATION=NOT_GRANTED
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
```

Task 10 implements internal teaching-resource search and detail projections for
authorized staff. It consumes resource categories, approved file metadata, and
trusted role/campus scope. It returns scoped published list/detail projections,
explicit empty results, bounded cursor pagination, and signed file-read intents
without exposing provider URLs.

## Task 10 security and data boundary

The API must derive `tenant_id`, `campus_id`, active membership, and capability
from trusted server context. Client claims cannot widen identity, role,
membership, scope, category ownership, publication state, file ownership,
version, or cursor scope.

Visitor, missing/inactive/suspended membership, missing capability, foreign
tenant or campus, unknown category, unsafe file reference, unbounded search,
invalid cursor, unpublished or stale version, and client-scope escalation must
fail closed. Denials cannot mutate resource state or append a successful audit
event. Only clearly synthetic fixtures are allowed; provider credentials,
production services, external requests, real personal data, and persistent
production state remain prohibited.

## Exact implementation boundary

The owner first authorized the four Stage B implementation files, then explicitly
expanded the whitelist with two minimal user-web toolchain files. The resulting
six-file whitelist is complete and atomic:

```text
TASK_10_STAGE_B_EXACT_FILES=apps/api/src/modules/resources/resource.service.ts|apps/api/src/routes/staff-resources.route.ts|apps/user-web/src/pages/resources.tsx|apps/api/src/modules/resources/resource.test.ts|apps/user-web/package.json|apps/user-web/tsconfig.json
TASK_10_USER_WEB_PACKAGE_POLICY=EXISTING_ROOT_TYPESCRIPT_AND_ESLINT_ONLY_NO_NEW_DEPENDENCIES
TASK_10_USER_WEB_TSCONFIG_POLICY=EXTEND_EXISTING_ROOT_CONFIGURATION
TASK_10_ROOT_PACKAGE_JSON=UNCHANGED
TASK_10_PNPM_LOCK=UNCHANGED
TASK_10_DEPENDENCY_INSTALL_OR_UPDATE=NO
TASK_10_SERVER_ROUTE_REGISTRATION=OUT_OF_SCOPE
TASK_10_SHARED_CONTRACT_AUTH_SCHEMA_MIGRATION_CONFIG_VERIFIER=OUT_OF_SCOPE
```

Any need for a seventh Stage B path is a fail-closed blocker requiring a new
owner-approved authority and whitelist. In particular, this authorization does
not permit editing `apps/api/src/server.ts`, root package metadata, the lockfile,
shared contracts/auth types, schemas, migrations, existing verifiers, or any
Task 01-09/12 frozen evidence.

## Preserved evidence and known blockers

V20 and earlier authorities remain HISTORICAL/FROZEN. Task 01-09 and Task 12
contracts, acceptance records, C1 evidence, and frozen packages remain
unchanged. The two untracked Task 10 Stage A files remain protected snapshots;
they are not modified, moved, deleted, staged, or committed by V21 or Stage B.
All other protected untracked evidence remains unchanged.

The Task 12 route integration gap remains: `apps/api/src/server.ts` does not
register `registerFileIntentRoutes`. Its repair is not authorized. The old
`scripts/verify_task_06.mjs` verifier remains an independent historical blocker
and must not be repaired, bypassed, or represented as current Task 10 evidence.

## Active reference and commit boundary

```text
V21_ACTIVE_REFERENCE_EXACT_FILES=AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md
V21_GOVERNANCE_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V21.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md
V21_GOVERNANCE_COMMIT_MESSAGE=docs: authorize Phase 1B Task 10 Stage B
TASK_10_STAGE_B_COMMIT_MESSAGE=feat: add scoped teaching resources and search
EXPLICIT_PATH_STAGING_ONLY=YES
NODE_AND_DOTNET_SHA256=REQUIRED
TEXT_FORMAT=UTF8_NO_BOM_LF_EXACTLY_ONE_TRAILING_LF
NETWORK_DEPENDENCY_SERVICE_DATABASE_MIGRATION=NO
BRANCH_WORKTREE_GOAL_PUSH_PR_DEPLOY=NO
```

After the exact six-file implementation commit and required focused verification
pass, Task 10 Stage B becomes `IMPLEMENTED_PENDING_OWNER_REVIEW` in the external
execution receipt without rewriting V21. Stage C1 remains unauthorized until a
separate owner review passes Stage B.

```text
OWNER_REVIEW_GATE=TASK10_STAGE_B_OWNER_REVIEW_GATE
STOP_REASON=TASK10_STAGE_B_OWNER_REVIEW_GATE
```
