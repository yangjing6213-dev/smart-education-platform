# Task 17 Operation Logs and Audit Views Implementation Plan

> **For agentic workers:** Stage B requires separate project-owner
> authorization. When authorized, use test-driven development and execute this
> plan task by task. Stage A creates only this plan and its execution contract.

**Goal:** Define a future append-only, traceable, tenant- and campus-scoped
audit trail with an authorized administrative metadata view.

**Architecture:** Keep audit-event creation in the API service boundary, bind
protected state changes and events transactionally, expose only a
permission-filtered administrative route, and render redacted metadata in the
admin web. The audit record carries identity and trace metadata but excludes
minor data, business-body content, credentials, and raw request bodies.

**Tech Stack:** Existing TypeScript API and admin-web runtimes, existing local
Node test runner, existing TypeScript/ESLint/Prettier tools, synthetic fixtures,
and no new dependencies.

---

## Plan state and authority

```text
TASK_ID=PHASE_1B_TASK_17
TITLE=Operation logs and audit views
ACTIVE_GOVERNANCE=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md
ACTIVE_GOVERNANCE_SHA256=F2C77C7A1EEE626619CB19DDD994D2D373D59C54CBB939260E7C3B7C77B52D5A
AUTHORIZATION_SOURCE=PROJECT_OWNER_CONFIRMED_V39_AND_AUTHORIZED_TASK17_STAGE_A_2026-09-17
FORMALIZATION_EXECUTION_DATE=2026-09-16
AUTHORIZATION_SOURCE_DATE_NOTE=SOURCE_IDENTIFIER_CONTAINS_2026-09-17_FUTURE_RELATIVE_TO_FORMALIZATION_DATE
BASELINE_BRANCH=feature/phase-1b-task-04-identity-membership
BASELINE_HEAD=9de01c4f5953ad48552c447fa8922da785f14e71
TASK16_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_16_ACCEPTANCE.md
TASK16_ACCEPTANCE_SHA256=A77C3FDCD079271AE12CDF9D16A6D4F50B05936F9F231AE26B6F405E7F489FF5
TASK_17_STARTED=YES_STAGE_A_FORMALIZED
TASK17_STAGE_A_AUTHORIZATION=GRANTED
TASK17_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK17_STAGE_A_OWNER_REVIEW=PASS
TASK17_STAGE_B_AUTHORIZATION=GRANTED
TASK17_STAGE_B_REPAIR_AUTHORIZATION=GRANTED
TASK17_STAGE_B_STATUS=BLOCKED_ENTRYPOINT_AND_INTEGRATION_GAP
TASK17_API_ENTRYPOINT_STATUS=NOT_WIRED
TASK17_ADMIN_WEB_ENTRYPOINT_STATUS=NOT_WIRED
TASK17_AUDIT_ACTION_INTEGRATION_STATUS=NOT_PROVEN
TASK17_AUDIT_ACTION_INTEGRATION_EXACT_ACTIONS=CONTENT_DRAFT_CREATED|CONTENT_DRAFT_UPDATED|CONTENT_PUBLISHED|CONTENT_UNPUBLISHED|FILE_INTENT_CREATED|PARTNER_LINK_HANDOFF_CREATED
TASK17_FULL_AUDIT_ACTION_INTEGRATION=NOT_AUTHORIZED
TASK17_REPAIR_EXACT_FILES=apps/api/src/server.ts|apps/admin-web/src/main.ts|apps/api/src/modules/audit/audit.test.ts|apps/admin-web/test/home-content.test.mjs
TASK17_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK17_STAGE_C1_STATUS=NOT_STARTED
TASK17_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK17_STAGE_C2_STATUS=NOT_STARTED
TASK18_PLUS_STARTED=NO
TASK18_PLUS_AUTHORIZATION=NOT_GRANTED
PHASE_1B_ACTIVE_TASK=TASK17_STAGE_B_REPAIR_AUTHORIZED
OWNER_REVIEW_GATE=TASK17_STAGE_B_REPAIR_OWNER_REVIEW_GATE
STOP_REASON=V42_GOVERNANCE_SYNC_READY_FOR_TASK17_ENTRYPOINT_REPAIR
```

V39 predates the current explicit Task 17 Stage A authorization and therefore
correctly remains unchanged. This plan does not treat V39's earlier
`TASK17_PLUS_STARTED=NO` state as a blocker.

## Locked dependencies and role

```text
TASK17_DEPENDENCIES=TASK_03|TASK_04|TASK_05|TASK_06|TASK_07|TASK_08|TASK_09|TASK_10|TASK_11|TASK_12|TASK_13|TASK_14|TASK_15|TASK_16
TASK17_DEPENDENCY_GRAPH_LITERAL=T03 -> T04 -> T05 -> T06 -> T07 -> T08 -> T09 -> T10 -> T11 -> T12 -> T13 -> T14 -> T15 -> T16
TASK17_ROLE=CROSS_CUTTING_AUDIT_GATE
TASK18_ROLE=RELEASE_GATE
TASK18_DEPENDS_ON=TASK17
```

Task 16 acceptance at
`docs/project/PHASE_1B_TASK_16_ACCEPTANCE.md`, SHA-256
`A77C3FDCD079271AE12CDF9D16A6D4F50B05936F9F231AE26B6F405E7F489FF5`,
is the direct predecessor anchor. Task 18 depends on Task 17 and remains
unstarted and unauthorized.

## Exact future Stage B file map

```text
STAGE_B_EXACT_FILES=apps/api/src/modules/audit/audit.service.ts|apps/api/src/routes/admin-audit.route.ts|apps/admin-web/src/pages/audit-logs.tsx|apps/api/src/modules/audit/audit.test.ts
```

| Responsibility | Exact future Stage B file |
|---|---|
| Append-only event contract, transactional write boundary, redaction, and scoped query | `apps/api/src/modules/audit/audit.service.ts` |
| Administrator capability guard, tenant/campus filters, and metadata-only response | `apps/api/src/routes/admin-audit.route.ts` |
| Authorized audit-log filters, table states, and redacted metadata presentation | `apps/admin-web/src/pages/audit-logs.tsx` |
| RED/GREEN contract for immutability, identity, scope, content exclusion, and traceability | `apps/api/src/modules/audit/audit.test.ts` |

No fifth implementation, test, configuration, schema, migration, generated,
or support file is permitted. Stage A does not create or modify any file in
this table.

## Locked audit contract

Each future audit event must be append-only and contain a trusted actor,
tenant scope, campus scope when applicable, action, target type and identifier,
`occurred_at`, correlation identifier, trace identifier, and a bounded,
redacted metadata object. The event taxonomy and administrator permission
matrix must be explicit and deterministic.

Each successfully completed protected command must create exactly one
traceable event in the same transaction as its protected state change.
Rollback or failure must not leave a misleading success event. Administrators
may read only redacted metadata within their authorized tenant, campus, and
capability scope.

Events must reject missing actor or scope, event mutation or deletion,
unauthorized reads, cross-tenant or cross-campus reads, and any minor or
business-body content. Fixtures must be clearly synthetic and non-identifying.
No production data, external service, production queue, external logging
platform, persistence vendor, dependency, schema migration, or formal identity
integration is in scope.

## Task 1: Establish the failing audit contract

**File:** `apps/api/src/modules/audit/audit.test.ts`

- [ ] Add a RED assertion that an existing audit event cannot be edited or
  deleted.
- [ ] Add RED assertions for missing actor, tenant scope, and required campus
  scope.
- [ ] Add a RED assertion that minor-related fields, business-body text,
  credentials, and raw request bodies are rejected from event metadata.
- [ ] Add RED assertions for missing administrator capability and
  cross-tenant/cross-campus reads.
- [ ] Add a RED assertion that a protected command cannot report success
  without exactly one correlated audit event.

Future focused command:

```text
node --test --experimental-strip-types apps/api/src/modules/audit/audit.test.ts
```

Expected RED result: failures are confined to the four-file allowlist because
the audit service, route, and page contract do not yet satisfy the assertions.

## Task 2: Implement the append-only audit service

**File:** `apps/api/src/modules/audit/audit.service.ts`

- [ ] Define the bounded event taxonomy and required audit identity fields.
- [ ] Validate trusted actor, tenant, campus when applicable, action, target,
  occurrence time, correlation identifier, and trace identifier.
- [ ] Reject mutable operations and unsafe metadata keys or values.
- [ ] Bind protected state changes and exactly one event to the same
  transaction boundary.
- [ ] Provide only tenant/campus/capability-scoped redacted metadata queries.

Expected GREEN contribution: valid synthetic protected commands create one
traceable event, while missing identity, unsafe content, mutation, and foreign
scope fail closed.

## Task 3: Implement the authorized administrator route

**File:** `apps/api/src/routes/admin-audit.route.ts`

- [ ] Require the trusted administrator audit capability.
- [ ] Derive tenant and campus scope from trusted identity and membership
  context; never trust a client-supplied tenant scope.
- [ ] Expose only bounded filters and redacted metadata fields.
- [ ] Deny unauthorized, cross-tenant, cross-campus, malformed, and
  unbounded queries.

Expected GREEN contribution: the route returns only authorized redacted
metadata and never exposes event bodies, minor content, credentials, or raw
request data.

## Task 4: Implement the administrative audit-log view

**File:** `apps/admin-web/src/pages/audit-logs.tsx`

- [ ] Render scoped filters for event taxonomy, actor reference, target
  reference, occurrence time, correlation identifier, and trace identifier.
- [ ] Render loading, empty, denied, error, and populated states without
  exposing unredacted content.
- [ ] Keep all examples clearly synthetic and non-identifying.
- [ ] Do not add mutation, deletion, export, external logging, or production
  integration controls.

Expected GREEN contribution: authorized administrators can inspect only
redacted metadata in their permitted scope.

## Task 5: Run the future Stage B verification matrix

**Files:** the four exact Stage B files only.

- [ ] Run the focused audit test.
- [ ] Run API and admin-web typechecks using existing read-only project
  configuration.
- [ ] Run ESLint and Prettier checks on the four exact files.
- [ ] Run `git diff --check` and `git diff --cached --check`.
- [ ] Verify UTF-8 without BOM, LF-only, and exactly one trailing LF for each
  changed file.
- [ ] Verify zero dependency, migration, schema, generated, cache, coverage,
  network, service, database, production-data, or non-allowlisted writes.
- [ ] Record `UI_NOT_VISUALLY_VERIFIED=YES` if usable browser evidence is not
  available; do not install a visual tool.

Planned commands:

```text
node --test --experimental-strip-types apps/api/src/modules/audit/audit.test.ts
node_modules/.bin/tsc.cmd -p apps/api/tsconfig.json --noEmit
node_modules/.bin/tsc.cmd -p apps/admin-web/tsconfig.json --noEmit
node_modules/.bin/eslint.cmd apps/api/src/modules/audit/audit.service.ts apps/api/src/routes/admin-audit.route.ts apps/admin-web/src/pages/audit-logs.tsx apps/api/src/modules/audit/audit.test.ts
node_modules/.bin/prettier.cmd --check apps/api/src/modules/audit/audit.service.ts apps/api/src/routes/admin-audit.route.ts apps/admin-web/src/pages/audit-logs.tsx apps/api/src/modules/audit/audit.test.ts
git diff --check
git diff --cached --check
```

Before future execution, every command must be proven not to create cache,
build, coverage, generated, or other non-allowlisted output. A missing config,
validator, or required fifth write is `STATUS=BLOCKED`; Stage B must not create
configuration or install dependencies to force a pass.

## Task 6: Stop at the Stage B owner-review gate

- [ ] Confirm all applicable tests and checks genuinely passed.
- [ ] Confirm the exact four-file allowlist and zero fifth-file writes.
- [ ] Confirm each protected command creates exactly one correlated event and
  administrators see only authorized redacted metadata.
- [ ] Confirm all fixtures are synthetic and no production or minor data was
  introduced.
- [ ] Stop at `TASK17_STAGE_B_OWNER_REVIEW_GATE`; do not create C1, C2,
  governance, external receipt, or Task 18+ artifacts.

## Lifecycle gates

- Stage A creates only this plan and
  `PHASE_1B_TASK_17_CODEX_EXECUTION.md`, then stops at
  `TASK17_STAGE_A_OWNER_REVIEW_GATE`.
- Stage B requires separate project-owner authorization. Stage A PASS does not
  authorize implementation.
- Stage C1 requires Stage B technical verification, Stage B owner review, and
  separate authorization. Its paths must be explicitly limited to a review,
  detached manifest, and deterministic ZIP.
- Stage C2 requires independent C1 acceptance and separate authorization. It
  may create only an acceptance record and an explicitly authorized external
  receipt.
- Task 18+ remains unauthorized and cannot be inferred from any earlier PASS.

## Encoding, preservation, and fail-closed rules

Both Stage A documents must be UTF-8 without BOM, LF-only, exactly one trailing
LF, and must not contain their own final actual SHA. V39, Task 16 acceptance,
Task 01-16 evidence, source, tests, configuration, dependencies, lockfiles,
databases, migrations, protected paths, and external receipts remain
unchanged.

Stage A performs no network, service, branch, worktree, staging, commit, push,
PR, deployment, production-data, or Task 18+ operation. Any non-allowlisted
write, pre-existing target, authorization conflict, or boundary expansion is
`STATUS=BLOCKED`.

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
