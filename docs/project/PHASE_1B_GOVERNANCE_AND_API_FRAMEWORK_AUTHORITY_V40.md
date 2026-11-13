# Phase 1B Governance and API Framework Authority V40

AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V40
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V40.md
AUTHORITY_STATUS=ACTIVE_TASK17_STAGE_A_OWNER_REVIEW_PASSED
AUTHORITY_OWNER_APPROVAL_SOURCE=PROJECT_OWNER_CONFIRMED_TASK17_STAGE_A_AND_AUTHORIZED_V40_GOVERNANCE_SYNC_2026-09-17
AUTHORITY_OWNER_APPROVAL_SOURCE_DATE_NOTE=SOURCE_IDENTIFIER_CONTAINS_2026-09-17_FUTURE_RELATIVE_TO_V40_EXECUTION_DATE
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V39.md
AUTHORITY_SUPERSEDES_SHA256=007C7B9269977323A3ADC8454EB6453C915F9A921CB9744977795082E4F08A06
CURRENT_HEAD_BEFORE_V40=9de01c4f5953ad48552c447fa8922da785f14e71
V40_EXECUTION_DATE=2026-09-16
AUTHORITY_SHA256=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
AUTHORITY_SHA256_SCOPE=WHOLE_FILE

## Authority state

V40 supersedes V39 as the active Phase 1B governance authority. V39 remains
historical/frozen evidence, retains its verified whole-file SHA-256
`007C7B9269977323A3ADC8454EB6453C915F9A921CB9744977795082E4F08A06`,
and is not modified by this synchronization.

Task 01-16 remain accepted and frozen. The project owner confirmed that Task
17 Stage A was formalized, independently accepted, and passed owner review,
then authorized this V40 governance synchronization. The authorization source
identifier contains September 17, 2026, which is future-dated relative to the
applicable V40 execution date of September 16, 2026; the required source
identifier is preserved literally and is not treated as execution-date
evidence. Task 17 Stage B, C1, and C2 remain unstarted and unauthorized. Task
18+ remains unstarted and unauthorized.

TASK_17_STARTED=YES_STAGE_A_FORMALIZED
TASK17_STAGE_A_AUTHORIZATION=GRANTED
TASK17_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK17_STAGE_A_OWNER_REVIEW=PASS
TASK17_STAGE_B_AUTHORIZATION=NOT_GRANTED
TASK17_STAGE_B_STATUS=NOT_STARTED
TASK17_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK17_STAGE_C1_STATUS=NOT_STARTED
TASK17_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK17_STAGE_C2_STATUS=NOT_STARTED
TASK18_PLUS_STARTED=NO
TASK18_PLUS_AUTHORIZATION=NOT_GRANTED
PHASE_1B_ACTIVE_TASK=TASK17_STAGE_A_OWNER_REVIEW_PASSED
OWNER_REVIEW_GATE=V40_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
STOP_REASON=V40_GOVERNANCE_SYNC_OWNER_REVIEW_GATE

## Pre-V40 formalization evidence

The following whole-file hashes identify the two original Task 17 Stage A
documents before V40 synchronization:

```text
TASK17_STAGE_A_CONTRACT_PATH=PHASE_1B_TASK_17_CODEX_EXECUTION.md
TASK17_STAGE_A_CONTRACT_BYTES=8894
TASK17_STAGE_A_CONTRACT_SHA256=74168A0648AE789B711202AB88082417A0FC8684DA65066623562F5A83D3AAF4
TASK17_STAGE_A_PLAN_PATH=docs/project/PHASE_1B_TASK_17_PLAN.md
TASK17_STAGE_A_PLAN_BYTES=12179
TASK17_STAGE_A_PLAN_SHA256=B1C7285E00480D214D2A17EF87EB48C2715EA6A254C599DDD47DBDA3B522DA01
TASK16_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_16_ACCEPTANCE.md
TASK16_ACCEPTANCE_BYTES=3249
TASK16_ACCEPTANCE_SHA256=A77C3FDCD079271AE12CDF9D16A6D4F50B05936F9F231AE26B6F405E7F489FF5
```

Task 17 depends on Tasks 03 through 16. Task 16 acceptance is the direct
predecessor anchor.

```text
TASK17_DEPENDENCIES=TASK_03|TASK_04|TASK_05|TASK_06|TASK_07|TASK_08|TASK_09|TASK_10|TASK_11|TASK_12|TASK_13|TASK_14|TASK_15|TASK_16
TASK17_DEPENDENCY_GRAPH_LITERAL=T03 -> T04 -> T05 -> T06 -> T07 -> T08 -> T09 -> T10 -> T11 -> T12 -> T13 -> T14 -> T15 -> T16
TASK17_ROLE=CROSS_CUTTING_AUDIT_GATE
TASK18_ROLE=RELEASE_GATE
TASK18_DEPENDS_ON=TASK17
```

## Future Task 17 Stage B boundary

The future Stage B file whitelist is exactly the following four paths:

```text
TASK17_STAGE_B_EXACT_FILES=apps/api/src/modules/audit/audit.service.ts|apps/api/src/routes/admin-audit.route.ts|apps/admin-web/src/pages/audit-logs.tsx|apps/api/src/modules/audit/audit.test.ts
```

This synchronization does not authorize or perform Stage B implementation.
Any fifth implementation, test, configuration, dependency, schema, migration,
or other path requires a new authority and explicit project-owner approval.

## Protected boundaries

This synchronization creates V40 and updates only the other 19 paths in the
exact governance set below. It does not modify V39, Task 01-16 frozen evidence,
Task 16 acceptance or C1/Stage B evidence, Task 17 Stage A business scope, the
old Task 06 verifier, protected paths, external receipts, or `pnpm-lock.yaml`.

It does not create Task 17 Stage B/C1/C2 code or evidence, review, manifest,
ZIP, acceptance, external JSON, or Task 18+ files. No network, dependency
installation or update, service, database, migration, branch, worktree,
staging, commit, push, PR, deployment, or production-data operation is
authorized.

## Exact active governance set

```text
V40_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V40.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md|PHASE_1B_TASK_17_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_17_PLAN.md
V40_ACTIVE_REFERENCE_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V40.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md|PHASE_1B_TASK_17_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_17_PLAN.md
V40_GOVERNANCE_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V40.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md|PHASE_1B_TASK_17_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_17_PLAN.md
V40_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
V40_SYNC_COMMIT_POLICY=NO_COMMIT_OWNER_REVIEW_FIRST
```

All 20 governance texts must be UTF-8 without BOM, LF-only, and have exactly
one terminal LF. V40 uses a whole-file SHA with
`EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE`; its final SHA is reported in the
execution receipt and is never written into V40 itself.
