# Phase 1B Task 06 Institution Profile and Home Content Management Plan

> **For agentic workers:** This plan contains the owner-confirmed Stage B
> amendment and the generated Stage C1 evidence state.
> amendment. Use `long-horizon-development`, `using-superpowers`,
> `brainstorming`, `writing-plans`, `test-driven-development`,
> `verification-before-completion`, and `requesting-code-review`; use
> `systematic-debugging` before any retry after a failure. Stage C1, C2, and
> Task 07+ remain unauthorized.

**Goal:** Implement and verify the bounded Task 06 tenant- and campus-scoped
institution profile and home content management slice, generate C1 evidence,
then stop for owner review before C2.

**Architecture:** Task 06 adapts the accepted Task 05 versioned content model
for institution profile and home content records. The API service consumes
trusted identity and server-derived scope from Tasks 03 and 04, uses separate
draft and publish commands, and exposes only a public published projection.
The admin-web surface is a no-dependency static TypeScript package with a
single editor entrypoint and no production provider integration.

**Tech Stack:** Fastify 5.12.1, Node.js 24.14.0, Corepack pnpm 11.22.0 offline,
TypeScript 5.7.3, the existing workspace packages, and the Node test runner.
No new dependency, service, database, migration, network request, or provider
integration is authorized in Stage B. The no-dependency admin-web shell and
local build checks are authorized.

---

## Current status and fixed anchors

```text
TASK_ID=PHASE_1B_TASK_06
TASK_NAME=INSTITUTION_PROFILE_AND_HOME_CONTENT_MANAGEMENT
STAGE=STAGE_B_IMPLEMENTATION
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
SOURCE_BRANCH=feature/phase-1b-task-04-identity-membership
SOURCE_HEAD=4db46c39d6a1f18517fe561a43b2207e8fa1dfde
TARGET_BRANCH=CURRENT_CHECKOUT_NO_NEW_BRANCH_OR_WORKTREE
GOVERNANCE_AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V5.md
GOVERNANCE_AUTHORITY_SHA256=BC8B2232F3203368BD712586464734614D0E56D062792AFA284F8794A50914DB
AUTHORIZATION_EVIDENCE_ID=PROJECT_OWNER_EXPLICIT_TASK06_STAGE_B_IMPLEMENTATION_2026-09-02
AUTHORIZATION_OBJECTIVE_TEXT=Authorize Phase 1B Task 06 Stage B implementation
AUTHORIZATION_OBJECTIVE_UTF8_BYTES=49
AUTHORIZATION_OBJECTIVE_SHA256=CE5F93CEE0BF1758853C1F1F47F3B78EF350544DFF6D74DE2566D3A7EBB68667
TASK_05_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
TASK_05_ACCEPTANCE_SHA256=640BCF9B2B5C33ED1499E1F5C35E58608872953DCF0059A33086312FC260ECDD
TASK_05_ACCEPTANCE_COMMIT=11d2a361e91232e79675597a256a7577b4cada24
TASK_06_STARTED=YES_STAGE_B_IMPLEMENTATION
TASK_06_GOAL_AUTHORIZATION=GRANTED_FOR_STAGE_B_IMPLEMENTATION
TASK_06_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_06_STAGE_A_STATUS=OWNER_CONFIRMED
TASK_06_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_06_STAGE_C1_STATUS=FINAL_EVIDENCE_READY
TASK_06_OWNER_REVIEW=WAITING_AT_OWNER_REVIEW_GATE
TASK_06_STAGE_C2_STATUS=NOT_ACCEPTED
TASK_06_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_06_PLUS_STARTED=NO
DEPENDENCIES=T05
PUBLIC_API_DTOS=@student-care/contracts
INTERNAL_AUTH_POLICY_TYPES=@student-care/auth
CONTENT_MODEL_SOURCE=TASK05_ACCEPTED_VERSIONED_CONTENT_MODEL
ADMIN_WEB_PACKAGE_STATUS=OWNER_AUTHORIZED_MINIMAL_STATIC_PACKAGE
STATUS=STAGE_C1_FINAL_EVIDENCE_READY
STOP_REASON=OWNER_REVIEW_GATE_BEFORE_TASK06_C2
```

Task 05 C2 is the accepted prerequisite. The current V5 authority records the
owner-authorized Task 06 Stage B implementation and generated C1 evidence.
Task 06 C2 remains absent, not accepted, and unauthorized until a separate
explicit owner PASS.

## Scope contract

```text
INSTITUTION_PROFILE_SCOPE=TENANT_SCOPED
HOME_CONTENT_SCOPE=TENANT_SCOPED_OR_SERVER_ALLOWED_CAMPUS_SCOPED
TENANT_SCOPE_SOURCE=SERVER_RESOLVED_ACTIVE_MEMBERSHIP
CAMPUS_SCOPE_SOURCE=SERVER_RESOLVED_ALLOWED_CAMPUS_MEMBERSHIP
EDIT_CAPABILITY=content:write
PUBLISH_CAPABILITY=content:publish
STAFF_WITHOUT_PUBLISH_CAPABILITY=DENY
PUBLIC_PROJECTION=ONLY_PUBLISHED_ALLOWLISTED_FIELDS
PUBLIC_VISITOR_SCOPE_RESOLUTION=SERVER_OWNED_RESOLVER_ONLY
PUBLIC_VISITOR_WITHOUT_RESOLVER=FAIL_CLOSED
VERSION_CONTROL=TASK05_EXPECTED_VERSION_FAIL_CLOSED
INVALID_CONTENT_BLOCK=REJECT_BEFORE_STATE_CHANGE
PUBLIC_API_CONTRACT=@student-care/contracts
INTERNAL_POLICY_TYPES=@student-care/auth
```

The implementation may reuse the Task 05 content body and block kinds. It must
not invent a second publication state machine, accept client scope claims, or
leak internal draft and administration fields. Institution and home content are
public only after an explicit successful publish transition.

## Exact file boundaries

### Stage A

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_06_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_06_PLAN.md
STAGE_A_POLICY=CREATE_ONLY_THE_TWO_FILES|UTF8_NO_BOM|LF_ONLY|EXACTLY_ONE_TRAILING_LF|NO_SELF_SHA|NO_STAGE|NO_COMMIT
```

Only these two files may be created in Stage A. Format checks inspect only these
two files and do not require any future Stage B, C1, or C2 path.

### Stage B amendment

```text
STAGE_B_EXACT_FILES=apps/api/src/modules/institution/institution.service.ts|apps/api/src/routes/admin-institution.route.ts|apps/admin-web/src/pages/home-content.tsx|apps/api/src/modules/institution/institution.test.ts|apps/api/src/server.ts|apps/api/package.json|packages/contracts/src/identity.ts|packages/contracts/test/identity.test.ts|packages/auth/src/identity.ts|packages/auth/test/policy.test.ts|apps/admin-web/package.json|apps/admin-web/tsconfig.json|apps/admin-web/index.html|apps/admin-web/src/main.ts|apps/admin-web/test/home-content.test.mjs|scripts/verify_task_06.mjs|package.json|pnpm-lock.yaml|tests/contracts/package-boundaries.test.mjs|tests/workspace/paths.test.mjs|PHASE_1B_TASK_06_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_06_PLAN.md
STAGE_B_SHARED_FILES=OWNER_CONFIRMED_TASK06_INTEGRATION_AMENDMENT_2026-09-02|FROZEN_TASK01_TO_TASK05_EVIDENCE_REMAINS_UNMODIFIED
STAGE_B_NEW_FILES=apps/admin-web/package.json|apps/admin-web/tsconfig.json|apps/admin-web/index.html|apps/admin-web/src/main.ts|apps/admin-web/test/home-content.test.mjs|scripts/verify_task_06.mjs
STAGE_B_NO_DEPENDENCY_INSTALL=YES
STAGE_B_LOCKFILE_CHANGE=ONE_EXPLICIT_APPS_ADMIN_WEB_WORKSPACE_IMPORTER_ONLY
STAGE_B_SCAFFOLDING_POLICY=MINIMUM_NO_DEPENDENCY_ADMIN_WEB_PACKAGE_AND_API_ENTRYPOINT_ALLOWED
STAGE_B_VERIFICATION_POLICY=TASK06_TARGETED_TESTS_PLUS_ROOT_TYPECHECK_LINT_FORMAT_TEST_BUILD_PLUS_TASK06_AWARE_BOUNDARY_VERIFY
```

The amendment resolves the recorded Stage B integration risk. It permits only
the minimum package, entrypoint, shared capability types, API registration,
active verification harness, and tests needed to make the existing Task 06
slice runnable. No new runtime dependency or unapproved lockfile update is
allowed; the only permitted lockfile change is the single `apps/admin-web: {}`
workspace importer.

### Future C1 and C2

```text
STAGE_C1_EXACT_FILES=docs/reviews/PHASE_1B_TASK_06_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_06.txt|artifacts/review-package/student-care-platform-phase1b-task-06-review-pack-v1.0.zip
STAGE_C2_EXACT_FILES=docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md
OWNER_REVIEW_GATE=AFTER_STAGE_A_BEFORE_STAGE_B_IMPLEMENTATION_AUTHORIZATION
STAGE_C1_OWNER_REVIEW_GATE=AFTER_STAGE_C1_BEFORE_STAGE_C2_ACCEPTANCE
STAGE_C2_POLICY=ACCEPTANCE_RECORD_ONLY_AFTER_EXPLICIT_PROJECT_OWNER_PASS|SEPARATE_COMMIT|NEVER_PREWRITE
```

Stage C1 is generated evidence awaiting owner review. Stage C2 must not be
created before explicit owner PASS.

## Stage A record and Stage B execution steps

### Historical Task 1: Render the contract and plan

**Files:**

- Create: `PHASE_1B_TASK_06_CODEX_EXECUTION.md`
- Create: `docs/project/PHASE_1B_TASK_06_PLAN.md`

- [x] Preserve the V4 authority path and SHA, Task 05 C2 acceptance SHA, current
      branch, and current HEAD.
- [x] Record the Task 06 objective, scope, permissions, version policy, public
      projection boundary, synthetic-data rules, and exact future file lists.
- [x] State that Stage A only creates the two files and does not grant Stage B.
- [x] Record the missing `apps/admin-web` package as a future integration risk
      without creating it.

### Historical Task 2: Run the Stage A format and scope gates

Run the following checks after both files exist:

```text
node crypto SHA-256 for PHASE_1B_TASK_06_CODEX_EXECUTION.md and docs/project/PHASE_1B_TASK_06_PLAN.md
.NET SHA256 for the same two exact byte sequences
UTF-8 decode, BOM check, CR count, LF-only check, and exactly one trailing LF
git status --short --branch
git rev-parse HEAD
git diff --check
git diff --cached --check
git remote
git branch --list *task-06*
git worktree list
```

Expected results are: both document hashes agree between Node and .NET; both
files are UTF-8 without BOM, LF-only, and have exactly one trailing LF; only
the two Task 06 Stage A paths are newly created; the index remains clean; no
Task 06 branch or worktree exists; no remote is configured; and no future Task
06 artifact exists.

### Historical Task 3: Record the external receipt and stop

Write only the external Stage A JSON receipt at
`C:/Users/HU.codex/execution-receipts/student-care/phase1b-task06-stage-a-20260902.json`
after the repository files and checks pass. The receipt must include the
assistant body, both file hashes, bytes, encoding, Git state, prohibited-action
results, and blockers. Do not stage, commit, delete, or modify repository
evidence. Stop at `OWNER_REVIEW_GATE`.

## Stage B amendment execution steps

### Task 4: Prove the integration gaps with red tests

**Files:**

- Modify: `apps/api/src/modules/institution/institution.test.ts`
- Modify: `packages/contracts/test/identity.test.ts`
- Modify: `packages/auth/test/policy.test.ts`
- Create: `apps/admin-web/test/home-content.test.mjs`

- [x] Assert that `buildServer()` exposes the Task 06 admin route.
- [x] Assert that public contracts and trusted auth accept `content:write` and
      `content:publish`.
- [x] Assert that admin-web has a package, HTML entrypoint, and JS entrypoint.
- [x] Run the tests before implementation and record the expected failures.

### Task 5: Implement shared capabilities and API integration

**Files:**

- Modify: `packages/contracts/src/identity.ts`
- Modify: `packages/auth/src/identity.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/package.json`

- [x] Add the two content capabilities to the public identity capability union.
- [x] Register `registerAdminInstitutionRoute()` in `buildServer()` with one
      shared `InstitutionService` instance.
- [x] Include the Task 06 test in the API package test and coverage commands.

### Task 6: Implement the no-dependency admin-web shell

**Files:**

- Create: `apps/admin-web/package.json`
- Create: `apps/admin-web/tsconfig.json`
- Create: `apps/admin-web/index.html`
- Create: `apps/admin-web/src/main.ts`
- Modify: `apps/admin-web/src/pages/home-content.tsx`

- [x] Render the typed Task 06 home editor view with synthetic data.
- [x] Provide draft and publish actions, with publish disabled without
      `canPublish`.
- [x] Compile to `dist/main.js` with the existing root TypeScript toolchain.

### Task 7: Replace the stale boundary with a Task 06-aware verifier

**Files:**

- Create: `scripts/verify_task_06.mjs`
- Modify: `package.json`
- Modify: `tests/contracts/package-boundaries.test.mjs`
- Modify: `tests/workspace/paths.test.mjs`

- [x] Keep `scripts/verify_task_05.mjs` and all Task 01-05 evidence frozen.
- [x] Make active root scripts and boundary tests invoke the Task 06 verifier.
- [x] Verify the exact Task 06 whitelist, absence of C1/C2 artifacts, no
      remote, clean index, and unchanged frozen evidence hashes.

### Task 8: Run the Stage B verification matrix

- [x] Run Task 06 unit and route tests.
- [x] Run contracts/auth/API/admin-web typecheck, lint, and build.
- [x] Run root format, test, and build commands.
- [x] Run `node scripts/verify_task_06.mjs --mode=structure`.
- [x] Review exact Git status and diff checks.
- [x] Generate Stage C1 evidence and stop at `OWNER_REVIEW_GATE`.

### Task 9: Remediate independent review findings

**Files:**

- Modify: `apps/api/src/modules/institution/institution.service.ts`
- Modify: `apps/api/src/routes/admin-institution.route.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/modules/institution/institution.test.ts`
- Modify: `scripts/verify_task_06.mjs`
- Modify: `tests/contracts/package-boundaries.test.mjs`
- Modify: `PHASE_1B_TASK_06_CODEX_EXECUTION.md`
- Modify: `docs/project/PHASE_1B_TASK_06_PLAN.md`

- [x] Prevent profile/home operations from crossing resource types when the
      same scoped content key is reused.
- [x] Select the active membership that covers the requested campus before
      invoking scope resolution.
- [x] Provide an anonymous visitor projection route backed only by an explicit
      server-owned scope resolver; deny when no resolver is configured.
- [x] Pin the complete Task 01-05 acceptance, review, manifest, and ZIP
      evidence set and verify that `BASE_HEAD` is an ancestor of `HEAD`.
- [x] Add regression tests and observe each affected behavior fail before the
      corresponding implementation correction.

## Future Stage B implementation contract

Stage B is authorized by the owner-confirmed amendment and must use TDD and
only the expanded Stage B whitelist.

The red tests must prove all of the following before implementation is written:

1. A staff actor without `content:publish` cannot publish institution or home
   content.
2. A foreign tenant or foreign/disallowed campus cannot edit or publish.
3. A stale expected version is denied without changing stored state or emitting
   a successful publication audit event.
4. An invalid content block is rejected before state change.
5. Draft and unpublished home content is absent from the visitor projection.
6. The public response excludes editor notes, moderation fields, membership
   details, administrative metadata, and concurrency internals.

The green implementation must let a tenant administrator edit synthetic
institution content, publish it through the Task 05 versioned lifecycle, and
let a visitor read only the published projection. Every successful publication
transition emits exactly one in-memory audit event through the existing
boundary; durable Task 17 audit storage remains out of scope.

Stage B must stop if any additional path, dependency, lockfile, service,
database, migration, or provider integration is required. Such a change needs
a new owner-approved stable amendment.

## Acceptance and stop criteria

Stage C1 is ready for owner review only when the expanded exact files exist,
the evidence package is deterministic, the current V5 and Task 05 acceptance
anchors are unchanged, the index is clean, existing untracked Task 04/05
evidence is unchanged, and no Task 06 C2 artifact or branch exists.

Stage C1 does not claim owner acceptance or authorize C2. Any claim of Task 06
acceptance remains pending the next owner review.

Stop immediately on governance conflict, missing prerequisite, path expansion,
real data, secret, network, registry, dependency installation, unapproved lockfile change,
production service, database, migration, branch/worktree creation, staging
outside the explicit commit gate, commit before all verification passes, any
verification failure, or any attempt to enter Stage C1/C2 or Task 07+.

`STATUS=STAGE_B_READY_FOR_OWNER_REVIEW`

`STOP_REASON=STOP_BEFORE_STAGE_C1_UNTIL_STAGE_B_VERIFICATION_AND_OWNER_REVIEW`
