# Phase 1B Task 13 Visitor User Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define a public visitor user-web surface that renders only synthetic published contract data with accessible loading, empty, error, and published states.

**Architecture:** Compose two web-only page projections from approved public API contract data. Keep route selection, page rendering, and focused assertions inside the four future Stage B files, with no provider calls, persistence, or shared-contract changes.

**Tech Stack:** Existing TypeScript user-web package, existing project lint/typecheck/build commands, deterministic synthetic fixtures, and the separately authorized test/browser tooling available at implementation time.

---

## Current anchors and preconditions

```text
TASK_ID=PHASE_1B_TASK_13
TASK_NAME=VISITOR_USER_WEB
STAGE=STAGE_A_FORMALIZATION
STATUS=OWNER_REVIEW_PASSED
EXECUTION_DATE=2026-09-11
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=984c92a4b897caeb097e48d3af57324f3e7b612e
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V28.md
ACTIVE_GOVERNANCE_SHA256=433E07B66ECE98110255158DA63D3FE87D9F4D11FA442444B150FC9FBEFFE4AC
TASK_05_TO_TASK_08_STATUS=ACCEPTED_AND_FROZEN
TASK_12_STATUS=ACCEPTED_AND_FROZEN
TASK_12_ROUTE_REPAIR_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_13_STARTED=YES_STAGE_B_OWNER_REVIEW_PASSED
TASK_13_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_13_STAGE_B_AUTHORIZATION=GRANTED
TASK_13_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_13_STAGE_B_OWNER_REVIEW=PASS
TASK_13_STAGE_C1_AUTHORIZATION=GRANTED
TASK_13_STAGE_C1_STATUS=AUTHORIZED_NOT_STARTED
TASK_13_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_14_PLUS_STARTED=NO
TASK_14_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=V28_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
STOP_REASON=V28_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```
Stage A creates only this plan and the companion execution contract. It does not
create implementation files, tests, routes, review evidence, acceptance records,
JSON receipts, or later-task artifacts.

## Approved scope and non-scope

### In scope after separate Stage B authorization

- Visitor home route and page projection for public synthetic published content.
- Visitor content route and page projection for one published synthetic item.
- Deterministic loading, empty, error, and published states.
- Keyboard-reachable actions, visible focus, logical focus order, and narrow
  viewport layout behavior.
- Contract-data composition with no direct provider call.
- Focused tests for privacy filtering, state rendering, accessibility, responsive
  behavior, and unexpected-request absence.

### Out of scope

- Any Stage B implementation during this Stage A turn.
- Real API mounting, server registration, provider connectivity, OAuth, webhooks,
  scraping, proxying, storage, persistence, analytics, or deployment.
- Authentication, membership, tenant administration, content editing, publishing,
  moderation, or staff-only controls.
- New shared contracts, package manifests, dependencies, schemas, migrations,
  configuration, lockfile changes, or changes to existing pages.
- Task 14 or later work, future governance versions, C1/C2 review packages, manifests,
  ZIPs, acceptance records, or external JSON receipts.

## Exact file map

The complete future Stage B candidate set is:

```text
apps/user-web/src/routes/visitor.routes.tsx
apps/user-web/src/pages/visitor-home.tsx
apps/user-web/src/pages/visitor-content.tsx
apps/user-web/src/pages/visitor.test.tsx
```

Responsibilities:

- `visitor.routes.tsx`: define the visitor route boundary and pass only the
  approved public contract projection to the page components.
- `visitor-home.tsx`: render the visitor entry/list projection and loading,
  empty, error, and published states without external navigation.
- `visitor-content.tsx`: render a single published content projection while
  fail-closing private, foreign, draft, unpublished, stale, or unavailable data.
- `visitor.test.tsx`: hold the minimum RED and GREEN assertions for privacy,
  state coverage, keyboard access, narrow viewport behavior, and no unexpected
  requests.

No fifth file is allowed. If the existing route or package architecture requires
another file, stop and request a new owner-approved contract.

## Task 1: Establish the failing visitor contract tests

**Files:**

- Create, only after Stage B authorization: `apps/user-web/src/pages/visitor.test.tsx`

- [ ] Define deterministic synthetic fixtures containing one published public
  item and one private/unpublished item. Mark all fixtures as simulated data.
- [ ] Add a RED assertion that the private/unpublished item is absent from the
  public projection.
- [ ] Add a RED keyboard assertion for focusable visitor actions and visible
  focus order.
- [ ] Add a RED narrow-viewport assertion for the approved mobile width.
- [ ] Add a RED request guard that fails if a provider URL, external asset, or
  unexpected network request is attempted.

Run the focused test command selected by the separately authorized runner. The
expected result is a genuine failure caused by the absent visitor implementation,
not a missing dependency or command-environment error. Do not weaken assertions.

## Task 2: Implement the visitor route boundary

**Files:**

- Create, only after Stage B authorization: `apps/user-web/src/routes/visitor.routes.tsx`

- [ ] Define only the approved visitor routes.
- [ ] Accept or construct only the public contract projection needed by the two
  pages; do not accept client authorization claims as proof of visibility.
- [ ] Keep route behavior deterministic and local; do not fetch, persist, or open
  external destinations.
- [ ] Preserve loading, empty, error, and published state inputs for the pages.

The route boundary must not claim global API reachability. That remains a
separate integration concern and residual risk.

## Task 3: Implement the visitor home page

**Files:**

- Create, only after Stage B authorization: `apps/user-web/src/pages/visitor-home.tsx`

- [ ] Render a loading state with an accessible status announcement.
- [ ] Render an empty state with a clear, keyboard-reachable next action.
- [ ] Render an error state without leaking private or foreign object details.
- [ ] Render only published synthetic content in the list projection.
- [ ] Keep headings, landmarks, labels, and focus order deterministic.
- [ ] Keep the layout usable at the approved narrow viewport without horizontal
  overflow or clipped actions.

## Task 4: Implement the visitor content page

**Files:**

- Create, only after Stage B authorization: `apps/user-web/src/pages/visitor-content.tsx`

- [ ] Render the published content projection with semantic headings and readable
  long-form structure.
- [ ] Fail closed for private, draft, unpublished, stale, foreign, or malformed
  content by rendering the safe unavailable/error state.
- [ ] Do not expose provider URLs, internal identifiers, tenant identifiers,
  authorization claims, or raw response fields.
- [ ] Keep all actions keyboard reachable and keep narrow layouts stable.

## Task 5: Verify the green contract

**Files:**

- Verify the four exact Stage B files only.

- [ ] Re-run the focused visitor tests and confirm the RED assertions are GREEN.
- [ ] Confirm published synthetic content renders and private content does not.
- [ ] Confirm loading, empty, error, and published states render deterministically.
- [ ] Confirm keyboard navigation, visible focus, and narrow viewport checks pass.
- [ ] Confirm the request guard records zero unexpected requests and no provider
  URL is opened.
- [ ] Run the existing package checks:

```text
corepack pnpm --filter @student-care/user-web typecheck
corepack pnpm --filter @student-care/user-web lint
corepack pnpm --filter @student-care/user-web build
pnpm exec prettier --check apps/user-web/src/routes/visitor.routes.tsx apps/user-web/src/pages/visitor-home.tsx apps/user-web/src/pages/visitor-content.tsx apps/user-web/src/pages/visitor.test.tsx
git diff --check
```

If browser tooling is available, perform the approved page interaction check at
desktop and narrow viewport sizes, recording console errors and network requests.
If it is unavailable, report `UI_NOT_VISUALLY_VERIFIED`; do not install tooling
under this contract.

## Task 6: Future lifecycle and commit gate

The implementation and evidence lifecycle is strictly sequential:

```text
STAGE_A=FORMALIZATION_ONLY
STAGE_A_STATUS=OWNER_REVIEW_PASSED
STAGE_B=IMPLEMENTATION_AND_FOCUSED_VERIFICATION
STAGE_B_AUTHORIZATION=GRANTED
STAGE_B_STATUS=AUTHORIZED_NOT_STARTED
STAGE_C1=REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP
STAGE_C1_AUTHORIZATION=NOT_GRANTED
STAGE_C2=ACCEPTANCE_RECORD_ONLY
STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_14_PLUS_STARTED=NO
TASK_14_PLUS_AUTHORIZATION=NOT_GRANTED
FUTURE_COMMIT_MESSAGE=feat: add visitor web surface
OWNER_REVIEW_GATE=V28_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
STOP_REASON=V28_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```

After the V28 governance sync and successful verification, the authorized
executor may generate only the three Stage C1 evidence artifacts: the review,
detached manifest, and deterministic ZIP. Stage B was completed and passed owner
review before this overlay; C1 completion does not grant C2, which requires
separate owner authorization and acceptance evidence.

## Stage A evidence and stop conditions

This Stage A turn must report, for both newly created documents:

- exact path and byte count;
- Node crypto SHA-256 and .NET SHA256 with `MATCH=YES`;
- UTF-8 validity, no BOM, LF-only, and exactly one trailing LF;
- no self-SHA reference;
- branch, HEAD, index, tracked worktree, and remote count;
- exact two-file write set and 26 protected untracked paths preserved;
- prohibited operations not executed and blockers, if any.

Stop with `STATUS=BLOCKED` without cleanup if any baseline drifts, either target
already exists, a protected path changes, an extra file is touched, or any
encoding/hash/permission check fails. The final Stage A state is:

```text
TASK_13_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_13_STAGE_B_AUTHORIZATION=GRANTED
TASK_13_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_13_STAGE_B_OWNER_REVIEW=PASS
TASK_13_STAGE_C1_AUTHORIZATION=GRANTED
TASK_13_STAGE_C1_STATUS=AUTHORIZED_NOT_STARTED
TASK_13_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK_14_PLUS_STARTED=NO
TASK_14_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=V28_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
STOP_REASON=V28_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```
