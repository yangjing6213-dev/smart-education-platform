# Phase 1B Task 10 Codex Execution Contract

This contract formalizes Task 10 Stage A only. It defines the future teaching
resources and search implementation boundary without authorizing implementation,
tests, evidence generation, or any later task.

## Contract status and authorization

```text
TASK_ID=PHASE_1B_TASK_10
TASK_NAME=TEACHING_RESOURCES_AND_SEARCH
STAGE=STAGE_A_FORMALIZATION
STATUS=READY_FOR_OWNER_REVIEW
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
TARGET_BRANCH=CURRENT_CHECKOUT_NO_NEW_BRANCH_OR_WORKTREE
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=b856fd809b2ee00e12907d1fd28a5c6186e6b8a2
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V18.md
ACTIVE_GOVERNANCE_SHA256=20157D3F8B0DC997E380E75961BB308E66FCB0BD71214FACA2A713460BC7343E
DEPENDENCY_AUTHORITY_PATH=docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md
DEPENDENCY_AUTHORITY_SHA256=B7F7509914399DD660D02F6FFD52E735EDF9EA850C0BF5C92F95698D8104F007
OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK10_STAGE_A_2026-09-07
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

V18 remains the current active authority. Task 09 is accepted and frozen under
its separate acceptance record. This Stage A authorization records a bounded
future task contract only; it does not override V18, authorize Task 10 Stage B,
or authorize Task 11+.

## Stage A exact boundary

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_10_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_10_PLAN.md
STAGE_A_WRITE_POLICY=CREATE_ONLY_THE_TWO_EXACT_FILES
STAGE_A_COMMIT_POLICY=NO_ADD|NO_STAGE|NO_COMMIT
STAGE_A_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
```

No existing file may be modified in Stage A. This includes V18, AGENTS.md,
PLANS.md, README.md, the decision baseline, scope, dependency graph, V0.1 plan,
Task 09 contract/plan/acceptance/C1 evidence, Task 01-08 frozen evidence, the
old Task 06 verifier, and all protected untracked evidence.

## Task identity and future product slice

Task 10 is **Teaching resources and search**. The frozen dependency decision is
`T05 -> T08 -> T12`; Task 12 must be accepted and frozen before a future Stage B
implementation can begin.

- Input: resource categories, file metadata, and role/campus scope.
- Output: a filtered resource list, resource detail projection, and explicit
  empty-result behavior.
- Red intent: unsafe file references, unknown categories, unrestricted search,
  and foreign-tenant access are denied.
- Implementation intent: allowlisted filters, bounded cursor pagination, and
  signed file reads through an approved file access boundary.
- Green intent: authorized synthetic staff can read scoped published resources,
  while unauthorized callers never receive provider URLs.

The future Stage B implementation whitelist is exactly:

```text
TASK_10_STAGE_B_EXACT_FILES=apps/api/src/modules/resources/resource.service.ts|apps/api/src/routes/staff-resources.route.ts|apps/user-web/src/pages/resources.tsx|apps/api/src/modules/resources/resource.test.ts
```

This list is a future boundary, not current write permission. Any need for a
shared contract, auth module, route registry, package manifest, user-web package,
schema, migration, verifier, or configuration file is a fail-closed blocker and
requires a new owner-approved authority and whitelist.

## Trust, privacy, and fail-closed rules

The future implementation must derive `tenant_id` and `campus_id` on the server
from trusted identity, active membership, allowed campus scope, and capability.
Client claims for tenant, campus, role, membership, category ownership,
publication, file ownership, cursor scope, or provider URL are untrusted and
cannot widen access.

Resource reads must remain internal to authorized staff. Visitor access,
missing, inactive, or suspended membership, missing capability, foreign tenant,
foreign or disallowed campus, unknown category, unsafe file reference,
unapproved provider reference, malformed or unrestricted search, invalid cursor,
and cross-scope detail access must fail closed. A denied operation must not
change resource state or emit a successful audit result.

Search must use allowlisted categories and bounded query terms, a fixed maximum
page size, and an opaque server-validated cursor bound to the derived scope.
Detail reads must validate publication state, ownership, category, version, scope,
and file approval before returning an explicit resource projection. The response
must never expose raw provider URLs, credentials, storage keys, internal audit
fields, or unrelated tenant/campus records.

Only clearly fictional synthetic fixtures may be used. No real child or family
data, contact details, credentials, secrets, external provider, network request,
production database, migration, or persistent production state is permitted.

## Lifecycle and owner gates

```text
STAGE_A=CONTRACT_AND_PLAN_FORMALIZATION
STAGE_A_OWNER_REVIEW_GATE=AFTER_FORMAT_AND_BOUNDARY_CHECKS
STAGE_B=FUTURE_IMPLEMENTATION_ONLY_AFTER_SEPARATE_OWNER_AUTHORIZATION
STAGE_C1=FUTURE_REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP_ONLY_AFTER_STAGE_B_OWNER_REVIEW
STAGE_C2=FUTURE_ACCEPTANCE_ONLY_AFTER_EXPLICIT_C1_OWNER_PASS
TASK_10_STAGE_A_AUTHORIZATION=GRANTED
TASK_10_STAGE_A_STATUS=READY_FOR_OWNER_REVIEW
TASK_10_STAGE_B_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_10_STAGE_B_STATUS=NOT_STARTED
TASK_10_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_10_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_11_PLUS_STARTED=NO
TASK_11_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK10_STAGE_A_OWNER_REVIEW_GATE
STOP_REASON=TASK10_STAGE_A_OWNER_REVIEW_GATE
```

Stage A stops after the two documents are locally validated and left
uncommitted. Owner review of this contract and plan is required before any
separate Stage B authorization can be considered.

## Stage A verification boundary

Only the following checks are allowed in Stage A:

```text
Node crypto SHA-256 over the two Stage A files
.NET SHA256 over the same exact bytes
UTF-8 without BOM, CR=0, LF-only, exactly one trailing LF
No self-SHA in either Stage A file
git diff --check
git status --short --branch --untracked-files=all
```

No implementation, test, build, service, browser, network, dependency,
database, migration, review, manifest, ZIP, acceptance, or Task 11+ operation is
part of this Stage A contract.
