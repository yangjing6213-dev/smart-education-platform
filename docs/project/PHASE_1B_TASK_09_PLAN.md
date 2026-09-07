# Phase 1B Task 09 Newcomer Guides Plan

This plan records the reviewed Task 09 Stage A formalization, the existing
four-file module evidence, the completed entry repair, the owner-reviewed C1
evidence, and the accepted C2 record. It preserves V17 and all earlier history
as frozen and does not authorize Task 10+ or any path outside the exact V18
governance synchronization whitelist.

## Current anchors

```text
TASK_ID=PHASE_1B_TASK_09
TASK_NAME=NEWCOMER_GUIDES
STAGE=STAGE_C2_ACCEPTED_AND_FROZEN
STATUS=ACCEPTED_AND_FROZEN
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD_BEFORE_V18=f13a5f11aa20bb9b0fe793abe9270f707c8562d6
OWNER_AUTHORIZATION_EVIDENCE=Current explicit project-owner authorization for Phase 1B V18 governance synchronization after Task 09 Stage C2 acceptance
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V18.md
ACTIVE_GOVERNANCE_SHA256=20157D3F8B0DC997E380E75961BB308E66FCB0BD71214FACA2A713460BC7343E
TASK_05_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
TASK_05_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_07_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_07_ACCEPTANCE.md
TASK_07_DEPENDENCY_STATUS=ACCEPTED_AND_FROZEN
TASK_09_STAGE_A_AUTHORIZATION=GRANTED
TASK_09_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_MODULE_EVIDENCE=EXISTS_IN_ORIGINAL_FOUR_FILES
TASK_09_STAGE_B_ENTRY_REPAIR_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_REPAIR_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_09_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_C1_AUTHORIZATION=GRANTED
TASK_09_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_C2_AUTHORIZATION=GRANTED
TASK_09_STAGE_C2_STATUS=ACCEPTED
TASK_09_STATUS=ACCEPTED_AND_FROZEN
TASK_09_STARTED=YES_STAGE_C2_ACCEPTED
TASK_09_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_09_ACCEPTANCE.md
TASK_09_ACCEPTANCE_SHA256=93BC037DEB90D179099F723D86A8409DD486C8D627C1337E734826BC7A70DC62
TASK_09_C1_REVIEW_SHA256=11C34F65DC71C458E58E3E79F3F03CFA002398F395123C40BC57C8F07FC3F62A
TASK_09_C1_MANIFEST_SHA256=AB5613C56062E08D32C1A3C3BD2FFB0806D0C068DEFD5D77E44ACAEECEE7AE90
TASK_09_C1_ZIP_SHA256=237DA795845AB4848B3553172830759CDE74728F85C9333ABCA5E33873B8F6D4
TASK_10_PLUS_STARTED=NO
TASK_10_PLUS_AUTHORIZATION=NOT_GRANTED
```

V18 is the current active authority; V17 and all earlier authorities remain
historical and frozen. Task 08 is accepted and frozen. Task 09 Stage A and
Stage B passed owner review, C1 evidence passed owner review, and C2 is accepted
and frozen. This does not authorize Task 10+.

## Goal and source requirements

Task 09 is **Newcomer guides**, with dependencies on Tasks 05 and 07
(`T05 -> T07`). The accepted Phase 1B source plan specifies:

- Input: staff role policy, versioned content, and a file access port.
- Output: searchable internal guide list and detail projection.
- Red tests: visitor access, suspended membership, and guides outside the
  allowed campus scope are denied.
- Implementation direction: internal visibility and bounded search filters.
- Green test: an authorized synthetic staff member searches and reads only
  allowed versions.
- Implementation files:
  `apps/api/src/modules/guides/guide.service.ts`,
  `apps/api/src/routes/staff-guides.route.ts`,
  `apps/user-web/src/pages/staff-guides.tsx`, and
  `apps/api/src/modules/guides/guide.test.ts`.
- Implementation commit reference: `feat: add scoped newcomer guides`.

The original four Stage B paths are existing module evidence. The historical
V16 entry-repair whitelist is limited to the following four paths; no source code,
route registration, UI entry, verifier, package configuration, or other
implementation file is created or changed in this governance synchronization.

## Scope and trust boundaries

The future implementation must preserve the platform's multi-tenant rules:

- Every guide query and file lookup is scoped by server-derived `tenant_id`
  and `campus_id`.
- Trusted identity, active membership, allowed campus membership, and the
  required staff capability are resolved on the server.
- Client-provided tenant, campus, role, membership, publication, ownership,
  version, search scope, and file claims are untrusted and cannot authorize
  access.
- Guides are internal staff content. Visitor access is denied and no public
  guide projection is defined by this task.
- Search is bounded by allowlisted terms, filters, result limits, and the
  server-resolved scope. It must not become an unrestricted content oracle.
- Only allowed, published/version-valid content and approved file references
  may be returned to an authorized staff member.

Foreign-tenant or foreign-campus access, a disallowed campus, inactive or
suspended membership, missing capability, unauthorized version, out-of-range
search, malformed scope claims, and unapproved file access must fail closed.
Denied operations must not mutate content state or emit a successful audit
event. Internal version, moderation, membership, tenant/campus management,
provider, audit, and unsafe file details must not leak to unauthorized callers.

Only clearly fictional synthetic fixtures may be used. The future task may not
use real names, contact details, child records, photographs, credentials,
production data, external providers, network services, a persistent
production database, or migrations.

## Stage B implementation whitelist

The original Stage B implementation evidence exists, and its separately
authorized entry repair is implemented, verified, and accepted by the owner:

```text
STAGE_B_ORIGINAL_EXACT_FILES=apps/api/src/modules/guides/guide.service.ts|apps/api/src/routes/staff-guides.route.ts|apps/user-web/src/pages/staff-guides.tsx|apps/api/src/modules/guides/guide.test.ts
STAGE_B_ORIGINAL_STATUS=MODULE_EVIDENCE_EXISTS
STAGE_B_REPAIR_EXACT_FILES=apps/api/src/server.ts|apps/admin-web/src/main.ts|apps/api/src/modules/guides/guide.test.ts|apps/admin-web/test/home-content.test.mjs
STAGE_B_REPAIR_AUTHORIZATION=GRANTED
STAGE_B_REPAIR_STATUS=IMPLEMENTED_AND_VERIFIED
STAGE_B_OWNER_REVIEW=PASSED
STAGE_B_STATUS=OWNER_REVIEW_PASSED
```

No other path was included in Stage B. The Stage C1 evidence paths below are
historical and frozen. Any required shared
contract, auth module, verifier, package script, lockfile, schema, migration,
or configuration file remains a fail-closed blocker requiring a new explicit
authority and whitelist.

## Stage C1 evidence boundary (HISTORICAL/FROZEN)

```text
STAGE_C1_EXACT_FILES=docs/reviews/PHASE_1B_TASK_09_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_09.txt|artifacts/review-package/student-care-saas-platform-phase1b-task-09-review-pack-v1.0.zip
STAGE_C1_WRITE_POLICY=EXACT_WHITELIST_ONLY
STAGE_C1_REVIEW_SCOPE=ORIGINAL_TASK09_MODULE_EVIDENCE_PLUS_TASK09_STAGE_B_ENTRY_REPAIR_AND_VERIFICATION
STAGE_C1_MANIFEST_POLICY=DETACHED_ROOT_MANIFEST_EXCLUDED_FROM_ZIP
STAGE_C1_ZIP_POLICY=DETERMINISTIC_ARCHIVE_ONLY_APPROVED_SOURCE_MEMBERS
STAGE_C1_MEMBER_ORDER=POSIX_RELATIVE_PATHS_CASEFOLDED_UNICODE_ORDINAL_ASCENDING
STAGE_C1_FIXED_TIMESTAMP=1980-01-01T00:00:00
STAGE_C1_DETERMINISTIC_REBUILD=REQUIRED_BYTE_IDENTICAL
STAGE_C1_TEXT_FORMAT=UTF8_NO_BOM_LF_EXACTLY_ONE_TRAILING_LF
STAGE_C1_PACKAGE_SOURCE_SCOPE=TASK09_STAGE_A_CONTRACT_AND_PLAN|TASK09_STAGE_B_ORIGINAL_FOUR_FILES|TASK09_STAGE_B_REPAIR_FOUR_FILES|TASK09_C1_REVIEW
STAGE_C1_PACKAGE_EXCLUSIONS=V17_AUTHORITY|V16_AUTHORITY|V15_AUTHORITY|C1_MANIFEST|C1_ZIP|TASK01_TO_TASK08_EVIDENCE|OLD_TASK06_VERIFIER|PROTECTED_UNTRACKED_EVIDENCE|C2_ACCEPTANCE|TASK10_PLUS|GENERATED_OUTPUT|UNRELATED_FILES
STAGE_C1_STATUS=OWNER_REVIEW_PASSED
STAGE_C1_REVIEW_SHA256=11C34F65DC71C458E58E3E79F3F03CFA002398F395123C40BC57C8F07FC3F62A
STAGE_C1_MANIFEST_SHA256=AB5613C56062E08D32C1A3C3BD2FFB0806D0C068DEFD5D77E44ACAEECEE7AE90
STAGE_C1_ZIP_SHA256=237DA795845AB4848B3553172830759CDE74728F85C9333ABCA5E33873B8F6D4
STAGE_C1_OWNER_REVIEW_GATE=PASSED
STAGE_C2_EXACT_FILES=docs/project/PHASE_1B_TASK_09_ACCEPTANCE.md
STAGE_C2_POLICY=ACCEPTANCE_ONLY_ACCEPTED_AND_FROZEN
STAGE_C2_STATUS=ACCEPTED
STAGE_C2_ACCEPTANCE_SHA256=93BC037DEB90D179099F723D86A8409DD486C8D627C1337E734826BC7A70DC62
```

Stage C1 created only the three exact evidence paths. The detached manifest
records every ZIP member's actual SHA-256 and is excluded from the ZIP. The
archive uses POSIX paths, the case-folded Unicode ordinal order, the fixed
timestamp, and a byte-identical deterministic rebuild. C1 passed owner review;
the separate C2 acceptance record is accepted and frozen.

## Accepted verification intent

Stage B must use TDD and prove at least:

1. An authorized synthetic staff member can search within a bounded query and
   server-derived campus scope.
2. Detail reads return only an explicit internal projection for an allowed
   version and approved file reference.
3. Visitor access, suspended membership, missing capability, foreign tenant,
   foreign or disallowed campus, unauthorized version, unbounded search, and
   unapproved file access are denied without unintended state changes.
4. Client-supplied scope, role, publication, ownership, version, and file
   claims cannot widen access.
5. Fixtures remain synthetic-only and no external service, production data,
   database, migration, or provider is used.

## Lifecycle and V18 gate

```text
STAGE_A=CONTRACT_AND_PLAN_FORMALIZATION_COMPLETE
STAGE_A_FORMAT_GATE=CHECK_ONLY_THE_TWO_STAGE_A_FILES
STAGE_A_OWNER_REVIEW_GATE=AFTER_READ_ONLY_FORMAT_AND_BOUNDARY_CHECKS
STAGE_B=ORIGINAL_MODULE_EVIDENCE_PLUS_ENTRY_REPAIR_COMPLETE
STAGE_C1=REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP_OWNER_REVIEW_PASSED
STAGE_C1_OWNER_REVIEW_GATE=PASSED
STAGE_C2=ACCEPTANCE_RECORD_ACCEPTED_AND_FROZEN
TASK_09_STAGE_A_AUTHORIZATION=GRANTED
TASK_09_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_REPAIR_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_REPAIR_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_09_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_C1_AUTHORIZATION=GRANTED
TASK_09_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_C2_AUTHORIZATION=GRANTED
TASK_09_STAGE_C2_STATUS=ACCEPTED
TASK_09_STATUS=ACCEPTED_AND_FROZEN
TASK_09_STARTED=YES_STAGE_C2_ACCEPTED
TASK_10_PLUS_STARTED=NO
TASK_10_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=V18_GOVERNANCE_SYNC_BEFORE_TASK10_PLUS
STOP_REASON=V18_GOVERNANCE_SYNC_OWNER_REVIEW_GATE_BEFORE_TASK10
```

The lifecycle is Stage A -> owner review passed -> original module evidence ->
entry-repair authorization -> entry repair -> Stage B owner review passed ->
C1 review/manifest/deterministic ZIP -> C1 owner review passed -> C2
acceptance-only -> accepted and frozen. V18 synchronizes this completed
lifecycle and stops before Task 10+.

## V18 governance synchronization verification and stop conditions

Run only the approved V18 governance synchronization verification for V18 and
the active reference files:

```text
Node crypto SHA-256 over V18 and each synchronized file
.NET SHA256 over the same exact bytes
UTF-8 validation, no BOM, CR=0, LF-only, exactly one trailing LF for text files
No actual self-SHA value in V18
git status --short --branch --untracked-files=all
git rev-parse HEAD
git diff --check
git diff --cached --check
git remote
git worktree list
```

The final path audit must show V18 and the nine synchronized active reference
paths as the governance commit, in addition to the pre-existing protected
untracked evidence. Those protected paths are existence/state inputs
only and must not be read, modified, deleted, moved, staged, packaged, or
committed. The index remains clean and no other path may be created or
modified.

Any historical authority drift, dependency drift, missing protected evidence,
unexpected path, format/hash failure, self-SHA, missing authorization
traceability, real data or secret, or Task 10+ artifact is a fail-closed stop.

## File format and prohibited operations

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_09_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_09_PLAN.md
FILE_ENCODING=UTF-8
FILE_BOM=NO
FILE_LINE_ENDING=LF
FILE_TRAILING_LF=EXACTLY_ONE
FILE_SELF_SHA=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
GIT_POLICY=V18_EXPLICIT_TEN_PATH_STAGE_AND_SINGLE_GOVERNANCE_COMMIT_ONLY
PUSH_PR_DEPLOY=NO
IMPLEMENTATION_OR_TEST_CODE=NO
DEPENDENCY_NETWORK_SERVICE_DATABASE_MIGRATION=NO
CURRENT_TASK09_STAGE_B_IMPLEMENTATION=COMPLETE_AND_FROZEN
TASK09_STAGE_C1=OWNER_REVIEW_PASSED_AND_FROZEN
TASK09_STAGE_C2=ACCEPTED_AND_FROZEN
TASK10_PLUS=NO
TASK01_TO_TASK08_FREEZENS_OR_V1_TO_V17_MODIFICATION=NO
PROTECTED_UNTRACKED_EVIDENCE_READ_OR_MODIFICATION=NO
```

This plan is UTF-8 without BOM, LF-only, and has exactly one trailing LF. It
does not record its own actual SHA-256.
