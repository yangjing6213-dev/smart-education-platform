# Phase 1B Task 09 Codex Execution Contract

This contract records the reviewed Task 09 Stage A formalization, the existing
four-file module evidence, the completed entry repair, and the separately
authorized Stage C1 evidence operation. It does not authorize C2, Task 10+, or
any path outside the exact C1 whitelist.

## Contract status and authorization

```text
TASK_ID=PHASE_1B_TASK_09
TASK_NAME=NEWCOMER_GUIDES
TASK_STAGE=STAGE_C1_AUTHORIZED_NOT_STARTED
TASK_STATUS=OWNER_REVIEW_GATE_BEFORE_C1
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
TARGET_BRANCH=CURRENT_CHECKOUT_NO_NEW_BRANCH_OR_WORKTREE
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD_BEFORE_V17=68d8209e90e48bb3f139173a423f6e768e200fde
OWNER_AUTHORIZATION_EVIDENCE=Current explicit project-owner authorization for Task 09 V17 governance synchronization and Stage C1 review, detached manifest, and deterministic ZIP dated 2026-09-04; no separate evidence identifier supplied
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V17.md
ACTIVE_GOVERNANCE_SHA256=CF8A20D84EE25F4848E2D3CFE43802AF0BEEE96AE17BF4044038E6B695F92917
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
TASK_09_STAGE_C1_STATUS=AUTHORIZED_NOT_STARTED
TASK_09_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_09_STAGE_C2_STATUS=NOT_STARTED
TASK_09_STARTED=YES_STAGE_C1_AUTHORIZED
TASK_10_PLUS_STARTED=NO
TASK_10_PLUS_AUTHORIZATION=NOT_GRANTED
```

V17 is the current active governance authority; V16, V15, and V14 remain
historical and frozen. Task 08 is accepted and frozen. Task 09 Stage A passed
owner review, the original four module files exist, the entry repair is
implemented and verified, and Stage B passed owner review. C1 evidence is
authorized but not started. This authorization does not grant C2 or Task 10+
authorization.

## Objective and approved source scope

Task 09 is named **Newcomer guides** and depends on Tasks 05 and 07
(`T05 -> T07`). The approved source plan defines the following future product
slice:

- Input: staff role policy, versioned content, and a file access port.
- Output: a searchable internal guide list and detail projection.
- Red cases: visitor access, suspended membership, and a guide outside the
  allowed campus scope must be denied.
- Implementation direction: internal visibility and bounded search filters.
- Green case: an authorized synthetic staff member can search and read only
  allowed versions.
- Future implementation files:
  `apps/api/src/modules/guides/guide.service.ts`,
  `apps/api/src/routes/staff-guides.route.ts`,
  `apps/user-web/src/pages/staff-guides.tsx`, and
  `apps/api/src/modules/guides/guide.test.ts`.
- Future implementation commit reference:
  `feat: add scoped newcomer guides`.

The source plan remains the bounded implementation reference. The original
four Stage B module files are existing evidence and are not repair targets in
this synchronization.

## Bounded security and data contract

The future service must derive `tenant_id` and `campus_id` on the server from
trusted identity, active membership, allowed campus scope, and the required
staff capability. Client-supplied tenant, campus, role, membership,
publication, ownership, version, search-scope, or file-access claims are
untrusted inputs and cannot widen authorization.

Guides are internal staff content, not visitor content. Visitor requests,
missing or suspended membership, foreign tenants, foreign or disallowed
campuses, missing capability, unauthorized versions, unbounded searches, and
unapproved file references must fail closed. A denied read or write must not
cause an unintended state change or successful audit result.

The future public-facing boundary is empty for this task: no guide content,
staff-only metadata, tenant or campus identifiers, membership data, internal
version details, moderation fields, audit internals, or file-provider details
may be exposed to visitors or unauthorized callers. Search must use bounded,
allowlisted filters and return only records visible to the server-derived
scope. Version and publication checks must occur before content or file
details are returned. File access must use the approved scoped file-access
port and safe references; arbitrary URLs, provider tokens, executable media,
and cross-scope references are prohibited.

Only clearly synthetic fixtures and fictional labels may be used. No real
names, contact details, child records, photographs, credentials, production
data, external provider, network service, persistent production database, or
production migration is permitted.

## Stage A historical file boundary

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_09_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_09_PLAN.md
STAGE_A_WRITE_POLICY=CREATE_ONLY_THE_TWO_EXACT_FILES
STAGE_A_FORMAT_GATE=CHECK_ONLY_THE_TWO_STAGE_A_FILES
STAGE_A_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
```

Stage A created only the two contract and plan files above. The earlier V16
governance synchronization is historical; this active V17 contract permits
only the C1 evidence paths below and does not authorize C2 or Task 10+.

## Stage B original module boundary

The following four files are the existing Stage B module evidence. They are
not repair targets in this synchronization:

```text
TASK_09_STAGE_B_ORIGINAL_EXACT_FILES=apps/api/src/modules/guides/guide.service.ts|apps/api/src/routes/staff-guides.route.ts|apps/user-web/src/pages/staff-guides.tsx|apps/api/src/modules/guides/guide.test.ts
TASK_09_STAGE_B_ORIGINAL_FILES_POLICY=PRODUCTION_MODULES_FROZEN_GUIDE_TEST_ADDITIVE_REPAIR_ONLY
TASK_09_STAGE_B_GUIDE_TEST_REPAIR_POLICY=ADDITIVE_BUILD_SERVER_INTEGRATION_ASSERTION_ONLY
```

## Stage B entry-repair boundary

```text
TASK_09_STAGE_B_REPAIR_EXACT_FILES=apps/api/src/server.ts|apps/admin-web/src/main.ts|apps/api/src/modules/guides/guide.test.ts|apps/admin-web/test/home-content.test.mjs
TASK_09_STAGE_B_REPAIR_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_REPAIR_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_09_STAGE_B_OWNER_REVIEW=PASSED
```

The repair must call `registerStaffGuideRoutes` from `buildServer` using
injectable `GuideService` and `StaffGuideScopeResolver` options. It must add a
real local `/admin/staff-guides` rendering branch using the existing static
entry pattern and synthetic data. It must not change the `/staff/guides`
module contract. The repair was committed as `68d8209e90e48bb3f139173a423f6e768e200fde`
and passed owner review. No other repository path was included in Stage B.

## Stage C1 evidence boundary

```text
TASK_09_STAGE_C1_EXACT_FILES=docs/reviews/PHASE_1B_TASK_09_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_09.txt|artifacts/review-package/student-care-saas-platform-phase1b-task-09-review-pack-v1.0.zip
TASK_09_STAGE_C1_WRITE_POLICY=EXACT_WHITELIST_ONLY
TASK_09_STAGE_C1_REVIEW_SCOPE=ORIGINAL_TASK09_MODULE_EVIDENCE_PLUS_TASK09_STAGE_B_ENTRY_REPAIR_AND_VERIFICATION
TASK_09_STAGE_C1_MANIFEST_POLICY=DETACHED_ROOT_MANIFEST_EXCLUDED_FROM_ZIP
TASK_09_STAGE_C1_ZIP_POLICY=DETERMINISTIC_ARCHIVE_ONLY_APPROVED_SOURCE_MEMBERS
TASK_09_STAGE_C1_MEMBER_ORDER=POSIX_RELATIVE_PATHS_CASEFOLDED_UNICODE_ORDINAL_ASCENDING
TASK_09_STAGE_C1_FIXED_TIMESTAMP=1980-01-01T00:00:00
TASK_09_STAGE_C1_DETERMINISTIC_REBUILD=REQUIRED_BYTE_IDENTICAL
TASK_09_STAGE_C1_TEXT_FORMAT=UTF8_NO_BOM_LF_EXACTLY_ONE_TRAILING_LF
TASK_09_STAGE_C1_PACKAGE_SOURCE_SCOPE=TASK09_STAGE_A_CONTRACT_AND_PLAN|TASK09_STAGE_B_ORIGINAL_FOUR_FILES|TASK09_STAGE_B_REPAIR_FOUR_FILES|TASK09_C1_REVIEW
TASK_09_STAGE_C1_PACKAGE_EXCLUSIONS=V17_AUTHORITY|V16_AUTHORITY|V15_AUTHORITY|C1_MANIFEST|C1_ZIP|TASK01_TO_TASK08_EVIDENCE|OLD_TASK06_VERIFIER|PROTECTED_UNTRACKED_EVIDENCE|C2_ACCEPTANCE|TASK10_PLUS|GENERATED_OUTPUT|UNRELATED_FILES
```

Stage C1 may create only the three exact evidence paths above. The detached
manifest records each ZIP member's actual SHA-256 and is excluded from the
archive. The ZIP must use POSIX paths, the specified case-folded Unicode
ordinal order, the fixed timestamp, and a byte-identical deterministic rebuild.
The review must report local evidence separately from owner acceptance and
must stop at `C1_OWNER_REVIEW_GATE_BEFORE_C2`.

## Lifecycle and owner gates

```text
STAGE_A=CONTRACT_AND_PLAN_FORMALIZATION_COMPLETE
STAGE_A_OWNER_REVIEW_GATE=AFTER_READ_ONLY_FORMAT_AND_BOUNDARY_CHECKS
STAGE_B=ORIGINAL_MODULE_EVIDENCE_PLUS_ENTRY_REPAIR_COMPLETE
STAGE_C1=REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP_AUTHORIZED_NOT_STARTED
STAGE_C1_OWNER_REVIEW_GATE=AFTER_STAGE_C1_BEFORE_STAGE_C2
STAGE_C2=SEPARATE_ACCEPTANCE_RECORD_ONLY_AFTER_EXPLICIT_OWNER_PASS
TASK_09_STAGE_A_AUTHORIZATION=GRANTED
TASK_09_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_ENTRY_REPAIR_AUTHORIZATION=GRANTED
TASK_09_STAGE_B_REPAIR_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_09_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK_09_STAGE_C1_AUTHORIZATION=GRANTED
TASK_09_STAGE_C1_STATUS=AUTHORIZED_NOT_STARTED
TASK_09_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_09_STAGE_C2_STATUS=NOT_STARTED
TASK_09_STARTED=YES_STAGE_C1_AUTHORIZED
TASK_10_PLUS_STARTED=NO
TASK_10_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK09_STAGE_C1_BEFORE_C2
STOP_REASON=TASK09_STAGE_C1_OWNER_REVIEW_GATE_BEFORE_C2
```

The required lifecycle is Stage A -> owner review passed -> original module
evidence -> entry-repair authorization -> repair implementation and
verification -> Stage B owner review passed -> C1 review/manifest/
deterministic ZIP -> owner review gate -> C2 acceptance-only. This authority
authorizes only C1 evidence and stops before C2.

## V17 C1 verification and stop conditions

The V17 C1 verification set is:

```text
Node crypto SHA-256 for V17, all synchronized active reference files, and C1 artifacts
.NET SHA256 over the same exact bytes
UTF-8 without BOM, CR=0, LF-only, exactly one trailing LF for text files
No self-SHA value in V17 or any synchronized file
git status --short --branch --untracked-files=all
git rev-parse HEAD
git diff --check
git diff --cached --check
git remote
git worktree list
```

The final boundary check must show only V17 and the synchronized active
reference paths plus the three authorized C1 paths, in addition to the
already-known protected untracked evidence.
Those protected paths are existence/state inputs only and must not be read,
modified, deleted, moved, staged, packaged, or committed. The index must remain
clean.

Any V16/V15 drift in historical files, dependency-anchor drift, missing
protected evidence, unexpected path, format/hash failure, self-reference,
missing authorization traceability, real data or secret, C2 artifact, or
Task 10+ artifact is a fail-closed stop.

## Prohibited operations

```text
IMPLEMENTATION_CODE=NO
TEST_CODE=NO
SCHEMA_OR_MIGRATION=NO
DEPENDENCY_OR_LOCKFILE_CHANGE=NO
PACKAGE_OR_SCRIPT_CHANGE=NO
NETWORK_REGISTRY_EXTERNAL_API_PROVIDER=NO
SERVICE_DATABASE_BROWSER_OR_PRODUCTION_DATA=NO
BRANCH_OR_WORKTREE=NO
GOAL_OR_TASK_DISPATCH=NO
GIT_ADD_STAGE_COMMIT_PUSH_PR_DEPLOY=NO
DESIGN_SPEC=NO
CURRENT_TASK09_STAGE_B_ENTRY_REPAIR=COMPLETE_AND_FROZEN_FOR_C1_REVIEW
TASK09_STAGE_C1=AUTHORIZED_ONLY
TASK09_STAGE_C2=NO
TASK10_PLUS=NO
TASK01_TO_TASK08_FREEZENS_OR_V1_TO_V16_MODIFICATION=NO
PROTECTED_UNTRACKED_EVIDENCE_READ_OR_MODIFICATION=NO
```

This contract is UTF-8 without BOM, LF-only, and has exactly one trailing LF.
It does not record its own actual SHA-256.
