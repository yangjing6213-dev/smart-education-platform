# Phase 1B Task 07 Public Teacher Introductions Plan

This plan records the owner-authorized Stage A and separately authorized Stage
B implementation. It creates no C1, C2, review, manifest, ZIP, or acceptance
artifact.

## Current contract and anchors

```text
TASK_ID=PHASE_1B_TASK_07
TASK_NAME=PUBLIC_TEACHER_INTRODUCTIONS
STAGE=STAGE_B_IMPLEMENTATION
STATUS=STAGE_B_REPAIR_AND_IMPLEMENTATION_COMPLETE_PENDING_C1_OWNER_REVIEW
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
TARGET_BRANCH=CURRENT_CHECKOUT_NO_NEW_BRANCH_OR_WORKTREE
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=1e5ae4bc93733832d7d52cf40444a451631e6974
OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK07_STAGE_B_IMPLEMENTATION_2026-09-03
STAGE_A_OWNER_REVIEW=PASS
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V9.md
ACTIVE_GOVERNANCE_SHA256=B4E53F632AC135925CBAE802CE360D361EE2394044C339137F11A9B045A96165
TASK_06_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md
TASK_06_ACCEPTANCE_SHA256=0B690B77CF4C08653FAE3495ABB9B218C640E8C4F02121CC14DEE0557850F68C
TASK_06_ACCEPTANCE_STATUS=ACCEPTED_AND_FROZEN
DEPENDENCIES=TASK_05|TASK_06
INPUT=APPROVED_PUBLIC_FIELDS_AND_FILE_REFERENCE_CONTRACT
OUTPUT=FILTERED_PUBLIC_TEACHER_CARDS_AND_SCOPED_ADMIN_EDITING
TASK_07_STAGE_A_AUTHORIZATION=GRANTED
TASK_07_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_07_STAGE_B_STATUS=REPAIR_AND_IMPLEMENTATION_COMPLETE_PENDING_C1_OWNER_REVIEW
TASK_07_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_07_PLUS_STARTED=NO
TASK_07_PLUS_AUTHORIZATION=NOT_GRANTED
```

Task 05 supplies the versioned publication model and Task 06 supplies the
accepted institution/home scope and administration boundary. Stage A passed
owner review, and the separate Stage B authorization is recorded above.

## Goal and user-visible contract

The future feature is a public teacher introduction surface for visitors,
backed by a scoped administrative editing surface. A public teacher card must
be generated from an explicit allowlist of approved fields, with stable
published state and safe file references. Public reads must never expose
private biography fields, internal notes, membership data, moderation data,
tenant/campus administration metadata, unpublished records, or concurrency
internals.

## Scope and policy

1. Public projection: define the exact title/name-safe display fields,
   approved description fields, approved role/subject labels, and approved
   file-reference form. Do not expose fields merely because they exist in an
   internal record.
2. Publication: draft and published records remain separate. Only an explicit
   successful publish transition makes a profile eligible for public reads.
   Unpublish removes it from the public projection without revealing internal
   state.
3. Scope: the server derives tenant and campus scope from trusted identity,
   active membership, and allowed campus membership. Client tenant, campus,
   role, publication, version, or profile identifiers cannot grant access.
4. Authorization: admin editing requires active membership and the approved
   write capability; publishing requires the approved publish capability or
   tenant-admin policy. Staff without publish authority are denied.
5. Isolation: foreign tenant and foreign/disallowed campus reads and writes
   fail closed without confirming another tenant's records.
6. Data: fixtures are obviously fictitious and synthetic only. No real
   personal data, secrets, provider credentials, or production records are
   permitted.

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

## Future implementation whitelist

The four core Stage B implementation/test files are:

```text
STAGE_B_CORE_IMPLEMENTATION_FILES=apps/api/src/modules/teachers/public-profile.service.ts|apps/api/src/routes/public-teachers.route.ts|apps/admin-web/src/pages/public-teachers.tsx|apps/api/src/modules/teachers/public-profile.test.ts
```

The current V9 repair and entry-integration authorization expands the exact
Stage B write boundary to the following complete set:

```text
STAGE_B_REPAIR_EXACT_FILES=apps/api/src/modules/teachers/public-profile.service.ts|apps/api/src/routes/public-teachers.route.ts|apps/api/src/modules/teachers/public-profile.test.ts|apps/admin-web/src/pages/public-teachers.tsx|apps/api/src/server.ts|apps/admin-web/src/main.ts|scripts/verify_task_06.mjs|tests/contracts/package-boundaries.test.mjs|tests/workspace/paths.test.mjs|package.json|PHASE_1B_TASK_07_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_07_PLAN.md|docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V9.md|AGENTS.md|PLANS.md|README.md|docs/project/DECISION_BASELINE.md|docs/project/SCOPE_AND_NON_SCOPE.md|docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md|docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md
```

The Stage A files remain contract/plan records:

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_07_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_07_PLAN.md
```

No repository path outside `STAGE_B_REPAIR_EXACT_FILES` may be created,
changed, deleted, moved, staged, or committed for Task 07 Stage B. The four
core files remain the implementation/test subset; the expanded set additionally
covers the approved entry integration, Task07-aware verification, governance
references, and contract/plan synchronization. Existing Task 01-06 frozen
evidence and the six untracked Task 04/05 evidence files remain untouched and
outside this plan.

## Risk register

- Public-field drift can leak private teacher information; solve with an
  explicit projection type and exact response-shape tests in a later Stage B.
- Client-provided scope claims can create cross-tenant exposure; solve by
  deriving scope only from trusted identity and active membership.
- Unpublished profiles can become visible through fallback reads; solve with a
  published-only query path and deny-by-default behavior.
- File references can bypass scope or publish policy; solve with an approved
  symbolic reference contract before implementation.
- Multiple memberships or campuses can produce ambiguous scope; solve with a
  deterministic active-membership and allowed-campus selection rule.

## Lifecycle

```text
STAGE_A=CONTRACT_AND_PLAN_FORMALIZATION_ONLY
STAGE_A_FORMAT_GATE=CHECK_ONLY_THE_TWO_STAGE_A_FILES
STAGE_A_OWNER_REVIEW_GATE=PASSED_BEFORE_STAGE_B_IMPLEMENTATION_AUTHORIZATION
STAGE_B=REPAIR_RED_GREEN_REGRESSION_ENTRY_INTEGRATION_AND_IMPLEMENTATION_UNDER_CURRENT_AUTHORIZATION
STAGE_C1=REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP_AFTER_STAGE_B_VERIFICATION
STAGE_C1_OWNER_REVIEW_GATE=AFTER_STAGE_C1_BEFORE_STAGE_C2_ACCEPTANCE
STAGE_C2=ACCEPTANCE_RECORD_ONLY_AFTER_EXPLICIT_OWNER_PASS
TASK_07_STAGE_B_STATUS=REPAIR_AND_IMPLEMENTATION_COMPLETE_PENDING_C1_OWNER_REVIEW
TASK_07_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_07_STAGE_C1_STATUS=NOT_STARTED
TASK_07_STAGE_C2_STATUS=NOT_STARTED
TASK_07_PLUS_STARTED=NO
```

Stage B does not require C1 or C2 files to exist. Under the current V9 repair
authorization, the Stage A contract and plan were synchronized as part of the
expanded repair boundary, while C1/C2 artifacts remain outside the boundary
and unauthorized.

## Later acceptance points

Later authorized implementation must prove:

- public responses contain only the approved projection fields;
- draft, unpublished, private-field, foreign-tenant, and disallowed-campus
  cases are denied or omitted safely;
- server-derived scope and active membership/capability checks control every
  admin operation;
- successful publication follows the accepted version rule and does not
  expose concurrency internals;
- all fixtures are synthetic and no real data, secret, network, service,
  database, migration, or provider integration is used.

## Stage B verification and stop conditions

Run the targeted Task 07 tests first, then the approved root quality/build and
Task07-aware verifier checks. Run Node crypto and .NET SHA-256 over the exact
bytes of every changed text file, verify UTF-8 without BOM, CR=0, LF-only, and
exactly one trailing LF, then run read-only content checks and:

```text
git status --short --branch --untracked-files=all
git rev-parse HEAD
git diff --check
git diff --cached --check
git remote
git worktree list
```

The existing branch and approved Stage B base remain in use, no remote may be
used, and all C1/C2 artifacts must remain absent. The expanded Stage B repair
set may be explicitly staged and committed only after all checks pass. Any
authorization conflict, path expansion beyond `STAGE_B_REPAIR_EXACT_FILES`,
frozen-evidence drift, format or hash failure, unapproved dependency change,
or later-stage activity is a fail-closed stop.

```text
STATUS=STAGE_B_REPAIR_AND_IMPLEMENTATION_COMPLETE_PENDING_C1_OWNER_REVIEW
OWNER_REVIEW_GATE=AFTER_STAGE_B_BEFORE_C1
TASK_07_IMPLEMENTATION_AUTHORIZATION=GRANTED
STOP_REASON=TASK07_STAGE_B_C1_OWNER_REVIEW_GATE
```

## File format contract

```text
PLAN_ENCODING=UTF-8
PLAN_BOM=NO
PLAN_LINE_ENDING=LF
PLAN_TRAILING_LF=EXACTLY_ONE
PLAN_SELF_SHA=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
```
