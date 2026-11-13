# Phase 1B Governance and API Framework Authority V41

AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V41
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V41.md
AUTHORITY_STATUS=ACTIVE_TASK17_STAGE_B_AUTHORIZED_NOT_STARTED
AUTHORITY_OWNER_APPROVAL_SOURCE=PROJECT_OWNER_CONFIRMED_V40_AND_AUTHORIZED_TASK17_STAGE_B_2026-09-17
AUTHORITY_OWNER_APPROVAL_SOURCE_DATE_NOTE=SOURCE_IDENTIFIER_CONTAINS_2026-09-17_FUTURE_RELATIVE_TO_V41_EXECUTION_DATE
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V40.md
AUTHORITY_SUPERSEDES_SHA256=56008573572E9537A665BE07467D0391E54AD9955EE58F68083346D557F75293
CURRENT_HEAD_BEFORE_V41=9de01c4f5953ad48552c447fa8922da785f14e71
V41_EXECUTION_DATE=2026-09-16
AUTHORITY_SHA256=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
AUTHORITY_SHA256_SCOPE=WHOLE_FILE

## Authority state

V41 supersedes V40 as the active Phase 1B governance authority. The V40
governance synchronization passed project-owner review. V40 remains
historical/frozen evidence, retains its verified whole-file size of 7314 bytes
and SHA-256
`56008573572E9537A665BE07467D0391E54AD9955EE58F68083346D557F75293`,
and is not modified by this synchronization.

Task 01-16 remain accepted and frozen. Task 17 Stage A remains formalized and
owner-reviewed. The project owner granted Task 17 Stage B implementation
authorization, but this governance-only synchronization does not start or
implement Stage B. The authorization source identifier contains September 17,
2026, which is future-dated relative to the applicable V41 execution date of
September 16, 2026; the required identifier is preserved literally and is not
treated as execution-date evidence. Task 17 C1 and C2 remain unstarted and
unauthorized. Task 18+ remains unstarted and unauthorized.

V40_GOVERNANCE_SYNC_OWNER_REVIEW=PASS
TASK_17_STARTED=YES_STAGE_A_FORMALIZED
TASK17_STAGE_A_AUTHORIZATION=GRANTED
TASK17_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK17_STAGE_A_OWNER_REVIEW=PASS
TASK17_STAGE_B_AUTHORIZATION=GRANTED
TASK17_STAGE_B_STATUS=NOT_STARTED
TASK17_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK17_STAGE_C1_STATUS=NOT_STARTED
TASK17_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK17_STAGE_C2_STATUS=NOT_STARTED
TASK18_PLUS_STARTED=NO
TASK18_PLUS_AUTHORIZATION=NOT_GRANTED
PHASE_1B_ACTIVE_TASK=TASK17_STAGE_B_AUTHORIZED_NOT_STARTED
OWNER_REVIEW_GATE=TASK17_STAGE_B_OWNER_REVIEW_GATE
STOP_REASON=V41_GOVERNANCE_SYNC_COMPLETE_READY_FOR_TASK17_STAGE_B

## Task 17 Stage B exact boundary

The authorized future Stage B write set is exactly four files:

```text
TASK17_STAGE_B_EXACT_FILES=apps/api/src/modules/audit/audit.service.ts|apps/api/src/routes/admin-audit.route.ts|apps/admin-web/src/pages/audit-logs.tsx|apps/api/src/modules/audit/audit.test.ts
TASK17_STAGE_B_IMPLEMENTATION_THIS_SYNC=NO
```

- `apps/api/src/modules/audit/audit.service.ts`
- `apps/api/src/routes/admin-audit.route.ts`
- `apps/admin-web/src/pages/audit-logs.tsx`
- `apps/api/src/modules/audit/audit.test.ts`

The four files remain absent during this V41 synchronization. Any fifth
implementation, test, configuration, schema, migration, generated, or support
file requires a new authority and explicit project-owner approval.

## Locked Task 17 audit contract

The future Stage B implementation remains bound to the approved Task 17
contract and plan:

- audit events are append-only and cannot be edited or deleted through the
  Task 17 surface;
- every audit event carries a trusted actor, tenant scope, campus scope when
  applicable, action, target, occurrence time, correlation identifier, trace
  identifier, and bounded redacted metadata;
- reads and metadata are isolated by authorized tenant, campus, and
  administrator capability scope;
- each successfully completed protected command creates exactly one traceable
  audit event in the same transaction as its protected state change;
- failed or rolled-back protected commands do not leave a misleading success
  event;
- mutable events, missing actor or scope, minor or business-body content,
  unauthorized reads, and cross-tenant or cross-campus reads fail closed;
- all fixtures and examples are obviously synthetic and non-identifying;
- production data, external services, production queues, external logging
  platforms, persistence vendors, new dependencies, schema migrations, and
  formal identity integrations remain out of scope.

Stage B implementation and verification are deferred to a separate execution
after independent V41 review. This synchronization does not infer C1, C2, or
Task 18+ authorization.

## Protected boundaries

This synchronization creates V41 and updates only the other 19 paths in the
exact governance set below. It does not modify V40, Task 01-16 frozen evidence,
Task 17 Stage A business content, the old Task 06 verifier, protected paths,
external receipts, `pnpm-lock.yaml`, or any Stage B target.

It does not create Stage B code, Stage B/C1/C2 review, manifest, ZIP,
acceptance, external JSON, or Task 18+ files. No network, dependency
installation or update, service, database, migration, branch, worktree,
staging, commit, push, PR, deployment, or production-data operation is
authorized.

## Exact active governance set

```text
V41_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V41.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md|PHASE_1B_TASK_17_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_17_PLAN.md
V41_ACTIVE_REFERENCE_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V41.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md|PHASE_1B_TASK_17_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_17_PLAN.md
V41_GOVERNANCE_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V41.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md|PHASE_1B_TASK_17_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_17_PLAN.md
V41_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
V41_SYNC_COMMIT_POLICY=NO_COMMIT_OWNER_REVIEW_FIRST
```

All 20 governance texts must be UTF-8 without BOM, LF-only, and have exactly
one terminal LF. V41 uses a whole-file SHA with
`EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE`; its final SHA is reported in the
execution receipt and is never written into V41 itself.
