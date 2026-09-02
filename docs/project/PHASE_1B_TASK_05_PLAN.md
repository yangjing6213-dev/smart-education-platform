# Phase 1B Task 05 Content and Publishing Model Plan

> **For agentic workers:** This plan is not an implementation authorization.
> Before any later stage, use `long-horizon-development`,
> `using-superpowers`, `brainstorming`, `writing-plans`,
> `test-driven-development`, `verification-before-completion`, and
> `requesting-code-review`; use `systematic-debugging` before any retry after
> a failure.

**Goal:** Formalize a future, tenant- and campus-scoped content lifecycle with
versioned drafts, publication transitions, and a public published projection,
then stop at the project-owner review gate.

**Architecture:** Task 05 will place content lifecycle policy in a focused API
module and expose a public projection route. A scoped repository owns version
checks and state transitions; the route receives trusted tenant/campus and
capability context from Tasks 03 and 04, and never accepts client scope or
publication claims as authority. Publication audit events are emitted through
an interface boundary; durable Task 17 audit infrastructure is excluded.

**Tech Stack:** Fastify 5.12.1, Node.js 24.14.0, Corepack pnpm 11.22.0
offline, TypeScript 5.7.3, the existing workspace packages, and the Node test
runner. No new runtime dependency is authorized by this Stage A plan.

## Current status and fixed anchors

```text
TASK_ID=PHASE_1B_TASK_05
TASK_NAME=CONTENT_AND_PUBLISHING_MODEL
SOURCE_BRANCH=feature/phase-1b-task-04-identity-membership
SOURCE_HEAD=c20d12d3982e065db4bcba368e6e85319ad1839e
GOVERNANCE_AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V2.md
GOVERNANCE_AUTHORITY_SHA256=5C9FA63960F47AC3986C18D36069D395086A2E7C4FD23A56412D5232589299AA
TASK04_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md
TASK04_ACCEPTANCE_SHA256=113870DB0895145A183740F1B97D2F4102E3D6EEC4806A12A017C41C7CAE4202
TASK04_ACCEPTANCE=PROJECT_OWNER_ACCEPTANCE=PASS|TASK_04_STARTED=YES|TASK_04_IMPLEMENTATION_AUTHORIZATION=GRANTED|TASK_05_STARTED=NO
ACTIVE_GOVERNANCE=PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_04_ONLY|TASK_04_STARTED=YES|TASK_04_IMPLEMENTATION_AUTHORIZATION=GRANTED|TASK_05_STARTED=NO|TASK_05_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
DEPENDENCIES=T02 -> T04
TASK_05_STARTED=NO
TASK_05_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
STATUS=OWNER_REVIEW_GATE
STOP_REASON=WAITING_FOR_PROJECT_OWNER_REVIEW_OF_TASK05_STAGE_A
```

The Task 04 acceptance remains read-only frozen evidence. The owner-approved
V2 authority reconciles its status for current active governance without
rewriting that acceptance record. This Task 05 owner instruction authorizes
only Stage A formalization. No Stage B implementation may begin.

## Lifecycle

```text
STAGE_A=CREATE_ONLY_THE_TASK05_CONTRACT_AND_THIS_PLAN
STAGE_A_FORMAT_GATE=CHECK_ONLY_EXISTING_TASK05_CONTRACT_AND_PLAN
STAGE_B=FUTURE_IMPLEMENTATION_AND_VERIFICATION_AFTER_STABLE_RECONCILIATION_AND_SEPARATE_AUTHORIZATION
STAGE_C1=FUTURE_REVIEW_MANIFEST_AND_ZIP_AFTER_STAGE_B
OWNER_REVIEW_GATE=AFTER_STAGE_C1_BEFORE_ACCEPTANCE
STAGE_C2=FUTURE_ACCEPTANCE_RECORD_ONLY_AFTER_EXPLICIT_OWNER_PASS
```

This Stage A execution must not inspect future files as required gates, create
implementation code or tests, update dependencies, start a service, or create
review, manifest, ZIP, or acceptance evidence.

## Exact file boundaries

### Stage A

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_05_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_05_PLAN.md
```

Only these two files may be created in this stage. They must be UTF-8 without
BOM, LF-only, and contain exactly one trailing LF. They must not contain their
own SHA-256 values.

### Future Stage B proposed whitelist

```text
NEW_TASK05_FILES=apps/api/src/modules/content/content.service.ts|apps/api/src/modules/content/content.repository.ts|apps/api/src/routes/public-content.route.ts|apps/api/src/modules/content/content.test.ts|scripts/verify_task_05.mjs
ACTIVE_SHARED_FILES=apps/api/src/server.ts|apps/api/package.json|packages/contracts/src/index.ts|packages/contracts/package.json|package.json|pnpm-lock.yaml|tests/contracts/package-boundaries.test.mjs|tests/workspace/paths.test.mjs
FROZEN_FILES=PHASE_1B_TASK_04_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_04_PLAN.md|docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md|scripts/verify_task_03.mjs|SHA256SUMS_PHASE_1B_TASK_03.txt|SHA256SUMS_PHASE_1B_TASK_04.txt|docs/reviews/PHASE_1B_TASK_03_REVIEW.md|docs/reviews/PHASE_1B_TASK_04_REVIEW.md|artifacts/review-package/student-care-platform-phase1b-task-03-review-pack-v1.0.zip|artifacts/review-package/student-care-platform-phase1b-task-04-review-pack-v1.0.zip|docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md|docs/project/PHASE_1B_TASK_02_ACCEPTANCE.md|docs/project/PHASE_1B_TASK_03_ACCEPTANCE.md|docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V1.md
```

The future whitelist is exact and bounded. If implementation inspection shows
that another path is necessary, implementation must stop and obtain a new
stable contract before touching that path. No wildcard or implicit file
authorization is granted. The existing Task 04 C1 files remain untracked
evidence and must not be modified, moved, deleted, or added to a Task 05
commit.

### Future Stage C1 and C2

```text
STAGE_C1_EXACT_FILES=docs/reviews/PHASE_1B_TASK_05_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_05.txt|artifacts/review-package/student-care-platform-phase1b-task-05-review-pack-v1.0.zip
STAGE_C2_EXACT_FILES=docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
STAGE_C2_POLICY=CREATE_ONLY_AFTER_EXPLICIT_PROJECT_OWNER_PASS|SEPARATE_COMMIT|RECORD_ACTUAL_STAGE_B_COMMIT_AND_FINAL_STAGE_C1_SHAS|NEVER_PREWRITE
```

## Domain design

### Content identity and versions

Each content stream has a server-defined `tenantId`, optional server-defined
`campusId`, a stable public content key, and a monotonic version. A draft
version contains editable internal fields and a lifecycle state. A published
version is immutable from the perspective of public reads. Unpublish changes
public visibility through an explicit state transition; it does not expose the
previous draft or silently select an older version.

The repository must preserve:

```text
CONTENT_KEY=(tenantId,campusIdOrGlobalScope,contentKey)
VERSION_RULE=MONOTONIC_SERVER_VERSION_PER_CONTENT_KEY
STATE_RULE=DRAFT|PUBLISHED|UNPUBLISHED
PUBLIC_SELECTION=EXACTLY_ONE_CURRENT_PUBLISHED_VERSION_OR_EMPTY
SCOPE_SOURCE=TRUSTED_TASK03_SCOPE_PLUS_TASK04_AUTHORIZATION_CONTEXT
```

The plan does not authorize a database schema or migration. A future
implementation may use the existing approved repository seam or an in-memory
synthetic adapter only if its stable contract explicitly authorizes that
choice.

### Commands and concurrency

The implementation must define these operations with explicit input and
output types:

```text
CREATE_DRAFT(scopedIdentity,draftPayload,createOrExpectedVersion)
UPDATE_DRAFT(scopedIdentity,draftPayload,expectedCurrentVersion)
PUBLISH(scopedIdentity,expectedCurrentVersion,actorContext)
UNPUBLISH(scopedIdentity,expectedCurrentVersion,actorContext)
READ_PUBLIC(serverResolvedScope,publicContentKey)
```

`PUBLISH` and `UNPUBLISH` compare the expected version with the server version
before changing state. A mismatch returns the existing denial/error envelope,
does not mutate content, and does not emit a successful publication event.
Foreign tenant, foreign campus, absent scope, inactive membership, and
insufficient capability all fail closed before a repository write.

### Public projection

The public route returns only the allowlisted public projection of the current
published version. It returns an empty/not-found public result when no
published version exists. It never returns a draft, invited/suspended/revoked
membership detail, editor note, moderation field, internal actor reference,
concurrency token, tenant administration field, campus administration field, or
unpublished asset reference.

The route must derive scope from the server request context. Client-supplied
tenant, campus, role, publication state, or version values are treated as
untrusted filters or rejected; they never expand authorization.

### Publication audit event

Each successful publish and unpublish transition emits exactly one event:

```text
PUBLICATION_AUDIT_EVENT=(eventType,tenantId,campusIdOrGlobalScope,contentKey,resultingVersion,actorReference,eventTime)
EVENT_RULE=EMIT_AFTER_SUCCESSFUL_STATE_TRANSITION_WITHOUT_DURABLE_TASK17_IMPLEMENTATION
DENIAL_RULE=NO_SUCCESS_EVENT_FOR_DENIED_OR_STALE_COMMAND
```

The event interface is testable and provider-independent. Durable storage,
retention, search, export, and the complete audit trail belong to Task 17 and
are excluded.

## Security and synthetic data rules

- Accept only trusted server-side identity, membership, capability, tenant,
  and campus context from Tasks 03 and 04.
- Derive tenant and campus scope on the server; reject foreign or disallowed
  scope without revealing whether another tenant's content exists.
- Require an active membership and the minimum capability for draft,
  publish, and unpublish commands.
- Public reads expose published content only and never leak administrative or
  draft fields.
- Use obvious synthetic fixtures such as `tenant-demo-a`, `campus-demo-1`,
  and `content-demo-001`; do not use real names, phone numbers, addresses,
  student records, credentials, tokens, keys, or copied production data.
- Do not add real login, external identity providers, cloud APIs, services,
  databases, migrations, payment, formal AI, or Task 06+ behavior.
- Do not install or update dependencies, access a registry, or use the
  network. An offline lockfile change would require a separate explicit
  authorization and reproducibility evidence.

## Future TDD and verification sequence

No future command is run during this Stage A execution. After separate
authorization, execute the sequence below and record actual exit codes.

### Red

1. Add policy tests for draft ownership scope, active membership,
   foreign-tenant denial, foreign/disallowed-campus denial, and capability
   denial.
2. Add version tests for stale create/update/publish/unpublish attempts,
   state preservation, and no-event-on-denial.
3. Add public route tests for unpublished absence, published projection,
   field exclusion, and server-derived scope.
4. Add regression tests for Task 04 auth composition, Task 03 scope
   derivation, the existing denial envelope, and `/health`.

### Green

1. Implement the smallest repository and service policy for scoped content
   versions and state transitions.
2. Implement the public route using the allowlisted projection.
3. Wire only the authorized shared entry points and preserve existing routes.
4. Implement a test spy for publication audit events without Task 17
   persistence.

### Refactor and regression

Run the focused tests again, then the existing contracts, validation, tenant,
API, workspace, and package-boundary suites. Confirm that all deny branches
remain fail closed and changed server-module coverage is 100 percent.

### Exact future gates

```text
VERIFICATION_COMMANDS=corepack pnpm typecheck|corepack pnpm lint|corepack pnpm format:check|corepack pnpm test|corepack pnpm test:coverage|corepack pnpm build|node scripts/verify_task_05.mjs --mode=structure|node scripts/verify_task_05.mjs --mode=final-review
TASK04_REGRESSION_COMMANDS=TO_BE_RENDERED_FROM_EXISTING_PACKAGE_SCRIPTS_AND_TASK04_VERIFIER_WITHOUT_RUNNING_HISTORICAL_TASK03_VERIFIER_AS_CURRENT_HEAD_GATE
SECURITY_SCAN_COMMANDS=TO_BE_RENDERED_FROM_EXISTING_LOCAL_NODE_TOOLS_FOR_REAL_DATA_SECRET_NETWORK_TASK06_PLUS_AND_PUBLIC_FIELD_LEAKAGE
STAGE_C1_FORMAT_GATE=AFTER_GENERATION_CHECK_REVIEW_TEXT_AND_VALIDATE_MANIFEST_DETERMINISTICALLY|ZIP_HASH_MEMBER_ORDER_AND_CONTENT_ONLY
STAGE_C2_FORMAT_GATE=AFTER_OWNER_PASS_CHECK_ACCEPTANCE_RECORD
```

The first command group is a future Stage B acceptance gate, not a Stage A
requirement. Exact additional shell composition must be rendered from the
actual package scripts and local verifier when Stage B is separately
authorized; this plan does not invent a command output or claim a future
pass.

## Acceptance and stop criteria

Stage B can be considered internally complete only when all of the following
are evidenced: versioned draft behavior, publish/unpublish transitions,
published-only public projection, tenant/campus isolation, stale-version
fail-closed behavior, exactly one publication audit event per successful
transition, no public field leakage, synthetic-only fixtures, full regression
coverage, and successful structure/final-review verifier modes.

Stage C1 must generate only its three exact evidence files, validate review
text and deterministic manifest, validate ZIP binary members and hashes, and
stop at the owner review gate. Stage C2 may create only its acceptance file
after explicit owner PASS and must use a separate commit.

Stop immediately on governance-anchor drift, a non-whitelist path, frozen
evidence drift, a security or secret finding, real data, network or registry
use, dependency installation, service/database/migration work, a failed
verification command, or an attempt to enter a later stage without its
authorization. Do not reset, clean, restore, checkout, rebase, amend, or
silently repair unrelated user changes.

## Stage A completion boundary

This Stage A action creates only the two files listed in
`STAGE_A_EXACT_FILES`. It does not create a receipt, hash manifest, review,
ZIP, acceptance record, branch, worktree, goal, implementation, test, or
dependency change. The current status is `OWNER_REVIEW_GATE` because Stage A
formalization is complete and awaits project-owner review. Stop with
`STOP_REASON=WAITING_FOR_PROJECT_OWNER_REVIEW_OF_TASK05_STAGE_A`; no Task 05
Stage B request may proceed before separate implementation authorization.
