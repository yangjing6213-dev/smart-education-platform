# Phase 1B Task 04 Codex Execution Contract

This is the stable Stage A formalization contract for Phase 1B Task 04. It
formalizes a future identity and internal employee login foundation without
starting Task 04 implementation. This file does not contain its own SHA-256;
its exact-file digest is recorded only in the external execution receipt.

## Canonical manifest

```text
CANONICAL_MANIFEST_FORMAT=PHASE_1B_TASK_04_CANONICAL_CONTRACT_V2_2_RENDERED_STAGE_A
CANONICALIZATION_RULE=THE_COMPLETE_TEXT_BLOCK_FROM_CANONICAL_MANIFEST_FORMAT_THROUGH_STOP_CONDITIONS_IS_UTF8_NO_BOM_LF_EXACTLY_ONE_TRAILING_LF_AND_IS_HASHED_ONLY_IN_AN_EXTERNAL_RECEIPT
TASK_ID=PHASE_1B_TASK_04
TASK_NAME=IDENTITY_AND_INTERNAL_EMPLOYEE_LOGIN_FOUNDATION
TASK_STATUS=STAGE_A_FORMALIZED_PENDING_OWNER_REVIEW
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
SOURCE_BRANCH=feature/phase-1b-task-03-tenant-campus-scope
SOURCE_HEAD=af9219def7fab5b68f7b9c611cc5a6fb0e1822c2
TARGET_BRANCH=feature/phase-1b-task-04-identity-membership
GOVERNANCE_AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V1.md
GOVERNANCE_AUTHORITY_SHA256=FD9DC8D4FA11222B70ED549818C431FD12B7E87B0F045EFAE856991EE008F051
V2_2_DRAFT_STATUS=READY_FOR_OWNER_REVIEW
V2_2_EXTERNAL_JSON_SHA256=6B5DC5603D288B186AD5EA46361C263D3DBDC8C231E854C074F2F25AC352E5ED
V2_2_CANONICAL_SHA256=2B12E3121C7EB786CFC40CE0FC3680DE5EB0D91DB1A12E61ED241F5A3D2EC27E
CONTRACT_SHA256_RECORDING=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
PLAN_SHA256_RECORDING=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
TASK_04_STARTED=NO
TASK_04_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_04_GOAL_AUTHORIZATION=NOT_GRANTED
DEPENDENCIES=T02 -> T03
DEPENDENCY_ACCEPTANCE_EVIDENCE=TASK_02_AND_TASK_03_ARE_FROZEN_ACCEPTED_PREREQUISITES
LONG_HORIZON_DEVELOPMENT_REQUIRED=YES
SUPERPOWERS_REQUIRED=using-superpowers|brainstorming|writing-plans|test-driven-development|verification-before-completion|requesting-code-review
SYSTEMATIC_DEBUGGING_REQUIRED_ON_ANY_FAILURE=YES
PUBLIC_API_DTOS=@student-care/contracts
INTERNAL_AUTH_POLICY_TYPES=@student-care/auth
MEMBERSHIPS_ROUTE=ACTIVE_ONLY
TASK_03_VERIFIER=HISTORICAL_FROZEN
ACTIVE_ROOT_VERIFIER=TASK_04_AWARE
PHASE_1B_API_FRAMEWORK=FASTIFY_5.12.1
PHASE_1B_NODE_VERSION=24.14.0
RUNTIME_PROJECT_PNPM=11.22.0_VIA_COREPACK_OFFLINE
GLOBAL_PNPM=11.19.0_NON_AUTHORITATIVE
PNPM_VERSION_BLOCKER=NO
TRUST_BOUNDARY=SERVER_ACCEPTS_ONLY_TRUSTED_AUTHENTICATION_RESULTS_AND_SERVER_RESOLVED_MEMBERSHIPS
SESSION_POLICY=MISSING|EXPIRED|REVOKED|FORGED_SESSION_FAILS_CLOSED
MEMBERSHIP_POLICY=ACTIVE_IS_REQUIRED_FOR_ACCESS|SUSPENDED_AND_REVOKED_FAIL_CLOSED|INVITED_IS_NOT_RETURNED_BY_MEMBERSHIPS_ROUTE
TENANT_POLICY=ACTIVE_MEMBERSHIP_MUST_MATCH_TARGET_TENANT|CLIENT_TENANT_CLAIMS_ARE_UNTRUSTED
CAMPUS_POLICY=SERVER_DERIVES_ALLOWED_CAMPUSES_FROM_ACTIVE_MEMBERSHIP|CLIENT_CAMPUS_CLAIMS_ARE_UNTRUSTED
CAPABILITY_POLICY=MINIMUM_CAPABILITIES_DERIVE_FROM_SERVER_POLICY|FORGED_CLIENT_ROLE_CLAIMS_FAIL_CLOSED
ERROR_POLICY=UNAUTHENTICATED_OR_INVALID_SESSION_IS_DENIED|MISSING_OR_INACTIVE_MEMBERSHIP_IS_DENIED|TENANT_OR_CAMPUS_SCOPE_DENIAL_USES_THE_EXISTING_TASK_03_SCOPE_ENVELOPE
PLATFORM_ADMIN_POLICY=NO_DEFAULT_STUDENT_SPECIFIC_CONTENT_ACCESS
SYNTHETIC_DATA_POLICY=ONLY_OBVIOUSLY_FICTITIOUS_NON_PERSONAL_TEST_FIXTURES|NO_REAL_ACCOUNTS_PHONE_NUMBERS_PASSWORDS_COOKIES_TOKENS_OR_KEYS
NETWORK_POLICY=NO_PROVIDER_REQUESTS_NO_REGISTRY_NO_EXTERNAL_APPLICATION_OR_TEST_REQUESTS
SECRET_POLICY=NO_REAL_CREDENTIALS_TOKENS_COOKIES_KEYS_OR_PRODUCTION_CONFIGURATION
DEPENDENCY_POLICY=NO_NEW_EXTERNAL_RUNTIME_DEPENDENCIES|WORKSPACE_LINKS_ONLY_AFTER_SEPARATE_IMPLEMENTATION_AUTHORIZATION
INSTALL_POLICY=NO_INSTALL_OR_LOCKFILE_UPDATE_IN_STAGE_A|FUTURE_OFFLINE_ACTION_REQUIRES_EXPLICIT_APPROVAL
LOCKFILE_POLICY=STAGE_B_MAY_CHANGE_pnpm-lock.yaml_ONLY_WITH_EXPLICIT_IMPLEMENTATION_AUTHORIZATION_AND_OFFLINE_REPRODUCIBILITY_EVIDENCE
HISTORICAL_TASK_03_VERIFIER_POLICY=scripts/verify_task_03.mjs_AND_ITS_MANIFEST_REVIEW_ZIP_AND_ACCEPTANCE_ARE_FROZEN_HISTORICAL_EVIDENCE
ACTIVE_ROOT_VERIFIER_POLICY=FUTURE_ROOT_VERIFY_MUST_USE_scripts/verify_task_04.mjs_AND_MUST_NOT_REQUIRE_CURRENT_HEAD_TO_PASS_THE_HISTORICAL_TASK_03_VERIFIER
ACTIVE_SHARED_FILE_POLICY=ONLY_THE_EXACT_STAGE_B_ACTIVE_SHARED_FILE_LIST_MAY_EVOLVE_AFTER_SEPARATE_IMPLEMENTATION_AUTHORIZATION
FROZEN_EVIDENCE_POLICY=TASK_01_TO_TASK_03_AND_BATCH_A_BATCH_B_CONTRACTS_IMPLEMENTATION_TESTS_MANIFESTS_REVIEWS_ZIPS_ACCEPTANCE_AND_VALIDATORS_ARE_NOT_REWRITTEN
ROOT_SCRIPT_MIGRATION_POLICY=typecheck_and_build_include_@student-care/contracts_@student-care/validation_@student-care/tenant_@student-care/api_@student-care/auth|lint_includes_contracts_validation_tenant_api_auth|test_includes_contracts_validation_tenant_api_auth_and_active_workspace_boundary_tests|test_coverage_includes_auth_and_api_task04_deny_branches_and_active_boundary_tests|verify_ends_with_scripts/verify_task_04.mjs|format_check_in_stage_b_covers_only_existing_stage_a_and_stage_b_text_files|scripts/verify_task_03.mjs_is_not_modified
FORMAT_GATE_POLICY=StageA_after_render_check_only_existing_contract_and_plan|StageB_root_format_check_requires_only_existing_StageA_and_StageB_text_files|StageC1_after_generation_check_review_text_and_validate_manifest_deterministically|ZIP_is_binary_hash_and_member_validation_only_not_prettier|StageC2_after_owner_PASS_check_acceptance_record|no_stage_gate_requires_absent_future_stage_paths
STAGE_A_EXACT_FILES=PHASE_1B_TASK_04_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_04_PLAN.md
STAGE_B_NEW_FILES=packages/contracts/src/identity.ts|packages/contracts/test/identity.test.ts|packages/auth/package.json|packages/auth/tsconfig.json|packages/auth/src/index.ts|packages/auth/src/identity.ts|packages/auth/src/session.ts|packages/auth/src/membership-policy.ts|packages/auth/test/policy.test.ts|apps/api/src/plugins/auth.plugin.ts|apps/api/src/routes/me.route.ts|apps/api/src/routes/memberships.route.ts|apps/api/test/task04.routes.test.ts|scripts/verify_task_04.mjs
STAGE_B_ACTIVE_SHARED_FILES=packages/contracts/package.json|packages/contracts/src/index.ts|apps/api/package.json|apps/api/src/server.ts|package.json|pnpm-lock.yaml|tests/contracts/package-boundaries.test.mjs|tests/workspace/paths.test.mjs
STAGE_B_FROZEN_FILES=scripts/verify_task_03.mjs|PHASE_1B_TASK_03_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_03_PLAN.md|docs/project/PHASE_1B_TASK_03_ACCEPTANCE.md|docs/reviews/PHASE_1B_TASK_03_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_03.txt|artifacts/review-package/student-care-platform-phase1b-task-03-review-pack-v1.0.zip|apps/api/src/app.ts|pnpm-workspace.yaml|tsconfig.base.json|packages/contracts/src/errors.ts|packages/contracts/src/content.ts|packages/contracts/src/requests.ts|packages/contracts/test/schema.test.ts
STAGE_C1_EXACT_FILES=docs/reviews/PHASE_1B_TASK_04_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_04.txt|artifacts/review-package/student-care-platform-phase1b-task-04-review-pack-v1.0.zip
STAGE_C2_EXACT_FILES=docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md
OWNER_REVIEW_GATE=after_StageC1_evidence_before_StageC2_acceptance
ACCEPTANCE_RECORD_POLICY=create_only_after_explicit_project_owner_PASS|record_actual_StageB_implementation_commit_and_final_manifest_ZIP_SHAs|separate_commit|never_prewrite_or_claim_owner_acceptance
COMMIT_BOUNDARIES=StageA_contract_formalization|StageB_implementation_verification|StageC1_final_evidence|OWNER_REVIEW_GATE|StageC2_acceptance_record_only
STAGE_C2_AUTHORIZATION=NOT_AUTHORIZED_UNTIL_EXPLICIT_PROJECT_OWNER_PASS
BASELINE_REPRODUCTION_COMMANDS=node scripts/verify_task_03.mjs|node --test tests/contracts/package-boundaries.test.mjs
CURRENT_ROOT_VERIFICATION_STATUS=FAIL_BASELINE_REPRODUCED_IN_PRECONTRACT_AUDIT
CURRENT_ROOT_VERIFICATION_FAILURE_DISPOSITION=HISTORICAL_TASK_03_COMMITTED_BOUNDARY_AND_SHA_EVIDENCE_REMAINS_FROZEN|FUTURE_TASK_04_AWARE_ACTIVE_VERIFICATION_MIGRATES_SHARED_ROOT_SCRIPTS_AND_BOUNDARY_TESTS_WITHOUT_REWRITING_TASK_03_EVIDENCE
FUTURE_TASK04_VERIFICATION_COMMANDS=corepack pnpm typecheck|corepack pnpm lint|corepack pnpm format:check|corepack pnpm test|corepack pnpm test:coverage|corepack pnpm build|node scripts/verify_task_04.mjs --mode=structure|node scripts/verify_task_04.mjs --mode=final-review
TASK03_FROZEN_EVIDENCE_VERIFICATION=VERIFY_FIXED_SHA_AND_HISTORICAL_ANCHORS_OF_scripts/verify_task_03.mjs_TASK03_MANIFEST_REVIEW_ZIP_AND_ACCEPTANCE_WITHOUT_USING_THE_HISTORICAL_VERIFIER_AS_A_CURRENT_HEAD_PASS_GATE
TDD_ORDER=AUTH_POLICY_RED|AUTH_POLICY_GREEN|FASTIFY_ROUTE_RED|FASTIFY_ROUTE_GREEN|TASK03_SCOPE_REGRESSION|HEALTH_REGRESSION|WORKSPACE_BOUNDARY_REGRESSION|FULL_VERIFICATION
RED_TESTS=FORGED_ROLE_CLAIM|ABSENT_SESSION|EXPIRED_SESSION|REVOKED_SESSION|SUSPENDED_MEMBERSHIP|REVOKED_MEMBERSHIP|FOREIGN_TENANT_MEMBERSHIP|FOREIGN_OR_DISALLOWED_CAMPUS|UNAUTHENTICATED_ME|UNAUTHENTICATED_MEMBERSHIPS
GREEN_CRITERIA=SERVER_TRUSTED_IDENTITY_AND_ACTIVE_MEMBERSHIP_PRODUCE_PUBLIC_ME_DTO_AND_ACTIVE_ONLY_MEMBERSHIPS_DTO_WITH_TASK03_SCOPE_CONTEXT
REGRESSION_TESTS=TASK03_SCOPE|HEALTH|CONTRACTS|VALIDATION|TENANT|API|WORKSPACE_PATHS|PACKAGE_BOUNDARIES
COVERAGE_REQUIREMENT=ALL_AUTH_AND_CHANGED_API_DENY_BRANCHES_100_PERCENT|CHANGED_SERVER_MODULES_MEET_THE_FUTURE_APPROVED_COVERAGE_TARGET
EVIDENCE_REQUIREMENTS=STAGE_C1_REVIEW_MANIFEST_ZIP_AFTER_STAGE_B|OWNER_PASS_BEFORE_STAGE_C2_ACCEPTANCE
STOP_CONDITIONS=ANCHOR_DRIFT|NON_WHITELIST_CHANGE|REAL_DATA_OR_SECRET|NETWORK_OR_REGISTRY|DEPENDENCY_INSTALL|SERVICE|DATABASE_OR_MIGRATION|TASK05_PLUS_WORK|STAGE_C2_BEFORE_OWNER_PASS|ANY_VERIFICATION_FAILURE
ROLLBACK_POLICY=NO_RESET_NO_RESTORE_NO_CLEAN|REPORT_AND_PRESERVE_THE_ACTUAL_STATE|ANY_REVERT_REQUIRES_SEPARATE_OWNER_APPROVAL
OWNER_APPROVAL_REQUIRED=YES_FOR_GOAL_IMPLEMENTATION_STAGE_B_EVIDENCE_STAGE_C1_AND_STAGE_C2
TASK_05_STARTED=NO
```

## 1. Current authorization

The project owner authorized only this Stage A formalization. It creates the
two files named by `STAGE_A_EXACT_FILES` and nothing else. It does not start
Task 04, grant `/goal`, create the target branch, grant implementation
authorization, or authorize Stage B, Stage C1, or Stage C2.

Stage A's format gate checks only the two existing Stage A text files. It must
not require a future implementation file, review report, manifest, ZIP, or
acceptance record.

## 2. Future implementation boundary

After a separate owner authorization, `@student-care/contracts` may expose
only transport DTOs, public enums, and envelope composition types for `/me`
and `/memberships`. `@student-care/auth` owns trusted authentication results,
session state, membership policy, and capability policy. It must be pure,
provider-independent, and independent of real identity providers.

The identity adapter accepts only trusted server-side authentication results.
It must not trust client identity, role, tenant, or campus claims. Missing,
expired, revoked, or forged sessions fail closed. The authenticated identity
must hold an active membership for the target tenant; allowed campuses come
from that membership and server authorization, never from a client claim.

`/memberships` returns only memberships visible to the current identity with
status `ACTIVE`. Invited, suspended, and revoked membership details are not
returned. The future `/me` and `/memberships` routes deny unauthenticated,
no-membership, cross-tenant, and cross-campus requests. A platform
administrator gains no student-specific content access from this contract.

The Task 04 auth boundary must supply trusted identity and membership inputs
before the existing Task 03 scope plugin resolves tenant and campus context.
Task 03 retains scope derivation and its denial envelope; Task 04 retains
authentication, session, membership, and capability decisions.

## 3. Explicit non-scope

This Stage A contract does not authorize a real login flow, WeChat
authorization, SMS, OAuth, OIDC, a production identity provider, password
handling, custom cryptography, real token issuance, persistent sessions,
database schema or migration work, payment, Tencent Cloud, a client
application, formal AI, real personal data, production credentials, or Task
05 or later work.

Audit-event needs are limited to future interface and test boundaries. This
contract does not implement Task 17 or any audit persistence.

## 4. Lifecycle and evidence boundary

Stage B is a future implementation and verification phase only after separate
project-owner approval. It may use only the exact Stage B lists in the
canonical manifest. `packages/contracts/package.json` is an active shared
file because its test script must run both `schema.test` and the future
`identity.test`; its existing source modules and `schema.test` remain frozen.

Stage C1 is a later evidence phase. It first creates its exact review,
manifest, and ZIP paths, then checks review text formatting, manifest
determinism, and ZIP hash, members, and contents. The ZIP is binary evidence
and never passes through Prettier. Stage C1 stops at `OWNER_REVIEW_GATE`.

Only an explicit project-owner `PASS` may authorize Stage C2. The acceptance
record is a separate commit, records the actual Stage B implementation commit
and final manifest and ZIP hashes, and must never be written early or claim
owner acceptance before that decision.

## 5. Stage A verification and stop

This formalization verifies the two files for UTF-8 without BOM, LF-only line
endings, exactly one trailing LF, deterministic SHA-256 agreement between
Node crypto and .NET, explicit whitelist compliance, clean index, no remote,
and no future Task 04 artifacts.

Stop and preserve the actual state on any anchor drift, encoding failure,
hash disagreement, extra path, future artifact, secret, real data, network
or registry operation, service, dependency action, Git operation, or attempt
to enter another stage. A Stage A `PASS` is internal evidence pending
independent owner review and grants no implementation authorization.
