# Phase 1B Task 14 Visitor Mini Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define a compact visitor mini-program flow using synthetic public contract data, native platform navigation, and shared business semantics without provider, persistence, or external-resource access.

**Architecture:** Keep the future boundary in four exact files: native route definitions, two mini-program page adapters, and one focused test file. Pages consume a safe public projection and do not duplicate server authorization.

**Tech Stack:** Existing local TypeScript, Node, ESLint, and Prettier tooling; native platform navigation primitives; deterministic synthetic fixtures; and any mini runtime already present when Stage B is separately authorized.

---

## Current anchors and preconditions

```text
TASK_ID=PHASE_1B_TASK_14
TASK_NAME=VISITOR_MINI_PROGRAM
STAGE=STAGE_C2_ACCEPTANCE
STATUS=ACCEPTED_AND_FROZEN
EXECUTION_DATE=2026-09-12
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=8a95455b287cff3db3efadcd28ebc453c3e7fa94
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md
ACTIVE_GOVERNANCE_SHA256=F2C77C7A1EEE626619CB19DDD994D2D373D59C54CBB939260E7C3B7C77B52D5A
TASK_05_TO_TASK_08_STATUS=ACCEPTED_AND_FROZEN
TASK_13_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_13_STAGE_B_OWNER_REVIEW=PASS
TASK_13_STAGE_C1_AUTHORIZATION=GRANTED
TASK_13_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_13_STAGE_C2_AUTHORIZATION=GRANTED
TASK_13_STAGE_C2_STATUS=ACCEPTED
TASK_13_STATUS=ACCEPTED_AND_FROZEN
TASK_13_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_13_ACCEPTANCE.md
TASK_13_ACCEPTANCE_SHA256=8F8BC3976D22150FBE9801D71ACAC4D9C8DA9EB8A96F616CC50DF891E5700ADF
TASK_14_STAGE_A_AUTHORIZATION=GRANTED
TASK_14_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_14_STAGE_B_AUTHORIZATION=GRANTED
TASK_14_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_14_STAGE_B_OWNER_REVIEW=PASS
TASK_14_STAGE_C1_AUTHORIZATION=GRANTED
TASK_14_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_14_STAGE_C2_AUTHORIZATION=GRANTED
TASK_14_STAGE_C2_STATUS=ACCEPTED
TASK_14_STATUS=ACCEPTED_AND_FROZEN
TASK_14_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_14_ACCEPTANCE.md
TASK_14_ACCEPTANCE_SHA256=E3399204076DF11AD94301BEE0881589C3CE743FC4A3C84C7F1EEABCDD9C8FD9
TASK_14_C2_EXTERNAL_RECEIPT_PATH=C:/Users/HU.codex/execution-receipts/student-care/phase1b-task14-stage-c2-20260913.json
TASK_14_C2_EXTERNAL_RECEIPT_SHA256=930871AFEF1BEDBE7821C3779189F4BFE7DEB4E1011E6E1EA178CFC4A4B347EB
TASK_14_STARTED=YES_STAGE_C2_ACCEPTED
TASK_15_STARTED=YES_STAGE_C2_ACCEPTED
TASK_15_PLUS_STARTED=NO
TASK_15_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=V38_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
STOP_REASON=V38_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```

Stage A creates only this plan and its companion contract. It does not create
implementation files, tests, route registries, evidence, acceptance records,
manifests, ZIPs, JSON receipts, governance versions, or later-task artifacts.

Task 14 Stage B required Task 13 Stage C1 completion followed by the
independent Task 13 C2 acceptance gate. Under V32, Task 13 is accepted and
frozen, and Task 14 Stage B, C1, and C2 are completed within their approved
boundaries and frozen.

## Approved scope and non-scope

After separate Stage B authorization, the scope is native visitor home and
content adapters, home-to-content selection, deterministic platform back
navigation, loading/empty/error/published states, safe public projection
filtering, phone layout constraints, supported focus behavior, status
announcements, and focused no-request/no-external-resource assertions.

Out of scope are real API calls, server registration, authentication,
membership resolution, provider/storage access,
OAuth, webhooks, scraping, proxying, persistence, analytics, deployment,
staff/admin features, publishing, new contracts, package or dependency changes,
schemas, migrations, lockfile changes, user-web/server changes, Task 13 evidence
changes, Task 14 C1/C2 artifacts, Task 15+, future governance versions, and
external JSON receipts.

## Exact future Stage B file map

```text
apps/mini-program/src/pages/visitor/home.ts
apps/mini-program/src/pages/visitor/content.ts
apps/mini-program/src/navigation/routes.ts
apps/mini-program/src/pages/visitor.test.ts
```

`routes.ts` defines only visitor home/content routes and selection/back
transitions. `home.ts` renders the compact entry, list, and four states.
`content.ts` renders one safe published item or unavailable/error.
`visitor.test.ts` owns RED/GREEN assertions for isolation, states, navigation,
phone dimensions, filtering, and zero unexpected requests/resources.

No fifth file is allowed. A different entrypoint, shared-contract or auth
change, package/configuration change, dependency, or test-runtime requirement
must produce `STATUS=BLOCKED` and a new owner-approved contract.

## Product and safety rules

Use clearly synthetic, non-real published public contract data only. Exclude
private, draft, unpublished, disabled, stale, foreign, and malformed content.
Do not trust client tenant, campus, membership, role, capability, publication,
visibility, or ownership claims. Do not call providers, storage, OAuth,
webhooks, scrapers, proxies, or direct provider URLs. Do not use credentials,
production data, persistence, browser storage, cookies, external fonts, or
external assets. Do not import user-web components, browser-only pages, server
adapters, staff adapters, or admin adapters.

```text
VISITOR_STATE=LOADING|EMPTY|ERROR|PUBLISHED
PUBLIC_CONTENT=VISIBLE_ONLY_WHEN_PUBLISHED_AND_PUBLIC
PRIVATE_CONTENT=NEVER_RENDERED_FROM_PUBLIC_RESPONSE
PHONE_LAYOUT=REQUIRED
PLATFORM_NAVIGATION=REQUIRED
BACK_NAVIGATION=REQUIRED
KEYBOARD_OR_PLATFORM_FOCUS=REQUIRED_WHERE_SUPPORTED
STATUS_ANNOUNCEMENT=REQUIRED_FOR_LOADING_EMPTY_ERROR_RESULTS
EXTERNAL_RESOURCES=ZERO
UNEXPECTED_REQUESTS=ZERO
```

## Future Stage B execution steps

### Task 1: Confirm preconditions

Files: none. Confirm branch, HEAD, V31 SHA, frozen dependencies, target state,
protected evidence boundary, and clean tracked/index state with local checks:
`git status --short --branch --untracked-files=all`, `git rev-parse HEAD`,
`git diff --check`, `git diff --cached --check`, and `git remote`. Do not use
network commands. Any drift blocks before writing.

### Task 2: Establish RED tests

File: `apps/mini-program/src/pages/visitor.test.ts`.

- [ ] Add marked synthetic public, private, draft, disabled, stale, foreign,
      unpublished, and malformed fixtures.
- [ ] Assert mini pages reject user-web and server-adapter imports.
- [ ] Assert missing route/page adapters fail home-to-content and back navigation.
- [ ] Assert missing compact phone layout fails at the approved phone dimensions.
- [ ] Assert non-public content is absent and external/request guards stay closed.

Run `node --test --experimental-strip-types
apps/mini-program/src/pages/visitor.test.ts` before implementation. Expected
RED: non-zero exit caused by the test's missing local route/page imports or
failing route/back-navigation assertions, not by a missing dependency or
environment failure.

### Task 3: Implement routes

File: `apps/mini-program/src/navigation/routes.ts`.

- [ ] Define stable home and content route identifiers.
- [ ] Define deterministic home selection to content and content back to home.
- [ ] Accept only a safe public identifier or local synthetic key.
- [ ] Keep behavior local with no fetch, persistence, provider, or resource load.

### Task 4: Implement home

File: `apps/mini-program/src/pages/visitor/home.ts`.

- [ ] Render loading, empty, error, and published states with status semantics.
- [ ] Provide a supported focusable local action in the empty state.
- [ ] Render only stable, synthetic, published public items.
- [ ] Keep controls usable at phone dimensions without horizontal overflow.

### Task 5: Implement content

File: `apps/mini-program/src/pages/visitor/content.ts`.

- [ ] Render one published public title/body projection.
- [ ] Fail closed for private, draft, unpublished, disabled, stale, foreign,
      malformed, or missing input.
- [ ] Exclude tenant/campus IDs, internal IDs, claims, raw fields, and provider
      metadata; expose deterministic back navigation.

### Task 6: Verify GREEN and regression

Files: only the four Stage B files. Run these local commands after the focused
test is GREEN: `node --test --experimental-strip-types
apps/mini-program/src/pages/visitor.test.ts`; `node_modules/.bin/tsc --noEmit
--target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck
apps/mini-program/src/pages/visitor/home.ts
apps/mini-program/src/pages/visitor/content.ts
apps/mini-program/src/navigation/routes.ts
apps/mini-program/src/pages/visitor.test.ts`; `node_modules/.bin/eslint
apps/mini-program/src/pages/visitor/home.ts
apps/mini-program/src/pages/visitor/content.ts
apps/mini-program/src/navigation/routes.ts
apps/mini-program/src/pages/visitor.test.ts`; `node_modules/.bin/prettier
--check apps/mini-program/src/pages/visitor/home.ts
apps/mini-program/src/pages/visitor/content.ts
apps/mini-program/src/navigation/routes.ts
apps/mini-program/src/pages/visitor.test.ts`; and `git diff --check`.
Expected GREEN: each command exits zero; states, filtering, navigation/back
navigation, phone constraints, mini-only imports, and zero external requests
or resources are proven by the focused test. Do not install tooling or change
`pnpm-lock.yaml`; lockfile drift is a hard blocker. If visual mini-runtime
tooling is unavailable, report `UI_NOT_VISUALLY_VERIFIED`. The earlier V29
implementation gate prohibited staging and committing during Stage B; V31
records the completed Task 14 lifecycle as accepted and frozen.

### Task 7: Stop after verification

The original Stage B stop condition required exactly the four Stage B paths and
an uncommitted worktree under V29. That historical condition is superseded by
V31, which records the four-file implementation, C1, and C2 as accepted and
frozen; no new Task 14 work is authorized.

## Lifecycle and stop gate

```text
STAGE_A=FORMALIZATION_ONLY
STAGE_A_STATUS=OWNER_REVIEW_PASSED
STAGE_A_TO_OWNER_REVIEW=COMPLETED
STAGE_A_TO_STAGE_B=OWNER_AUTHORIZATION_GRANTED
STAGE_B=IMPLEMENTATION_AND_FOCUSED_VERIFICATION
STAGE_B_AUTHORIZATION=GRANTED
STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
STAGE_B_OWNER_REVIEW=PASS
STAGE_C1=REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP
STAGE_C1_AUTHORIZATION=GRANTED
STAGE_C1_STATUS=OWNER_REVIEW_PASSED
STAGE_C2=ACCEPTANCE_RECORD_ONLY
STAGE_C2_AUTHORIZATION=GRANTED
STAGE_C2_STATUS=ACCEPTED
TASK_14_STARTED=YES_STAGE_C2_ACCEPTED
TASK_14_STATUS=ACCEPTED_AND_FROZEN
TASK_15_PLUS_STARTED=NO
TASK_15_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=V34_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
STOP_REASON=V34_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```

Stage A is complete after owner review. V32 records the completed Stage B
implementation, reviewed C1 evidence, and accepted C2 record within their exact
boundaries. Task 14 is frozen, and Task 15 Stage B/C and Task 16+ remain unauthorized.
Stop with `STATUS=BLOCKED` and preserve the scene if any V32 baseline,
protected-path, encoding, or exact-write-boundary condition fails.
