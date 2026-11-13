# Phase 1B Governance and API Framework Authority V37

AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V37
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V37.md
AUTHORITY_STATUS=ACTIVE_TASK16_STAGE_B_MINIMAL_REPAIR
AUTHORITY_OWNER_APPROVAL_SOURCE=PROJECT_OWNER_AUTHORIZED_V37_AND_TASK16_STAGE_B_MINIMAL_REPAIR_2026-09-14
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V36.md
AUTHORITY_SUPERSEDES_SHA256=EC5DED93883AE93D00AFC7D32204891A9A6FE0E52C6B87439858827600891D73
CURRENT_HEAD_BEFORE_V37=9de01c4f5953ad48552c447fa8922da785f14e71
AUTHORITY_SHA256=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
AUTHORITY_SHA256_SCOPE=WHOLE_FILE

## Authority state

V37 supersedes V36 as the active Phase 1B governance authority. V36 remains
historical/frozen evidence and is not modified. Task 01—15 remain accepted and
frozen. Task 16 Stage B has prior implementation evidence but remains blocked
after the minimal repair attempt because the focused typecheck failed.

TASK16_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK16_STAGE_B_PREVIOUS_STATUS=BLOCKED_TYPECHECK_AFTER_MINIMAL_REPAIR
TASK16_STAGE_B_REPAIR_AUTHORIZATION=GRANTED
TASK16_STAGE_B_AUTHORIZATION=GRANTED
TASK16_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK16_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK17_PLUS_STARTED=NO
TASK17_PLUS_AUTHORIZATION=NOT_GRANTED
TASK16_STAGE_B_STATUS=BLOCKED_TYPECHECK_OR_BOUNDARY
OWNER_REVIEW_GATE=TASK16_STAGE_B_OWNER_REVIEW_GATE
STOP_REASON=TASK16_STAGE_B_OWNER_REVIEW_GATE

## Task 16 Stage B minimal repair boundary

The current repair may modify only these two paths:

```text
apps/mini-program/tsconfig.json
apps/mini-program/src/pages/staff.test.ts
```

The existing Stage B implementation files remain byte-preserved. The repair
may add only the ESM/Bundler and TypeScript-import compatibility options needed
by the focused project typecheck, and may adjust only test-fixture types in
staff.test.ts. No package.json, dependency, lockfile, production route, page,
or shared registration may change. If a third file is required, the result is
STATUS=BLOCKED and execution stops.

The repair must preserve synthetic-only data, trusted active employee
membership, tenant and campus isolation, capability checks, fail-closed
behavior, local-only execution, and the mini-program package boundary.

## Protected boundaries

The following remain unchanged and outside this authority:

```text
Task 01—15 accepted/frozen evidence
旧 Task 06 verifier
保护未跟踪路径
pnpm-lock.yaml
Task 16 C1 review/manifest/ZIP
Task 16 C2 acceptance
Task 17+ files
```

No network, dependency installation, service, database or migration, branch,
worktree, staging, commit, push, PR, deployment, C1, C2, or Task 17+ operation
is authorized.

## Exact active governance set

```text
V37_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V37.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md
V37_ACTIVE_REFERENCE_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V37.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md
V37_GOVERNANCE_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V37.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md
V37_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
V37_SYNC_COMMIT_POLICY=NO_COMMIT_OWNER_REVIEW_FIRST
```

All governance text is UTF-8 without BOM, LF-only, and exactly one terminal
LF. The V37 whole-file SHA is reported externally and is never written into
V37 itself.
