# Phase 1B Task 09 Newcomer Guides Plan

This plan records the reviewed Task 09 Stage A formalization, the existing
four-file module evidence, and the separately authorized entry repair. It
preserves the accepted V14 and V15 history and does not authorize C1, C2,
Task 10+, or any path outside the exact repair whitelist.

## Current anchors

```text
TASK_ID=PHASE_1B_TASK_09
TASK_NAME=NEWCOMER_GUIDES
STAGE=STAGE_B_ENTRY_REPAIR_AUTHORIZED_NOT_STARTED
STATUS=READY_FOR_OWNER_REVIEW
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=dbbda11521fd1e2ca49f05e31858c90200e976d6
OWNER_AUTHORIZATION_EVIDENCE=Current explicit project-owner delegation for Task 09 Stage B entry repair dated 2026-09-04; no separate evidence identifier supplied
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V16.md
ACTIVE_GOVERNANCE_SHA256=DD69E2F92DDA9CBA867729B07DBDECD099ECE623911AB213D01659E711B57E15
TASK_05_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
TASK_05_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_07_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_07_ACCEPTANCE.md
TASK_07_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_09_STAGE_A_AUTHORIZATION=GRANTED
TASK_09_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_MODULE_EVIDENCE=EXISTS_IN_ORIGINAL_FOUR_FILES
TASK_09_STAGE_B_ENTRY_REPAIR_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_REPAIR_STATUS=NOT_STARTED
TASK_09_STAGE_B_STATUS=ENTRY_REPAIR_PENDING_REVIEW
TASK_09_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_09_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_09_STARTED=YES_EXISTING_MODULE_EVIDENCE_ONLY
TASK_10_PLUS_STARTED=NO
TASK_10_PLUS_AUTHORIZATION=NOT_GRANTED
```

V16 is the current active authority; V15 and V14 remain historical and frozen.
Task 08 is accepted and frozen. Task 09 Stage A passed owner review, the
original four module files exist, and entry repair is authorized but has not
started. This does not authorize C1, C2, or Task 10+.

## Goal and source requirements

Task 09 is **Newcomer guides**, with dependencies on Tasks 05 and 07
(`T05 -> T07`). The accepted Phase 1B source plan specifies:

- Input: staff role policy, versioned content, and a file access port.
- Output: searchable internal guide list and detail projection.
- Red tests: visitor access, suspended membership, and guides outside the
  allowed campus scope are denied.
- Implementation direction: internal visibility and bounded search filters.
- Green test: an authorized synthetic staff member searches and reads only
  allowed versions.
- Future files:
  `apps/api/src/modules/guides/guide.service.ts`,
  `apps/api/src/routes/staff-guides.route.ts`,
  `apps/user-web/src/pages/staff-guides.tsx`, and
  `apps/api/src/modules/guides/guide.test.ts`.
- Future commit reference: `feat: add scoped newcomer guides`.

The original four Stage B paths are existing module evidence. The separate V16
entry-repair whitelist is limited to the following four paths; no source code,
route registration, UI entry, verifier, package configuration, or other
implementation file is created or changed in this governance synchronization.

## Scope and trust boundaries

The future implementation must preserve the platform's multi-tenant rules:

- Every guide query and file lookup is scoped by server-derived `tenant_id`
  and `campus_id`.
- Trusted identity, active membership, allowed campus membership, and the
  required staff capability are resolved on the server.
- Client-provided tenant, campus, role, membership, publication, ownership,
  version, search scope, and file claims are untrusted and cannot authorize
  access.
- Guides are internal staff content. Visitor access is denied and no public
  guide projection is defined by this task.
- Search is bounded by allowlisted terms, filters, result limits, and the
  server-resolved scope. It must not become an unrestricted content oracle.
- Only allowed, published/version-valid content and approved file references
  may be returned to an authorized staff member.

Foreign-tenant or foreign-campus access, a disallowed campus, inactive or
suspended membership, missing capability, unauthorized version, out-of-range
search, malformed scope claims, and unapproved file access must fail closed.
Denied operations must not mutate content state or emit a successful audit
event. Internal version, moderation, membership, tenant/campus management,
provider, audit, and unsafe file details must not leak to unauthorized callers.

Only clearly fictional synthetic fixtures may be used. The future task may not
use real names, contact details, child records, photographs, credentials,
production data, external providers, network services, a persistent
production database, or migrations.

## Stage B implementation whitelist

The original Stage B implementation evidence exists, and its separately
authorized entry repair is not yet started:

```text
STAGE_B_ORIGINAL_EXACT_FILES=apps/api/src/modules/guides/guide.service.ts|apps/api/src/routes/staff-guides.route.ts|apps/user-web/src/pages/staff-guides.tsx|apps/api/src/modules/guides/guide.test.ts
STAGE_B_ORIGINAL_STATUS=MODULE_EVIDENCE_EXISTS
STAGE_B_REPAIR_EXACT_FILES=apps/api/src/server.ts|apps/admin-web/src/main.ts|apps/api/src/modules/guides/guide.test.ts|apps/admin-web/test/home-content.test.mjs
STAGE_B_REPAIR_AUTHORIZATION=GRANTED
STAGE_B_REPAIR_STATUS=NOT_STARTED
STAGE_B_STATUS=ENTRY_REPAIR_PENDING_REVIEW
```

No other path is included. The V16 repair authority is the only authorization
for the API/admin entry integration. Any required shared contract, auth module,
verifier, package script, lockfile, schema, migration, or configuration file
remains a fail-closed blocker requiring a new explicit authority and whitelist.

## Later acceptance intent

Stage B must use TDD and prove at least:

1. An authorized synthetic staff member can search within a bounded query and
   server-derived campus scope.
2. Detail reads return only an explicit internal projection for an allowed
   version and approved file reference.
3. Visitor access, suspended membership, missing capability, foreign tenant,
   foreign or disallowed campus, unauthorized version, unbounded search, and
   unapproved file access are denied without unintended state changes.
4. Client-supplied scope, role, publication, ownership, version, and file
   claims cannot widen access.
5. Fixtures remain synthetic-only and no external service, production data,
   database, migration, or provider is used.

## Lifecycle and V16 gate

```text
STAGE_A=CONTRACT_AND_PLAN_FORMALIZATION_COMPLETE
STAGE_A_FORMAT_GATE=CHECK_ONLY_THE_TWO_STAGE_A_FILES
STAGE_A_OWNER_REVIEW_GATE=AFTER_READ_ONLY_FORMAT_AND_BOUNDARY_CHECKS
STAGE_B=ORIGINAL_MODULE_EVIDENCE_PLUS_ENTRY_REPAIR_AUTHORIZED_NOT_STARTED
STAGE_C1=SEPARATE_REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP_AUTHORIZATION_REQUIRED
STAGE_C1_OWNER_REVIEW_GATE=AFTER_STAGE_C1_BEFORE_STAGE_C2
STAGE_C2=SEPARATE_ACCEPTANCE_RECORD_ONLY_AFTER_EXPLICIT_OWNER_PASS
TASK_09_STAGE_A_AUTHORIZATION=GRANTED
TASK_09_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_REPAIR_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_REPAIR_STATUS=NOT_STARTED
TASK_09_STAGE_B_STATUS=ENTRY_REPAIR_PENDING_REVIEW
TASK_09_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_09_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_09_STARTED=YES_EXISTING_MODULE_EVIDENCE_ONLY
TASK_10_PLUS_STARTED=NO
TASK_10_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK09_STAGE_B_REPAIR_BEFORE_C1
STOP_REASON=TASK09_STAGE_B_REPAIR_OWNER_REVIEW_GATE
```

The lifecycle is Stage A -> owner review passed -> original module evidence ->
entry-repair authorization -> entry repair -> owner review gate -> C1
authorization -> C2 acceptance-only. This governance synchronization stops
before entry repair starts.

## V16 synchronization verification and stop conditions

Run only read-only checks for V16 and the nine synchronized active reference
files:

```text
Node crypto SHA-256 over each synchronized file's exact bytes
.NET SHA256 over the same exact bytes
UTF-8 validation, no BOM, CR=0, LF-only, exactly one trailing LF
No self-SHA value in V16 or any synchronized file
git status --short --branch --untracked-files=all
git rev-parse HEAD
git diff --check
git diff --cached --check
git remote
git worktree list
```

The final path audit must show V16 and the nine synchronized active reference
paths in addition to the pre-existing protected untracked evidence. Those
protected paths are existence/state inputs only and must not be read, modified,
deleted, moved, staged, packaged, or committed. The index remains clean and no
other path may be created or modified.

Any V14 or dependency drift, missing protected evidence, unexpected path,
format/hash failure, self-SHA, missing authorization traceability, real data
or secret, implementation file, or later-stage artifact is a fail-closed stop.

## File format and prohibited operations

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_09_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_09_PLAN.md
FILE_ENCODING=UTF-8
FILE_BOM=NO
FILE_LINE_ENDING=LF
FILE_TRAILING_LF=EXACTLY_ONE
FILE_SELF_SHA=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
GIT_POLICY=NO_ADD|NO_STAGE|NO_COMMIT|NO_PUSH|NO_PR|NO_DEPLOY
IMPLEMENTATION_OR_TEST_CODE=NO
DEPENDENCY_NETWORK_SERVICE_DATABASE_MIGRATION=NO
CURRENT_TASK09_STAGE_B_IMPLEMENTATION=NO
TASK09_STAGE_C1_C2=NO
TASK10_PLUS=NO
TASK01_TO_TASK08_FREEZENS_OR_V1_TO_V14_MODIFICATION=NO
PROTECTED_UNTRACKED_EVIDENCE_READ_OR_MODIFICATION=NO
```

This plan is UTF-8 without BOM, LF-only, and has exactly one trailing LF. It
does not record its own actual SHA-256.
