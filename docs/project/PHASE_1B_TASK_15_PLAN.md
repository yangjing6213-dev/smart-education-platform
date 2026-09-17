# Phase 1B Task 15 Internal Employee User Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define a secure internal employee user-web surface with scoped workbench, long-form guide/resource content, task views, and authorized daily report views using synthetic contract data.

**Architecture:** Keep the future implementation inside four exact user-web files. Route selection, workbench projection, report projection, and focused tests remain separate responsibilities. Server-enforced identity, membership, capability, tenant, and campus scope are treated as authoritative; the web layer only adapts approved contract data and never becomes an authorization engine.

**Tech Stack:** Existing local TypeScript, Node, user-web package tooling, installed lint/type/format tools, synthetic fixtures, and the repository's existing contract conventions. No dependency installation, provider access, persistence, service startup, or configuration change is allowed.

---

## Current anchors and preconditions

```text
TASK_ID=PHASE_1B_TASK_15
TASK_NAME=INTERNAL_EMPLOYEE_USER_WEB
STAGE=STAGE_A_FORMALIZATION
STATUS=OWNER_REVIEW_PASSED
EXECUTION_DATE=2026-09-13
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=9de01c4f5953ad48552c447fa8922da785f14e71
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md
ACTIVE_GOVERNANCE_SHA256=F2C77C7A1EEE626619CB19DDD994D2D373D59C54CBB939260E7C3B7C77B52D5A
TASK_14_STATUS=ACCEPTED_AND_FROZEN
TASK_15_STARTED=YES_STAGE_C2_ACCEPTED
TASK_15_STAGE_A_AUTHORIZATION=GRANTED
TASK_15_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_15_STAGE_A_OWNER_REVIEW=PASS
TASK_15_STAGE_A_EXECUTION_RECEIPT_CHANNEL=DELAYED_RECOVERY_ACCEPTED_BY_OWNER
TASK_15_STAGE_B_AUTHORIZATION=GRANTED
TASK_15_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_15_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK_15_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_16_PLUS_STARTED=NO
TASK_16_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK15_STAGE_B_OWNER_REVIEW_GATE
STOP_REASON=TASK15_STAGE_B_OWNER_REVIEW_GATE
```

V34 is the read-only active authority. This Stage B package records the
owner-authorized formalization after the V31 historical pre-formalization snapshot and
does not modify V31 or any other historical/frozen evidence. Task 14 remains frozen.

## Scope and non-scope

The future Stage B scope is limited to an internal employee user-web flow:
staff workbench, long-form guide/resource content, scoped task views, and daily
report views. It includes explicit denied states for visitor identities,
suspended staff, missing membership, revoked membership, absent capabilities,
foreign tenant/campus identifiers, and teacher-only summary requests.

The future Stage B flow must support an authorized synthetic teacher completing
the approved report flow and viewing only the permitted AI summary projection.
The summary is a contract projection, not a direct model call. Any child-related
data must remain synthetic, minimized, redacted, tenant/campus scoped, and safe
for the capability. The web layer must use visitor/staff product terminology
correctly and must not reveal internal authorization fields.

Out of scope are real authentication, provider calls, persistence, production
data, real AI calls, browser storage, analytics, external resources, server
policy edits, shared-contract edits, package/configuration changes, database
migrations, deployment, mini-program changes, admin surfaces, Task 14 evidence
changes, C1/C2 artifacts, governance synchronization, and Task 16+.

## Exact future Stage B file map

```text
apps/user-web/src/routes/staff.routes.tsx
apps/user-web/src/pages/staff-workbench.tsx
apps/user-web/src/pages/staff-report.tsx
apps/user-web/src/pages/staff.test.tsx
```

`staff.routes.tsx` defines only the internal employee web route map and safe
route selection. `staff-workbench.tsx` renders the scoped workbench, task list,
guide/resource entry points, loading/empty/error/authorized/denied states, and
supported focus order. `staff-report.tsx` renders the daily report workflow,
scope-safe fields, permitted summary state, and explicit denial for
teacher-only summaries. `staff.test.tsx` owns the focused contract and isolation
assertions.

No fifth file is permitted. If implementation requires a shared contract,
server adapter, package manifest, route registry outside the four paths,
dependency, lockfile, or configuration change, the result is `STATUS=BLOCKED`
and a new owner-approved contract is required.

## Required security and product invariants

```text
STAFF_ACCESS=ACTIVE_EMPLOYEE_MEMBERSHIP_AND_SERVER_CAPABILITY_REQUIRED
VISITOR_ACCESS=DENY
SUSPENDED_STAFF_ACCESS=DENY
MISSING_OR_REVOKED_MEMBERSHIP=DENY
CROSS_TENANT_SEARCH=DENY
CROSS_CAMPUS_SEARCH=DENY
TEACHER_ONLY_SUMMARY_WITHOUT_CAPABILITY=DENY
AUTHORIZED_SYNTHETIC_TEACHER_REPORT_FLOW=ALLOW_WITHIN_SCOPE
PUBLIC_OR_VISITOR_PROJECTION=NOT_USED_FOR_INTERNAL_AUTHORIZATION
EXTERNAL_RESOURCES=ZERO
UNEXPECTED_REQUESTS=ZERO
```

The server remains the source of truth for identity, membership, tenant,
campus, role, capability, and report authorization. Tests must prove that the
web layer does not accept forged client claims as permission. Search and report
fixtures must contain clearly synthetic records from an allowed campus and a
foreign campus, with the foreign record absent from every successful projection.

## Future Stage B execution sequence

### Task 1: Reconfirm the owner-approved preconditions

**Files:** none.

- [ ] Confirm the active V31 path and SHA, branch, HEAD, index, tracked
  worktree, lockfile, remote count, exact four-file target state, and protected
  untracked path set using local read-only commands.
- [ ] Confirm Task 14 is accepted/frozen and Task 15 Stage B remains separately
  authorized before any implementation write.

Expected result: all anchors match the approved Stage B start record; otherwise
stop `STATUS=BLOCKED` before writing.

### Task 2: Establish the failing isolation and authorization tests

**File:** `apps/user-web/src/pages/staff.test.tsx`

- [ ] Add synthetic fixtures for an allowed teacher, a visitor, a suspended
  staff member, a missing/revoked membership, an allowed campus, a foreign
  campus, and a teacher-only summary.
- [ ] Assert visitor and suspended staff access return a safe denied state.
- [ ] Assert cross-campus search and foreign campus identifiers never enter the
  successful projection.
- [ ] Assert a staff member without teacher capability cannot view the
  teacher-only summary.
- [ ] Assert an authorized synthetic teacher can complete the report flow and
  receives only the permitted summary projection.
- [ ] Assert no `fetch`, provider URL, storage, external asset, or unexpected
  request is used.

Run:

```text
node --test --experimental-strip-types apps/user-web/src/pages/staff.test.tsx
```

Expected RED: non-zero exit caused by missing local route/page adapters or the
unimplemented denial and report-flow assertions, not by a missing dependency or
environment failure.

### Task 3: Implement the internal employee route boundary

**File:** `apps/user-web/src/routes/staff.routes.tsx`

- [ ] Define stable workbench and report route identifiers.
- [ ] Select routes only from a safe local route key and trusted capability
  result supplied by the contract fixture.
- [ ] Return a deterministic denied route for visitor, suspended, missing, or
  revoked identities.
- [ ] Keep route selection free of provider, storage, persistence, and external
  resource access.

Expected GREEN contribution: route tests distinguish authorized staff routes
from denied visitor/suspended/foreign-capability cases.

### Task 4: Implement the staff workbench projection

**File:** `apps/user-web/src/pages/staff-workbench.tsx`

- [ ] Render loading, empty, error, authorized, and denied states with
  accessible status semantics.
- [ ] Render only contract-approved synthetic tasks/resources within the trusted
  tenant and campus scope.
- [ ] Provide long-form guide/resource projections without exposing private child
  fields, raw claims, or provider metadata.
- [ ] Keep focus order and narrow desktop/mobile constraints deterministic.

Expected GREEN contribution: workbench tests pass for scoped authorized content
and fail closed for visitor, suspended, and foreign-campus input.

### Task 5: Implement the daily report and permitted summary projection

**File:** `apps/user-web/src/pages/staff-report.tsx`

- [ ] Render the authorized synthetic teacher report flow using only approved
  contract fields.
- [ ] Deny teacher-only summary access when the capability is absent.
- [ ] Exclude raw student identity and sensitive minor fields from all rendered
  states.
- [ ] Represent unavailable, denied, loading, and completed summary states
  without direct model/provider calls.

Expected GREEN contribution: the authorized teacher flow passes while
unauthorized summary requests remain denied and non-leaking.

### Task 6: Run focused regression and local quality checks

**Files:** only the four Stage B files.

- [ ] Run the focused test again and confirm all denial, isolation, report-flow,
  accessibility-state, and zero-request assertions pass.
- [ ] Run the existing local TypeScript check for the four files without
  changing configuration or the lockfile.
- [ ] Run the existing local ESLint check for the four files.
- [ ] Run Prettier check for the four files.
- [ ] Run `git diff --check`.
- [ ] If visual user-web runtime verification is unavailable, report
  `UI_NOT_VISUALLY_VERIFIED`.

Expected GREEN: every applicable command exits zero; a missing local binary,
lockfile drift, fifth-file requirement, or external request is a hard blocker.

### Task 7: Stop at the Stage B owner-review gate

**Files:** only the four Stage B files.

- [ ] Verify UTF-8 without BOM, LF-only, exactly one trailing LF, Node/.NET
  SHA-256 agreement, and exact four-path diff.
- [ ] Do not create C1/C2 artifacts, do not stage or commit unless a later
  contract explicitly authorizes that action, and do not start Task 16.
- [ ] Report `TASK15_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED` only after all
  applicable checks pass and stop at `TASK15_STAGE_B_OWNER_REVIEW_GATE`.

## Stage lifecycle and stop conditions

```text
STAGE_A=CONTRACT_AND_IMPLEMENTATION_PLAN_FORMALIZATION
STAGE_A_STATUS=OWNER_REVIEW_PASSED
STAGE_A_TO_STAGE_B=SEPARATE_OWNER_AUTHORIZATION_REQUIRED
STAGE_B=IMPLEMENTATION_AND_FOCUSED_VERIFICATION
STAGE_B_AUTHORIZATION=GRANTED
STAGE_B_STATUS=NOT_STARTED
STAGE_B_OWNER_REVIEW=REQUIRED
STAGE_C1=REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP
STAGE_C1_AUTHORIZATION=NOT_GRANTED
STAGE_C1_STATUS=NOT_STARTED
STAGE_C2=ACCEPTANCE_RECORD_ONLY
STAGE_C2_AUTHORIZATION=NOT_GRANTED
STAGE_C2_STATUS=NOT_STARTED
TASK_16_PLUS_STARTED=NO
TASK_16_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK15_STAGE_B_OWNER_REVIEW_GATE
STOP_REASON=TASK15_STAGE_B_OWNER_REVIEW_GATE
```

Stage A creates only this plan and its companion contract. It does not create
implementation files, tests, review artifacts, manifests, ZIPs, acceptance
records, JSON receipts, governance versions, or Task 16+ files. All Stage A
documents must be UTF-8 without BOM, LF-only, exactly one trailing LF, and must
not contain their own actual SHA.

Stop with `STATUS=BLOCKED` and preserve the scene if any V33 anchor, protected
path set, target-file state, exact four-file boundary, or Stage authorization
does not match. Do not clean, restore, delete, move, stage, commit, or expand
the scope.
