# Phase 1B Task 10 Teaching Resources and Search Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define a server-scoped internal teaching-resource list and detail
projection with bounded search and safe file reads.

**Architecture:** A future API service will resolve tenant and campus scope from
trusted identity and active membership, then apply allowlisted resource filters,
bounded cursor pagination, publication/version checks, and approved file access.
The future user-web page will consume the explicit internal projection and show
synthetic list, empty, loading, error, and detail states without direct provider
access.

**Tech Stack:** Existing Fastify/TypeScript API patterns, existing auth and scope
contracts, existing in-memory synthetic fixtures, React/TSX user-web patterns,
Node test runner, TypeScript, ESLint, and Prettier. No new dependency is planned.

---

## Current anchors and preconditions

```text
TASK_ID=PHASE_1B_TASK_10
TASK_NAME=TEACHING_RESOURCES_AND_SEARCH
STAGE=STAGE_A_FORMALIZATION
STATUS=READY_FOR_OWNER_REVIEW
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=b856fd809b2ee00e12907d1fd28a5c6186e6b8a2
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V18.md
ACTIVE_GOVERNANCE_SHA256=20157D3F8B0DC997E380E75961BB308E66FCB0BD71214FACA2A713460BC7343E
DEPENDENCY_AUTHORITY_PATH=docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md
DEPENDENCY_AUTHORITY_SHA256=B7F7509914399DD660D02F6FFD52E735EDF9EA850C0BF5C92F95698D8104F007
TASK_05_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_08_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_12_DEPENDENCY_STATUS=REQUIRED_BEFORE_TASK10_STAGE_B_AND_NOT_CURRENTLY_AUTHORIZED
TASK_10_STAGE_A_AUTHORIZATION=GRANTED
TASK_10_STAGE_A_STATUS=READY_FOR_OWNER_REVIEW
TASK_10_STAGE_B_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_10_STAGE_B_STATUS=NOT_STARTED
TASK_10_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_10_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_11_PLUS_STARTED=NO
TASK_11_PLUS_AUTHORIZATION=NOT_GRANTED
```

Stage B requires a separate owner authorization after this Stage A plan is
reviewed. It also requires the dependency order `T05 -> T08 -> T12` to be
satisfied, including accepted/frozen Task 12 evidence. Task 10 Stage A does not
authorize implementation merely because Task 05 and Task 08 are frozen.

## Exact files

### Stage A files

Only these two files may be created during this formalization:

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_10_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_10_PLAN.md
STAGE_A_WRITE_POLICY=CREATE_ONLY_THE_TWO_EXACT_FILES
STAGE_A_GIT_POLICY=NO_ADD|NO_STAGE|NO_COMMIT|NO_PUSH|NO_PR|NO_DEPLOY
```

### Future Stage B files

The future implementation/test boundary is exactly:

```text
STAGE_B_EXACT_FILES=apps/api/src/modules/resources/resource.service.ts|apps/api/src/routes/staff-resources.route.ts|apps/user-web/src/pages/resources.tsx|apps/api/src/modules/resources/resource.test.ts
```

These paths must not be created, modified, staged, or committed in Stage A.
Stage B may not add route registration, shared contracts, auth types, package
configuration, schemas, migrations, verifiers, or other paths without a new
authority and owner approval.

## Scope contract

Task 10 consumes resource categories, file metadata, and role/campus scope. It
produces a filtered internal resource list, an explicit detail projection, and
an empty-result response. It does not define a visitor/public resource route,
provider integration, file upload, storage migration, or production persistence.

The service must enforce:

- server-derived `tenant_id` and `campus_id` from trusted identity;
- active membership and required staff capability;
- allowlisted categories and bounded text filters;
- bounded cursor pagination with scope-bound server validation;
- publication and version checks before detail projection;
- approved file-reference checks before signed file-read intent;
- explicit projections that exclude provider URLs and internal metadata.

Visitor access, missing or suspended membership, missing capability, foreign
tenant, foreign or disallowed campus, unknown category, unsafe file, invalid or
unbounded search, malformed cursor, unauthorized version, and cross-scope detail
requests must be denied. Denials must leave state unchanged and must not create a
successful audit record. Client-supplied scope, ownership, role, publication,
file, category, version, or cursor claims cannot widen access.

All fixtures and UI labels must be clearly synthetic. The implementation must
not contain real minor data, contact information, secrets, provider tokens,
external URLs, network calls, production database access, or migrations.

## Future Stage B execution plan

### Task 1: Confirm the future Stage B preconditions

Files: none.

- [ ] Confirm the live branch is `feature/phase-1b-task-04-identity-membership`.
- [ ] Confirm Task 05 and Task 08 remain accepted/frozen and Task 12 has its
      separately accepted/frozen dependency evidence.
- [ ] Confirm a separate owner authorization names exactly the four Stage B
      paths above.
- [ ] Confirm no unknown path, dependency change, package manifest, schema,
      migration, or protected evidence drift exists.

Run:

```text
git status --short --branch --untracked-files=all
git rev-parse HEAD
git diff --check
git diff --cached --check
```

Expected: the authorized branch is current, protected inputs remain unchanged,
and no unapproved path is present. Any failed precondition blocks Stage B.

### Task 2: Write the failing API tests

File: `apps/api/src/modules/resources/resource.test.ts`

- [ ] Add synthetic fixtures for one authorized staff member, one inactive or
      suspended member, one foreign tenant, one disallowed campus, one published
      resource, one draft, one unknown category, and one unsafe file reference.
- [ ] Assert visitor, inactive/suspended membership, missing capability, foreign
      tenant/campus, unknown category, unsafe file, unbounded search, invalid
      cursor, unauthorized version, and client-claim scope escalation deny.
- [ ] Assert denied operations do not mutate the in-memory resource state and do
      not append a successful audit event.
- [ ] Assert an authorized synthetic staff member receives only scoped published
      resources, stable bounded pages, explicit detail fields, and no provider
      URL.

Run the API test after compiling the existing TypeScript project:

```text
corepack pnpm --filter @student-care/api build
node --test apps/api/dist/src/modules/resources/resource.test.js
```

Expected before implementation: the new test fails for the missing resource
service/route behavior. This is the required RED evidence; do not weaken the
assertions to obtain a pass.

### Task 3: Implement the scoped resource service

File: `apps/api/src/modules/resources/resource.service.ts`

- [ ] Define an in-memory synthetic resource fixture with tenant, campus,
      category, publication/version, approved file-reference, and audit state.
- [ ] Resolve scope from trusted identity and active membership before any
      filter or lookup. Ignore or reject client tenant/campus/role/membership
      claims.
- [ ] Validate an allowlisted category, bounded search term, bounded page size,
      and scope-bound cursor before reading the collection.
- [ ] Return only an explicit list projection and an explicit detail projection.
      Return signed file-read intent only for an approved reference; never return
      a raw provider URL.
- [ ] Reject all unsafe, foreign, stale, unpublished, unauthorized, or malformed
      requests without changing state or writing a success audit event.

### Task 4: Implement the staff route

File: `apps/api/src/routes/staff-resources.route.ts`

- [ ] Expose only the approved internal staff list and detail HTTP operations
      required by the service contract.
- [ ] Map typed validation failures to the repository's existing fail-closed
      status/error envelope.
- [ ] Do not add public/visitor resource projection or trust client scope claims.

### Task 5: Implement the user-web page

File: `apps/user-web/src/pages/resources.tsx`

- [ ] Render a synthetic internal resource list, bounded search controls, empty
      state, error state, and detail/version state using the existing user-web
      conventions.
- [ ] Keep authorization and scope decisions on the server; the page must not
      manufacture tenant/campus/role claims or call a provider URL.
- [ ] Keep labels and fixtures clearly synthetic and avoid real personal data.

Before editing this file, confirm the repository already contains an approved
user-web package, compiler configuration, and scripts. If that toolchain is
absent, stop with a blocker rather than creating package/configuration files.

### Task 6: Run focused GREEN and regression checks

Run exactly:

```text
corepack pnpm --filter @student-care/api typecheck
corepack pnpm --filter @student-care/api lint
corepack pnpm --filter @student-care/api build
corepack pnpm --filter @student-care/api build && node --test apps/api/dist/src/modules/resources/resource.test.js
corepack pnpm exec prettier --check apps/api/src/modules/resources/resource.service.ts apps/api/src/routes/staff-resources.route.ts apps/api/src/modules/resources/resource.test.ts apps/user-web/src/pages/resources.tsx
```

If an approved `@student-care/user-web` package and scripts exist, additionally
run:

```text
corepack pnpm --filter @student-care/user-web typecheck
corepack pnpm --filter @student-care/user-web lint
corepack pnpm --filter @student-care/user-web build
```

Expected GREEN evidence: all applicable commands exit zero, the focused test
passes, and the user-web toolchain is either verified or explicitly recorded as
a pre-existing blocker. Do not install dependencies or change scripts to make a
command pass.

### Task 7: Inspect the future Stage B boundary

- [ ] Run `git diff --check` and `git diff --cached --check`.
- [ ] Confirm only the four exact Stage B files changed.
- [ ] Confirm no provider URL, secret, real personal data, dependency, schema,
      migration, or unrelated route/config change was introduced.
- [ ] Only after all focused checks pass and owner authorization remains valid,
      explicitly stage the four paths and inspect the staged diff.
- [ ] Commit with `feat: add scoped teaching resources and search`.

Stage B must stop before C1 owner review. No review, manifest, ZIP, acceptance,
or Task 11+ artifact is created by this plan.

## Future evidence lifecycle placeholders

These are lifecycle placeholders only and are not Stage A files or permissions:

```text
STAGE_C1=REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP_AFTER_STAGE_B_OWNER_REVIEW
STAGE_C1_AUTHORIZATION=NOT_GRANTED
STAGE_C2=ACCEPTANCE_RECORD_ONLY_AFTER_C1_OWNER_PASS
STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_11_PLUS_STARTED=NO
TASK_11_PLUS_AUTHORIZATION=NOT_GRANTED
```

No C1 review, detached manifest, deterministic ZIP, C2 acceptance, Task 11
contract, or Task 11+ implementation is created in this Stage A formalization.

## Stage A stop condition

After both documents pass the format and path checks, leave them uncommitted for
owner review. The final status is:

```text
TASK_10_STAGE_A_STATUS=READY_FOR_OWNER_REVIEW
TASK_10_STAGE_B_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_10_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_10_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_11_PLUS_STARTED=NO
TASK_11_PLUS_AUTHORIZATION=NOT_GRANTED
STOP_REASON=TASK10_STAGE_A_OWNER_REVIEW_GATE
```
