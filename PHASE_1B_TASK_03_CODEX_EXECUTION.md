# Phase 1B Task 03 Codex Execution Contract

This document is the rendered Task 03 contract produced under the approved formalization scope.
It is not an implementation authorization. The canonical manifest is the field-level contract
source; the SHA of this file is recorded externally because a file cannot contain its own digest.

## Canonical manifest

```text
CANONICAL_MANIFEST_FORMAT=PHASE_1B_TASK_03_CANONICAL_CONTRACT_V5
CANONICAL_MANIFEST_SCOPE=ALL_FIELDS_AND_REVIEW_PACKAGE_MEMBER_LINES
CANONICAL_MANIFEST_START=CANONICAL_MANIFEST_FORMAT
CANONICAL_MANIFEST_END=REVIEW_PACKAGE_MEMBER_064
CANONICAL_MANIFEST_ENCODING=UTF-8
CANONICAL_MANIFEST_BOM=NO
CANONICAL_MANIFEST_LINE_ENDING=LF
CANONICAL_MANIFEST_TRAILING_LF=EXACTLY_ONE
TASK_ID=PHASE_1B_TASK_03
TASK_NAME=TENANT_CAMPUS_SCOPE
TASK_03_CONTRACT_PATH=PHASE_1B_TASK_03_CODEX_EXECUTION.md
TASK_03_DRAFT_STATUS=READY_FOR_OWNER_REVIEW
TASK_03_OWNER_REVIEW_ACTION=APPROVE_RENDERED_SHA_IDENTIFIED_TASK_03_CONTRACT_WITH_T10_T12_DEPENDENCY_AUTHORITY_BEFORE_GOAL
TASK_03_STARTED=NO
TASK_04_STARTED=NO
TASK_05_PLUS_STARTED=NO
TASK_03_GOAL_AUTHORIZATION=NOT_GRANTED
TASK_03_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
PHASE_1B_STARTED=YES
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
SOURCE_BRANCH=feature/phase-1b-task-02-shared-contracts-validation
SOURCE_HEAD=ff834cdf9e63a0300a3763df88b8d4f8d67d1ddd
CURRENT_BRANCH=feature/phase-1b-task-02-shared-contracts-validation
CURRENT_HEAD=ff834cdf9e63a0300a3763df88b8d4f8d67d1ddd
HEAD_PARENT=14973e2adbe124ba083cb6b821181a2ee333652f
TARGET_BRANCH=feature/phase-1b-task-03-tenant-campus-scope
TARGET_BRANCH_EXISTS=NO
GIT_WORKTREE_STATUS=MODIFIED_BY_APPROVED_FORMALIZATION
GIT_INDEX_STATUS=CLEAN
GIT_REMOTE_COUNT=0
NODE_VERSION=v24.14.0
PNPM_VERSION=11.22.0
TASK_03_CONTRACT_EXISTS=YES
TASK_03_REVIEW_PACKAGE_EXISTS=NO
PACKAGES_TENANT_EXISTS=NO
SCOPE_PLUGIN_EXISTS=NO
TASK_01_PROJECT_OWNER_ACCEPTANCE=PASS
TASK_01_COMMIT=badc119aa62835fae9fd45da089a19dafd063ddd
TASK_01_FROZEN_EVIDENCE_STATUS=PASS
TASK_02_CODE_COMMIT=14973e2adbe124ba083cb6b821181a2ee333652f
TASK_02_PROJECT_OWNER_ACCEPTANCE=PASS
TASK_02_ACCEPTANCE_DATE=2026-08-25
TASK_02_ACCEPTANCE_AUTHORITY=PROJECT_OWNER_EXPLICIT_THREAD_CONFIRMATION
TASK_02_ACCEPTANCE_RECORD_PATH=docs/project/PHASE_1B_TASK_02_ACCEPTANCE.md
TASK_02_ACCEPTANCE_RECORD_STATUS=PRESENT_AND_COMMITTED
TASK_02_ACCEPTANCE_RECORD_COMMIT=ff834cdf9e63a0300a3763df88b8d4f8d67d1ddd
TASK_02_ACCEPTANCE_RECORD_SHA256=62316AA2C94B5C5B3B52DA2E678799B2B20787589AA9C8E0D5FB6DBA239628DF
TASK_02_ACCEPTANCE_RECORD_IN_HEAD=YES
TASK_02_CONTRACT_PATH=PHASE_1B_TASK_02_CODEX_EXECUTION.md
TASK_02_CONTRACT_SHA256=0292269A8264F7217014C629FFA53133E1818B0483DC90ECA275B8817C461A57
TASK_02_INTERNAL_STATUS=PASS
TASK_02_REVIEW_REPORT=docs/reviews/PHASE_1B_TASK_02_REVIEW.md
TASK_02_REVIEW_REPORT_OWNER_ACCEPTANCE_FIELD=PENDING_HISTORICAL_INTERNAL_REPORT
TASK_02_REVIEW_PACKAGE=artifacts/review-package/student-care-platform-phase1b-task-02-review-pack-v1.0.zip
TASK_02_REVIEW_PACKAGE_SHA256=FB42ECCD371747D76A8D95CD3692081F392C1A6AE4662F355BEBEC1911966622
TASK_02_REVIEW_PACKAGE_MEMBER_COUNT=49
TASK_02_REVIEW_PACKAGE_MEMBER_LIST_SHA256=2F95991DD733B355EBAA212E7BEF904DD7DE412B2B09AC374FEC8A3DAE458A8A
TASK_02_FROZEN_EVIDENCE_STATUS=PASS
TASK_02_ACCEPTANCE_RECORD_TASK_03_WRITABLE=NO
TASK_02_ACCEPTANCE_RECORD_TASK_03_REVIEW_MEMBER=NO
GOVERNANCE_CONFLICT=AGENTS_MD_LIMITS_CURRENT_EXECUTION_TO_PHASE_1A_BATCH_B_WHILE_TASK_03_IS_PHASE_1B_IMPLEMENTATION_SCOPE
GOVERNANCE_RESOLUTION=PROJECT_OWNER_MUST_APPROVE_A_NEW_SHA_IDENTIFIED_TASK_03_AUTHORITY_AND_REQUIRED_REFERENCES_BEFORE_GOAL
GOVERNANCE_AGENTS_MD_MODIFICATION=FORBIDDEN_IN_THIS_FORMALIZATION
TASK_03_TASK_04_CONFLICT=TASK_03_NEEDS_TYPED_TRUSTED_INPUTS_WHILE_TASK_04_OWNS_IDENTITY_SESSION_AND_MEMBERSHIP_IMPLEMENTATION
TASK_03_TASK_04_RESOLUTION=SYNTHETIC_CALLER_SUPPLIED_TRUSTED_INPUTS_ONLY_WITH_NO_AUTH_OR_IDENTITY_OR_MEMBERSHIP_STORAGE
DEPENDENCY_DECISION_ID=OWNER_T10_T12_DEPENDENCY_DECISION_2026_08_25
DEPENDENCY_DECISION_SOURCE=PROJECT_OWNER_EXPLICIT_THREAD_CONFIRMATION
DEPENDENCY_DECISION_STATUS=OWNER_APPROVED_PENDING_STABLE_SHA_FORMALIZATION
T12_DEPENDENCIES=T02 -> T03 -> T05
T10_DEPENDENCIES=T05 -> T08 -> T12
DEPENDENCY_SOURCE_CONFLICT_001=PHASE_1B_TASK_DEPENDENCY_GRAPH.md_T12_IS_T02_TO_T03_TO_T05
DEPENDENCY_SOURCE_CONFLICT_002=PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md_TASK_12_STILL_LISTS_TASK_10
DEPENDENCY_FORMALIZATION_REQUIRED=NEW_SHA_IDENTIFIED_OWNER_APPROVED_AUTHORITY_AND_REQUIRED_REFERENCES
DEPENDENCY_FORMALIZATION_TARGET=FINAL_RENDERED_SHA_IDENTIFIED_TASK_03_CONTRACT_AND_REQUIRED_REFERENCES
DEPENDENCY_FORMALIZATION_BEFORE_GOAL=YES
DEPENDENCY_SOURCE_FILES_IN_PLACE_MODIFICATION=AUTHORIZED_BY_OWNER_FORMALIZATION_SCOPE
TASK_03_GOAL_DEPENDENCY_PRECONDITION=STABLE_T10_T12_DEPENDENCY_AUTHORITY_APPROVED
DEPENDENCY_AUTHORITY_FILE_PATH=docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md
DEPENDENCY_AUTHORITY_VERSION=V1
DEPENDENCY_AUTHORITY_APPROVAL_STATUS=OWNER_APPROVED_PENDING_STABLE_SHA_FORMALIZATION
DEPENDENCY_AUTHORITY_FILE_SHA256=B7F7509914399DD660D02F6FFD52E735EDF9EA850C0BF5C92F95698D8104F007
DEPENDENCY_AUTHORITY_REVIEW_PACKAGE_INCLUDED=YES
DEPENDENCY_AUTHORITY_REVIEW_PACKAGE_MEMBER=REVIEW_PACKAGE_MEMBER_028
DEPENDENCY_LEGACY_T12_T10_CONFLICT_STATUS=RESOLVED_IN_ACTIVE_PLAN_BY_AUTHORITY_REFERENCE
GOVERNANCE_CONFLICT_STATUS=AGENTS_MD_PHASE_1A_PHASE_1B_BOUNDARY_CONFLICT_UNRESOLVED_PENDING_OWNER_APPROVED_SHA_AUTHORITY
TASK_03_SCOPE=FAIL_CLOSED_SCOPECONTEXT_RESOLUTION_SCOPE_CACHE_KEY_BUILD_VERIFY_FASTIFY_BOUNDARY_AND_SYNTHETIC_ISOLATION_TESTS
TASK_03_NON_SCOPE=LOGIN_TOKEN_SESSION_IDENTITY_STORAGE_MEMBERSHIP_STORAGE_DATABASE_MIGRATION_BUSINESS_ROUTE_CLIENT_CACHE_BACKEND_QUEUE_FILE_AI_PAYMENT_DEPLOYMENT
TASK_03_DATA_POLICY=SYNTHETIC_UUIDS_AND_SYNTHETIC_TEXT_ONLY
TASK_03_NETWORK_POLICY=NO_EXTERNAL_APPLICATION_OR_TEST_REQUESTS
HEALTH_ROUTE_POLICY=UNCHANGED_RESPONSE_EXACTLY_{status:ok}
UUID_VALIDATION_SOURCE=@student-care/validation.uuidSchema
UUID_VALIDATION_RULE=LOWERCASE_UUID_WITHOUT_TRIM_OR_COERCION
ZOD_VERSION=3.25.76
ZOD_TASK_03_DIRECT_DEPENDENCY=FORBIDDEN
PACKAGE_DIRECTION=@student-care/contracts->@student-care/validation->@student-care/tenant_and_approved_consumers
TENANT_PACKAGE_NAME=@student-care/tenant
TENANT_PACKAGE_VERSION=0.1.0
TENANT_PACKAGE_DEPENDENCIES=@student-care/validation=workspace:*
TENANT_PACKAGE_FORBIDDEN_DEPENDENCIES=zod|fastify|apps/api|external_packages
API_SCOPE_PLUGIN_DEPENDENCIES=@student-care/contracts=workspace:*|@student-care/tenant=workspace:*|fastify=5.12.1
FASTIFY_PLUGIN_NEW_DIRECT_DEPENDENCY=FORBIDDEN
CONTRACTS_IMPORTS_TENANT=FORBIDDEN
VALIDATION_IMPORTS_TENANT=FORBIDDEN
TENANT_IMPORTS_API=FORBIDDEN
TENANT_IMPORTS_ZOD=FORBIDDEN
API_DUPLICATES_UUID_SCHEMA=FORBIDDEN
TRUSTED_ACTOR_INTERFACE=interface TrustedActor { readonly actorId: string; }
TRUSTED_MEMBERSHIP_INTERFACE=interface TrustedMembership { readonly tenantId: string; readonly campusIds: readonly string[]; readonly status: "ACTIVE" | "SUSPENDED"; }
RESOLVE_SCOPE_INPUT_INTERFACE=interface ResolveScopeInput { readonly trustedActor: TrustedActor | null | undefined; readonly membership: TrustedMembership | null | undefined; readonly requestedTenantId?: unknown; readonly requestedCampusId?: unknown; }
RESOLVE_SCOPE_SIGNATURE=resolveScope(input: ResolveScopeInput): ScopeResolutionResult
SCOPE_CONTEXT_INTERFACE=interface ScopeContext { readonly actorId: string; readonly tenantId: string; readonly campusId?: string; }
SCOPE_DENIAL_INTERFACE=interface ScopeDenial { readonly ok: false; readonly reason: ScopeDenialReason; }
SCOPE_RESOLUTION_SUCCESS_INTERFACE=interface ScopeResolutionSuccess { readonly ok: true; readonly scopeContext: ScopeContext; }
SCOPE_RESOLUTION_RESULT=ScopeResolutionSuccess | ScopeDenial
SCOPE_DENIAL_REASON=TRUSTED_PRINCIPAL_MISSING|MEMBERSHIP_MISSING|MEMBERSHIP_SUSPENDED|TENANT_SCOPE_MISMATCH|CAMPUS_SCOPE_INVALID|CACHE_KEY_INVALID|CACHE_KEY_COLLISION
SCOPE_CACHE_KEY_COMPONENTS_INTERFACE=interface ScopeCacheKeyComponents { readonly namespace: string; readonly resource: string; readonly key: string; }
SCOPE_CACHE_KEY_RESULT=ScopeCacheKeySuccess | ScopeCacheKeyDenial
SCOPE_CACHE_KEY_SUCCESS_INTERFACE=interface ScopeCacheKeySuccess { readonly ok: true; readonly key: string; }
SCOPE_CACHE_KEY_DENIAL_INTERFACE=interface ScopeCacheKeyDenial { readonly ok: false; readonly denial: ScopeDenial; }
BUILD_SCOPE_CACHE_KEY_SIGNATURE=buildScopeCacheKey(scopeContext: ScopeContext,components: ScopeCacheKeyComponents): ScopeCacheKeyResult
VERIFY_SCOPE_CACHE_KEY_SIGNATURE=verifyScopeCacheKey(scopeContext: ScopeContext,components: ScopeCacheKeyComponents,candidate: unknown): ScopeCacheKeyResult
SCOPE_PLUGIN_OPTIONS_INTERFACE=interface ScopePluginOptions { readonly getScopeInput: (request: FastifyRequest) => ResolveScopeInput; }
TRUSTED_INPUT_NO_TRIM=YES
TRUSTED_INPUT_NO_IMPLICIT_COERCION=YES
TRUSTED_INPUT_RUNTIME_NON_OBJECT=TRUSTED_PRINCIPAL_MISSING
TRUSTED_ACTOR_INVALID_VALUES=null|undefined|missing_property|non_object|array|missing_actorId|non_string_actorId|empty_actorId|uuidSchema_failure
TRUSTED_ACTOR_INVALID_RESULT=TRUSTED_PRINCIPAL_MISSING
MEMBERSHIP_CHECK_PRECONDITION=VALID_TRUSTED_ACTOR
MEMBERSHIP_INVALID_VALUES=null|undefined|missing_property|non_object|array|missing_tenantId|non_string_tenantId|tenantId_uuidSchema_failure|missing_campusIds|non_array_campusIds|non_string_campusId|campusId_uuidSchema_failure|missing_status|non_string_status|status_not_ACTIVE_or_SUSPENDED
MEMBERSHIP_INVALID_RESULT=MEMBERSHIP_MISSING
MEMBERSHIP_SUSPENDED_RESULT=MEMBERSHIP_SUSPENDED
REQUESTED_TENANT_ID_ABSENT_OR_UNDEFINED=USE_membership.tenantId
REQUESTED_TENANT_ID_INVALID_OR_NOT_EQUAL=TENANT_SCOPE_MISMATCH
REQUESTED_TENANT_ID_INVALID_VALUES=null|non_string|empty|uuidSchema_failure
REQUESTED_CAMPUS_ID_ABSENT_OR_UNDEFINED=OMIT_scopeContext.campusId
REQUESTED_CAMPUS_ID_INVALID_OR_NOT_MEMBER=CAMPUS_SCOPE_INVALID
REQUESTED_CAMPUS_ID_INVALID_VALUES=null|non_string|empty|uuidSchema_failure|not_in_membership.campusIds
RESOLVE_SCOPE_CHECK_ORDER=trustedActor_validity_then_membership_validity_then_membership_status_then_requestedTenantId_then_requestedCampusId
TENANT_SCOPE_SOURCE=membership.tenantId
CAMPUS_SCOPE_SOURCE=requestedCampusId_intersect_membership.campusIds
CLIENT_SUPPLIED_TENANT_OR_CAMPUS_ID_TRUST_LEVEL=UNTRUSTED_CANDIDATE_ONLY
CACHE_KEY_COMPONENTS=namespace|resource|key
CACHE_KEY_COMPONENT_CHARACTER_COUNT=1_TO_128
CACHE_KEY_COMPONENT_PATTERN=^[A-Za-z0-9._:-]+$
CACHE_KEY_COMPONENT_TRIM=FORBIDDEN
CACHE_KEY_COMPONENT_IMPLICIT_COERCION=FORBIDDEN
CACHE_KEY_COMPONENT_CONTROL_CHARACTERS=FORBIDDEN
CACHE_KEY_COMPONENT_VALIDATION=TYPE_STRING_AND_ASCII_PATTERN_AND_UNTRIMMED_EXACT_VALUE
CACHE_KEY_SCOPE_CONTEXT_VALIDATION=actorId_tenantId_and_optional_campusId_must_pass_uuidSchema_without_trim_or_coercion
CACHE_KEY_SERIALIZATION=JSON.stringify(["scope-v1",scopeContext.tenantId,scopeContext.campusId??null,components.namespace,components.resource,components.key])
CACHE_KEY_FINAL_VALUE_CHARACTER_RULE=NOT_APPLICABLE_TO_JSON_SERIALIZED_OUTPUT
CACHE_KEY_INVALID=tenant_or_campus_scope_invalid_or_any_cache_component_is_not_a_string_or_violates_the_ASCII_rule
CACHE_KEY_COLLISION=all_scope_and_components_are_valid_but_candidate_key_is_not_the_exact_expected_serialized_key
CACHE_KEY_FOREIGN_OR_MISMATCHED_CANDIDATE=CACHE_KEY_COLLISION
VERIFY_SCOPE_CACHE_KEY_ORDER=build_expected_key_then_non_string_candidate_is_CACHE_KEY_INVALID_then_exact_compare_then_CACHE_KEY_COLLISION
CACHE_KEY_RESULT_DENIAL_FIELD=ScopeCacheKeyDenial.denial
ROUTE_SCOPE_REQUIREMENT=routeOptions.config.scopeRequired === true
ROUTE_SCOPE_UNMARKED_BEHAVIOR=NO_SCOPE_RESOLUTION_AND_NO_SCOPE_DENIAL
FASTIFY_MODULE_AUGMENTATION=declare_module_fastify
FASTIFY_CONTEXT_CONFIG_DECLARATION=interface FastifyContextConfig { scopeRequired?: boolean; }
REQUEST_SCOPE_DECORATOR=app.decorateRequest("scopeContext",undefined)
REQUEST_SCOPE_CONTEXT_DECLARATION=interface FastifyRequest { scopeContext: ScopeContext | undefined; }
REQUEST_SCOPE_CONTEXT_TYPE=ScopeContext | undefined
SCOPE_PLUGIN_EXPORT=scopePlugin: FastifyPluginAsync<ScopePluginOptions>
SCOPE_PLUGIN_HOOK=preHandler
SCOPE_PLUGIN_INPUT_SOURCE=options.getScopeInput(request)
REQUEST_ID_SOURCE=request.id
DENIAL_STATUS_CODE=403
DENIAL_ERROR_CODE=FORBIDDEN_SCOPE
DENIAL_MESSAGE=Scope access is not permitted.
DENIAL_ENVELOPE={"error":{"code":"FORBIDDEN_SCOPE","message":"Scope access is not permitted."},"request_id":request.id}
DENIAL_HANDLER_EXECUTION=FORBIDDEN
DENIAL_REPLY_STATEMENT=return reply.code(403).send({error:{code:"FORBIDDEN_SCOPE",message:"Scope access is not permitted."},request_id:request.id})
SUCCESS_REQUEST_SCOPE_ASSIGNMENT=request.scopeContext=resolution.scopeContext
PLUGIN_TEST_INSTANCE=independent fastify({logger:false}) instance
SCOPE_PLUGIN_TEST_BINDING=await scopePlugin(app,{getScopeInput})
SCOPE_PLUGIN_TEST_BINDING_CONTEXT=ROOT_FASTIFY_TEST_INSTANCE_BEFORE_SCOPE_TEST_ROUTE_REGISTRATION
SCOPE_PLUGIN_TEST_ROUTE_BINDING_REQUIREMENT=scopePlugin_hook_must_apply_to_the_same_fastify_context_that_registers_/scope-test
SCOPE_PLUGIN_ROOT_REGISTER_THEN_ROOT_ROUTE=FORBIDDEN_BECAUSE_FASTIFY_PLUGIN_ENCAPSULATION_DOES_NOT_APPLY_CHILD_HOOKS_TO_PARENT_ROUTES
SCOPE_PLUGIN_PRODUCTION_WIRING=DEFERRED_UNTIL_A_SEPARATE_OWNER_APPROVED_CONTRACT_PROVIDES_A_TRUSTED_INPUT_SOURCE
PLUGIN_TEST_ROUTE=app.get("/scope-test",{config:{scopeRequired:true}},handler)
PLUGIN_TEST_UNSCOPED_ROUTE=app.get("/unscoped-test",handler)
API_INDEX_TS_MODIFICATION=FORBIDDEN
API_SERVER_TS_MODIFICATION=FORBIDDEN
TDD_RUNNER=node_test
TDD_RED_001=missing_or_empty_or_malformed_trusted_actor_returns_TRUSTED_PRINCIPAL_MISSING
TDD_RED_002=valid_actor_with_missing_or_malformed_membership_returns_MEMBERSHIP_MISSING
TDD_RED_003=suspended_membership_returns_MEMBERSHIP_SUSPENDED
TDD_RED_004=cross_tenant_and_illegal_campus_requests_return_TENANT_SCOPE_MISMATCH_and_CAMPUS_SCOPE_INVALID
TDD_RED_005=foreign_or_mismatched_candidate_key_returns_CACHE_KEY_COLLISION
TDD_RED_006=empty_non_string_whitespace_control_character_or_129_character_component_returns_CACHE_KEY_INVALID
TDD_RED_007=scope_required_fastify_denial_returns_fixed_403_envelope_with_request_id_and_does_not_execute_handler
TDD_GREEN_001=valid_active_membership_returns_typed_ScopeContext
TDD_GREEN_002=buildScopeCacheKey_returns_only_typed_success_key_or_typed_denial
TDD_GREEN_003=scope_plugin_assigns_request.scopeContext_only_after_success_and_preserves_unscoped_routes
TENANT_TYPECHECK_SCRIPT=tsc -p tsconfig.json --noEmit
TENANT_LINT_SCRIPT=eslint src test
TENANT_TEST_SCRIPT=tsc -p tsconfig.json && node --test dist/test/isolation.test.js
TENANT_TEST_COVERAGE_SCRIPT=tsc -p tsconfig.json && node --experimental-test-coverage --test-coverage-lines=90 --test-coverage-branches=100 --test-coverage-include=dist/src/**/*.js --test dist/test/isolation.test.js
TENANT_BUILD_SCRIPT=tsc -p tsconfig.json
API_TYPECHECK_SCRIPT=tsc -p tsconfig.json --noEmit
API_LINT_SCRIPT=eslint src test
API_TEST_SCRIPT=tsc -p tsconfig.json && node --test dist/test/health.route.test.js dist/test/scope.plugin.test.js
API_TEST_COVERAGE_SCRIPT=tsc -p tsconfig.json && node --experimental-test-coverage --test-coverage-lines=90 --test-coverage-branches=100 --test-coverage-include=dist/src/plugins/scope.plugin.js --test dist/test/scope.plugin.test.js
API_BUILD_SCRIPT=tsc -p tsconfig.json
ROOT_TYPECHECK_SCRIPT=corepack pnpm --filter @student-care/contracts typecheck && corepack pnpm --filter @student-care/validation typecheck && corepack pnpm --filter @student-care/tenant typecheck && corepack pnpm --filter @student-care/api typecheck
ROOT_LINT_SCRIPT=corepack pnpm --filter @student-care/contracts lint && corepack pnpm --filter @student-care/validation lint && eslint eslint.config.mjs tests scripts
ROOT_FORMAT_CHECK_SCRIPT=prettier --check --ignore-unknown package.json pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs .prettierrc.json apps/api/package.json apps/api/tsconfig.json apps/api/src/**/*.ts apps/api/test/**/*.ts packages/*/package.json packages/*/tsconfig.json packages/*/src/**/*.ts packages/*/test/**/*.ts tests/**/*.mjs scripts/**/*.mjs PHASE_1B_TASK_03_CODEX_EXECUTION.md SHA256SUMS_PHASE_1B_TASK_03.txt docs/project/PHASE_1B_RUNTIME_BASELINE_DECISION.md docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md docs/project/PHASE_1B_TASK_02_PLAN.md docs/project/PHASE_1B_TASK_03_PLAN.md docs/reviews/PHASE_1B_TASK_01_REVIEW.md
ROOT_TEST_SCRIPT=corepack pnpm --filter @student-care/contracts test && corepack pnpm --filter @student-care/validation test && corepack pnpm --filter @student-care/tenant test && corepack pnpm --filter @student-care/api test && node --test tests/workspace/paths.test.mjs tests/contracts/package-boundaries.test.mjs
ROOT_TEST_COVERAGE_SCRIPT=corepack pnpm --filter @student-care/tenant test:coverage && corepack pnpm --filter @student-care/api test:coverage && node --test tests/workspace/paths.test.mjs tests/contracts/package-boundaries.test.mjs
ROOT_BUILD_SCRIPT=corepack pnpm --filter @student-care/contracts build && corepack pnpm --filter @student-care/validation build && corepack pnpm --filter @student-care/tenant build && corepack pnpm --filter @student-care/api build
ROOT_VERIFY_SCRIPT=corepack pnpm typecheck && corepack pnpm lint && corepack pnpm format:check && corepack pnpm test && corepack pnpm test:coverage && corepack pnpm build && node scripts/verify_task_03.mjs
VERIFY_TASK_03_SCRIPT=node scripts/verify_task_03.mjs
LOCKFILE_EXCEPTION_COUNT=1
LOCKFILE_EXCEPTION_001=corepack pnpm install --offline --lockfile-only --ignore-scripts
LOCKFILE_EXCEPTION_EXECUTION_PHASE=POST_GOAL_ONLY_AFTER_OWNER_APPROVAL
LOCKFILE_ALLOWED_CHANGES=packages/tenant_importer_and_its_workspace_link_to_@student-care/validation_only
LOCKFILE_FORBIDDEN_CHANGES=actual_installation|registry_access|new_external_resolution|version_changes|integrity_changes|peer_suffix_changes|snapshot_changes
LOCKFILE_REPRODUCIBILITY_CHECK=corepack pnpm install --frozen-lockfile --ignore-scripts_must_leave_no_tracked_change
WRITABLE_FILE_COUNT=19
WRITABLE_FILE_001=PHASE_1B_TASK_03_CODEX_EXECUTION.md
WRITABLE_FILE_002=SHA256SUMS_PHASE_1B_TASK_03.txt
WRITABLE_FILE_003=apps/api/package.json
WRITABLE_FILE_004=apps/api/src/plugins/scope.plugin.ts
WRITABLE_FILE_005=apps/api/test/scope.plugin.test.ts
WRITABLE_FILE_006=artifacts/review-package/student-care-platform-phase1b-task-03-review-pack-v1.0.zip
WRITABLE_FILE_007=docs/project/PHASE_1B_TASK_03_PLAN.md
WRITABLE_FILE_008=docs/reviews/PHASE_1B_TASK_03_REVIEW.md
WRITABLE_FILE_009=package.json
WRITABLE_FILE_010=packages/tenant/package.json
WRITABLE_FILE_011=packages/tenant/src/index.ts
WRITABLE_FILE_012=packages/tenant/src/resolve-scope.ts
WRITABLE_FILE_013=packages/tenant/src/scope-context.ts
WRITABLE_FILE_014=packages/tenant/test/isolation.test.ts
WRITABLE_FILE_015=packages/tenant/tsconfig.json
WRITABLE_FILE_016=pnpm-lock.yaml
WRITABLE_FILE_017=scripts/verify_task_03.mjs
WRITABLE_FILE_018=tests/contracts/package-boundaries.test.mjs
WRITABLE_FILE_019=tests/workspace/paths.test.mjs
TASK_03_WRITABLE_EXCLUSIONS=docs/project/PHASE_1B_TASK_02_ACCEPTANCE.md|apps/api/src/index.ts|apps/api/src/server.ts
REVIEW_PACKAGE_PATH=artifacts/review-package/student-care-platform-phase1b-task-03-review-pack-v1.0.zip
REVIEW_PACKAGE_ROOT_MANIFEST=SHA256SUMS_PHASE_1B_TASK_03.txt
REVIEW_PACKAGE_INTERNAL_MANIFEST_PAYLOAD_COUNT=63
REVIEW_PACKAGE_MEMBER_COUNT=64
REVIEW_PACKAGE_MEMBER_LIST_BYTES=2199
REVIEW_PACKAGE_MEMBER_LIST_SHA256=23EF5FC311BC2B64F15E617EA91FEA91BC9102992D89688CAC4022F72785AC1D
REVIEW_PACKAGE_MEMBER_LIST_ORDER=POSIX_RELATIVE_PATHS_UNICODE_ORDINAL_ASCENDING
REVIEW_PACKAGE_MEMBER_LIST_ENCODING=UTF-8
REVIEW_PACKAGE_MEMBER_LIST_BOM=NO
REVIEW_PACKAGE_MEMBER_LIST_LINE_ENDING=LF
REVIEW_PACKAGE_MEMBER_LIST_TRAILING_LF=EXACTLY_ONE
REVIEW_PACKAGE_EXCLUSIONS=.git|node_modules|dist|build|coverage|caches|.env|secrets|real_data|temporary_red_fixtures|phase_1a_zip|task_01_zip|task_02_zip|unrelated_files
REVIEW_PACKAGE_GENERATION=POST_GOAL_ONLY_AFTER_OWNER_APPROVES_MEMBER_COUNT_AND_MEMBER_LIST_SHA256
REVIEW_PACKAGE_SHA256=NOT_ASSIGNED_UNTIL_POST_GOAL_ZIP_GENERATION
POST_GOAL_VERIFICATION_001=node --version
POST_GOAL_VERIFICATION_002=corepack --version
POST_GOAL_VERIFICATION_003=corepack pnpm --version
POST_GOAL_VERIFICATION_004=corepack pnpm typecheck
POST_GOAL_VERIFICATION_005=corepack pnpm lint
POST_GOAL_VERIFICATION_006=corepack pnpm format:check
POST_GOAL_VERIFICATION_007=corepack pnpm test
POST_GOAL_VERIFICATION_008=corepack pnpm test:coverage
POST_GOAL_VERIFICATION_009=corepack pnpm build
POST_GOAL_VERIFICATION_010=corepack pnpm verify
POST_GOAL_VERIFICATION_011=git diff --check
POST_GOAL_VERIFICATION_012=git diff --cached --check
POST_GOAL_VERIFICATION_013=git status --short --branch --untracked-files=all
POST_GOAL_VERIFICATION_014=git remote -v
POST_GOAL_STOP_CONDITIONS=missing_owner_approved_task03_contract|missing_stable_t10_t12_dependency_authority|non_whitelist_change|invalid_lockfile_change|scope_test_failure|task04_or_prohibited_artifact
PLAN_MODE_FILE_WRITES=NO
PLAN_MODE_BRANCH_OPERATIONS=NO
PLAN_MODE_DEPENDENCY_OR_REGISTRY_OPERATIONS=NO
PLAN_MODE_SERVICE_OR_ZIP_OPERATIONS=NO
PLAN_MODE_GIT_STAGE_COMMIT_PUSH_DEPLOY=NO
PLAN_MODE_GOAL_EXECUTION=NO
PLAN_MODE_TASK_03_IMPLEMENTATION=NO
REVIEW_PACKAGE_MEMBER_001=.prettierignore
REVIEW_PACKAGE_MEMBER_002=.prettierrc.json
REVIEW_PACKAGE_MEMBER_003=PHASE_1B_TASK_02_CODEX_EXECUTION.md
REVIEW_PACKAGE_MEMBER_004=PHASE_1B_TASK_03_CODEX_EXECUTION.md
REVIEW_PACKAGE_MEMBER_005=SHA256SUMS_PHASE_1B_TASK_01.txt
REVIEW_PACKAGE_MEMBER_006=SHA256SUMS_PHASE_1B_TASK_02.txt
REVIEW_PACKAGE_MEMBER_007=SHA256SUMS_PHASE_1B_TASK_03.txt
REVIEW_PACKAGE_MEMBER_008=apps/api/package.json
REVIEW_PACKAGE_MEMBER_009=apps/api/src/health/health.route.ts
REVIEW_PACKAGE_MEMBER_010=apps/api/src/index.ts
REVIEW_PACKAGE_MEMBER_011=apps/api/src/plugins/scope.plugin.ts
REVIEW_PACKAGE_MEMBER_012=apps/api/src/server.ts
REVIEW_PACKAGE_MEMBER_013=apps/api/test/health.route.test.ts
REVIEW_PACKAGE_MEMBER_014=apps/api/test/scope.plugin.test.ts
REVIEW_PACKAGE_MEMBER_015=apps/api/tsconfig.json
REVIEW_PACKAGE_MEMBER_016=docs/architecture/API_CONTRACT_BASELINE.md
REVIEW_PACKAGE_MEMBER_017=docs/architecture/MODULE_BOUNDARIES_BASELINE.md
REVIEW_PACKAGE_MEMBER_018=docs/architecture/SECURITY_AND_PRIVACY_BASELINE.md
REVIEW_PACKAGE_MEMBER_019=docs/architecture/TEST_STRATEGY_BASELINE.md
REVIEW_PACKAGE_MEMBER_020=docs/contracts/V0_1_ACCEPTANCE_TRACEABILITY.md
REVIEW_PACKAGE_MEMBER_021=docs/contracts/V0_1_API_SCHEMA.json
REVIEW_PACKAGE_MEMBER_022=docs/contracts/V0_1_CONTENT_SCHEMA.json
REVIEW_PACKAGE_MEMBER_023=docs/contracts/V0_1_ERROR_CATALOG.md
REVIEW_PACKAGE_MEMBER_024=docs/contracts/V0_1_PERMISSION_MATRIX.md
REVIEW_PACKAGE_MEMBER_025=docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md
REVIEW_PACKAGE_MEMBER_026=docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md
REVIEW_PACKAGE_MEMBER_027=docs/project/PHASE_1B_RUNTIME_BASELINE_DECISION.md
REVIEW_PACKAGE_MEMBER_028=docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md
REVIEW_PACKAGE_MEMBER_029=docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md
REVIEW_PACKAGE_MEMBER_030=docs/project/PHASE_1B_TASK_02_PLAN.md
REVIEW_PACKAGE_MEMBER_031=docs/project/PHASE_1B_TASK_03_PLAN.md
REVIEW_PACKAGE_MEMBER_032=docs/reviews/PHASE_1B_TASK_01_REVIEW.md
REVIEW_PACKAGE_MEMBER_033=docs/reviews/PHASE_1B_TASK_02_REVIEW.md
REVIEW_PACKAGE_MEMBER_034=docs/reviews/PHASE_1B_TASK_03_REVIEW.md
REVIEW_PACKAGE_MEMBER_035=eslint.config.mjs
REVIEW_PACKAGE_MEMBER_036=package.json
REVIEW_PACKAGE_MEMBER_037=packages/contracts/package.json
REVIEW_PACKAGE_MEMBER_038=packages/contracts/src/content.ts
REVIEW_PACKAGE_MEMBER_039=packages/contracts/src/errors.ts
REVIEW_PACKAGE_MEMBER_040=packages/contracts/src/index.ts
REVIEW_PACKAGE_MEMBER_041=packages/contracts/src/requests.ts
REVIEW_PACKAGE_MEMBER_042=packages/contracts/test/schema.test.ts
REVIEW_PACKAGE_MEMBER_043=packages/contracts/tsconfig.json
REVIEW_PACKAGE_MEMBER_044=packages/tenant/package.json
REVIEW_PACKAGE_MEMBER_045=packages/tenant/src/index.ts
REVIEW_PACKAGE_MEMBER_046=packages/tenant/src/resolve-scope.ts
REVIEW_PACKAGE_MEMBER_047=packages/tenant/src/scope-context.ts
REVIEW_PACKAGE_MEMBER_048=packages/tenant/test/isolation.test.ts
REVIEW_PACKAGE_MEMBER_049=packages/tenant/tsconfig.json
REVIEW_PACKAGE_MEMBER_050=packages/validation/package.json
REVIEW_PACKAGE_MEMBER_051=packages/validation/src/content.ts
REVIEW_PACKAGE_MEMBER_052=packages/validation/src/envelope.ts
REVIEW_PACKAGE_MEMBER_053=packages/validation/src/index.ts
REVIEW_PACKAGE_MEMBER_054=packages/validation/src/primitives.ts
REVIEW_PACKAGE_MEMBER_055=packages/validation/src/request.ts
REVIEW_PACKAGE_MEMBER_056=packages/validation/test/schema.test.ts
REVIEW_PACKAGE_MEMBER_057=packages/validation/tsconfig.json
REVIEW_PACKAGE_MEMBER_058=pnpm-lock.yaml
REVIEW_PACKAGE_MEMBER_059=pnpm-workspace.yaml
REVIEW_PACKAGE_MEMBER_060=scripts/verify_task_02.mjs
REVIEW_PACKAGE_MEMBER_061=scripts/verify_task_03.mjs
REVIEW_PACKAGE_MEMBER_062=tests/contracts/package-boundaries.test.mjs
REVIEW_PACKAGE_MEMBER_063=tests/workspace/paths.test.mjs
REVIEW_PACKAGE_MEMBER_064=tsconfig.base.json
```

## Rendered reference hashes

```text
DEPENDENCY_AUTHORITY_SHA256=B7F7509914399DD660D02F6FFD52E735EDF9EA850C0BF5C92F95698D8104F007
DEPENDENCY_GRAPH_SHA256=9C9674E43042B229DEA32E3AF912B1876339259F0D6F581275AD3EE99001BA11
IMPLEMENTATION_PLAN_SHA256=4DAB62008CCB3658D00DB1ACA080419F98E934D7E2C0F5DDC84BD7F05D2D6BED
CONTRACT_SHA256_RECORDING=EXTERNAL_FORMALIZATION_RECEIPT_ONLY_NO_SELF_REFERENCE
CONTRACT_ENCODING=UTF-8
CONTRACT_BOM=NO
CONTRACT_LINE_ENDING=LF
CONTRACT_TRAILING_LF=EXACTLY_ONE
```

## 1. Authority and objective

The project owner approved formalization of the T10/T12 dependency decision and rendering of
this contract. The dependency authority is
`docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md`. Task 12 depends on
`T02 -> T03 -> T05`; Task 10 depends on `T05 -> T08 -> T12`.

Task 03 will eventually provide deterministic, fail-closed tenant and campus request scope,
scope-aware cache-key construction and verification, and a narrowly isolated Fastify boundary.
This contract does not start that implementation. `/goal` and implementation authorization
remain `NOT_GRANTED` until the project owner separately approves the rendered authority SHA and
this contract SHA.

## 2. Frozen anchors and governance

The accepted Task 01 and Task 02 commits, contracts, acceptance record, review reports, fixed
review packages, and historical manifests remain unchanged. The current branch is the accepted
Task 02 branch and no target Task 03 branch exists. There is no Git remote.

`AGENTS.md` still contains the Phase 1A/Phase 1B boundary conflict. This formalization records
that conflict and does not modify `AGENTS.md`. No interpretation of this contract may silently
override that file before a separate owner-approved governance authority exists.

## 3. Implementation scope after later approval

The future implementation scope is limited to:

- typed trusted actor and membership inputs supplied by an upstream caller;
- fail-closed tenant and optional campus scope resolution;
- immutable scope context and typed denial reasons;
- deterministic scope-aware cache-key build and exact candidate verification;
- an isolated Fastify `preHandler` plugin for routes explicitly marked `scopeRequired`;
- synthetic tests for positive paths, denial order, cache-key collisions, request envelopes,
  handler non-execution, and preservation of unscoped routes.

The implementation must reuse `@student-care/validation.uuidSchema`, must not trim or coerce
trusted inputs, and must use only synthetic UUIDs and text.

## 4. Explicit non-scope

This contract does not authorize login, token parsing, sessions, identity providers, membership
storage, role persistence, databases, migrations, business routes, client applications, queues,
file storage, COS, external APIs, cache infrastructure, live AI, payment, deployment, production
data, personal data, or production credentials. It also does not authorize wiring the production
API index or server; the plugin's trusted input source remains deferred to a later contract.

## 5. Dependency and file boundaries

The package direction remains:

```text
@student-care/contracts -> @student-care/validation -> @student-care/tenant -> approved consumers
```

The tenant package may depend on the workspace validation package only. It must not import Zod
directly, Fastify, the API application, or external packages. The API plugin may consume the
contracts and tenant packages using dependencies already approved by this contract; no new direct
Fastify dependency is authorized.

The 19 future implementation paths are listed in the canonical manifest. They are not writable
in this formalization run. A later `/goal` must restate the exact implementation whitelist and
may authorize only the minimum necessary paths.

## 6. Verification plan after separate implementation authorization

The later implementation must use the existing Node test runner and execute red tests before the
minimal implementation, then focused regression checks. It must run the exact package and root
commands listed in the canonical manifest, including typecheck, lint, format, tests, coverage,
build, health regression, and `node scripts/verify_task_03.mjs`.

No command in this section was run by this formalization. Dependency installation, registry access,
service startup, and review-package generation are post-approval operations only.

## 7. Review package boundary

The 64-member list is a future candidate manifest, not a generated ZIP. The authority file is
member 028, the Task 03 contract is member 004, and the package path uses the existing project
naming convention. ZIP generation remains prohibited until a later owner approval explicitly
confirms the member count and member-list SHA.

## 8. Stop conditions and approval gate

Stop immediately on any missing or changed frozen anchor, unauthorized file, real data, secret,
external request, dependency or registry operation, service, branch, staging, commit, push,
deployment, Task 04 artifact, or implementation path. A failure must be reported as a failure;
it must not be repaired by widening the whitelist or changing a frozen contract.

The formalization result is ready for owner review only. The next authorization must explicitly
approve both stable SHA values:

```text
DEPENDENCY_AUTHORITY_SHA256=B7F7509914399DD660D02F6FFD52E735EDF9EA850C0BF5C92F95698D8104F007
TASK_03_CONTRACT_SHA256=EXTERNAL_FORMALIZATION_RECEIPT_ONLY
TASK_03_GOAL_AUTHORIZATION=NOT_GRANTED_UNTIL_SEPARATE_OWNER_APPROVAL
TASK_03_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED_UNTIL_SEPARATE_OWNER_APPROVAL
```

After that approval, the owner must provide a separate `/goal` authorization before any Task 03
branch, dependency operation, implementation, test execution requiring new packages, staging, or
commit. The current formalization run ends before all of those operations.
