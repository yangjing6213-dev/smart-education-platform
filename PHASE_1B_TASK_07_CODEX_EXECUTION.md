# Phase 1B Task 07 Codex Execution Contract

This contract records the owner-authorized Stage A and the separately
authorized Stage B implementation for Task 07, Public Teacher Introductions.
It does not authorize Stage C1, Stage C2, or Task 08+.

## Contract status and authorization

```text
TASK_ID=PHASE_1B_TASK_07
TASK_NAME=PUBLIC_TEACHER_INTRODUCTIONS
TASK_STAGE=STAGE_B_IMPLEMENTATION
TASK_STATUS=STAGE_B_IMPLEMENTATION_IN_PROGRESS
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
TARGET_BRANCH=CURRENT_CHECKOUT_NO_NEW_BRANCH_OR_WORKTREE
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=4c1c4ca055c031ecbfabf790e5d8152fca05cdb2
OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK07_STAGE_B_IMPLEMENTATION_2026-09-03
OWNER_AUTHORIZATION_SCOPE=STAGE_B_IMPLEMENTATION_ONLY
STAGE_A_OWNER_REVIEW=PASS
GOVERNANCE_AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V8.md
GOVERNANCE_AUTHORITY_SHA256=4CE2089247EF111CFCA78EC0AE7A6C06016F72E160E741F79AD6D6A1ECCF218B
TASK_06_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md
TASK_06_ACCEPTANCE_SHA256=0B690B77CF4C08653FAE3495ABB9B218C640E8C4F02121CC14DEE0557850F68C
TASK_06_ACCEPTANCE_STATUS=ACCEPTED_AND_FROZEN
DEPENDENCIES=T05 -> T06
INPUTS=APPROVED_PUBLIC_FIELDS_AND_FILE_REFERENCE_CONTRACT
OUTPUTS=FILTERED_PUBLIC_TEACHER_CARDS_AND_SCOPED_ADMIN_EDITING
TASK_07_STARTED=YES_STAGE_B_IMPLEMENTATION
TASK_07_STAGE_A_AUTHORIZATION=GRANTED
TASK_07_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_07_STAGE_B_STATUS=IMPLEMENTATION_IN_PROGRESS
TASK_07_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_07_STAGE_C1_STATUS=NOT_STARTED
TASK_07_STAGE_C2_STATUS=NOT_STARTED
TASK_07_PLUS_STARTED=NO
TASK_07_PLUS_AUTHORIZATION=NOT_GRANTED
```

The Stage A authorization and PASS are prerequisites only. The independent
Stage B authorization above is the source of implementation authority.

## Objective and bounded design

Task 07 will eventually provide filtered public teacher introduction cards and
scoped administrative editing. The public surface must be an explicit,
allowlisted projection of approved public fields. Publication is a deliberate
state transition; an unpublished profile is private to its authorized internal
scope and must not appear in visitor reads.

The server derives tenant and campus scope from trusted identity, active
membership, and allowed-campus context. A client-supplied tenant ID, campus ID,
role, publication state, version, or profile ownership claim is never an
authorization source. Foreign-tenant and foreign/disallowed-campus requests
fail closed. Active membership and the required capability are mandatory for
administrative editing and publication.

Only obviously fictitious synthetic fixtures are permitted. No real teacher,
student, family, contact, credential, provider, or production data may be used.

```text
TASK07_PUBLIC_PROJECTION=EXPLICIT_ALLOWLISTED_PUBLIC_FIELDS_ONLY
TASK07_PUBLICATION_POLICY=PUBLISHED_ONLY_PUBLIC_READ
TASK07_SCOPE_POLICY=SERVER_DERIVED_TENANT_AND_CAMPUS_SCOPE
TASK07_MEMBERSHIP_POLICY=ACTIVE_MEMBERSHIP_AND_CAPABILITY_REQUIRED
TASK07_FOREIGN_TENANT_POLICY=FAIL_CLOSED
TASK07_UNPUBLISHED_PRIVATE_FIELD_POLICY=FAIL_CLOSED
TASK07_DATA_POLICY=SYNTHETIC_ONLY
TASK07_CLIENT_CLAIMS=TENANT_CAMPUS_ROLE_PUBLICATION_AND_VERSION_CLAIMS_UNTRUSTED
```

## Scope

- Define approved public teacher fields and the file-reference boundary.
- Define a stable public projection that excludes private and administrative
  fields by construction.
- Define publication policy and the separation between draft and published
  states.
- Define server-derived tenant/campus scope and active
  membership/capability checks.
- Define fail-closed foreign-tenant, foreign-campus, unpublished, and private
  field behavior.
- Define bounded admin editing for the authorized tenant/campus scope.
- Define synthetic-only fixtures and local verification evidence.

## Non-goals and prohibited work

- No implementation code or tests outside the four Stage B files; no database
  schema, migrations, or lockfile changes.
- No real login, SMS, WeChat/OAuth/OIDC provider, production service, network,
  registry, external API, or persistent data store.
- No real personal data, secrets, tokens, cookies, credentials, or production
  configuration.
- No Task 06 or Task 01-06 frozen evidence changes; no V1-V7 authority
  changes.
- No Task 07 Stage C1 or Stage C2 authorization is implied.
- No Stage C1 review, manifest, ZIP, or C2 acceptance file is created.
- No Task 08+ work is started or authorized.
- No branch or worktree is created. The existing checkout is used.
- No `git add`, staging, commit, push, PR, or deployment is performed for the
  Stage A record. Stage B permits one explicit commit after verification.

## Exact Stage A and Stage B files

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_07_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_07_PLAN.md
STAGE_A_WRITE_POLICY=CREATE_ONLY_THE_TWO_FILES
STAGE_A_COMMIT_POLICY=NO_STAGE|NO_COMMIT|NO_PUSH|NO_PR|NO_DEPLOY
STAGE_A_ENCODING=UTF-8
STAGE_A_BOM=NO
STAGE_A_LINE_ENDING=LF
STAGE_A_TRAILING_LF=EXACTLY_ONE
STAGE_A_SELF_SHA=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
STAGE_B_EXACT_FILES=apps/api/src/modules/teachers/public-profile.service.ts|apps/api/src/routes/public-teachers.route.ts|apps/admin-web/src/pages/public-teachers.tsx|apps/api/src/modules/teachers/public-profile.test.ts
STAGE_B_WRITE_POLICY=MODIFY_OR_CREATE_ONLY_THE_FOUR_FILES
STAGE_B_COMMIT_POLICY=ONE_EXPLICIT_COMMIT_AFTER_VERIFICATION
```

The following files are the exact Stage B implementation/test files. They are
not created until the Stage B implementation steps below:

```text
STAGE_B_FILES=apps/api/src/modules/teachers/public-profile.service.ts|apps/api/src/routes/public-teachers.route.ts|apps/admin-web/src/pages/public-teachers.tsx|apps/api/src/modules/teachers/public-profile.test.ts
```

## Lifecycle and owner gates

```text
STAGE_A=CONTRACT_AND_PLAN_FORMALIZATION_ONLY
STAGE_A_OWNER_REVIEW_GATE=PASSED_BEFORE_STAGE_B_IMPLEMENTATION_AUTHORIZATION
STAGE_B=IMPLEMENTATION_AND_TDD_UNDER_CURRENT_AUTHORIZATION
STAGE_C1=FINAL_REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP_AFTER_STAGE_B_VERIFICATION
STAGE_C1_OWNER_REVIEW_GATE=AFTER_STAGE_C1_BEFORE_STAGE_C2_ACCEPTANCE
STAGE_C2=ACCEPTANCE_RECORD_ONLY_AFTER_EXPLICIT_OWNER_PASS
TASK_07_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_07_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_07_STAGE_C2_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=AFTER_STAGE_B_BEFORE_C1
STOP_REASON=TASK07_STAGE_B_C1_OWNER_REVIEW_GATE
```

Stage B stops after the four implementation/test files pass the authorized
TDD, regression, quality, and scope checks. It does not create C1, C2, or
Task 08+ artifacts.

## Acceptance points for later authorized stages

Stage B acceptance must demonstrate explicit public projection,
published-only reads, private/unpublished-field denial, server-derived scope,
active membership and capability enforcement, foreign-tenant denial,
synthetic-only fixtures, and no leakage of membership or administrative
metadata. Future C1 must package only approved evidence after Stage B
verification. Future C2 must record actual evidence only after owner PASS and a
separate authorization; it must never be prewritten.

## Stage B verification commands

Run targeted tests first, then the existing relevant quality commands:

```text
corepack pnpm --filter @student-care/api test
corepack pnpm --filter @student-care/admin-web test
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm test
corepack pnpm build
Node crypto SHA-256 for the four Stage B files
.NET SHA256 for the same four exact byte sequences
git status --short --branch --untracked-files=all
git rev-parse HEAD
git diff --check
git diff --cached --check
git remote
git worktree list
```

Expected Stage B results are exact changes to the four listed files, passing
tests and quality checks, no new dependency or service activity, no C1/C2 or
Task 08+ artifact, and unchanged frozen evidence.

## Stop conditions

Stop immediately and preserve the actual state on governance or dependency
conflict, anchor drift, non-whitelist change, encoding failure, non-whitelisted
file creation, real data or secret discovery, network or service activity,
dependency installation, database or migration activity, or any attempt to
enter C1, C2, or Task 08+ without a new explicit authorization.

```text
TASK_07_STAGE_A_COMPLETION=OWNER_REVIEW_PASSED
TASK_07_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_08_PLUS_STARTED=NO
```
