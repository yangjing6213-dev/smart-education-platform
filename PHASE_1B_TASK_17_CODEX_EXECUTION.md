# Phase 1B Task 17 Codex Execution Contract

TASK_ID=PHASE_1B_TASK_17
TITLE=Operation logs and audit views
STAGE=STAGE_C2_ACCEPTANCE
CONTRACT_STATUS=ACCEPTED_AND_FROZEN
ACTIVE_GOVERNANCE=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md
ACTIVE_GOVERNANCE_SHA256=7BECA819534A223D84C4D95FD117FC68C4B9CD4CDFC2E5345AF09E9547D188AB
AUTHORIZATION_SOURCE=PROJECT_OWNER_CONFIRMED_V39_AND_AUTHORIZED_TASK17_STAGE_A_2026-09-17
FORMALIZATION_EXECUTION_DATE=2026-09-16
AUTHORIZATION_SOURCE_DATE_NOTE=SOURCE_IDENTIFIER_CONTAINS_2026-09-17_FUTURE_RELATIVE_TO_FORMALIZATION_DATE
BASELINE_BRANCH=feature/phase-1b-task-04-identity-membership
BASELINE_HEAD=9de01c4f5953ad48552c447fa8922da785f14e71
TASK16_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_16_ACCEPTANCE.md
TASK16_ACCEPTANCE_SHA256=A77C3FDCD079271AE12CDF9D16A6D4F50B05936F9F231AE26B6F405E7F489FF5
TASK_17_STARTED=YES_STAGE_C2_ACCEPTED
TASK17_STAGE_A_AUTHORIZATION=GRANTED
TASK17_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK17_STAGE_A_OWNER_REVIEW=PASS
TASK17_STAGE_B_AUTHORIZATION=GRANTED
TASK17_STAGE_B_REPAIR_AUTHORIZATION=GRANTED
TASK17_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK17_API_ENTRYPOINT_STATUS=WIRED_AND_TESTED
TASK17_ADMIN_WEB_ENTRYPOINT_STATUS=WIRED_AND_TESTED
TASK17_AUDIT_ACTION_INTEGRATION_STATUS=SIX_ACTIONS_LOCALLY_VERIFIED
TASK17_AUDIT_ACTION_INTEGRATION_EXACT_ACTIONS=CONTENT_DRAFT_CREATED|CONTENT_DRAFT_UPDATED|CONTENT_PUBLISHED|CONTENT_UNPUBLISHED|FILE_INTENT_CREATED|PARTNER_LINK_HANDOFF_CREATED
TASK17_FULL_AUDIT_ACTION_INTEGRATION=SIX_ACTIONS_LOCALLY_VERIFIED
TASK17_REPAIR_EXACT_FILES=apps/api/src/server.ts|apps/admin-web/src/main.ts|apps/api/src/modules/audit/audit.test.ts|apps/admin-web/test/home-content.test.mjs
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

## 1. Authority and purpose

This contract formalizes Phase 1B Task 17, Operation logs and audit views.
V39 remains unchanged. Although V39 records Task 17 as unstarted and
unauthorized, the project owner's explicit Task 17 Stage A instruction is
subsequent authorization evidence for creating only this contract and
`docs/project/PHASE_1B_TASK_17_PLAN.md`.

Stage A defines the future audit-event contract, exact Stage B file boundary,
TDD expectations, verification gates, and stop conditions. It does not
authorize implementation, review packaging, acceptance, Task 18+, governance
synchronization, or any production operation.

## 2. Locked dependencies

Task 17 depends on Tasks 03 through 16. Task 16 acceptance is the direct
predecessor anchor:

```text
TASK16_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_16_ACCEPTANCE.md
TASK16_ACCEPTANCE_SHA256=A77C3FDCD079271AE12CDF9D16A6D4F50B05936F9F231AE26B6F405E7F489FF5
TASK17_DEPENDENCIES=TASK_03|TASK_04|TASK_05|TASK_06|TASK_07|TASK_08|TASK_09|TASK_10|TASK_11|TASK_12|TASK_13|TASK_14|TASK_15|TASK_16
TASK17_DEPENDENCY_GRAPH_LITERAL=T03 -> T04 -> T05 -> T06 -> T07 -> T08 -> T09 -> T10 -> T11 -> T12 -> T13 -> T14 -> T15 -> T16
TASK17_ROLE=CROSS_CUTTING_AUDIT_GATE
TASK18_ROLE=RELEASE_GATE
TASK18_DEPENDS_ON=TASK17
```

Task 17 is the cross-cutting audit gate. Task 18 is the release gate, depends
on Task 17, and remains unstarted and unauthorized.

## 3. Exact future Stage B allowlist

Stage B requires separate project-owner authorization. Its exact future write
allowlist is:

```text
STAGE_B_EXACT_FILES=apps/api/src/modules/audit/audit.service.ts|apps/api/src/routes/admin-audit.route.ts|apps/admin-web/src/pages/audit-logs.tsx|apps/api/src/modules/audit/audit.test.ts
```

- `apps/api/src/modules/audit/audit.service.ts`
- `apps/api/src/routes/admin-audit.route.ts`
- `apps/admin-web/src/pages/audit-logs.tsx`
- `apps/api/src/modules/audit/audit.test.ts`

Stage A does not create or modify those files. Any fifth implementation, test,
configuration, schema, migration, generated, or support file requires a new
authority with explicit project-owner approval. The allowlist cannot be
expanded by inference.

## 4. Locked product and audit scope

Future Stage B must provide:

- append-only audit events that cannot be edited or deleted through the Task
  17 surface;
- a tenant- and campus-scoped administrative metadata view;
- a stable event taxonomy and explicit administrator permission matrix;
- transactional consistency between each protected state change and its audit
  event;
- exactly one traceable audit event for every successfully completed protected
  command;
- redacted metadata views limited to the administrator's authorized tenant,
  campus, and capability scope;
- required audit identity fields for actor, tenant and campus scope, action,
  target, `occurred_at`, correlation identifier, and trace identifier.

Future Stage B must fail closed for mutable events, missing actor or scope,
minor or business-body content in an event, unauthorized reads, and
cross-tenant or cross-campus reads. Audit metadata must not contain student
names, contact details, addresses, health data, attendance content, pickup
content, grades, family relationships, free-form business text, credentials,
or raw request bodies.

All examples and fixtures must be obviously synthetic and non-identifying.
No production queue, external logging platform, persistence vendor, new
dependency, schema migration, production data, external service, or formal
identity integration is in scope.

## 5. Future Stage B TDD and verification contract

The future RED phase must prove that each of the following fails:

- mutation or deletion of an existing audit event;
- creation without a trusted actor, tenant scope, or campus scope;
- inclusion of minor-related or business-body content in event metadata;
- audit-log reads without the required administrator capability;
- cross-tenant or cross-campus audit-log reads.

The future GREEN phase must prove:

- every successful protected command creates exactly one traceable event;
- failed or rolled-back protected commands do not produce a misleading
  success event;
- the event and protected state change remain transactionally consistent;
- administrators receive only redacted metadata within their authorized
  tenant, campus, and capability scope.

The planned Stage B verification matrix is:

```text
node --test --experimental-strip-types apps/api/src/modules/audit/audit.test.ts
node_modules/.bin/tsc.cmd -p apps/api/tsconfig.json --noEmit
node_modules/.bin/tsc.cmd -p apps/admin-web/tsconfig.json --noEmit
node_modules/.bin/eslint.cmd apps/api/src/modules/audit/audit.service.ts apps/api/src/routes/admin-audit.route.ts apps/admin-web/src/pages/audit-logs.tsx apps/api/src/modules/audit/audit.test.ts
node_modules/.bin/prettier.cmd --check apps/api/src/modules/audit/audit.service.ts apps/api/src/routes/admin-audit.route.ts apps/admin-web/src/pages/audit-logs.tsx apps/api/src/modules/audit/audit.test.ts
git diff --check
git diff --cached --check
```

These commands are a future contract and are not executed by Stage A. Before
future execution, each command must be proven to use existing read-only
configuration and to avoid cache, build, coverage, generated, or other
non-allowlisted writes. Missing configuration or a required fifth write is
`STATUS=BLOCKED`; Stage B must not create configuration or install a
dependency to force a pass.

UI visual verification is not part of Stage A. If future Stage B lacks usable
browser evidence, its receipt must record `UI_NOT_VISUALLY_VERIFIED=YES`.

## 6. Lifecycle gates

- Stage A creates only this contract and
  `docs/project/PHASE_1B_TASK_17_PLAN.md`, verifies them, and stops at
  `TASK17_STAGE_A_OWNER_REVIEW_GATE`.
- Stage B requires separate project-owner authorization. A Stage A PASS does
  not authorize Stage B.
- Stage C1 requires completed Stage B technical verification, Stage B owner
  review, and separate authorization. Its exact future paths must be limited
  to an authorized review, detached manifest, and deterministic ZIP.
- Stage C2 requires independent Stage C1 acceptance and separate owner
  authorization. It may create only an authorized acceptance record and an
  explicitly authorized external receipt.
- Task 18+ cannot be inferred from any earlier PASS and remains unauthorized.

## 7. Preservation and stop conditions

V39, Task 16 acceptance, all Task 01-16 evidence, source, tests, configuration,
dependencies, lockfiles, databases, migrations, protected paths, and external
receipts are read-only. This Stage A performs no network, service, branch,
worktree, staging, commit, push, PR, deployment, production-data, or Task 18+
operation.

Both Stage A documents must be UTF-8 without BOM, LF-only, and have exactly one
terminal LF. Neither document may contain its own final actual SHA. Any
boundary conflict, pre-existing target, authorization ambiguity, or
non-allowlisted write is fail-closed.

## HISTORICAL/FROZEN: Stage A snapshot

TASK_17_STARTED=YES_STAGE_A_FORMALIZED
TASK17_STAGE_A_AUTHORIZATION=GRANTED
TASK17_STAGE_A_STATUS=FORMALIZED_PENDING_OWNER_REVIEW
TASK17_STAGE_B_AUTHORIZATION=NOT_GRANTED
TASK17_STAGE_B_STATUS=NOT_STARTED
TASK17_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK17_STAGE_C1_STATUS=NOT_STARTED
TASK17_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK17_STAGE_C2_STATUS=NOT_STARTED
TASK18_PLUS_STARTED=NO
TASK18_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK17_STAGE_A_OWNER_REVIEW_GATE
STOP_REASON=TASK17_STAGE_A_OWNER_REVIEW_GATE
