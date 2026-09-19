# Phase 1B Task 19 Codex Execution Contract

TASK_ID=PHASE_1B_TASK_19
TASK19_TYPE=PHASE_1B_V0_1_FINAL_DELIVERY_ACCEPTANCE
TASK19_STAGE_A_AUTHORIZATION=GRANTED
TASK19_STAGE_A_STATUS=PROPOSED_PENDING_OWNER_REVIEW
TASK19_STARTED=NO
TASK19_IMPLEMENTATION_AUTHORIZED=NO
TASK19_STAGE_B_AUTHORIZATION=NOT_GRANTED
TASK19_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK19_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK20_PLUS_STARTED=NO
TASK20_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK19_STAGE_A_OWNER_REVIEW_GATE
STOP_REASON=TASK19_STAGE_A_OWNER_REVIEW_GATE

## 1. Authority and baseline

- Project root: `C:\Users\HU\Documents\student-care-saas-platform`.
- Stage A baseline HEAD:
  `b3f300cd3c749cc06dc462d149353ac8cd0f5528`.
- Stage A baseline tree:
  `e9ed53fc1c1246d2fe0957d46ab9a7056efd9a57`.
- Active governance remains
  `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md`
  with SHA-256
  `7BECA819534A223D84C4D95FD117FC68C4B9CD4CDFC2E5345AF09E9547D188AB`.
- V42 is not modified by this task. Its old Task 17 gate and
  `TASK18_PLUS_STARTED=NO` / `TASK18_PLUS_AUTHORIZATION=NOT_GRANTED` fields are
  `HISTORICAL/FROZEN` statements from the V42 authorization point, not the
  current Task 19 Stage A control plane.
- Task 18 is `ACCEPTED_AND_FROZEN`. Its product checkpoint is
  `e0c41bb859a87a031cf8b7d39373aea3b712681a`; its accepted control-plane
  checkpoint is `b3f300cd3c749cc06dc462d149353ac8cd0f5528`.
- Task 19 is final delivery acceptance work, not product feature development.
- `EXPECTED_UNTRACKED_PATHS=71` is the Stage B pre-start clean-baseline count.
  This count is the exact 71-path protected read-only set enumerated below; no
  nonexistent paths are restored to satisfy an obsolete count.

## 2. Goal and user value

Task 19 proves that the Phase 1B V0.1 repository can be independently
reproduced, installed from the locked dependency graph, validated across the
three clients, packaged deterministically, rolled back to the accepted Task 18
checkpoint, and reviewed without production data or external services. The
user value is one auditable delivery boundary: a reviewer can trace every
claim to a command result, browser case, frozen source byte, or package member
instead of relying on narrative status alone.

Task 19 does not add product behavior, change authorization rules, migrate a
database, deploy, release, or start Task 20.

## 3. Stage A exact write set

This Stage A authorization permits writes only to these five paths:

1. `PHASE_1B_TASK_19_CODEX_EXECUTION.md`
2. `docs/project/PHASE_1B_TASK_19_PLAN.md`
3. `docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md`
4. `AGENTS.md`
5. `PLANS.md`

Stage A must not stage or commit these files. It must not run E2E, browser,
build, service, packaging, installation, release-verifier final mode, or any
Stage B command.

## 4. Frozen inputs and non-rewrite rule

Tasks 01-18, the V42 authority, Task 18's six release-gate files, product code,
tests, lockfile, acceptance records, reviews, manifests, ZIP files, and other
frozen evidence are read-only. Stage B may verify bytes and behavior but must
not rewrite evidence to make a check pass. A mismatch is a blocker, not a
formatting opportunity.

The exact tracked Task 01-18 contract/plan/evidence index at the Stage A
baseline contains 50 paths. The case-folded Unicode ordinal ascending,
LF-joined, no-terminal-LF path-list SHA-256 is
`490AFCAA36E7FF32132571DC61A05D3E7C2AD3176394449F4CD597D87CF04781`:

```text
docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md
docs/project/PHASE_1B_TASK_02_ACCEPTANCE.md
docs/project/PHASE_1B_TASK_02_PLAN.md
docs/project/PHASE_1B_TASK_03_ACCEPTANCE.md
docs/project/PHASE_1B_TASK_03_PLAN.md
docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md
docs/project/PHASE_1B_TASK_04_PLAN.md
docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md
docs/project/PHASE_1B_TASK_05_PLAN.md
docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md
docs/project/PHASE_1B_TASK_06_PLAN.md
docs/project/PHASE_1B_TASK_07_ACCEPTANCE.md
docs/project/PHASE_1B_TASK_07_PLAN.md
docs/project/PHASE_1B_TASK_08_ACCEPTANCE.md
docs/project/PHASE_1B_TASK_08_PLAN.md
docs/project/PHASE_1B_TASK_09_ACCEPTANCE.md
docs/project/PHASE_1B_TASK_09_PLAN.md
docs/project/PHASE_1B_TASK_10_ACCEPTANCE.md
docs/project/PHASE_1B_TASK_12_ACCEPTANCE.md
docs/project/PHASE_1B_TASK_12_PLAN.md
docs/project/PHASE_1B_TASK_13_PLAN.md
docs/project/PHASE_1B_TASK_14_PLAN.md
docs/project/PHASE_1B_TASK_15_PLAN.md
docs/project/PHASE_1B_TASK_16_PLAN.md
docs/project/PHASE_1B_TASK_17_PLAN.md
docs/reviews/PHASE_1B_TASK_01_REVIEW.md
docs/reviews/PHASE_1B_TASK_02_REVIEW.md
docs/reviews/PHASE_1B_TASK_03_REVIEW.md
docs/reviews/PHASE_1B_TASK_06_REVIEW.md
docs/reviews/PHASE_1B_TASK_07_REVIEW.md
PHASE_1B_TASK_01_CODEX_EXECUTION.md
PHASE_1B_TASK_02_CODEX_EXECUTION.md
PHASE_1B_TASK_03_CODEX_EXECUTION.md
PHASE_1B_TASK_04_CODEX_EXECUTION.md
PHASE_1B_TASK_05_CODEX_EXECUTION.md
PHASE_1B_TASK_06_CODEX_EXECUTION.md
PHASE_1B_TASK_07_CODEX_EXECUTION.md
PHASE_1B_TASK_08_CODEX_EXECUTION.md
PHASE_1B_TASK_09_CODEX_EXECUTION.md
PHASE_1B_TASK_12_CODEX_EXECUTION.md
PHASE_1B_TASK_13_CODEX_EXECUTION.md
PHASE_1B_TASK_14_CODEX_EXECUTION.md
PHASE_1B_TASK_15_CODEX_EXECUTION.md
PHASE_1B_TASK_16_CODEX_EXECUTION.md
PHASE_1B_TASK_17_CODEX_EXECUTION.md
SHA256SUMS_PHASE_1B_TASK_01.txt
SHA256SUMS_PHASE_1B_TASK_02.txt
SHA256SUMS_PHASE_1B_TASK_03.txt
SHA256SUMS_PHASE_1B_TASK_06.txt
SHA256SUMS_PHASE_1B_TASK_07.txt
```

The entire tracked read-only input universe is the tree named by the exact
owner-reviewed Stage B baseline HEAD. Stage B authorization must supply that
40-hex HEAD, prove it descends from the Stage A checkpoint, and prove its tree
contains no unauthorized product or frozen-evidence change. An absent or
ambiguous Stage B baseline is `STATUS=BLOCKED`.

The 71 protected untracked paths are a proposed future Stage B read-only input
set. Stage A reads only their Git path, size, and mtime metadata. It does not
read, hash by content, copy, execute, import, package, modify, or overwrite any
of them.

All three path lists in this section use POSIX repository-relative paths sorted
case-folded Unicode ordinal ascending, with the original path as the ordinal
tiebreaker. The serialized list is UTF-8 without BOM, paths joined by one LF,
and no terminal LF:

```text
TASK19_PROTECTED_71_PATH_COUNT=71
TASK19_PROTECTED_71_PATH_LIST_SHA256=2EEDEDCAED72F9215B33F0F0BB09D48B397572A4622E77A51206B963F2004474
TASK19_PRODUCT_13_PATH_COUNT=13
TASK19_PRODUCT_13_PATH_LIST_SHA256=0AF4BAF26D7B857812C76C612A428B18281C7CAF0DA022CDC5F3D7EB26278132
TASK19_FROZEN_EVIDENCE_58_PATH_COUNT=58
TASK19_FROZEN_EVIDENCE_58_PATH_LIST_SHA256=B9E657C02348911914C475AA4A0CEA6A96DC79C0B215525DDAB31B80E5D7B17F
```

The 13 proposed product inputs are:

1. `apps/mini-program/src/navigation/routes.ts`
2. `apps/mini-program/src/pages/staff.test.ts`
3. `apps/mini-program/src/pages/staff/quick-action.ts`
4. `apps/mini-program/src/pages/staff/workbench.ts`
5. `apps/mini-program/src/pages/visitor.test.ts`
6. `apps/mini-program/src/pages/visitor/content.ts`
7. `apps/mini-program/src/pages/visitor/home.ts`
8. `apps/mini-program/src/routes/staff.routes.ts`
9. `apps/mini-program/tsconfig.json`
10. `apps/user-web/src/pages/staff-report.tsx`
11. `apps/user-web/src/pages/staff-workbench.tsx`
12. `apps/user-web/src/pages/staff.test.tsx`
13. `apps/user-web/src/routes/staff.routes.tsx`

The 58 proposed frozen-evidence inputs are:

1. `artifacts/review-package/student-care-platform-phase1b-task-04-review-pack-v1.0.zip`
2. `artifacts/review-package/student-care-platform-phase1b-task-05-review-pack-v1.0.zip`
3. `artifacts/review-package/student-care-platform-phase1b-task-08-review-pack-v1.0.zip`
4. `artifacts/review-package/student-care-platform-phase1b-task-10-review-pack-v1.0.zip`
5. `artifacts/review-package/student-care-platform-phase1b-task-11-review-pack-v1.0.zip`
6. `artifacts/review-package/student-care-platform-phase1b-task-12-review-pack-v1.0.zip`
7. `artifacts/review-package/student-care-platform-phase1b-task-13-review-pack-v1.0.zip`
8. `artifacts/review-package/student-care-platform-phase1b-task-14-review-pack-v1.0.zip`
9. `artifacts/review-package/student-care-platform-phase1b-task-15-review-pack-v1.0.zip`
10. `artifacts/review-package/student-care-platform-phase1b-task-16-review-pack-v1.0.zip`
11. `artifacts/review-package/student-care-platform-phase1b-task-17-review-pack-v1.0.zip`
12. `artifacts/review-package/student-care-saas-platform-phase1b-task-09-review-pack-v1.0.zip`
13. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V29.md`
14. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V30.md`
15. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V32.md`
16. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V33.md`
17. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V34.md`
18. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V35.md`
19. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V36.md`
20. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V37.md`
21. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V38.md`
22. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V39.md`
23. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V40.md`
24. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V41.md`
25. `docs/project/PHASE_1B_TASK_10_PLAN.md`
26. `docs/project/PHASE_1B_TASK_11_ACCEPTANCE.md`
27. `docs/project/PHASE_1B_TASK_11_PLAN.md`
28. `docs/project/PHASE_1B_TASK_13_ACCEPTANCE.md`
29. `docs/project/PHASE_1B_TASK_14_ACCEPTANCE.md`
30. `docs/project/PHASE_1B_TASK_15_ACCEPTANCE.md`
31. `docs/project/PHASE_1B_TASK_16_ACCEPTANCE.md`
32. `docs/project/PHASE_1B_TASK_17_ACCEPTANCE.md`
33. `docs/reviews/PHASE_1B_TASK_04_REVIEW.md`
34. `docs/reviews/PHASE_1B_TASK_05_REVIEW.md`
35. `docs/reviews/PHASE_1B_TASK_08_REVIEW.md`
36. `docs/reviews/PHASE_1B_TASK_09_REVIEW.md`
37. `docs/reviews/PHASE_1B_TASK_10_REVIEW.md`
38. `docs/reviews/PHASE_1B_TASK_11_REVIEW.md`
39. `docs/reviews/PHASE_1B_TASK_12_REVIEW.md`
40. `docs/reviews/PHASE_1B_TASK_13_REVIEW.md`
41. `docs/reviews/PHASE_1B_TASK_14_REVIEW.md`
42. `docs/reviews/PHASE_1B_TASK_15_REVIEW.md`
43. `docs/reviews/PHASE_1B_TASK_16_REVIEW.md`
44. `docs/reviews/PHASE_1B_TASK_17_REVIEW.md`
45. `PHASE_1B_TASK_10_CODEX_EXECUTION.md`
46. `PHASE_1B_TASK_11_CODEX_EXECUTION.md`
47. `SHA256SUMS_PHASE_1B_TASK_04.txt`
48. `SHA256SUMS_PHASE_1B_TASK_05.txt`
49. `SHA256SUMS_PHASE_1B_TASK_08.txt`
50. `SHA256SUMS_PHASE_1B_TASK_09.txt`
51. `SHA256SUMS_PHASE_1B_TASK_10.txt`
52. `SHA256SUMS_PHASE_1B_TASK_11.txt`
53. `SHA256SUMS_PHASE_1B_TASK_12.txt`
54. `SHA256SUMS_PHASE_1B_TASK_13.txt`
55. `SHA256SUMS_PHASE_1B_TASK_14.txt`
56. `SHA256SUMS_PHASE_1B_TASK_15.txt`
57. `SHA256SUMS_PHASE_1B_TASK_16.txt`
58. `SHA256SUMS_PHASE_1B_TASK_17.txt`

A future Stage B may read content from these 71 paths only after the owner gives
explicit Stage B authorization that incorporates this exact list and all three
hashes. The 13 product inputs may then be copied into the isolated build copies.
The 58 frozen-evidence inputs may only be content-hashed, parsed for structure
and declared cross-references, and copied as immutable delivery-package members;
they must not be executed, imported into runtime, modified, or overwritten. If
Stage B authorization omits this read-only scope, final evidence closure is
`STATUS=BLOCKED` and no complete-delivery claim is permitted.

Repository-external execution-receipt JSON files are external evidence, not
repository delivery members. Stage A and Stage B must not read, copy, or package
them unless the owner separately provides exact external read-only paths. Task
19 verifies only the summaries and hashes already recorded in repository
acceptance files for those external receipts.

## 5. Future Stage B permanent write whitelist

Stage B is not authorized by this document. If separately authorized, its
permanent writes are limited to these exact 31 paths:

1. `scripts/verify-final-delivery.mjs`
2. `tests/release/final-delivery.spec.ts`
3. `docs/reviews/PHASE_1B_TASK_19_FINAL_DELIVERY_REVIEW.md`
4. `artifacts/final-delivery/task19/suite-evidence.json`
5. `artifacts/final-delivery/task19/browser-evidence.json`
6. `artifacts/final-delivery/task19/install-upgrade-rollback.json`
7. `artifacts/final-delivery/task19/performance-smoke.json`
8. `artifacts/final-delivery/task19/release-verifier-report.json`
9. `SHA256SUMS_PHASE_1B_TASK_19.txt`
10. `artifacts/release-package/student-care-platform-phase1b-v0.1-final-delivery-v1.0.zip`
11. `artifacts/final-delivery/task19/browser/web-visitor-home__desktop-1440x1024.png`
12. `artifacts/final-delivery/task19/browser/web-visitor-home__mobile-390x844.png`
13. `artifacts/final-delivery/task19/browser/web-visitor-home__small-mobile-320x568.png`
14. `artifacts/final-delivery/task19/browser/web-staff-workbench__desktop-1440x1024.png`
15. `artifacts/final-delivery/task19/browser/web-staff-workbench__mobile-390x844.png`
16. `artifacts/final-delivery/task19/browser/web-staff-workbench__small-mobile-320x568.png`
17. `artifacts/final-delivery/task19/browser/mini-visitor-home__desktop-1440x1024.png`
18. `artifacts/final-delivery/task19/browser/mini-visitor-home__mobile-390x844.png`
19. `artifacts/final-delivery/task19/browser/mini-visitor-home__small-mobile-320x568.png`
20. `artifacts/final-delivery/task19/browser/mini-staff-workbench__desktop-1440x1024.png`
21. `artifacts/final-delivery/task19/browser/mini-staff-workbench__mobile-390x844.png`
22. `artifacts/final-delivery/task19/browser/mini-staff-workbench__small-mobile-320x568.png`
23. `artifacts/final-delivery/task19/browser/flow-ai-learning-assistant__desktop-1440x1024.png`
24. `artifacts/final-delivery/task19/browser/flow-ai-learning-assistant__mobile-390x844.png`
25. `artifacts/final-delivery/task19/browser/flow-ai-learning-assistant__small-mobile-320x568.png`
26. `artifacts/final-delivery/task19/browser/flow-ai-teacher-summary__desktop-1440x1024.png`
27. `artifacts/final-delivery/task19/browser/flow-ai-teacher-summary__mobile-390x844.png`
28. `artifacts/final-delivery/task19/browser/flow-ai-teacher-summary__small-mobile-320x568.png`
29. `artifacts/final-delivery/task19/browser/admin-audit-logs__desktop-1440x1024.png`
30. `artifacts/final-delivery/task19/browser/admin-audit-logs__mobile-390x844.png`
31. `artifacts/final-delivery/task19/browser/admin-audit-logs__small-mobile-320x568.png`

Every permanent output path must be absent at Stage B start. Existing content is
not overwritten. Any required 32nd path is a contract failure and blocks Stage B.

## 6. Future Stage B temporary writes and cleanup

The only temporary write root is `artifacts/task-19/tmp/`, with these children:

- `artifacts/task-19/tmp/run-ledger.json`
- `artifacts/task-19/tmp/current/`
- `artifacts/task-19/tmp/rollback/`
- `artifacts/task-19/tmp/browser-harness/index.html`
- `artifacts/task-19/tmp/browser-harness/server.mjs`
- `artifacts/task-19/tmp/browser-harness/stdout.log`
- `artifacts/task-19/tmp/browser-harness/stderr.log`
- `artifacts/task-19/tmp/rebuild-a.zip`
- `artifacts/task-19/tmp/rebuild-b.zip`

`artifacts/task-19/tmp/` must be absent at Stage B start. Stage B may delete only
the files and directories it created under that root during the same run and
recorded in `run-ledger.json`.
`EXPECTED_UNTRACKED_PATHS=71` must match the pre-start clean baseline before the
temporary root is created.
`TASK19_TEMP_DELETE_AUTHORIZATION=CREATED_THIS_RUN_UNDER_EXACT_TEMP_ROOT_ONLY`.
Pre-existing files, repository-root `dist`, `coverage`, `.playwright-mcp`, caches,
and all protected paths must not be deleted or overwritten. Cleanup failure is
reported; it is not hidden with a broad clean command. `git clean`, `git reset
--hard`, `git checkout --`, `git add .`, and `git add -A` are prohibited.

## 7. E2E and three-client browser matrix

Stage B must run the five frozen Task 18 focused specs and the complete existing
workspace typecheck, lint, format, test, coverage, and build matrix inside the
isolated `artifacts/task-19/tmp/current/` copy. It must not change root source or
lock bytes to make a command pass.

The final browser matrix is exactly seven routes by three viewports, 21 cases:

```text
/web/visitor/home
/web/staff/workbench
/mini/visitor/home
/mini/staff/workbench
/flow/ai-learning-assistant
/flow/ai-teacher-summary
/admin/audit-logs

desktop-1440x1024
mobile-390x844
small-mobile-320x568
```

The first five routes already recognized by the frozen Task 18 verifier remain
its compatibility subset. The Task 19 verifier must additionally require
`/mini/visitor/home` and `/admin/audit-logs`; it must not modify the frozen Task
18 verifier. Each case requires a non-empty heading, zero horizontal overflow,
no page errors, no severe console errors, no failed requests, no unexpected
external requests, and a screenshot at the exact path in Section 5. Visual
review must reject overlap, clipping, unreadable controls, broken focus order,
missing focus indication, and desktop layouts mechanically squeezed into phone
widths. Browser input must be real existing client modules with synthetic data,
not replacement static success pages.

## 8. Tenant, campus, authorization, audit, and minor-safety gates

The acceptance matrix must prove all of the following with synthetic fixtures:

- trusted active membership injects tenant and campus scope server-side;
- visitor, missing, suspended, disabled, and revoked memberships are denied;
- injected tenant/campus identifiers and cross-tenant/cross-campus access fail;
- teacher-only summaries are denied to guardians and actors without capability;
- public projections exclude private, draft, unpublished, disabled, stale,
  foreign, and malformed records;
- the six accepted audit actions each create exactly one successful event on
  success and zero successful events on failure or rollback;
- no real minor, family, health, attendance, pickup, grade, contact, image, or
  relationship data is read, generated from a real person, or emitted;
- no provider, storage, production database, formal AI, credential, or external
  network is used.

Any weakened assertion, skipped deny case, or real-data ambiguity is
`PRODUCT_ISSUE` and blocks acceptance.

## 9. Release verifier, manifest, and deterministic ZIP

Stage B first adds a failing pure-logic test in
`tests/release/final-delivery.spec.ts`, then implements the minimum Node
standard-library verifier in `scripts/verify-final-delivery.mjs`. The verifier
must validate the Stage B baseline, V42 and lock anchors, frozen Task 18 six-file
digest, 50-path tracked evidence index, the authorized 71/13/58 read-only input
partition, command evidence, 21 browser cases, security matrix,
installation/rollback evidence, package members, detached manifest, and no
out-of-scope writes.

The verifier has three non-overlapping modes:

1. `--mode=structure` validates repository boundaries without requiring
   generated evidence.
2. `--mode=evidence` reads exactly the four prerequisite JSON reports
   (`suite-evidence.json`, `browser-evidence.json`,
   `install-upgrade-rollback.json`, and `performance-smoke.json`), the Task 19
   review, the 21 screenshots, and the frozen anchors. It writes the one
   permanent `release-verifier-report.json`; it must not read its own output and
   must not require the detached manifest or any final/rebuild ZIP to exist.
3. `--mode=final` is read-only. It validates the saved
   `release-verifier-report.json`, detached manifest, final ZIP, every ZIP
   member, and all frozen/source anchors. It must not modify the saved report or
   any other file; its final result exists only on stdout and in the Stage B
   receipt, never in a sixth JSON report.

Only after evidence mode has written and a read-back has frozen the report may
Stage B build `rebuild-a.zip` and `rebuild-b.zip`, prove them byte-identical,
copy those verified bytes to the permanent ZIP, write the detached manifest,
and invoke final mode.

The ZIP member set is exact by rule: every blob in the owner-approved Stage B
baseline tree, the 13 explicitly authorized product inputs, all 58 explicitly
authorized frozen-evidence inputs from Section 4, the two Task 19 verifier
source files, the Task 19 review, all five JSON reports including the saved
release-verifier report, and all 21 PNG screenshots. The 58 evidence members
remain immutable and non-executable: they may be hashed, structurally checked,
and packaged, but never executed, imported into runtime, modified, or
overwritten. Repository-external execution-receipt JSON, the detached manifest,
the ZIP itself, temporary files, `.git`, `node_modules`, build output, coverage,
and caches are excluded.

ZIP requirements:

- member names use POSIX separators and case-folded Unicode ordinal ascending;
- every entry is stored, not deflated;
- every entry has DOS timestamp `1980-01-01T00:00:00`;
- non-ASCII-capable names use UTF-8 flag `0x0800`;
- source length, SHA-256, CRC32, local header, central directory, and EOCD agree;
- `rebuild-a.zip` and `rebuild-b.zip` are byte-identical before the final ZIP is
  copied to its permanent path;
- each detached-manifest line is exactly
  `<64_HEX_SHA256><two ASCII spaces><POSIX relative path>` in ZIP member order;
  the file is UTF-8 without BOM, LF-only, has exactly one terminal LF, and is
  excluded from ZIP;
- the manifest does not list itself, and neither manifest nor ZIP embeds or
  lists the ZIP's own SHA. Node crypto and .NET SHA-256 must independently match
  for every permanent output.

The frozen `scripts/verify-release.mjs` remains evidence and is not edited. Its
Task 18 lifecycle CLI is not treated as the Task 19 control-plane verifier after
Stage A paths are checkpointed.

## 10. Installation, upgrade, rollback, and reproduction

No dependency version may change. Stage B may perform only an offline frozen
install in the two exact temporary copies:

```powershell
corepack pnpm --dir artifacts/task-19/tmp/current install --offline --frozen-lockfile --ignore-scripts
corepack pnpm --dir artifacts/task-19/tmp/rollback install --offline --frozen-lockfile --ignore-scripts
```

The local pnpm store must already contain every locked package. Missing store
content is `INFRASTRUCTURE_ISSUE`; network fallback is prohibited. The current
copy uses the separately authorized Stage B baseline plus the exact 13 product
inputs and two Task 19 verifier files. The rollback copy uses
`b3f300cd3c749cc06dc462d149353ac8cd0f5528` plus the same 13 product inputs and
the two Task 19 verifier files plus five Stage A documents needed only for exact
format validation. Those validation-only overlays do not alter the rollback
product bytes.

In each copy, commands run in this order: root typecheck, lint, and format gates;
explicit user-web typecheck and lint; mini-program `tsc --noEmit`, exact ESLint,
and exact Prettier gates; explicit Prettier coverage for Task 19 verifier and
governance files; root build; user-web build; frozen focused tests; root test;
and root coverage. Builds therefore exist before focused specs read
`packages/tenant/dist` or `apps/user-web/dist`. The report must prove the root
`pnpm-lock.yaml` raw blob never changed and record
`MIGRATION_ID=NONE_NO_SCHEMA_CHANGE`. Rollback is a rehearsal in the temporary
copy only; root HEAD, branch, index, and worktree are not switched or reset.

## 11. Performance smoke and record fields

Performance smoke records observations; it does not invent or enforce an SLA.
For every browser case, record:

```text
route
client
viewport
run_index
started_at_utc
duration_ms
dom_content_loaded_ms_or_null
load_ms_or_null
response_status_or_null
horizontal_overflow_px
page_errors
severe_console_errors
failed_requests
request_origins
environment_node
environment_browser
environment_os
```

Values must be measured during the run. Missing or non-finite duration data is a
blocker. No text may claim an SLA, percentile, capacity, production latency, or
performance guarantee from this localhost smoke.

## 12. Allowed Stage B commands

Only a separately authorized Stage B may run the following commands. Every
quality command runs first in `artifacts/task-19/tmp/current/` and then in
`artifacts/task-19/tmp/rollback/`, preserving this exact order within each copy:

1. read-only `git status`, `git diff`, `git show`, `git ls-tree`, `git ls-files`,
   `git rev-parse`, `git merge-base`, and `git hash-object` commands;
2. Node/.NET hashing and text/ZIP structure inspection;
3. the two exact offline install commands in Section 10;
4. `corepack pnpm typecheck`, `corepack pnpm lint`, and
   `corepack pnpm format:check`;
5. `corepack pnpm --filter @student-care/user-web typecheck` and
   `corepack pnpm --filter @student-care/user-web lint`;
6. `corepack pnpm exec tsc -p apps/mini-program/tsconfig.json --noEmit`;
7. `corepack pnpm exec eslint` followed by these exact eight mini-program TypeScript
   paths: `apps/mini-program/src/navigation/routes.ts`,
   `apps/mini-program/src/pages/staff.test.ts`,
   `apps/mini-program/src/pages/staff/quick-action.ts`,
   `apps/mini-program/src/pages/staff/workbench.ts`,
   `apps/mini-program/src/pages/visitor.test.ts`,
   `apps/mini-program/src/pages/visitor/content.ts`,
   `apps/mini-program/src/pages/visitor/home.ts`, and
   `apps/mini-program/src/routes/staff.routes.ts`;
8. `corepack pnpm exec prettier --check` followed by the 13 product paths in
   Section 4, and a separate `corepack pnpm exec prettier --check` followed by
   `scripts/verify-final-delivery.mjs`,
   `tests/release/final-delivery.spec.ts`,
   `PHASE_1B_TASK_19_CODEX_EXECUTION.md`,
   `docs/project/PHASE_1B_TASK_19_PLAN.md`,
   `docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md`, `AGENTS.md`, and
   `PLANS.md`;
9. `corepack pnpm build`, then
   `corepack pnpm --filter @student-care/user-web build`;
10. `node --test tests/e2e/visitor.spec.ts tests/e2e/staff.spec.ts
   tests/e2e/learning.spec.ts tests/security/isolation.spec.ts
   tests/release/acceptance.spec.ts`; current additionally runs
    `tests/release/final-delivery.spec.ts` after the five frozen specs;
11. `corepack pnpm test`, then `corepack pnpm test:coverage`;
12. `node artifacts/task-19/tmp/browser-harness/server.mjs --host=127.0.0.1
   --port=4173` and browser automation restricted to localhost and the 21 cases;
13. `node scripts/verify-final-delivery.mjs --mode=structure`, then
    `--mode=evidence`, and, only after packaging, `--mode=final`;
14. explicit copy and created-this-run cleanup operations confined to the paths
    in Sections 5 and 6.

No registry access, install outside the temp copies, root build output, external
service, database, migration, branch creation/switch, worktree, staging, commit,
push, PR, deploy, or release is implied. A later authorization may separately
permit an explicit Task 19 checkpoint; this Stage A does not.

## 13. Stop conditions and review standard

Stage B must return `STATUS=BLOCKED` without widening scope when any of these is
true: baseline ambiguity, V42/lock/frozen drift, protected metadata drift,
unexpected path, existing output collision, external request, real data,
failed deny test, incomplete browser matrix, visual defect, command failure,
offline-store miss, invalid encoding, manifest/ZIP mismatch, nondeterministic
rebuild, cleanup boundary failure, or need for a 32nd permanent path.

After two repair attempts for the same failure:

- `PRODUCT_ISSUE` means source behavior, contract behavior, security, privacy,
  accessibility, visual output, or package content is wrong.
- `INFRASTRUCTURE_ISSUE` means the approved local runtime, browser, offline pnpm
  store, filesystem, or toolchain cannot execute the unchanged contract.

Owner Review may pass Stage B only when all required commands have fresh exit-0
evidence, all 21 visual cases have inspectable screenshots, deterministic ZIP
rebuild is byte-equal, detached hashes match independently, the root repository
has no out-of-scope drift, limitations are explicit, and no SLA or production
claim is inferred. Stage B then stops at `TASK19_STAGE_B_OWNER_REVIEW_GATE`.
C1 and C2 require separate authorization. Task 20+ remains prohibited.

## 14. Branch recommendation

If the owner later authorizes an isolated Task 19 branch, the recommended name
is `codex/phase-1b-task-19-final-delivery-acceptance`. This is a recommendation
only. Stage A must not create or switch a branch or worktree.

## 15. Stage A stop state

```text
TASK19_STARTED=NO
TASK19_IMPLEMENTATION_AUTHORIZED=NO
TASK19_STAGE_A_AUTHORIZATION=GRANTED
TASK19_STAGE_A_STATUS=PROPOSED_PENDING_OWNER_REVIEW
TASK19_TYPE=PHASE_1B_V0_1_FINAL_DELIVERY_ACCEPTANCE
TASK19_STAGE_B_AUTHORIZATION=NOT_GRANTED
TASK19_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK19_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK20_PLUS_STARTED=NO
TASK20_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK19_STAGE_A_OWNER_REVIEW_GATE
STOP_REASON=TASK19_STAGE_A_OWNER_REVIEW_GATE
```
