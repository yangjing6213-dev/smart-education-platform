# Phase 1B Governance and API Framework Authority V42

AUTHORITY_ID=PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY
AUTHORITY_VERSION=V42
AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md
AUTHORITY_STATUS=ACTIVE_TASK17_ACCEPTED_AND_FROZEN
AUTHORITY_OWNER_APPROVAL_SOURCE=PROJECT_OWNER_CONFIRMED_V41_AND_AUTHORIZED_TASK17_ENTRYPOINT_REPAIR_2026-09-17
AUTHORITY_SUPERSEDES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V41.md
AUTHORITY_SUPERSEDES_SHA256=26EA89E0C1FF01F24EA12060ED1F13737DFCA312D1466FDCDA24FE12D089A9E9
CURRENT_HEAD_BEFORE_V42=9de01c4f5953ad48552c447fa8922da785f14e71
V42_EXECUTION_DATE=2026-09-17
AUTHORITY_SHA256=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
AUTHORITY_SHA256_SCOPE=WHOLE_FILE

## Authority state

V42 supersedes V41 as the active Phase 1B governance authority. The V41
governance synchronization passed project-owner review. V41 remains
historical/frozen evidence, retains its verified whole-file size of 7802 bytes
and SHA-256
`26EA89E0C1FF01F24EA12060ED1F13737DFCA312D1466FDCDA24FE12D089A9E9`,
and is not modified by this synchronization.

Task 01-16 remain accepted and frozen. Task 17 Stage A remains formalized and
owner-reviewed. The project owner accepted the focused technical evidence for
the four Task 17 Stage B component files. The authorized repair wave now has
local evidence for entrypoint wiring and protected-command integration. Task 17
has completed C1 and is accepted and frozen through C2 owner review. UI visual
verification remains unavailable and is recorded as a known limitation.

The project owner granted a separate minimal entrypoint-repair authorization,
and its result is accepted by the project owner. Task 17 C1 is completed and
C2 is accepted and frozen. Task 18+ remains unstarted and unauthorized.

V41_GOVERNANCE_SYNC_OWNER_REVIEW=PASS
TASK_17_STARTED=YES_STAGE_C2_ACCEPTED
TASK17_STAGE_A_AUTHORIZATION=GRANTED
TASK17_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK17_STAGE_A_OWNER_REVIEW=PASS
TASK17_STAGE_B_AUTHORIZATION=GRANTED
TASK17_STAGE_B_COMPONENT_EVIDENCE=PASS
TASK17_STAGE_B_REPAIR_AUTHORIZATION=GRANTED
TASK17_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK17_API_ENTRYPOINT_STATUS=WIRED_AND_TESTED
TASK17_ADMIN_WEB_ENTRYPOINT_STATUS=WIRED_AND_TESTED
TASK17_AUDIT_ACTION_INTEGRATION_STATUS=SIX_ACTIONS_LOCALLY_VERIFIED
TASK17_STAGE_C1_AUTHORIZATION=GRANTED
TASK17_STAGE_C1_STATUS=COMPLETED
TASK17_STAGE_C1_OWNER_REVIEW=PASS
TASK17_STAGE_C2_AUTHORIZATION=GRANTED
TASK17_STAGE_C2_STATUS=ACCEPTED_AND_FROZEN
TASK17_STAGE_C2_OWNER_REVIEW=PASS
TASK17_STATUS=ACCEPTED_AND_FROZEN
UI_NOT_VISUALLY_VERIFIED=YES
TASK18_PLUS_STARTED=NO
TASK18_PLUS_AUTHORIZATION=NOT_GRANTED
PHASE_1B_ACTIVE_TASK=TASK17_ACCEPTED_AND_FROZEN
OWNER_REVIEW_GATE=TASK17_POST_C2_GOVERNANCE_REVIEW_GATE
STOP_REASON=TASK17_POST_C2_GOVERNANCE_REVIEW_GATE

## Accepted Task 17 Stage B component evidence

The accepted focused technical evidence covers exactly the previously
authorized Stage B component files:

- `apps/api/src/modules/audit/audit.service.ts`
- `apps/api/src/routes/admin-audit.route.ts`
- `apps/admin-web/src/pages/audit-logs.tsx`
- `apps/api/src/modules/audit/audit.test.ts`

The evidence demonstrates the bounded component behavior, API registration,
admin-web route exposure, and six-action audit integration. This remains local
evidence accepted through the Task 17 C2 owner review. UI visual verification
remains unavailable and is recorded as `UI_NOT_VISUALLY_VERIFIED=YES`.

## Authorized minimal entrypoint repair

The separately authorized future repair write set is exactly four files:

```text
TASK17_REPAIR_EXACT_FILES=apps/api/src/server.ts|apps/admin-web/src/main.ts|apps/api/src/modules/audit/audit.test.ts|apps/admin-web/test/home-content.test.mjs
TASK17_REPAIR_IMPLEMENTATION_THIS_SYNC=OWNER_REVIEW_PASSED
```

- `apps/api/src/server.ts`
- `apps/admin-web/src/main.ts`
- `apps/api/src/modules/audit/audit.test.ts`
- `apps/admin-web/test/home-content.test.mjs`

The repair authorization is limited to registering the existing Task 17 API
audit route and service at the real API entrypoint, exposing the existing
admin audit-log page at `/admin/audit-logs`, and adding the minimum regression
coverage within the exact four-file boundary. Any fifth implementation, test,
configuration, schema, migration, generated, or support file requires a new
authority and explicit project-owner approval.

This V42 synchronization records the completed and accepted repair result; it
does not expand Task 17 scope or authorize Task 18+.

## Locally verified audit-action integration

The full protected-command integration remains outside the minimal repair
authorization:

```text
TASK17_FULL_AUDIT_ACTION_INTEGRATION=SIX_ACTIONS_LOCALLY_VERIFIED
TASK17_AUDIT_ACTION_INTEGRATION_STATUS=SIX_ACTIONS_LOCALLY_VERIFIED
```

The following six actions are locally verified and accepted through owner review:

- `CONTENT_DRAFT_CREATED`
- `CONTENT_DRAFT_UPDATED`
- `CONTENT_PUBLISHED`
- `CONTENT_UNPUBLISHED`
- `FILE_INTENT_CREATED`
- `PARTNER_LINK_HANDOFF_CREATED`

Existing content publication, file-intent, and partner-handoff command
families were locally exercised against the Task 17 `AuditService` boundary.
Success-exactly-one-event and failure-or-rollback-zero-success-event semantics
are locally verified and accepted for this wave. Any later scope
expansion still requires a separately approved exact path whitelist, including
explicit exceptions for any Task 01-16 frozen file that must change.

## Locked Task 17 audit contract

The Task 17 implementation remains bound to the approved contract and plan:

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

## Protected boundaries

This synchronization creates V42 and updates only the other 19 paths in the
exact governance set below. It does not modify V41, Task 01-16 frozen evidence,
the old Task 06 verifier, protected paths, external receipts,
`pnpm-lock.yaml`, the four repair targets, or any Stage B component file beyond
the governance-reference update already authorized for the Task 17 contract
and plan.

It does not create or execute a repair, full audit-action integration, C1/C2
review, manifest, ZIP, acceptance, external JSON, or Task 18+ file. No network,
dependency installation or update, service, database, migration, branch,
worktree, staging, commit, push, PR, deployment, or production-data operation
is authorized.

## Exact active governance set

```text
V42_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md|PHASE_1B_TASK_17_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_17_PLAN.md
V42_ACTIVE_REFERENCE_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md|PHASE_1B_TASK_17_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_17_PLAN.md
V42_GOVERNANCE_EXACT_FILES=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md|PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md|PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md|PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md|PHASE_1B_TASK_15_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_15_PLAN.md|PHASE_1B_TASK_16_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_16_PLAN.md|PHASE_1B_TASK_17_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_17_PLAN.md
V42_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
V42_SYNC_COMMIT_POLICY=NO_COMMIT_OWNER_REVIEW_FIRST
```

All 20 governance texts must be UTF-8 without BOM, LF-only, and have exactly
one terminal LF. V42 uses a whole-file SHA with
`EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE`; its final SHA is reported in the
execution receipt and is never written into V42 itself.
