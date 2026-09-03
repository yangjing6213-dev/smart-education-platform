# Phase 1B Task 06 Stage C1 Review

## Gate and scope

```text
TASK_ID=PHASE_1B_TASK_06
TASK_NAME=INSTITUTION_PROFILE_AND_HOME_CONTENT_MANAGEMENT
STAGE_C1_STATUS=FINAL_EVIDENCE_READY
PROJECT_OWNER_ACCEPTANCE=WAITING_AT_OWNER_REVIEW_GATE
TARGET_BRANCH=feature/phase-1b-task-04-identity-membership
STAGE_B_IMPLEMENTATION_COMMIT=6bb0295c41e82b32b7cb9797ce534a6b8fd5dbdf
C1_REGENERATION_BASE_HEAD=52e6583c77c181c2ea7c94ffac484e8ad111eded
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V5.md
ACTIVE_GOVERNANCE_SHA256=BC8B2232F3203368BD712586464734614D0E56D062792AFA284F8794A50914DB
TASK05_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
TASK05_ACCEPTANCE_SHA256=640BCF9B2B5C33ED1499E1F5C35E58608872953DCF0059A33086312FC260ECDD
TASK06_C2_ACCEPTANCE=ABSENT
TASK06_C2_AUTHORIZATION=NOT_GRANTED
TASK07_PLUS_STARTED=NO
```

This report records the owner-authorized Task 06 Stage B implementation and
the resulting C1 evidence. It does not claim project-owner acceptance and does
not create or prewrite the Task 06 C2 acceptance record.

## Stage B evidence

The implementation adapts the accepted Task 05 versioned content lifecycle for
tenant-scoped institution profile content and tenant- or allowed-campus-scoped
home content. Server-derived trusted identity and active membership provide
scope; client tenant, campus, role, publication, and version claims are not
authorization sources. Draft editing requires `content:write`; publishing
requires `content:publish` or the permitted tenant-admin capability.

Expected-version checks fail closed and preserve state. Invalid blocks,
foreign tenant or campus scope, inactive membership, insufficient capability,
and resource-type conflicts are denied before state changes. Successful
publication transitions emit one provider-independent in-memory publication
audit event. The visitor projection returns only published allowlisted fields
and denies without an explicit server-owned public scope resolver.

The admin-web surface is a static, dependency-free synthetic fixture. No real
identity provider, external service, database, migration, durable Task 17
audit store, production configuration, secret, token, cookie, or personal data
was introduced.

## Verification record

```text
TYPECHECK=PASS
LINT=PASS
FORMAT_CHECK=PASS
TEST=PASS
COVERAGE=PASS
BUILD=PASS
TASK06_STRUCTURE_VERIFY=PASS
TASK06_FINAL_REVIEW_VERIFY=PASS
GIT_DIFF_CHECK=PASS
GIT_CACHED_DIFF_CHECK=PASS
```

The Stage B verification record was produced before this C1 regeneration and
covered the institution policy, admin/public routes, admin-web shell, package
boundaries, frozen Task 01-05 evidence, and no-remote boundary.

## Review findings and residual risks

1. Resource type is guarded at the service layer but is not yet an explicit
   durable repository identity dimension.
2. Anonymous public access is fail-closed without a server-owned public scope
   resolver; production wiring must not substitute client claims.
3. Multiple active memberships can cover different campuses, so the resolver
   must select the membership covering the requested server-derived campus.
4. The verifier is a local structural and evidence boundary check, not a
   deployment, durable audit, or full security review.
5. V4 remains a historical/frozen authority. V5 is now the active authority;
   Task 06 C1 remains pending owner review.

## Detached C1 package

The manifest is detached from the ZIP and contains one SHA-256 record for each
actual ZIP member. The package is deterministic, uses fixed timestamps, and
contains no manifest, ZIP, V5 authority, Task 04/05 evidence, Task 06 C2
acceptance, generated output, or unrelated files.

```text
REVIEW_PACKAGE=artifacts/review-package/student-care-platform-phase1b-task-06-review-pack-v1.0.zip
REVIEW_PACKAGE_MANIFEST=SHA256SUMS_PHASE_1B_TASK_06.txt
REVIEW_PACKAGE_MEMBER_COUNT=22
REVIEW_PACKAGE_MEMBER_ORDER=POSIX_RELATIVE_PATHS_CASEFOLDED_UNICODE_ORDINAL_ASCENDING
REVIEW_PACKAGE_FIRST_MEMBER=apps/admin-web/index.html
REVIEW_PACKAGE_FIXED_TIMESTAMP=1980-01-01T00:00:00
REVIEW_PACKAGE_DETERMINISTIC_REBUILD=REQUIRED
REVIEW_PACKAGE_EXCLUSIONS=MANIFEST|ZIP|V5_AUTHORITY|TASK04_EVIDENCE|TASK05_EVIDENCE|TASK06_C2|GENERATED_OUTPUT|UNRELATED_FILES
```

The exact member order is:

```text
apps/admin-web/index.html
apps/admin-web/package.json
apps/admin-web/src/main.ts
apps/admin-web/src/pages/home-content.tsx
apps/admin-web/test/home-content.test.mjs
apps/admin-web/tsconfig.json
apps/api/package.json
apps/api/src/modules/institution/institution.service.ts
apps/api/src/modules/institution/institution.test.ts
apps/api/src/routes/admin-institution.route.ts
apps/api/src/server.ts
docs/project/PHASE_1B_TASK_06_PLAN.md
docs/reviews/PHASE_1B_TASK_06_REVIEW.md
package.json
packages/auth/test/policy.test.ts
packages/contracts/src/identity.ts
packages/contracts/test/identity.test.ts
PHASE_1B_TASK_06_CODEX_EXECUTION.md
pnpm-lock.yaml
scripts/verify_task_06.mjs
tests/contracts/package-boundaries.test.mjs
tests/workspace/paths.test.mjs
```

## Frozen boundaries and stop

```text
V4_AUTHORITY_SHA256=11FD81FB5E9738B36F7EB495424F9D4161F6F5172DFDBA564BE1D5F0FD88DB5E
TASK04_ACCEPTANCE_SHA256=113870DB0895145A183740F1B97D2F4102E3D6EEC4806A12A017C41C7CAE4202
TASK05_ACCEPTANCE_SHA256=640BCF9B2B5C33ED1499E1F5C35E58608872953DCF0059A33086312FC260ECDD
TASK04_AND_TASK05_FROZEN_EVIDENCE=UNCHANGED
OLD_TASK06_C1_EVIDENCE=REGENERATED_IN_PLACE_WITH_SAME_22_MEMBER_SET
TASK06_C2_FILE_PRESENT=NO
STAGE_C2_AUTHORIZATION=NOT_GRANTED_UNTIL_OWNER_PASS
NETWORK_ACCESS=NO
DEPENDENCY_INSTALL_EXECUTED=NO
SERVICE_STARTED=NO
DATABASE_OR_MIGRATION_EXECUTED=NO
PUSH_EXECUTED=NO
PR_CREATED=NO
DEPLOYMENT_EXECUTED=NO
```

The three C1 files are the sole authorized evidence outputs. After independent
manifest, ZIP, format, frozen-evidence, and Git checks, they are committed as
the sole change for this C1 regeneration. Stop at `OWNER_REVIEW_GATE_BEFORE_TASK06_C2`.
