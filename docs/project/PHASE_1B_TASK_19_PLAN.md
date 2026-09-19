# Phase 1B Task 19 Final Delivery Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` only after a separate owner authorization grants
> Task 19 Stage B. Execute each checkbox in order and stop on the first failed
> hard gate.

**Goal:** Produce independently reproducible Phase 1B V0.1 final-delivery
evidence, a detached SHA manifest, and a deterministic package without changing
accepted product behavior or frozen Tasks 01-18 evidence.

**Architecture:** Run all install, build, test, and browser work in one exact
temporary root copied from an owner-approved baseline. Add a Task 19-only
standard-library verifier and pure-logic tests, persist only the fixed evidence
set, and package the immutable baseline plus approved evidence deterministically.
The repository root remains the control plane and never becomes a build sandbox.

**Tech Stack:** Node.js 24.14.x, pnpm 11.22.x via Corepack, TypeScript 5.7.x,
Node test runner, ESLint 9.39.x, Prettier 3.9.x, local browser automation,
PowerShell/.NET SHA-256, Node crypto, and ZIP structures produced with Node
standard-library-compatible code only.

---

## Stage A control state

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

The current baseline is
`b3f300cd3c749cc06dc462d149353ac8cd0f5528`; its tree is
`e9ed53fc1c1246d2fe0957d46ab9a7056efd9a57`. V42 remains the only active
governance file and retains SHA-256
`7BECA819534A223D84C4D95FD117FC68C4B9CD4CDFC2E5345AF09E9547D188AB`.
V42's old Task 17 gate and Task 18+ denial are `HISTORICAL/FROZEN` snapshots,
not current Task 19 controls. Task 18 is accepted and frozen.

This plan does not authorize any checkbox below. Stage B starts only after the
owner reviews Stage A, supplies the exact Stage A checkpoint HEAD, and separately
sets `TASK19_STAGE_B_AUTHORIZATION=GRANTED`.

If a later owner authorization chooses an isolated branch, the recommendation is
`codex/phase-1b-task-19-final-delivery-acceptance`. Stage A does not create or
switch a branch or worktree.

## Exact Stage B boundaries

### Permanent writes

The permanent write set has exactly 31 files. Ten are fixed directly:

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

The remaining 21 are the exact Cartesian product under
`artifacts/final-delivery/task19/browser/` of these route slugs:

```text
web-visitor-home
web-staff-workbench
mini-visitor-home
mini-staff-workbench
flow-ai-learning-assistant
flow-ai-teacher-summary
admin-audit-logs
```

and these viewport suffixes:

```text
desktop-1440x1024.png
mobile-390x844.png
small-mobile-320x568.png
```

Each filename is `<route-slug>__<viewport-suffix>`. This formula names exactly
the 21 screenshot paths enumerated in the execution contract and no others.

### Read-only inputs

- The complete tracked input set is the Git tree of the exact owner-supplied
  Stage B baseline HEAD.
- The fixed Task 01-18 tracked evidence index is the 50-path list in the
  execution contract, with path-list SHA-256
  `490AFCAA36E7FF32132571DC61A05D3E7C2AD3176394449F4CD597D87CF04781`.
- The proposed protected read-only universe has exactly 71 paths, split into the
  exact 13 product inputs and exact 58 frozen-evidence inputs fully enumerated in
  Section 4 of the execution contract. Their path-list SHA-256 values are,
  respectively,
  `2EEDEDCAED72F9215B33F0F0BB09D48B397572A4622E77A51206B963F2004474`,
  `0AF4BAF26D7B857812C76C612A428B18281C7CAF0DA022CDC5F3D7EB26278132`,
  and `B9E657C02348911914C475AA4A0CEA6A96DC79C0B215525DDAB31B80E5D7B17F`.
- Each list is sorted case-folded Unicode ordinal ascending with original-path
  ordinal tiebreaking, then serialized as UTF-8 without BOM, LF-joined, and with
  no terminal LF.
- Stage A reads only Git path, size, and mtime metadata for all 71 paths. A future
  Stage B may read their content only when the owner explicitly incorporates the
  exact list and all three hashes into the Stage B authorization.
- The 13 product inputs may be copied into the isolated current and rollback
  copies. The 58 frozen-evidence inputs may only be content-hashed, structurally
  verified, and copied unchanged into the final delivery ZIP; they must never be
  executed, imported into runtime, modified, overwritten, deleted, moved, or
  staged. Missing read authorization for any of the 58 makes complete frozen
  evidence closure `STATUS=BLOCKED`.
- Repository-external execution-receipt JSON is external evidence, not a
  repository delivery member. It is not read, copied, or packaged without a
  separate exact external read-only authorization; only its summary and hash in
  repository acceptance records are verified.
- V42, `pnpm-lock.yaml`, Tasks 01-18 evidence, and Task 18's six release files
  remain byte-frozen.

### Temporary writes and deletion

All temporary writes are under `artifacts/task-19/tmp/`: `run-ledger.json`,
`current/`, `rollback/`, `browser-harness/index.html`,
`browser-harness/server.mjs`, `browser-harness/stdout.log`,
`browser-harness/stderr.log`, `rebuild-a.zip`, and `rebuild-b.zip`.
The root must be absent before Stage B. Only same-run entries recorded in the
ledger may be deleted. Pre-existing files and any path outside this root must
not be cleaned. Broad Git cleanup commands are prohibited.

## Task 1: Re-establish the Stage B baseline

**Files:** No writes before every gate passes.

- [ ] **Step 1: Validate the owner-supplied baseline.**

  Require one exact 40-hex Stage B HEAD, current branch, clean index, and clean
  tracked worktree. Prove the HEAD descends from
  `b3f300cd3c749cc06dc462d149353ac8cd0f5528` and contains only the reviewed
  Stage A control-plane checkpoint after that commit.

- [ ] **Step 2: Validate immutable anchors.**

  Recompute V42 SHA, root lockfile HEAD/worktree blob, Task 18 six-file digest,
  the 50-path evidence-index digest, remote count, V43/V44 absence, and the
  71-path protected metadata snapshot. Expected result: every anchor matches;
  otherwise `STATUS=BLOCKED`.

- [ ] **Step 3: Validate output and temp absence.**

  Every one of the 31 permanent outputs and `artifacts/task-19/tmp/` must be
  absent. Existing content must not be overwritten.
  `EXPECTED_UNTRACKED_PATHS=71` must match the exact 71-path protected
  read-only baseline before the temporary root is created.

## Task 2: Write failing final-delivery verifier tests

**Files:**

- Create: `tests/release/final-delivery.spec.ts`
- Read only: `scripts/verify-release.mjs`

- [ ] **Step 1: Add pure-logic red tests.**

  Cover exact Stage B baseline ancestry, exact permanent write set, 50-path
  evidence index, 71/13/58 protection partition, 21 browser cases, failed deny
  evidence, malformed performance fields, evidence mode reading its own output,
  evidence mode requiring a ZIP, final mode attempting a write, manifest/ZIP
  self-reference, ZIP member drift, missing frozen-evidence member, CRC/length
  mismatch, non-fixed timestamp, non-stored entry, bad UTF-8 flag, and
  non-byte-identical rebuilds.

- [ ] **Step 2: Run the red test.**

  ```powershell
  node --test tests/release/final-delivery.spec.ts
  ```

  Expected: FAIL because `scripts/verify-final-delivery.mjs` does not exist or
  does not yet export the required evaluators.

## Task 3: Implement the Task 19 verifier

**Files:**

- Create: `scripts/verify-final-delivery.mjs`
- Modify: `tests/release/final-delivery.spec.ts`

- [ ] **Step 1: Implement minimum pure evaluators.**

  Implement exact-set comparison, baseline/frozen checks, UTF-8/LF validation,
  suite evidence validation, 21-case browser validation, security gate checks,
  performance-field checks, manifest parsing, ZIP local/central/EOCD parsing,
  CRC32, source-byte SHA comparison, and deterministic byte comparison. Use
  Node built-ins only.

- [ ] **Step 2: Add structure, evidence, and final CLI modes.**

  `--mode=structure` checks repository boundaries without requiring generated
  evidence. `--mode=evidence` reads only the four prerequisite JSON reports,
  review, screenshots, and frozen anchors, then writes
  `release-verifier-report.json`; it neither reads its own output nor requires a
  manifest or ZIP. `--mode=final` reads the saved report, manifest, final ZIP,
  and every member without writing any file. Each mode emits one parseable JSON
  object to stdout and exits nonzero on any blocker. Final mode produces no
  sixth JSON report.

- [ ] **Step 3: Run the focused verifier test.**

  ```powershell
  node --test tests/release/final-delivery.spec.ts
  ```

  Expected: PASS with zero failures.

- [ ] **Step 4: Run structure mode.**

  ```powershell
  node scripts/verify-final-delivery.mjs --mode=structure
  ```

  Expected: `status=PASS`, exact authorized work state, and no frozen drift.

## Task 4: Materialize isolated current and rollback copies

**Files:**

- Create only under: `artifacts/task-19/tmp/current/`
- Create only under: `artifacts/task-19/tmp/rollback/`
- Create: `artifacts/task-19/tmp/run-ledger.json`

- [ ] **Step 1: Export immutable tracked trees.**

  Export the owner-approved Stage B tree into `current/` and commit
  `b3f300cd3c749cc06dc462d149353ac8cd0f5528` into `rollback/`. Copy the exact
  13 product files into each corresponding path. Make the two Task 19 verifier
  files and five Stage A formatting targets available in both copies as
  validation-only overlays; exclude those overlays from rollback product-byte
  comparison. Do not copy the 58 frozen-evidence inputs into either runtime
  tree. Record every created path before any install or build.

- [ ] **Step 2: Perform offline frozen installs.**

  ```powershell
  corepack pnpm --dir artifacts/task-19/tmp/current install --offline --frozen-lockfile --ignore-scripts
  corepack pnpm --dir artifacts/task-19/tmp/rollback install --offline --frozen-lockfile --ignore-scripts
  ```

  Expected: both exit 0 without registry access or lockfile change. A local-store
  miss is `INFRASTRUCTURE_ISSUE`; do not retry online.

- [ ] **Step 3: Record install and rollback evidence.**

  Write `artifacts/final-delivery/task19/install-upgrade-rollback.json` with
  baseline/rollback commits, Node/pnpm/OS versions, commands, exit codes,
  lockfile hashes before/after, `MIGRATION_ID=NONE_NO_SCHEMA_CHANGE`, and no
  production/database action.

## Task 5: Run complete suites and security gates

**Files:**

- Create: `artifacts/final-delivery/task19/suite-evidence.json`
- Read only: all current/rollback copy sources and tests

- [ ] **Step 1: Run pre-build quality gates in `current/`.**

  ```powershell
  corepack pnpm typecheck
  corepack pnpm lint
  corepack pnpm format:check
  corepack pnpm --filter @student-care/user-web typecheck
  corepack pnpm --filter @student-care/user-web lint
  corepack pnpm exec tsc -p apps/mini-program/tsconfig.json --noEmit
  corepack pnpm exec eslint apps/mini-program/src/navigation/routes.ts apps/mini-program/src/pages/staff.test.ts apps/mini-program/src/pages/staff/quick-action.ts apps/mini-program/src/pages/staff/workbench.ts apps/mini-program/src/pages/visitor.test.ts apps/mini-program/src/pages/visitor/content.ts apps/mini-program/src/pages/visitor/home.ts apps/mini-program/src/routes/staff.routes.ts
  corepack pnpm exec prettier --check apps/mini-program/src/navigation/routes.ts apps/mini-program/src/pages/staff.test.ts apps/mini-program/src/pages/staff/quick-action.ts apps/mini-program/src/pages/staff/workbench.ts apps/mini-program/src/pages/visitor.test.ts apps/mini-program/src/pages/visitor/content.ts apps/mini-program/src/pages/visitor/home.ts apps/mini-program/src/routes/staff.routes.ts apps/mini-program/tsconfig.json apps/user-web/src/pages/staff-report.tsx apps/user-web/src/pages/staff-workbench.tsx apps/user-web/src/pages/staff.test.tsx apps/user-web/src/routes/staff.routes.tsx
  corepack pnpm exec prettier --check scripts/verify-final-delivery.mjs tests/release/final-delivery.spec.ts PHASE_1B_TASK_19_CODEX_EXECUTION.md docs/project/PHASE_1B_TASK_19_PLAN.md docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md AGENTS.md PLANS.md
  ```

  Expected: every command exits 0. The root scripts do not substitute for the
  explicit user-web or mini-program gates, and root `format:check` does not
  substitute for either explicit Prettier command.

- [ ] **Step 2: Build before any frozen focused spec in `current/`.**

  ```powershell
  corepack pnpm build
  corepack pnpm --filter @student-care/user-web build
  ```

  Expected: both exit 0 and materialize the `packages/tenant/dist` and
  `apps/user-web/dist` inputs read by frozen focused specs.

- [ ] **Step 3: Run focused, root-test, and coverage gates in `current/`.**

  ```powershell
  node --test tests/e2e/visitor.spec.ts tests/e2e/staff.spec.ts tests/e2e/learning.spec.ts tests/security/isolation.spec.ts tests/release/acceptance.spec.ts
  node --test tests/release/final-delivery.spec.ts
  corepack pnpm test
  corepack pnpm test:coverage
  ```

  Expected: every test passes, including tenant/campus injection denial,
  membership/capability denial, teacher-summary denial, public projection
  safety, learning hint order, audit exactly-once success, and rollback-zero
  success-event cases. Coverage output is evidence, not permission to weaken an
  existing threshold.

- [ ] **Step 4: Repeat the ordered matrix in `rollback/`.**

  Run Step 1, Step 2, then the five frozen focused specs, root test, and coverage
  from Step 3 in that exact order. The Task 19 verifier files and Stage A
  documents remain validation-only overlays for the explicit Prettier gate; the
  rollback does not claim them as product bytes. Expected: every command exits 0
  and product/lock bytes match the accepted Task 18 rollback target.

- [ ] **Step 5: Persist exact command evidence.**

  Record working directory, executable version, full command, start/end UTC,
  exit code, stdout/stderr SHA-256, and pass/fail for every command. Do not write
  a success value before observing exit 0.

## Task 6: Run localhost E2E and visual acceptance

**Files:**

- Create temporary harness files under `artifacts/task-19/tmp/browser-harness/`
- Create: `artifacts/final-delivery/task19/browser-evidence.json`
- Create: the exact 21 screenshot paths

- [ ] **Step 1: Build a local-only harness around real modules.**

  The harness must import the built current-copy user-web, mini-program, learning,
  and admin-audit modules. It may inject only clearly synthetic fixtures. It
  must not replace a real view with a static pass page.

- [ ] **Step 2: Start the one allowed local service.**

  ```powershell
  node artifacts/task-19/tmp/browser-harness/server.mjs --host=127.0.0.1 --port=4173
  ```

  Expected: binds only `127.0.0.1:4173`. Any other listener or external request
  is a blocker.

- [ ] **Step 3: Exercise all 21 route/viewport cases.**

  For each case, verify heading, content identity, loading/error handling where
  applicable, keyboard focus order and visibility, zero overlap/clipping,
  zero horizontal overflow, no page errors, no severe console errors, no failed
  requests, and no unexpected external requests. Save the exact screenshot.

- [ ] **Step 4: Exercise the security and minor-safety E2E matrix.**

  Attempt visitor/staff misuse, disabled/missing/revoked memberships,
  cross-tenant/cross-campus access, untrusted scope injection, teacher-summary
  disclosure, unsafe public content, and audit failure/rollback. Expected: all
  fail closed and all displayed data is visibly synthetic.

- [ ] **Step 5: Stop the service and persist evidence.**

  Record process exit, request origins, console/page errors, screenshot SHA-256,
  focus/overflow observations, and actual result for all 21 cases.

## Task 7: Record performance smoke without an SLA

**Files:**

- Create: `artifacts/final-delivery/task19/performance-smoke.json`

- [ ] **Step 1: Record measured fields for each browser case.**

  Use the exact schema in the execution contract. Every duration is a measured,
  finite, nonnegative value. Record environment versions and null when a timing
  field is genuinely unavailable.

- [ ] **Step 2: Scan narrative fields.**

  Reject `SLA`, percentile, capacity, production-latency, or guarantee claims.
  The only conclusion allowed is a localhost smoke observation under the
  recorded environment.

## Task 8: Build and verify deterministic delivery artifacts

**Files:**

- Create: `docs/reviews/PHASE_1B_TASK_19_FINAL_DELIVERY_REVIEW.md`
- Create: `artifacts/final-delivery/task19/release-verifier-report.json`
- Create: `SHA256SUMS_PHASE_1B_TASK_19.txt`
- Create temporary: `artifacts/task-19/tmp/rebuild-a.zip`
- Create temporary: `artifacts/task-19/tmp/rebuild-b.zip`
- Create: `artifacts/release-package/student-care-platform-phase1b-v0.1-final-delivery-v1.0.zip`

- [ ] **Step 1: Write the review from observed evidence.**

  Include baseline, frozen anchors, exact commands/exits, 21 visual results,
  security/child-safety results, install/rollback results, performance-smoke
  limitation, package member rule, open risks, and no-release statement. Do not
  write the review's own final SHA into itself.

- [ ] **Step 2: Run evidence mode and freeze its report.**

  ```powershell
  node scripts/verify-final-delivery.mjs --mode=evidence
  ```

  Evidence mode reads the four prerequisite JSON reports, review, screenshots,
  and frozen anchors, then writes only `release-verifier-report.json`. Read it
  back, validate JSON/encoding, and independently match Node/.NET SHA-256. It
  must not read its own output or require a manifest or ZIP.

- [ ] **Step 3: Assemble the exact member set.**

  Include the approved baseline tree, exact 13 protected product inputs, two
  Task 19 verifier files, all 58 frozen-evidence inputs enumerated in the
  execution contract, review, all five JSON reports including the frozen
  release-verifier report, and 21 screenshots. The 58 evidence files remain
  immutable and non-executable. Exclude repository-external execution-receipt
  JSON, manifest, ZIP, temp, Git, dependencies, build output, coverage, and
  caches.

- [ ] **Step 4: Rebuild twice and materialize the final ZIP.**

  Use stored entries, DOS timestamp `1980-01-01T00:00:00`, UTF-8 flag `0x0800`,
  and case-folded Unicode ordinal member order. Expected:
  `rebuild-a.zip` byte-equals `rebuild-b.zip`; only then copy the verified bytes
  to the permanent ZIP path.

- [ ] **Step 5: Write the detached manifest.**

  Write each line exactly as
  `<64_HEX_SHA256><two ASCII spaces><POSIX relative path>` for each ZIP member in
  package order. Use UTF-8 without BOM, LF-only, and exactly one terminal LF.
  The manifest is not a ZIP member and lists neither itself nor the ZIP.

- [ ] **Step 6: Verify bytes independently.**

  Compare source bytes, CRC32, lengths, local headers, central directory, EOCD,
  Node SHA-256, and .NET SHA-256 for every permanent output. Expected: all match.

## Task 9: Run final verifier and audit repository boundaries

**Files:**

- Read only: repository metadata and all permanent outputs

- [ ] **Step 1: Run final mode.**

  ```powershell
  node scripts/verify-final-delivery.mjs --mode=final
  ```

  Expected: `status=PASS`, no blockers, exact 31-file permanent write set, and
  deterministic package evidence. Final mode reads the already saved report,
  manifest, final ZIP, and all members; it writes nothing, leaves the report
  byte-identical, and emits its result only to stdout and the Stage B receipt.

- [ ] **Step 2: Run final Git checks.**

  ```powershell
  git diff --check
  git diff --cached --check
  ```

  Expected: both exit 0; index remains clean; no path outside the 31 permanent
  outputs and exact temp root changed; V42, lockfile, product code, Tasks 01-18,
  and 71-path metadata remain unchanged.

- [ ] **Step 3: Clean only same-run temporary output.**

  Validate every ledger entry resolves under `artifacts/task-19/tmp/`, then
  delete those same-run entries. Recheck the 31 permanent outputs and protected
  metadata. Never run broad cleanup.

- [ ] **Step 4: Stop for Owner Review.**

  Report `TASK19_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED_PENDING_OWNER_REVIEW`
  only if every fresh gate passed. Otherwise report `STATUS=BLOCKED` with
  `PRODUCT_ISSUE` or `INFRASTRUCTURE_ISSUE`. Do not stage, commit, start C1/C2,
  release, deploy, or start Task 20.

## Owner Review standard

Owner Review requires fresh exit-0 command evidence, all 21 inspectable visual
cases, zero unresolved security/privacy blocker, measured performance fields
without SLA claims, offline install and rollback reproduction, byte-identical
ZIP rebuilds, independent hash agreement, exact write-set closure, and no frozen
or protected drift. A partial package, missing browser case, unreviewed warning,
or need for another path is not a pass.

Stage A ends now at `TASK19_STAGE_A_OWNER_REVIEW_GATE`.
