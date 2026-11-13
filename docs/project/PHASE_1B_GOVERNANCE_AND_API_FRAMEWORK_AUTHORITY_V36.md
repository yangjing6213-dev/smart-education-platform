# Phase 1B Governance and API Framework Authority V36

This authority supersedes V35 after the project owner authorized the Task 16
Stage B blocker diagnosis and the bounded governance update. V35 and earlier
authorities remain historical/frozen evidence. V36 records that the Task 16
Stage B implementation exists but remains blocked by the missing
mini-program TypeScript configuration.

```text
AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V36
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V36.md
AUTHORITY_STATUS=ACTIVE_TASK16_STAGE_B_BLOCKED_TYPECHECK_MISSING_TSCONFIG
AUTHORITY_OWNER_APPROVAL_SOURCE=PROJECT_OWNER_AUTHORIZED_TASK16_STAGE_B_BLOCKER_DIAGNOSTIC_AND_V36_2026-09-15
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V35.md
AUTHORITY_SUPERSEDES_SHA256=77113966921E2AF518C166941BFBD79690A01360C59483DDDAEFF2FBE710B8F7
CURRENT_HEAD_BEFORE_V36=9de01c4f5953ad48552c447fa8922da785f14e71
AUTHORITY_SHA256=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
AUTHORITY_SHA256_SCOPE=WHOLE_FILE
V36_WRITE_POLICY=EXACT_GOVERNANCE_WHITELIST_ONLY
V36_SYNC_COMMIT_POLICY=NO_COMMIT_OWNER_REVIEW_FIRST
```

## Current Phase 1B state

```text
PHASE_1B_STARTED=YES_TASK16_STAGE_B_BLOCKED_TYPECHECK_MISSING_TSCONFIG
PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03|TASK_04|TASK_05|TASK_06|TASK_07|TASK_08|TASK_09|TASK_10|TASK_11|TASK_12|TASK_13|TASK_14|TASK_15
PHASE_1B_ACTIVE_TASK=TASK16_STAGE_B_OWNER_REVIEW_GATE
TASK_01_TO_TASK_15_STATUS=OWNER_ACCEPTED_AND_FROZEN
TASK_12_ROUTE_REPAIR_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_12_ROUTE_REPAIR_OWNER_REVIEW=PASS
TASK_13_STATUS=ACCEPTED_AND_FROZEN
TASK_14_STATUS=ACCEPTED_AND_FROZEN
TASK_15_STARTED=YES_STAGE_C2_ACCEPTED
TASK_15_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_15_STAGE_B_AUTHORIZATION=GRANTED
TASK_15_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_15_STAGE_B_OWNER_REVIEW=PASS
TASK_15_STAGE_C1_AUTHORIZATION=GRANTED
TASK_15_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_15_STAGE_C2_AUTHORIZATION=GRANTED
TASK_15_STAGE_C2_STATUS=ACCEPTED
TASK_15_STATUS=ACCEPTED_AND_FROZEN
TASK16_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK16_STAGE_B_AUTHORIZATION=GRANTED
TASK16_STAGE_B_STATUS=BLOCKED_TYPECHECK_MISSING_TSCONFIG
TASK16_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK16_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK17_PLUS_STARTED=NO
TASK17_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=V36_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
STOP_REASON=V36_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```

Task 01—15 remain accepted and frozen. Task 16 Stage B implementation exists
in its four previously authorized files, but Stage B cannot be considered
fully verified while its required typecheck configuration is absent. Stage C1,
C2, and Task 17+ remain unauthorized.

## Task 16 Stage B blocker diagnosis

The repository has no root `tsconfig.json`, no `apps/mini-program/package.json`,
and no `apps/mini-program/tsconfig.json`. The root `tsconfig.base.json` only
contains shared compiler options. Its direct no-emit check is not a compatible
mini-program project check because it includes unrelated app and package files
and lacks the mini-program module and DOM/JSX project boundaries. Existing
neighboring app configurations are scoped to their own application sources and
cannot be reused for the mini-program.

The required minimal future repair is bounded to one new configuration file:

```text
TASK16_STAGE_B_REPAIR_NEW_FILE=apps/mini-program/tsconfig.json
TASK16_STAGE_B_REPAIR_CONFIG_EXTENDS=../../tsconfig.base.json
TASK16_STAGE_B_REPAIR_CONFIG_INCLUDE=src/routes/staff.routes.ts|src/pages/staff/workbench.ts|src/pages/staff/quick-action.ts|src/pages/staff.test.ts
TASK16_STAGE_B_REPAIR_PACKAGE_JSON=NOT_ALLOWED
TASK16_STAGE_B_REPAIR_DEPENDENCIES=NOT_ALLOWED
TASK16_STAGE_B_REPAIR_LOCKFILE=NOT_ALLOWED
TASK16_STAGE_B_REPAIR_EXACT_FILES=apps/mini-program/src/routes/staff.routes.ts|apps/mini-program/src/pages/staff/workbench.ts|apps/mini-program/src/pages/staff/quick-action.ts|apps/mini-program/src/pages/staff.test.ts|apps/mini-program/tsconfig.json
```

This V36 synchronization does not create or modify that configuration file.
The four existing Stage B files remain unchanged by this synchronization.
Any future repair must use the separately authorized five-file Stage B repair
allowlist above and must stop again at the Stage B owner-review gate.

## Exact V36 active reference set

```text
V36_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V36.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md
V36_ACTIVE_REFERENCE_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V36.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md
V36_GOVERNANCE_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V36.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md
V36_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
V36_SYNC_COMMIT_POLICY=NO_COMMIT_OWNER_REVIEW_FIRST
```

All seventeen non-authority files in the exact set must contain the final
actual V36 SHA and the V36 path in their active governance reference. V35
remains unchanged as historical/frozen evidence. This synchronization does
not modify Task 01—15 frozen evidence, the old Task 06 verifier, protected
untracked paths, `pnpm-lock.yaml`, the four Stage B files, or any Stage B/C1/C2
artifact.

## Preservation and stop conditions

V36 synchronization is limited to the exact governance file set above. It
does not create `apps/mini-program/tsconfig.json`, rerun Stage B, change
configuration, install dependencies, alter the lockfile, or enter C1/C2.
There is no authorization for Stage C1, Stage C2, or Task 17+.

V36 and the seventeen non-authority active-reference files are UTF-8 without
BOM, LF-only, and have exactly one trailing LF. V36 does not contain its own
actual SHA; the SHA is reported externally. No staging, commit, dependency
installation, network, service, database, migration, branch, worktree,
deployment, or production data operation is permitted by this synchronization.
