# Phase 1B Task 06 Stage C1 review report

## Gate and scope

```text
TASK_ID=PHASE_1B_TASK_06
TASK_NAME=INSTITUTION_PROFILE_AND_HOME_CONTENT_MANAGEMENT
STAGE_C1_STATUS=FINAL_EVIDENCE_READY
TASK_06_STARTED=YES_STAGE_B_IMPLEMENTATION
STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED
STAGE_C1_AUTHORIZATION=GRANTED
PROJECT_OWNER_ACCEPTANCE=WAITING_AT_OWNER_REVIEW_GATE
TARGET_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=6bb0295c41e82b32b7cb9797ce534a6b8fd5dbdf
PARENT_HEAD=4db46c39d6a1f18517fe561a43b2207e8fa1dfde
STAGE_B_IMPLEMENTATION_COMMIT=6bb0295c41e82b32b7cb9797ce534a6b8fd5dbdf
STAGE_B_IMPLEMENTATION_COMMIT_MESSAGE=feat: add Phase 1B Task 06 institution content management
```

This report covers the owner-authorized Task 06 Stage B implementation commit
and its C1 evidence. It does not claim project-owner acceptance and does not
create the Stage C2 acceptance record.

## Implementation boundary

The implementation adds an in-memory institution service that adapts the
accepted Task 05 versioned content model for tenant-scoped institution profile
content and campus-scoped home content. Draft creation and update require a
trusted active membership and `content:write`. Publish and unpublish require
the explicit `content:publish` capability, use expected-version checks, and
emit the existing provider-independent in-memory publication audit event after
a successful state transition.

The admin API route derives tenant and campus scope from the trusted request
context and the active membership selected by the server. Client tenant,
campus, role, publication, and version claims are not authorization sources.
Invalid content blocks, foreign tenant or campus scope, inactive membership,
insufficient capability, type conflicts, and stale versions fail closed before
a state-changing write. Stale commands preserve state and produce no success
publication event.

The visitor route uses an explicit server-owned public scope resolver. It
returns only the current published allowlisted projection and denies when no
resolver is configured; drafts, unpublished records, non-public records,
editor notes, moderation fields, actor references, membership details,
administrative metadata, and concurrency internals are not returned.

The admin-web surface is a minimal static, dependency-free synthetic fixture.
It provides bounded draft and publish controls without a real service, login,
database, persistence layer, or external provider.

## TDD and verification evidence

| Check                           | Result                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Institution policy RED to GREEN | PASS: scope, membership, capability, type isolation, stale version, state preservation, audit, and public projection tests           |
| Admin/public route regression   | PASS: trusted scope derivation, client-claim rejection, anonymous resolver boundary, campus selection, and standard denial envelopes |
| Admin-web static test           | PASS: runnable entrypoint and bounded home-content surface                                                                           |
| TypeScript                      | PASS: `corepack pnpm typecheck`, exit 0                                                                                              |
| ESLint                          | PASS: `corepack pnpm lint`, exit 0                                                                                                   |
| Prettier                        | PASS: `corepack pnpm format:check`, exit 0                                                                                           |
| Workspace tests                 | PASS: `corepack pnpm test`, exit 0; API 44/44 and admin-web 1/1                                                                      |
| Coverage                        | PASS: `corepack pnpm test:coverage`, exit 0; covered API modules and prior packages report 100 percent branch coverage               |
| Build                           | PASS: `corepack pnpm build`, exit 0                                                                                                  |
| Task 06 structure verifier      | PASS: `node scripts/verify_task_06.mjs --mode=structure`, exit 0                                                                     |
| Task 06 final-review verifier   | PASS: `node scripts/verify_task_06.mjs --mode=final-review`, exit 0                                                                  |
| Git diff checks                 | PASS: `git diff --check` and `git diff --cached --check`, exit 0                                                                     |

The verifier and workspace tests also checked the Task 01-05 frozen evidence
hashes, the active governance anchor, the no-remote boundary, the clean index,
the exact Task 06 implementation boundary, and absence of Task 06 C1/C2 files
before this C1 generation.

## Review findings and residual risks

The following findings are recorded for owner review and are not silently
reclassified as acceptance:

1. The content model uses a shared repository identity keyed by scope and key;
   the service-level institution/home type checks prevent cross-resource use,
   but a future durable schema should make resource type an explicit identity
   dimension rather than relying on this in-memory guard.
2. The anonymous public entrypoint is safe only when a server-owned public
   scope resolver is explicitly supplied. Without that resolver it denies
   access; production integration must not replace this with client-provided
   tenant or campus claims.
3. Multiple active memberships can cover different campuses. The current
   server resolver selects the membership that covers the requested campus;
   callers must keep the requested campus server-derived and must not infer
   broader access from another membership.
4. The Task 06 verifier is a local structural/evidence boundary check. It does
   not replace full code review, runtime deployment validation, or a durable
   audit review, and its fixed-base and frozen-evidence assertions should be
   revisited if the repository baseline changes.
5. `AGENTS.md` contains historical wording that still says Task 06 is
   unauthorized, while the owner-approved Task 06 Stage B amendment and the
   current implementation commit authorize this completed Stage B. The
   historical file was not modified because it is outside this C1 whitelist.

These risks do not authorize a later task or a production integration. No
real personal data, secret, credential, token, cookie, production
configuration, network request, external service, database, migration, or
durable Task 17 audit implementation was introduced.

## Frozen evidence and stage boundary

```text
GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V4.md
GOVERNANCE_SHA256=11FD81FB5E9738B36F7EB495424F9D4161F6F5172DFDBA564BE1D5F0FD88DB5E
TASK05_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
TASK05_ACCEPTANCE_SHA256=640BCF9B2B5C33ED1499E1F5C35E58608872953DCF0059A33086312FC260ECDD
TASK06_STAGE_A_CONTRACT=PHASE_1B_TASK_06_CODEX_EXECUTION.md
TASK06_STAGE_A_PLAN=docs/project/PHASE_1B_TASK_06_PLAN.md
TASK04_AND_TASK05_FROZEN_EVIDENCE=UNCHANGED
TASK06_C1_FILES=docs/reviews/PHASE_1B_TASK_06_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_06.txt|artifacts/review-package/student-care-platform-phase1b-task-06-review-pack-v1.0.zip
TASK06_C2_FILE=docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md
TASK06_C2_FILE_PRESENT=NO
TASK07_PLUS_STARTED=NO
OWNER_REVIEW_GATE=after_StageC1_evidence_before_StageC2_acceptance
```

The six existing untracked Task 04/05 C1 evidence files remain outside this
package and were not modified, moved, deleted, or staged. Task 06 C2 remains
unauthorized until a separate explicit project-owner PASS after this C1 gate.

## Deterministic review package

The detached manifest records the actual SHA-256 of every ZIP member and is not
a ZIP member. Members use POSIX relative paths and Unicode ordinal ascending
order. The package contains the two Task 06 Stage A records, the actual Stage B
implementation and verification files from commit `6bb0295c...`, and this
review report only. It excludes all Task 04/05 evidence, the Task 06 manifest,
the Task 06 ZIP itself, the Task 06 acceptance record, generated output, and
unrelated files.

```text
REVIEW_PACKAGE=artifacts/review-package/student-care-platform-phase1b-task-06-review-pack-v1.0.zip
REVIEW_PACKAGE_MANIFEST=SHA256SUMS_PHASE_1B_TASK_06.txt
REVIEW_PACKAGE_MEMBER_COUNT=22
REVIEW_PACKAGE_MEMBER_ORDER=POSIX_RELATIVE_PATHS_UNICODE_ORDINAL_ASCENDING
REVIEW_PACKAGE_MANIFEST_PACKAGING=DETACHED_ROOT_MANIFEST
REVIEW_PACKAGE_FIXED_TIMESTAMP=1980-01-01T00:00:00
REVIEW_PACKAGE_DETERMINISTIC_REBUILD=REQUIRED
REVIEW_PACKAGE_EXCLUSIONS=.git|node_modules|dist|coverage|build|Task04_C1|Task05_C1|Task05_C2|Task06_C2|secrets|real_data|unrelated_files
```

## Safety and stop invariants

```text
NETWORK_ACCESS=NO
REGISTRY_ACCESS=NO
DEPENDENCY_INSTALL_EXECUTED=NO
SERVICE_STARTED=NO
DATABASE_OR_MIGRATION_EXECUTED=NO
REAL_PERSONAL_DATA_USED=NO
PRODUCTION_CREDENTIAL_USED=NO
TASK07_PLUS_STARTED=NO
TASK06_C2_ACCEPTANCE_CREATED=NO
PUSH_EXECUTED=NO
PR_CREATED=NO
DEPLOYMENT_EXECUTED=NO
STAGE_C1_FILES_ONLY=YES
STAGE_C1_EVIDENCE_STAGED=NO_BEFORE_EXPLICIT_C1_COMMIT
```

`STAGE_C1_STATUS=FINAL_EVIDENCE_READY` is the terminal status for this phase.
The review, detached manifest, and deterministic ZIP must be independently
validated, then committed as the sole C1 change. Stop at `OWNER_REVIEW_GATE`;
do not create or prewrite Task 06 C2 acceptance.
