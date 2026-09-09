# Phase 1B Task 12 Codex Execution Contract

This document preserves the approved Task 12 Stage A contract and records its
V24 active-lifecycle overlay. The Stage A and Stage B sections below remain the
formal design and implementation record; Task 12 C2 is accepted and frozen.

## Contract status and authorization

```text
TASK_ID=PHASE_1B_TASK_12
TASK_NAME=FILE_UPLOAD_AND_COS_ADAPTER_BOUNDARY
STAGE=STAGE_C2_ACCEPTANCE
STATUS=ACCEPTED_AND_FROZEN
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
TARGET_BRANCH=CURRENT_CHECKOUT_NO_NEW_BRANCH_OR_WORKTREE
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=78a0d9ef80a5c0bf634ab46f730cd386c05a180c
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V24.md
ACTIVE_GOVERNANCE_SHA256=209124CDD9FBB355A9C29610E97439CCBC847A3F5CA033575B14646C7974F833
TASK_12_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_12_ACCEPTANCE.md
TASK_12_ACCEPTANCE_SHA256=909A8153FA681F3C5951B236755A0147049F0FA13A9828F8BBB0381D2AA04908
DEPENDENCY_AUTHORITY_PATH=docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md
DEPENDENCY_AUTHORITY_SHA256=B7F7509914399DD660D02F6FFD52E735EDF9EA850C0BF5C92F95698D8104F007
OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK12_STAGE_A_2026-09-07
TASK_02_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_03_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_05_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_12_DEPENDENCY_ORDER=T02|T03|T05
TASK_10_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_10_STAGE_B_IMPLEMENTATION_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_10_STAGE_B_COMMIT=78a0d9ef80a5c0bf634ab46f730cd386c05a180c
TASK_10_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_10_STAGE_C1_AUTHORIZATION=GRANTED
TASK_10_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_10_STAGE_C2_AUTHORIZATION=GRANTED
TASK_10_STAGE_C2_STATUS=ACCEPTED
TASK_10_STATUS=ACCEPTED_AND_FROZEN
TASK_10_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_10_ACCEPTANCE.md
TASK_10_ACCEPTANCE_SHA256=4628B2BADB28CF6E5A065AD252B4A1E934D199A1A911D9DE6DEC07313064B657
TASK_11_STAGE_C2_STATUS=ACCEPTED
TASK_11_STATUS=ACCEPTED_AND_FROZEN
TASK_11_STARTED=YES_STAGE_C2_ACCEPTED
TASK_11_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_11_ACCEPTANCE.md
TASK_11_ACCEPTANCE_SHA256=4482B3B1914B3A78886487854A54C2732CDF688BB59418C88570E32F204B4FCD
TASK_12_STAGE_A_AUTHORIZATION=GRANTED
TASK_12_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_B_AUTHORIZATION=GRANTED
TASK_12_STAGE_B_COMMIT=e0cefee6417835ee7af24f572dfa76c82a5c3e63
TASK_12_STAGE_B_PARENT=b856fd809b2ee00e12907d1fd28a5c6186e6b8a2
TASK_12_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_C1_AUTHORIZATION=GRANTED
TASK_12_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_C2_AUTHORIZATION=GRANTED
TASK_12_STAGE_C2_STATUS=ACCEPTED
TASK_12_STATUS=ACCEPTED_AND_FROZEN
TASK_12_STARTED=YES_STAGE_C2_ACCEPTED
TASK_12_ROUTE_REPAIR_AUTHORIZATION=NOT_GRANTED
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
```

V24 is the current active governance authority. Task 01—12 are accepted and
frozen. Task 12 new work and Task 13+ are not started and not authorized.
Task 10 C2 is accepted and frozen. Task 12 C2 is accepted and frozen.
The residual integration gap is preserved: `apps/api/src/server.ts` does not
register `registerFileIntentRoutes`; route repair is not authorized.

## Stage A exact boundary

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_12_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_12_PLAN.md
STAGE_A_WRITE_POLICY=CREATE_ONLY_THE_TWO_EXACT_FILES
STAGE_A_GIT_POLICY=NO_ADD|NO_STAGE|NO_COMMIT|NO_PUSH|NO_PR|NO_DEPLOY
STAGE_A_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
```

No existing file may be modified in Stage A. This includes V19, V18, the dependency
authority, AGENTS.md, PLANS.md, README.md, all decision/scope/plan files, the
Task 09 contract/plan/acceptance/C1 evidence, the Task 10 Stage A files, all
Task 01-09 frozen evidence, the old Task 06 verifier, and all protected
untracked evidence.

## Task identity, dependencies, and product slice

Task 12 is **File upload and COS adapter boundary**. The approved dependency
authority locks the order `T02 -> T03 -> T05`; the dependency authority is a
read-only frozen record and does not authorize Task 12 implementation.

- Input: file storage baseline, declared purpose, checksum, and scope.
- Output: pending file record, short-lived upload intent, scan state, and scoped
  read link.
- Red cases: disallowed MIME, oversized file, foreign key, expired link, and
  unsigned access must fail.
- Implementation direction: implement a storage port with a provider fake first;
  keep COS credentials outside source.
- Green case: a valid synthetic image passes the fake scan and foreign object
  access remains denied.
- Future implementation commit: `feat: add scoped file storage adapter boundary`.

The future Stage B implementation and test whitelist is exactly:

```text
TASK_12_STAGE_B_EXACT_FILES=apps/api/src/modules/files/file.service.ts|apps/api/src/adapters/cos.storage.ts|apps/api/src/routes/file-intent.route.ts|apps/api/src/modules/files/file.test.ts
```

This is a future boundary, not current write permission. A future implementation
must not add route registration, shared contracts, auth types, package scripts,
package manifests, schemas, migrations, verifiers, or other paths without a new
owner-approved authority and whitelist.

## Storage port and COS boundary

The future service owns the domain rules and depends on a narrow storage port.
The provider fake is the first implementation and is used for deterministic
synthetic tests. A COS adapter may implement the same port later, but this task
does not authorize network access, provider calls, deployment, or production
credentials.

The storage port must separate the following concerns:

- file metadata validation: declared purpose, allowlisted MIME, bounded byte
  size, checksum, and server-derived scope;
- pending file lifecycle: pending record, upload intent, scan state, and final
  availability state;
- upload intent: short-lived, scope-bound, purpose-bound, and non-reusable after
  expiry or consumption;
- read access: a scoped read link or read intent generated only after the file is
  approved and the caller is authorized;
- provider implementation: fake storage for tests and a future COS adapter with
  credentials supplied outside source code.

The domain service must never expose a provider URL, access key, secret, bucket,
internal storage key, unsigned link, or raw provider response to an unauthorized
caller. COS credentials must remain outside source and outside fixtures, logs,
review artifacts, and Git.

## Trust, privacy, and fail-closed rules

The future implementation must derive `tenant_id` and `campus_id` on the server
from trusted identity, active membership, allowed campus scope, and capability.
Client claims for tenant, campus, role, membership, ownership, purpose, checksum,
MIME, file key, provider URL, upload state, scan state, expiry, or signature are
untrusted and cannot widen access.

Every pending file and read operation must remain bound to its server-derived
tenant and campus scope. Foreign tenant or campus keys, disallowed campus scope,
inactive or suspended membership, missing capability, unknown declared purpose,
disallowed MIME, oversized content, checksum mismatch, malformed or foreign file
key, expired or reused upload intent, pending or failed scan state, expired link,
and unsigned access must fail closed.

Denied operations must not mutate file state, consume an upload intent, issue a
read link, or emit a successful audit result. A valid file may become readable
only after the fake scan reaches the approved state and the caller passes the
same scope, membership, capability, and purpose checks.

Only clearly fictional synthetic fixtures may be used. No real child or family
data, contact details, photographs, credentials, secrets, provider tokens,
external URLs, network requests, production database, persistent production
state, or migration is permitted.

## Lifecycle and owner gates

```text
STAGE_A=CONTRACT_AND_PLAN_FORMALIZATION
STAGE_A_OWNER_REVIEW_GATE=AFTER_FORMAT_AND_BOUNDARY_CHECKS
STAGE_B=FUTURE_IMPLEMENTATION_ONLY_AFTER_SEPARATE_OWNER_AUTHORIZATION
STAGE_B_OWNER_REVIEW_GATE=AFTER_IMPLEMENTATION_AND_FOCUSED_VERIFICATION
STAGE_C1=FUTURE_REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP_ONLY_AFTER_STAGE_B_OWNER_REVIEW
STAGE_C2=FUTURE_ACCEPTANCE_ONLY_AFTER_EXPLICIT_C1_OWNER_PASS
TASK_12_STAGE_A_AUTHORIZATION=GRANTED
TASK_12_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_B_AUTHORIZATION=GRANTED
TASK_12_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_C1_AUTHORIZATION=GRANTED
TASK_12_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_12_STAGE_C2_AUTHORIZATION=GRANTED
TASK_12_STAGE_C2_STATUS=ACCEPTED
TASK_12_STATUS=ACCEPTED_AND_FROZEN
TASK_12_STARTED=YES_STAGE_C2_ACCEPTED
TASK_12_ROUTE_REPAIR_AUTHORIZATION=NOT_GRANTED
TASK_12_NEW_WORK_STARTED=NO
TASK_12_NEW_WORK_AUTHORIZATION=NOT_GRANTED
TASK_13_PLUS_STARTED=NO
TASK_13_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=V24_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
STOP_REASON=V24_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```

The historical V19 C1 boundary produced only these protected evidence files:

```text
TASK_12_STAGE_C1_EXACT_FILES=docs/reviews/PHASE_1B_TASK_12_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_12.txt|artifacts/review-package/student-care-platform-phase1b-task-12-review-pack-v1.0.zip
TASK_12_STAGE_C1_GIT_POLICY=CREATE_UNCOMMITTED_EVIDENCE_ONLY
TASK_12_STAGE_C1_MEMBER_COUNT=10
TASK_12_STAGE_C1_FIRST_MEMBER=apps/api/package.json
TASK_12_STAGE_C1_FIXED_TIMESTAMP=1980-01-01T00:00:00
```

The C1 review recorded that `apps/api/src/server.ts` does not register the
Task 12 route module; module-level evidence must not be presented as global
endpoint reachability. C2 acceptance does not authorize route repair or any
future task.

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
