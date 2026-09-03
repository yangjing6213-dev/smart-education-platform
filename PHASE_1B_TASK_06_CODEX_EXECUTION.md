# Phase 1B Task 06 Codex Execution Contract

This is the stable Stage A formalization contract and Stage B amendment for
Phase 1B Task 06, Institution Profile and Home Content Management. It defines a
bounded implementation and evidence lifecycle without creating a branch or
worktree.

## Canonical manifest

```text
CANONICAL_MANIFEST_FORMAT=PHASE_1B_TASK_06_CANONICAL_CONTRACT_V2_STAGE_B_AMENDMENT
CANONICALIZATION_RULE=THE_COMPLETE_FILE_IS_UTF8_NO_BOM_LF_ONLY_EXACTLY_ONE_TRAILING_LF_AND_ITS_SHA256_IS_RECORDED_ONLY_IN_THE_EXTERNAL_STAGE_A_RECEIPT
C1_CANONICAL_MEMBER_ORDER_POLICY=POSIX_RELATIVE_PATHS_CASEFOLDED_UNICODE_ORDINAL_ASCENDING
TASK_ID=PHASE_1B_TASK_06
TASK_NAME=INSTITUTION_PROFILE_AND_HOME_CONTENT_MANAGEMENT
TASK_STATUS=TASK_06_ACCEPTED_STOP_BEFORE_TASK07
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
SOURCE_BRANCH=feature/phase-1b-task-04-identity-membership
SOURCE_HEAD=4db46c39d6a1f18517fe561a43b2207e8fa1dfde
TARGET_BRANCH=CURRENT_CHECKOUT_NO_NEW_BRANCH_OR_WORKTREE
GOVERNANCE_AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V6.md
GOVERNANCE_AUTHORITY_SHA256=E695C9455B75704BE1BB61CB06EC815F30857B048F2FF2131CA4E51F0D6ED7BD
AUTHORIZATION_EVIDENCE_ID=PROJECT_OWNER_EXPLICIT_TASK06_STAGE_B_IMPLEMENTATION_2026-09-02
AUTHORIZATION_OBJECTIVE_TEXT=Authorize Phase 1B Task 06 Stage B implementation
AUTHORIZATION_OBJECTIVE_UTF8_BYTES=49
AUTHORIZATION_OBJECTIVE_SHA256=CE5F93CEE0BF1758853C1F1F47F3B78EF350544DFF6D74DE2566D3A7EBB68667
AUTHORIZATION_RECORD_SHA256=STAGE_A_EXTERNAL_RECEIPT_ONLY
APPROVED_AT=2026-09-02 Asia/Shanghai
CONTRACT_APPROVAL_STATUS=APPROVED_FOR_STAGE_B_IMPLEMENTATION
TASK_06_STARTED=YES_STAGE_B_IMPLEMENTATION
TASK_06_GOAL_AUTHORIZATION=GRANTED_FOR_STAGE_B_IMPLEMENTATION
TASK_06_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_06_STAGE_A_STATUS=OWNER_CONFIRMED
TASK_06_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_06_STAGE_C1_STATUS=FINAL_EVIDENCE_READY_AND_OWNER_REVIEW_PASSED
TASK_06_OWNER_REVIEW=ACCEPTED
TASK_06_STAGE_C2_STATUS=ACCEPTED
TASK_06_STAGE_C2_AUTHORIZATION=GRANTED
TASK_06_PLUS_STARTED=NO
TASK_07_PLUS_STARTED=NO
TASK_07_PLUS_AUTHORIZATION=NOT_GRANTED
TASK_06_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md
TASK_06_ACCEPTANCE_SHA256=0B690B77CF4C08653FA3495ABB9B218C640E8C4F02121CC14DEE0557850F68C
TASK_05_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
TASK_05_ACCEPTANCE_SHA256=640BCF9B2B5C33ED1499E1F5C35E58608872953DCF0059A33086312FC260ECDD
TASK_05_ACCEPTANCE_COMMIT=11d2a361e91232e79675597a256a7577b4cada24
DEPENDENCIES=T05
DEPENDENCY_ACCEPTANCE_EVIDENCE=TASK05_C2_ACCEPTED_AND_FROZEN
PUBLIC_API_DTOS=@student-care/contracts
INTERNAL_AUTH_POLICY_TYPES=@student-care/auth
CONTENT_MODEL_SOURCE=TASK05_ACCEPTED_VERSIONED_CONTENT_MODEL
LONG_HORIZON_DEVELOPMENT_REQUIRED=YES
SUPERPOWERS_REQUIRED=using-superpowers|brainstorming|writing-plans|test-driven-development|requesting-code-review|verification-before-completion
STAGE_B_BEHAVIOR_CHANGES_REQUIRE=test-driven-development|requesting-code-review
SYSTEMATIC_DEBUGGING_REQUIRED_ON_ANY_FAILURE=YES
CONTRACT_SHA256_RECORDING=EXTERNAL_STAGE_A_RECEIPT_ONLY_NO_SELF_REFERENCE
PLAN_SHA256_RECORDING=EXTERNAL_STAGE_A_RECEIPT_ONLY_NO_SELF_REFERENCE
CONTRACT_ENCODING=UTF-8
CONTRACT_BOM=NO
CONTRACT_LINE_ENDING=LF
CONTRACT_TRAILING_LF=EXACTLY_ONE
```

## Current authorization and amendment

The project owner confirmed the Stage B remediation scope after the initial
four-file implementation was independently found to be non-integrated. This
amendment authorized implementation only in the expanded Stage B whitelist
below. Stage B and C1 are now frozen, and the separate C2 record is
acceptance-record-only. It does not authorize new implementation, a new branch
or worktree, `/goal`, dependency installation, network access, production
services, database/migration work, or Task 07+.

V4, V5, and the original Stage A snapshot remain historical/frozen records. Their
old `TASK_06_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED` values are historical
anchors; this amendment and the current V6 authority record the owner-accepted
Task 06 implementation, generated C1 evidence, and C2 acceptance without
rewriting Task 01-05 evidence or authorizing Task 07+.

## Task 06 objective and bounded design

Task 06 will connect bounded institution profile fields and home content to the
accepted Task 05 content lifecycle. Institution profile content is tenant
scoped. Home content may be tenant scoped or campus scoped, but every campus
scope must come from the server-resolved active membership and allowed-campus
context. Client tenant, campus, role, publication, and version claims are never
authorization sources.

The future implementation must provide:

1. Scoped internal editing of bounded institution and home content.
2. Separate draft and publish commands using the Task 05 expected-version rule.
3. A published visitor projection that returns only explicitly public fields.
4. Fail-closed denial for staff without the publish capability, foreign campus
   scope, stale versions, and invalid content blocks.
5. Synthetic-only fixtures and an observable publication path without durable
   Task 17 audit infrastructure.

The public projection may expose only the existing allowlisted content shape:
title, summary, approved block kind/text/link fields, content type, version, and
publication time. It must not expose editor notes, moderation fields,
membership details, actor identifiers, tenant administration metadata, campus
administration metadata, unpublished references, or concurrency internals.

## Security, privacy, and data boundaries

```text
TRUST_BOUNDARY=SERVER_DERIVES_IDENTITY_TENANT_AND_CAMPUS_FROM_TASK03_AND_TASK04_CONTEXT
CLIENT_CLAIM_POLICY=CLIENT_TENANT_CAMPUS_ROLE_PUBLICATION_AND_VERSION_CLAIMS_ARE_UNTRUSTED
EDIT_POLICY=ACTIVE_MEMBERSHIP_AND_CONTENT_WRITE_CAPABILITY_REQUIRED
PUBLISH_POLICY=TENANT_ADMIN_OR_EXPLICIT_CONTENT_PUBLISH_CAPABILITY_REQUIRED
STAFF_PUBLISH_POLICY=DENY_WITHOUT_CONTENT_PUBLISH_CAPABILITY
FOREIGN_TENANT_POLICY=FAIL_CLOSED
FOREIGN_OR_DISALLOWED_CAMPUS_POLICY=FAIL_CLOSED
STALE_VERSION_POLICY=FAIL_CLOSED_AND_STATE_PRESERVING
INVALID_BLOCK_POLICY=FAIL_CLOSED_BEFORE_STATE_CHANGE
PUBLIC_READ_POLICY=ONLY_PUBLISHED_ALLOWLISTED_PROJECTION_IS_VISIBLE
PUBLIC_VISITOR_SCOPE_POLICY=SERVER_OWNED_PUBLIC_SCOPE_RESOLVER_ONLY
PUBLIC_VISITOR_CLIENT_SCOPE_CLAIMS=IGNORED
PUBLIC_VISITOR_NO_RESOLVER=FAIL_CLOSED
PLATFORM_ADMIN_POLICY=NO_DEFAULT_STUDENT_SPECIFIC_CONTENT_ACCESS
SYNTHETIC_DATA_POLICY=ONLY_OBVIOUSLY_FICTITIOUS_NON_PERSONAL_FIXTURES
REAL_DATA_POLICY=NO_REAL_NAMES_PHONE_NUMBERS_ADDRESSES_STUDENT_RECORDS_PHOTOS_OR_FAMILY_DATA
SECRET_POLICY=NO_PASSWORDS_COOKIES_TOKENS_KEYS_PRODUCTION_CONFIGURATION_OR_REAL_CREDENTIALS
PROVIDER_POLICY=NO_REAL_LOGIN_WECHAT_SMS_OAUTH_OIDC_OR_EXTERNAL_IDENTITY_PROVIDER
PERSISTENCE_POLICY=NO_PRODUCTION_DATABASE_SCHEMA_OR_MIGRATION
NETWORK_POLICY=NO_NETWORK_REGISTRY_EXTERNAL_SERVICE_OR_CLOUD_REQUEST
DEPENDENCY_POLICY=NO_NEW_EXTERNAL_RUNTIME_DEPENDENCY
INSTALL_POLICY=NO_DEPENDENCY_INSTALL_OR_LOCKFILE_UPDATE_IN_STAGE_A
```

## Lifecycle and exact file boundaries

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_06_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_06_PLAN.md
STAGE_A_FORMAT_GATE=CHECK_ONLY_THE_TWO_EXISTING_TASK06_STAGE_A_TEXT_FILES
STAGE_B_EXACT_FILES=apps/api/src/modules/institution/institution.service.ts|apps/api/src/routes/admin-institution.route.ts|apps/admin-web/src/pages/home-content.tsx|apps/api/src/modules/institution/institution.test.ts|apps/api/src/server.ts|apps/api/package.json|packages/contracts/src/identity.ts|packages/contracts/test/identity.test.ts|packages/auth/src/identity.ts|packages/auth/test/policy.test.ts|apps/admin-web/package.json|apps/admin-web/tsconfig.json|apps/admin-web/index.html|apps/admin-web/src/main.ts|apps/admin-web/test/home-content.test.mjs|scripts/verify_task_06.mjs|package.json|pnpm-lock.yaml|tests/contracts/package-boundaries.test.mjs|tests/workspace/paths.test.mjs|PHASE_1B_TASK_06_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_06_PLAN.md
STAGE_B_SHARED_FILES=OWNER_CONFIRMED_TASK06_INTEGRATION_AMENDMENT_2026-09-02|FROZEN_TASK01_TO_TASK05_EVIDENCE_REMAINS_UNMODIFIED
STAGE_B_NEW_FILES=apps/admin-web/package.json|apps/admin-web/tsconfig.json|apps/admin-web/index.html|apps/admin-web/src/main.ts|apps/admin-web/test/home-content.test.mjs|scripts/verify_task_06.mjs
STAGE_B_NO_DEPENDENCY_INSTALL=YES
STAGE_B_LOCKFILE_CHANGE=ONE_EXPLICIT_APPS_ADMIN_WEB_WORKSPACE_IMPORTER_ONLY
STAGE_C1_EXACT_FILES=docs/reviews/PHASE_1B_TASK_06_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_06.txt|artifacts/review-package/student-care-platform-phase1b-task-06-review-pack-v1.0.zip
STAGE_C1_MEMBER_ORDER_POLICY=POSIX_RELATIVE_PATHS_CASEFOLDED_UNICODE_ORDINAL_ASCENDING
STAGE_C2_EXACT_FILES=docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md
OWNER_REVIEW_GATE=AFTER_STAGE_A_BEFORE_STAGE_B_IMPLEMENTATION_AUTHORIZATION
STAGE_C1_OWNER_REVIEW_GATE=AFTER_STAGE_C1_BEFORE_STAGE_C2_ACCEPTANCE
STAGE_C2_POLICY=ACCEPTANCE_RECORD_ONLY_AFTER_EXPLICIT_PROJECT_OWNER_PASS|SEPARATE_COMMIT|NEVER_PREWRITE
COMMIT_BOUNDARIES=STAGE_A_OWNER_REVIEW_ARTIFACT|STAGE_B_IMPLEMENTATION|STAGE_C1_FINAL_EVIDENCE|OWNER_REVIEW_GATE|STAGE_C2_ACCEPTANCE_RECORD_ONLY
STAGE_A_GIT_POLICY=NO_STAGE_NO_COMMIT_UNTIL_OWNER_REVIEW
RECEIPT_PATH=C:/Users/HU.codex/execution-receipts/student-care/phase1b-task06-stage-a-20260902.json
```

The initial Stage A contract recorded the missing `apps/admin-web` package and
API registration as integration risks. The owner-approved amendment now
allows the minimum no-dependency static package scaffold and API registration
needed to make the four-file implementation runnable.

## Verification contract

```text
STAGE_A_VERIFICATION=NODE_CRYPTO_SHA256_AND_DOTNET_SHA256_FOR_BOTH_FILES|UTF8_NO_BOM_LF_EXACTLY_ONE_TRAILING_LF|NO_SELF_SHA|EXACT_TWO_NEW_TASK06_PATHS|READ_ONLY_BASELINE_PRESERVED
STAGE_B_VERIFICATION=TASK06_TESTS|API_BUILD|ADMIN_WEB_TYPECHECK_AND_BUILD|ROOT_TYPECHECK_LINT_FORMAT_TEST_BUILD|TASK06_AWARE_BOUNDARY_VERIFY|FROZEN_EVIDENCE_HASHES_UNCHANGED
GIT_VERIFICATION=git_status_short_branch|git_rev_parse_HEAD|git_diff_check|git_diff_cached_check|remote_count|no_task06_branch|no_task06_worktree
FUTURE_FILE_POLICY=STAGE_C1_AND_C2_FILES_MUST_NOT_EXIST_DURING_STAGE_B
FROZEN_EVIDENCE_CHECK=TASK04_ACCEPTANCE_AND_TASK05_C2_C1_EVIDENCE_HASHES_UNCHANGED
```

The original Stage A check covered only its two rendered files. Stage B now
checks the expanded implementation whitelist, the API/admin-web integration,
and the Task 06-aware boundary verifier. The six existing untracked Task 04/05
evidence paths are preserved and are not part of the Task 06 write set.

The current Stage C1 evidence was generated from the accepted Stage B
implementation commit and owner review passed. Task 06 C2 is recorded by the
separate acceptance-only file and remains frozen; no new implementation is
authorized by that record.

The C1 package member order is canonicalized as POSIX relative paths sorted by
case-folded Unicode ordinal order, with `apps/admin-web/index.html` required as
the first member. This is not a case-sensitive strict-ordinal policy.

## Stop conditions

Stop and preserve the actual state on governance-anchor drift, dependency or
acceptance conflict, a non-whitelist path, encoding failure, SHA disagreement,
missing authorized file, real data, secret, network or registry operation,
dependency installation, unapproved lockfile change, production service, database,
migration, branch/worktree creation, staging outside the explicit commit gate,
or any attempt to enter Task 07+.

Stage B and C1 are frozen evidence records, and C2 records explicit owner
acceptance only. C2 does not authorize new implementation or Task 07+. The
anonymous visitor route uses only a
server-owned public scope resolver; if that resolver is absent, the route
denies access and never treats client tenant or campus claims as authority.
