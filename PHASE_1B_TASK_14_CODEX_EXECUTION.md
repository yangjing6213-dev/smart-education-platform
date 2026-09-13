# Phase 1B Task 14 Codex Execution Contract

This document preserves the Task 14 Stage A formalization and records the V31
active-lifecycle overlay. Stage B was implemented and accepted within the
four-file boundary below, C1 was reviewed, and C2 was accepted. Task 14 is now
frozen; Task 15+ remain not started and unauthorized.

## Authorization and anchors

```text
TASK_ID=PHASE_1B_TASK_14
TASK_NAME=VISITOR_MINI_PROGRAM
STAGE=STAGE_C2_ACCEPTANCE
STATUS=ACCEPTED_AND_FROZEN
EXECUTION_DATE=2026-09-12
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=8a95455b287cff3db3efadcd28ebc453c3e7fa94
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V31.md
ACTIVE_GOVERNANCE_SHA256=318463CB170B0B2AFA8840DBD302D4E30078B7AE37B14063BDA77A74396BF685
OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_CONFIRMED_TASK14_STAGE_A_FORMALIZATION_2026-09-12
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
TASK_13_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_13_STAGE_B_OWNER_REVIEW=PASS
TASK_13_STAGE_C1_AUTHORIZATION=GRANTED
TASK_13_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_13_STAGE_C2_AUTHORIZATION=GRANTED
TASK_13_STATUS=ACCEPTED_AND_FROZEN
TASK_14_STARTED=YES_STAGE_C2_ACCEPTED
TASK_15_STARTED=NO
TASK_15_PLUS_STARTED=NO
TASK_15_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=V31_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
STOP_REASON=V31_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```

The current branch and HEAD are read-only anchors. V31 is the active authority;
its path and SHA are recorded above. The completed Stage B and C1 boundaries,
and the accepted C2 record, remain frozen. No Task 15+ work is authorized.

## Identity, dependencies, and output

```text
TASK_14_DEPENDENCIES=TASK_05|TASK_06|TASK_07|TASK_08|TASK_13
TASK_14_INPUTS=SHARED_PUBLIC_CONTRACTS|MINI_UI_PACKAGE|ON_SITE_LAYOUT_RULES
TASK_14_OUTPUT=COMPACT_VISITOR_FLOW_WITH_PLATFORM_NAVIGATION_AND_SHARED_SEMANTICS
TASK_14_IMPLEMENTATION_SCOPE=MINI_PROGRAM_ONLY_CONTRACT_ADAPTERS
TASK_14_PROVIDER_ACCESS=DISALLOWED
TASK_14_PERSISTENCE=DISALLOWED
TASK_14_REAL_DATA=DISALLOWED
TASK_14_EXTERNAL_RESOURCES=DISALLOWED
TASK_14_UNEXPECTED_REQUESTS=DISALLOWED
```

Task 14 is the Visitor mini program. It adapts shared public business meaning
for compact, on-site interaction. It must remain separate from user-web pages,
server adapters, and server-owned authorization.

Task 14 Stage B required Task 13 Stage C1 completion followed by the
independent Task 13 C2 acceptance gate. Under V31, Task 13 is accepted and
frozen, and Task 14 Stage B, C1, and C2 are completed within their approved
boundaries and frozen.

## Stage A and future Stage B boundaries

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_14_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_14_PLAN.md
STAGE_A_WRITE_POLICY=CREATE_ONLY_THE_TWO_EXACT_FILES
STAGE_A_GIT_POLICY=NO_ADD|NO_STAGE|NO_COMMIT|NO_PUSH|NO_PR|NO_DEPLOY
STAGE_A_NETWORK=NO
STAGE_A_DEPENDENCY_INSTALL=NO
STAGE_A_SERVICE_START=NO
STAGE_A_DATABASE_OR_MIGRATION=NO
STAGE_A_GOVERNANCE_SYNC=COMPLETED_IN_V31
STAGE_A_C1_C2=SEPARATE_AUTHORIZATION_AND_ACCEPTANCE_COMPLETED
STAGE_A_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
STAGE_A_ENCODING=UTF-8_NO_BOM
STAGE_A_LINE_ENDING=LF_ONLY
STAGE_A_TRAILING_LF=EXACTLY_ONE
STAGE_B_EXACT_FILES=apps/mini-program/src/pages/visitor/home.ts|apps/mini-program/src/pages/visitor/content.ts|apps/mini-program/src/navigation/routes.ts|apps/mini-program/src/pages/visitor.test.ts
STAGE_B_AUTHORIZATION=GRANTED
STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
STAGE_B_OWNER_REVIEW=PASS
STAGE_B_COMMIT_MESSAGE=feat: add visitor mini-program surface
STAGE_C1_STATUS=OWNER_REVIEW_PASSED
STAGE_C2_AUTHORIZATION=GRANTED
STAGE_C2_STATUS=ACCEPTED
TASK_14_STATUS=ACCEPTED_AND_FROZEN
TASK_15_STARTED=NO
TASK_15_PLUS_AUTHORIZATION=NOT_GRANTED
```

Stage A created only the two documents named above. No existing file was
modified by that formalization, including superseded governance authorities,
Task 01-13 evidence, Task 13 C1/C2 evidence, `scripts/verify_task_06.mjs`,
`pnpm-lock.yaml`, application code, tests, configuration, dependencies, or
protected untracked evidence.

After separate Stage B authorization, only the four exact Stage B files may be
created or modified. A fifth-file, shared-contract, auth, package, route
registry, dependency, or lockfile requirement is an immediate BLOCKED result;
the executor must not expand the allowlist.

## Product and safety requirements

The future implementation uses only clearly synthetic, non-real, published
public contract data. It must exclude private, draft, unpublished, disabled,
stale, foreign, and malformed content. It must not trust client tenant,
campus, membership, role, capability, publication, visibility, or ownership
claims as authorization evidence.

It must not call providers, storage, OAuth, webhooks, scrapers, proxies, or
direct provider URLs; use credentials, production data, persistence, browser
storage, cookies, external fonts, or external assets; or import user-web,
server, staff, or admin adapters. Mini pages may adapt approved contract data
but may not duplicate server policy or widen scope.

Required behavior is:

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

## Future TDD and verification contract

Stage B begins with a failing test in
`apps/mini-program/src/pages/visitor.test.ts`. RED must cover rejected
web-component/server-adapter imports, missing home-to-content and back
navigation, missing phone layout constraints, hidden private or unpublished
items, and the no-external-resource/request guard.

GREEN must prove synthetic published rendering; deterministic loading, empty,
error, and published states; home/content navigation and back navigation;
phone usability; filtering of private, draft, disabled, stale, foreign,
unpublished, and malformed data; and zero external resources, provider URLs,
persistence, or unexpected requests. Assertions must not be weakened.

After separate authorization, use only already-installed local tooling. The
focused test runs first, followed by local typecheck, lint, and Prettier checks
for the four files, then `git diff --check`. A missing runtime, missing binary,
fifth-file requirement, or lockfile drift is a hard blocker; do not install or
update dependencies. If visual mini-runtime tooling is unavailable, report
`UI_NOT_VISUALLY_VERIFIED`.

## Lifecycle and stop conditions

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
OWNER_REVIEW_GATE=V31_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
STOP_REASON=V31_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```

Stop with `STATUS=BLOCKED` and preserve the scene if the V31 baseline, branch,
HEAD, tracked/index cleanliness, protected-path boundary, encoding boundary, or
exact governance allowlist is not satisfied.
