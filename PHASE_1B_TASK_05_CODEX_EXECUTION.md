# Phase 1B Task 05 Codex Execution Contract

This is the Phase 1B Task 05 execution contract for Content and Publishing
Model. It records the Stage A formalization, the separately authorized Stage B
implementation, the Stage C1 evidence boundary, and the separately authorized
Stage C2 acceptance. It does not authorize Task 06 or any later task.

## Contract status and authority

```text
TASK_ID=PHASE_1B_TASK_05
TASK_NAME=CONTENT_AND_PUBLISHING_MODEL
TASK_STATUS=STAGE_C2_ACCEPTED_AND_FROZEN
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
SOURCE_BRANCH=feature/phase-1b-task-04-identity-membership
SOURCE_HEAD=5cf293d13f764517a13f8ce25c379cbbf2b38ebd
OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_EXPLICIT_TASK05_STAGE_B_AND_STAGE_C1_AUTHORIZATION_2026-09-02
OWNER_AUTHORIZATION_STABILITY=CHAT_AUTHORIZATION_IS_NOT_A_STABLE_GOVERNANCE_SHA
GOVERNANCE_AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V4.md
GOVERNANCE_AUTHORITY_SHA256=11FD81FB5E9738B36F7EB495424F9D4161F6F5172DFDBA564BE1D5F0FD88DB5E
TASK_04_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md
TASK_04_ACCEPTANCE_SHA256=113870DB0895145A183740F1B97D2F4102E3D6EEC4806A12A017C41C7CAE4202
TASK_04_ACCEPTANCE_STATUS=PROJECT_OWNER_ACCEPTANCE_PASS|TASK_04_STARTED=YES|TASK_04_IMPLEMENTATION_AUTHORIZATION=GRANTED
ACTIVE_GOVERNANCE_STATUS=PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_05_ONLY|TASK_04_STARTED=YES|TASK_04_IMPLEMENTATION_AUTHORIZATION=GRANTED|TASK_05_STARTED=YES|TASK_05_IMPLEMENTATION_AUTHORIZATION=GRANTED|TASK_05_STAGE_C1_STATUS=FINAL_EVIDENCE_READY|TASK_05_STAGE_C2_STATUS=ACCEPTED|TASK_05_OWNER_REVIEW=ACCEPTED_AND_FROZEN|TASK_06_STARTED=NO|TASK_06_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_05_STARTED=YES
TASK_05_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_05_GOAL_AUTHORIZATION=NOT_GRANTED
TASK_05_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_05_STAGE_C1_STATUS=FINAL_EVIDENCE_READY
TASK_05_STAGE_C2_STATUS=ACCEPTED
TASK_05_STAGE_C2_AUTHORIZATION=OWNER_CONFIRMED_2026-09-02
TASK_05_ACCEPTANCE_RECORD=docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
TASK_05_ACCEPTANCE_SHA256=640BCF9B2B5C33ED1499E1F5C35E58608872953DCF0059A33086312FC260ECDD
TASK_05_OWNER_REVIEW=ACCEPTED_AND_FROZEN
TASK_06_STARTED=NO
TASK_06_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
STATUS=ACCEPTED_STOP_BEFORE_TASK06
STOP_REASON=TASK05_C2_ACCEPTED_STOP_BEFORE_TASK06
```

The Task 04 acceptance record remains frozen evidence. The owner-approved V4
authority reconciles current active governance without rewriting the Task 04 or
Task 05 acceptance records. Task 05 Stage B was separately authorized and is
represented by the implementation and support commits recorded below. Stage C1
evidence was reviewed, and the separate Stage C2 acceptance record is now
accepted and frozen. Task 06 remains unauthorized.

## Dependency and scope contract

```text
DEPENDENCIES=T02 -> T03 -> T04
DEPENDENCY_PLAN_EVIDENCE=docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md:T05
DEPENDENCY_IMPLEMENTATION_PLAN_EVIDENCE=docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md:Task_05
DEPENDENCY_ACCEPTANCE_REQUIREMENT=T02_AND_T03_ACCEPTED_AND_T04_C2_ACCEPTED_WITH_RECONCILED_ACTIVE_GOVERNANCE
GOAL=VERSIONED_DRAFT|PUBLISH|UNPUBLISH|PUBLIC_READ_PROJECTION|TENANT_SCOPE|CAMPUS_SCOPE|STALE_VERSION_DENIAL|PUBLICATION_AUDIT_EVENT
PUBLIC_READ_POLICY=ONLY_PUBLISHED_VERSION_IS_VISIBLE
DRAFT_VISIBILITY=PRIVATE_TO_AUTHORIZED_INTERNAL_SCOPE
FOREIGN_TENANT_POLICY=FAIL_CLOSED
STALE_VERSION_POLICY=FAIL_CLOSED
PUBLIC_PROJECTION_POLICY=EXPLICIT_ALLOWLIST_WITH_NO_INTERNAL_DRAFT_OR_ADMIN_FIELDS
PUBLIC_API_DTO_POLICY=PUBLIC_PROJECTION_TYPES_ONLY_IN_PUBLIC_CONTRACT_SURFACE
```

Task 05 builds on the trusted identity and membership inputs of Task 04 and
the tenant/campus scope derivation of Tasks 02 and 03. It must not infer
authorization from a client tenant, campus, role, version, or publication
claim.

The content model uses a logical content identity scoped by tenant and, where
applicable, campus. A draft version is mutable only through an authorized
internal command. Publishing and unpublishing are explicit state transitions
guarded by the current version. A public read resolves the latest eligible
published version for the server-derived tenant/campus scope and projects only
the public fields. A stale expected version denies the command without applying
the transition.

Every successful publish or unpublish transition emits one publication audit
event containing the scoped content identity, transition, resulting version,
actor reference, and event time supplied by the application boundary. A denied
or stale command does not emit a successful publication event. Audit
persistence, retention, export, and the full Task 17 audit trail remain out of
scope.

## Security and data boundaries

```text
TRUST_BOUNDARY=SERVER_DERIVES_IDENTITY_TENANT_AND_CAMPUS_FROM_TASK04_AND_TASK03_CONTEXT
CLIENT_CLAIM_POLICY=CLIENT_TENANT_CAMPUS_ROLE_PUBLICATION_AND_VERSION_CLAIMS_ARE_UNTRUSTED
AUTHORIZATION_POLICY=ACTIVE_MEMBERSHIP_AND_MINIMUM_CAPABILITY_REQUIRED_FOR_INTERNAL_COMMANDS
PUBLIC_READ_AUTH_POLICY=PUBLIC_PROJECTION_MAY_BE_READ_ONLY_WHEN_TARGET_SCOPE_IS_RESOLVED_SERVER_SIDE
PLATFORM_ADMIN_POLICY=NO_DEFAULT_ACCESS_TO_STUDENT_SPECIFIC_CONTENT
SYNTHETIC_DATA_POLICY=ONLY_OBVIOUSLY_FICTITIOUS_NON_PERSONAL_FIXTURES
REAL_DATA_POLICY=NO_REAL_NAMES_PHONE_NUMBERS_ADDRESSES_STUDENT_RECORDS_PHOTOS_OR_FAMILY_DATA
SECRET_POLICY=NO_PASSWORDS_COOKIES_TOKENS_KEYS_PRODUCTION_CONFIGURATION_OR_REAL_CREDENTIALS
PROVIDER_POLICY=NO_REAL_LOGIN_WECHAT_SMS_OAUTH_OIDC_OR_EXTERNAL_IDENTITY_PROVIDER
PERSISTENCE_POLICY=NO_PRODUCTION_DATABASE_SCHEMA_OR_MIGRATION
NETWORK_POLICY=NO_NETWORK_REGISTRY_EXTERNAL_SERVICE_OR_CLOUD_REQUEST
DEPENDENCY_POLICY=NO_NEW_EXTERNAL_RUNTIME_DEPENDENCY
INSTALL_POLICY=NO_DEPENDENCY_INSTALL_OR_LOCKFILE_UPDATE_IN_STAGE_A
CRYPTO_POLICY=NO_CUSTOM_CRYPTOGRAPHY_AND_NO_REAL_TOKEN_ISSUANCE
```

Unsafe or non-public fields must never cross the public projection boundary.
Examples include draft body, editor notes, internal moderation fields,
membership details, actor identifiers not explicitly public, tenant
administrative metadata, campus administration metadata, unpublished media
references, and concurrency tokens.

## Lifecycle and exact file boundaries

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_05_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_05_PLAN.md
STAGE_A_AUTHORIZATION=OWNER_AUTHORIZED_FORMALIZATION_COMPLETED
STAGE_A_FORMAT_GATE=CHECK_ONLY_THE_TWO_EXISTING_STAGE_A_TEXT_FILES
STAGE_B_NEW_FILES=apps/api/src/modules/content/content.service.ts|apps/api/src/modules/content/content.repository.ts|apps/api/src/routes/public-content.route.ts|apps/api/src/modules/content/content.test.ts|scripts/verify_task_05.mjs
STAGE_B_ACTIVE_SHARED_FILES=apps/api/src/server.ts|apps/api/package.json|packages/contracts/src/index.ts|packages/contracts/package.json|package.json|pnpm-lock.yaml|tests/contracts/package-boundaries.test.mjs|tests/workspace/paths.test.mjs
STAGE_B_FROZEN_FILES=PHASE_1B_TASK_04_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_04_PLAN.md|PHASE_1B_TASK_04_ACCEPTANCE.md|docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md|scripts/verify_task_03.mjs|SHA256SUMS_PHASE_1B_TASK_03.txt|SHA256SUMS_PHASE_1B_TASK_04.txt|docs/reviews/PHASE_1B_TASK_03_REVIEW.md|docs/reviews/PHASE_1B_TASK_04_REVIEW.md|artifacts/review-package/student-care-platform-phase1b-task-03-review-pack-v1.0.zip|artifacts/review-package/student-care-platform-phase1b-task-04-review-pack-v1.0.zip|docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md|docs/project/PHASE_1B_TASK_02_ACCEPTANCE.md|docs/project/PHASE_1B_TASK_03_ACCEPTANCE.md|docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V2.md
STAGE_C1_EXACT_FILES=docs/reviews/PHASE_1B_TASK_05_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_05.txt|artifacts/review-package/student-care-platform-phase1b-task-05-review-pack-v1.0.zip
STAGE_C2_EXACT_FILES=docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
OWNER_REVIEW_GATE=after_StageC1_evidence_before_StageC2_acceptance
ACCEPTANCE_RECORD_POLICY=CREATE_ONLY_AFTER_EXPLICIT_PROJECT_OWNER_PASS|RECORD_ACTUAL_STAGE_B_COMMIT_AND_FINAL_STAGE_C1_SHAS|SEPARATE_COMMIT|NEVER_PREWRITE
COMMIT_BOUNDARIES=StageA_contract_formalization|StageB_implementation_verification|StageC1_final_evidence|OWNER_REVIEW_GATE|StageC2_acceptance_record_only
```

The Stage B list is the exact whitelist used by the separately authorized
implementation. The existing Task 04 Stage A and C2 files, Task 01-04
historical evidence, and the existing Task 04 C1 files remain frozen and were
not changed by Task 05. The Stage C1 ZIP must use the
`student-care-platform-*` naming convention.

Stage C2 remains unauthorized until an explicit project-owner PASS after C1.
An acceptance record must never be prewritten into Stage B or C1 evidence.

## Implemented Stage B contract

The Stage B service boundary provides exact operations equivalent to:

```text
CREATE_DRAFT=(scopedContentIdentity, draftPayload, expectedVersionOrCreate)
UPDATE_DRAFT=(scopedContentIdentity, draftPayload, expectedCurrentVersion)
PUBLISH=(scopedContentIdentity, expectedCurrentVersion, actorContext)
UNPUBLISH=(scopedContentIdentity, expectedCurrentVersion, actorContext)
READ_PUBLIC=(serverResolvedTenantId, serverResolvedCampusId, publicContentKey)
```

The repository must enforce tenant and campus scope before returning or
mutating a content record. `PUBLISH` and `UNPUBLISH` must use optimistic
concurrency: the expected version must equal the server version, otherwise
the operation returns the existing denial envelope and leaves state unchanged.
The public reader must never fall back to a draft when no published version
exists. If a campus-independent content type is later needed, that exact
scope rule must be named in the stable implementation contract rather than
inferred from a client request.

Public DTOs must contain only the approved public projection: stable public
content identity, published version, display-safe content blocks, and
explicitly public publication metadata. Internal draft fields and
administrative fields are excluded by construction and tested with exact
object-shape assertions.

## Acceptance criteria and evidence

```text
ACCEPTANCE_01=VERSIONED_DRAFTS_PRESERVE_VERSION_AND_SCOPE
ACCEPTANCE_02=PUBLISH_REQUIRES_ACTIVE_AUTHORIZED_MEMBERSHIP_AND_CURRENT_VERSION
ACCEPTANCE_03=UNPUBLISH_REQUIRES_ACTIVE_AUTHORIZED_MEMBERSHIP_AND_CURRENT_VERSION
ACCEPTANCE_04=STALE_VERSION_DENIAL_IS_FAIL_CLOSED_AND_STATE_PRESERVING
ACCEPTANCE_05=PUBLIC_READ_RETURNS_PUBLISHED_PROJECTION_ONLY
ACCEPTANCE_06=DRAFT_AND_UNPUBLISHED_CONTENT_ARE_NOT_PUBLIC
ACCEPTANCE_07=FOREIGN_TENANT_AND_FOREIGN_OR_DISALLOWED_CAMPUS_ARE_DENIED
ACCEPTANCE_08=EVERY_SUCCESSFUL_PUBLICATION_STATE_TRANSITION_EMITS_ONE_AUDIT_EVENT
ACCEPTANCE_09=PUBLIC_PROJECTION_EXCLUDES_INTERNAL_DRAFT_AND_ADMIN_FIELDS
ACCEPTANCE_10=SYNTHETIC_FIXTURES_CONTAIN_NO_REAL_PERSONAL_DATA_OR_SECRETS
ACCEPTANCE_11=TASK04_SCOPE_HEALTH_AND_EXISTING_WORKSPACE_BOUNDARIES_REGRESS
ACCEPTANCE_12=STAGE_C1_EVIDENCE_PRECEDES_OWNER_PASS_AND_STAGE_C2_ACCEPTANCE
```

Required evidence consists of the actual changed-file list, deterministic
file hashes, text encoding checks, test and verifier output, scope and
security scans, Stage C1 review/manifest/ZIP evidence, and a separately
authorized Stage C2 acceptance record. Stage C1 evidence is present in its
three exact paths; the Stage C2 acceptance record is present at its exact path
and is frozen as the owner decision.

## Verification contract

```text
STAGE_A_VERIFICATION=FORMAT_AND_HASH_ONLY_FOR_THE_TWO_STAGE_A_FILES|READ_ONLY_GIT_STATUS|NO_FUTURE_FILE_REQUIREMENT
STAGE_B_TDD_ORDER=CONTENT_POLICY_RED|CONTENT_POLICY_GREEN|PUBLIC_ROUTE_RED|PUBLIC_ROUTE_GREEN|STALE_VERSION_REGRESSION|SCOPE_REGRESSION|SECURITY_REGRESSION|FULL_VERIFICATION
STAGE_B_VERIFICATION_COMMANDS=corepack pnpm typecheck|corepack pnpm lint|corepack pnpm format:check|corepack pnpm test|corepack pnpm test:coverage|corepack pnpm build|node scripts/verify_task_05.mjs --mode=structure|node scripts/verify_task_05.mjs --mode=final-review
STAGE_B_TEST_COVERAGE=ALL_DENY_BRANCHES_AND_CHANGED_SERVER_MODULES_100_PERCENT
STAGE_B_SECURITY_SCANS=REAL_DATA|SECRET|NETWORK|TASK06_PLUS|PUBLIC_PROJECTION_FIELD_LEAKAGE
TASK04_REGRESSION=AUTH_MEMBERSHIP_SCOPE|TENANT_SCOPE|CAMPUS_SCOPE|HEALTH|CONTRACTS|VALIDATION|WORKSPACE_PATHS|PACKAGE_BOUNDARIES
TASK05_FROZEN_EVIDENCE_CHECK=VERIFY_TASK04_ACCEPTANCE_AND_C1_EVIDENCE_HASHES_WITHOUT_REWRITING_OR_REPACKAGING
```

The command group above is the recorded Stage B acceptance gate. Stage B and
Stage C1 verification was executed and is summarized in the C1 review. Stage C2
was separately authorized after owner PASS and recorded in the acceptance file;
no Task 06 or later task is authorized by that record.

## Stop conditions

```text
STOP_ON=GOVERNANCE_CONFLICT|ANCHOR_DRIFT|NON_WHITELIST_CHANGE|FROZEN_EVIDENCE_DRIFT|REAL_DATA|SECRET|NETWORK|REGISTRY|DEPENDENCY_INSTALL|SERVICE|DATABASE|MIGRATION|TASK06_PLUS|STAGE_C1_OR_C2_WRITE|VERIFICATION_FAILURE
ROLLBACK_POLICY=DO_NOT_RESET_CLEAN_RESTORE_CHECKOUT_REBASE_OR_AMEND|PRESERVE_ACTUAL_STATE|SEPARATE_OWNER_APPROVAL_REQUIRED_FOR_ANY_REVERT
OWNER_APPROVAL_REQUIRED=YES_FOR_GOVERNANCE_RECONCILIATION|TASK05_IMPLEMENTATION|STAGE_C1|STAGE_C2
```

The governance reconciliation is represented by the owner-approved V4
authority and its atomic active references. The current stop point is after
Task 05 Stage C2 acceptance and before Task 06 Stage A; preserve all evidence,
do not start Task 06 or later tasks from this document.
