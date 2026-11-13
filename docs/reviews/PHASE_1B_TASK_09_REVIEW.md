# Phase 1B Task 09 C1 Review

## Review identity

TASK_ID=PHASE_1B_TASK_09
TASK_NAME=NEWCOMER_GUIDES
STAGE=C1_REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP
REVIEW_DATE=2026-09-04
ACTIVE_AUTHORITY=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V17.md
ACTIVE_AUTHORITY_SHA256=CF8A20D84EE25F4848E2D3CFE43802AF0BEEE96AE17BF4044038E6B695F92917
OWNER_AUTHORIZATION=TASK09_STAGE_C1_AUTHORIZATION=GRANTED
OWNER_ACCEPTANCE_OF_THIS_C1=NOT_YET_GRANTED

## Scope

This review covers the existing Task 09 Stage B module evidence and the
subsequent entry repair. The original module implementation was recorded by
commit `d77e671` (`feat: add scoped newcomer guides`). The entry repair was
recorded by commit `68d8209` (`fix: wire newcomer guide entrypoints`), with
current governance commit `5c64f97` (`docs: activate Phase 1B Task 09 C1
governance V17`).

The approved source members are:

- `PHASE_1B_TASK_09_CODEX_EXECUTION.md`
- `docs/project/PHASE_1B_TASK_09_PLAN.md`
- `apps/api/src/modules/guides/guide.service.ts`
- `apps/api/src/routes/staff-guides.route.ts`
- `apps/user-web/src/pages/staff-guides.tsx`
- `apps/api/src/modules/guides/guide.test.ts`
- `apps/api/src/server.ts`
- `apps/admin-web/src/main.ts`
- `apps/admin-web/test/home-content.test.mjs`
- `docs/reviews/PHASE_1B_TASK_09_REVIEW.md`

The four original module paths and the four repair paths overlap at
`apps/api/src/modules/guides/guide.test.ts`; the package therefore contains
ten unique approved members including this review.

## Stage B evidence

The original module evidence provides:

- typed internal guide records with tenant and campus scope;
- bounded, allowlisted search inputs and published-only projections;
- server-side active-membership and capability checks;
- detail checks for publication, version, scope, and approved file references;
- fail-closed behavior for visitor, inactive membership, missing capability,
  foreign scope, stale version, draft, and unsafe or unavailable files;
- synthetic fixtures only.

The entry repair provides:

- `buildServer()` registration of `registerStaffGuideRoutes`;
- server-derived staff guide campus scope from the trusted active membership;
- injectable guide service and staff guide scope resolver options;
- a reachable `/admin/staff-guides` static admin-web branch;
- local synthetic guide list, bounded text search, detail projection, version,
  publication status, and approved file-reference display;
- no API, network, or production-service connection from the static admin page.

## Local verification

The following checks were run against the current checkout:

- `corepack pnpm --filter @student-care/api typecheck`: PASS
- `corepack pnpm --filter @student-care/api lint`: PASS
- `corepack pnpm --filter @student-care/api build`: PASS
- `node --test apps/api/dist/src/modules/guides/guide.test.js`: PASS, 8/8
- `corepack pnpm --filter @student-care/admin-web typecheck`: PASS
- `corepack pnpm --filter @student-care/admin-web lint`: PASS
- `corepack pnpm --filter @student-care/admin-web build`: PASS
- `node --test apps/admin-web/test/home-content.test.mjs`: PASS, 1/1
- `corepack pnpm exec prettier --check` on the Task 09 source and test
  files: PASS

The API guide test includes the `buildServer()` route-registration and trusted
active-membership scope regression. The admin-web test includes the static
`/admin/staff-guides`, `新成员指南`, and `模拟数据` entry assertions.

## Historical independent blocker

`node scripts/verify_task_06.mjs --mode=structure` was run without modifying
the verifier. It failed on its independent historical V9 baseline checks,
including its frozen-path and V9-authority-reference expectations. It also
reported that the current `apps/admin-web/test/home-content.test.mjs` differs
from a frozen Task 08 package member. This is a historical verifier/package
baseline conflict accepted as independent from Task 09 C1. The verifier,
Task 01-08 frozen evidence, and frozen packages remain unchanged.

This C1 review does not repair, bypass, or reinterpret that historical
verifier failure.

## C1 artifact boundary

Only the following three repository paths may be created:

- `docs/reviews/PHASE_1B_TASK_09_REVIEW.md`
- `SHA256SUMS_PHASE_1B_TASK_09.txt`
- `artifacts/review-package/student-care-saas-platform-phase1b-task-09-review-pack-v1.0.zip`

The detached manifest is excluded from the ZIP. The ZIP excludes all
authorities, Task 01-08 evidence, the old Task 06 verifier, protected
untracked evidence, the C2 acceptance record, Task 10+ files, generated
output, and unrelated files. ZIP members use POSIX paths, case-folded Unicode
ordinal ascending order, and the fixed timestamp `1980-01-01T00:00:00`.

## Gate

TASK_09_STAGE_C1_STATUS=READY_FOR_OWNER_REVIEW
TASK_09_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_10_PLUS_STARTED=NO
OWNER_REVIEW_GATE=TASK09_STAGE_C1_BEFORE_C2
STOP_REASON=TASK09_STAGE_C1_OWNER_REVIEW_GATE_BEFORE_C2
