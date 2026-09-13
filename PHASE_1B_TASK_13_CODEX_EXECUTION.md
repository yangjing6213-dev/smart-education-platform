# Phase 1B Task 13 Codex Execution Contract

This contract records the approved Task 13 Stage A formalization and the V31
active-lifecycle overlay. Stage B implementation passed owner review, C1 was
reviewed, and C2 was accepted under its approved boundary. Task 14 Stage B/C1/C2
were completed and accepted, and Task 14 is now frozen; Task 15+ remain outside
the current authorization.

## Contract status and authorization

```text
TASK_ID=PHASE_1B_TASK_13
TASK_NAME=VISITOR_USER_WEB
STAGE=STAGE_A_FORMALIZATION
STATUS=OWNER_REVIEW_PASSED
EXECUTION_DATE=2026-09-11
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
TARGET_BRANCH=CURRENT_CHECKOUT_NO_NEW_BRANCH_OR_WORKTREE
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=984c92a4b897caeb097e48d3af57324f3e7b612e
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V31.md
ACTIVE_GOVERNANCE_SHA256=318463CB170B0B2AFA8840DBD302D4E30078B7AE37B14063BDA77A74396BF685
OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_CONFIRMED_TASK13_STAGE_A_FORMALIZATION_2026-09-11
TASK_13_STARTED=YES_STAGE_C2_ACCEPTED
TASK_13_STAGE_A_AUTHORIZATION=GRANTED
TASK_13_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_13_STAGE_B_AUTHORIZATION=GRANTED
TASK_13_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_13_STAGE_B_OWNER_REVIEW=PASS
TASK_13_STAGE_C1_AUTHORIZATION=GRANTED
TASK_13_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_13_STAGE_C2_AUTHORIZATION=GRANTED
TASK_13_STAGE_C2_STATUS=ACCEPTED
TASK_13_STATUS=ACCEPTED_AND_FROZEN
TASK_13_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_13_ACCEPTANCE.md
TASK_13_ACCEPTANCE_SHA256=8F8BC3976D22150FBE9801D71ACAC4D9C8DA9EB8A96F616CC50DF891E5700ADF
TASK_14_STARTED=YES_STAGE_C2_ACCEPTED
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
TASK_15_STARTED=NO
TASK_15_PLUS_STARTED=NO
TASK_15_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=V31_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
STOP_REASON=V31_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```

`PASS` for Stage A means that the two formalization documents satisfy their
local evidence gates and are ready for owner review. The V31 authority records
Task 14 Stage B/C1/C2 as completed, accepted, and frozen; Task 15+ remain
unauthorized.

## Task identity, dependencies, and inputs

Task 13 is the visitor-facing user-web surface for public, contract-shaped
content. Its approved dependencies are Tasks 05-08 and 12, all of which remain
accepted and frozen under the active V31 authority.

```text
TASK_13_DEPENDENCIES=TASK_05|TASK_06|TASK_07|TASK_08|TASK_12
TASK_13_INPUTS=PUBLIC_API_CONTRACTS|USER_WEB_PACKAGE|RESPONSIVE_RULES
TASK_13_OUTPUT=LONG_FORM_VISITOR_PAGES_WITH_LOADING_EMPTY_ERROR_PUBLISHED_STATES
TASK_13_IMPLEMENTATION_SCOPE=WEB_ONLY_CONTRACT_DATA_COMPOSITION
TASK_13_PROVIDER_ACCESS=DISALLOWED
TASK_13_SYNTHETIC_DATA_ONLY=YES
TASK_13_PERSISTENCE=DISALLOWED
TASK_13_UNEXPECTED_REQUESTS=DISALLOWED
```

The current repository baseline is the Fastify/TypeScript monorepo described by
V31. The existing user-web package exposes `typecheck`, `lint`, and `build`
scripts, uses `src` as its root and `dist` as its output directory, and has no
Stage B visitor route or visitor test file yet.

## Exact Stage A boundary

The Stage A formalization created only these two files:

```text
STAGE_A_EXACT_FILES=PHASE_1B_TASK_13_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_13_PLAN.md
STAGE_A_WRITE_POLICY=CREATE_ONLY_THE_TWO_EXACT_FILES
STAGE_A_GIT_POLICY=NO_ADD|NO_STAGE|NO_COMMIT|NO_PUSH|NO_PR|NO_DEPLOY
STAGE_A_NETWORK=NO
STAGE_A_DEPENDENCY_INSTALL=NO
STAGE_A_SERVICE_START=NO
STAGE_A_DATABASE_OR_MIGRATION=NO
STAGE_A_SELF_SHA_POLICY=EXTERNAL_RECEIPT_ONLY_NO_SELF_REFERENCE
STAGE_A_ENCODING=UTF-8_NO_BOM
STAGE_A_LINE_ENDING=LF_ONLY
STAGE_A_TRAILING_LF=EXACTLY_ONE
```

No existing file may be modified by the Stage A formalization. This includes
V27, V26, all earlier governance,
Task 01-12 evidence, the old Task 06 verifier, application code, tests,
configuration, dependencies, lockfiles, and all protected untracked evidence.

## Future Stage B implementation boundary

The following four files were the complete Stage B candidate set. Their accepted
implementation remains frozen within the approved exact-file boundary while
the separately authorized C1 evidence work proceeds:

```text
STAGE_B_EXACT_FILES=apps/user-web/src/routes/visitor.routes.tsx|apps/user-web/src/pages/visitor-home.tsx|apps/user-web/src/pages/visitor-content.tsx|apps/user-web/src/pages/visitor.test.tsx
STAGE_B_WRITE_POLICY=FUTURE_EXACT_FILES_ONLY
STAGE_B_COMMIT_MESSAGE=feat: add visitor web surface
STAGE_B_AUTHORIZATION=GRANTED
STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
STAGE_C1_AUTHORIZATION=GRANTED
STAGE_C1_STATUS=AUTHORIZED_NOT_STARTED
STAGE_C2_AUTHORIZATION=NOT_GRANTED
```

If implementation requires a fifth file, a package change, a shared contract
change, a route registry change, or a dependency change, the future execution
must stop as BLOCKED and request a new explicit contract. It must not expand the
allowlist in place.

## Product and safety boundary

The future surface is a public visitor web projection over approved contract
data. It is not a provider integration, authenticated staff surface, content
management tool, or replacement for the API contract.

Required boundaries:

- Render only synthetic, clearly non-real published content supplied by the
  approved public contract projection.
- Never render private, draft, unpublished, disabled, foreign, stale, or
  otherwise non-public content from a public response.
- Do not trust client-supplied tenant, campus, membership, role, capability,
  publication, or visibility claims as authorization evidence.
- Do not call provider APIs, storage providers, OAuth, webhooks, scrapers,
  proxies, or direct provider URLs.
- Do not use real credentials, real personal data, production data, persistence,
  browser storage, cookies, or external fonts/assets.
- Do not imply that an API route is globally mounted merely because a page-level
  contract or synthetic fixture exists.
- Keep visitor terminology consistent with the project rule: use visitor,
  visitor state, visitor client, or visitor home; do not introduce a new public
  product term.

## Required visitor states and accessibility

The future pages must cover these states using stable, contract-shaped synthetic
fixtures:

```text
VISITOR_STATE=LOADING|EMPTY|ERROR|PUBLISHED
PUBLIC_CONTENT=VISIBLE_ONLY_WHEN_PUBLISHED_AND_PUBLIC
PRIVATE_CONTENT=NEVER_RENDERED_FROM_PUBLIC_RESPONSE
KEYBOARD_NAVIGATION=REQUIRED
NARROW_VIEWPORT=REQUIRED
STATUS_ANNOUNCEMENT=REQUIRED_FOR_LOADING_EMPTY_ERROR_RESULTS
FOCUS_ORDER=DETERMINISTIC_AND_KEYBOARD_REACHABLE
```

The home page is responsible for the visitor entry and published-content list
projection. The content page is responsible for a single published item and its
safe empty/error/unavailable presentation. Both pages must remain web-only and
must not open external destinations.

## TDD and acceptance contract for future Stage B

Stage B must begin with the smallest failing test in
`apps/user-web/src/pages/visitor.test.tsx` before implementation code is added.
The RED baseline must demonstrate all of the following:

1. A private item in a public-shaped response is not rendered.
2. The keyboard navigation assertion fails before the accessible visitor
   controls exist.
3. The narrow viewport assertion fails before responsive layout constraints
   exist.

The minimum GREEN evidence must then demonstrate:

1. A synthetic published item renders through the approved public contract.
2. Loading, empty, error, and published states render deterministically.
3. Keyboard focus reaches every visitor action in a logical order.
4. The layout remains usable at the approved narrow viewport dimensions.
5. No unexpected request is emitted and no provider URL is opened.
6. Private, draft, foreign, and unpublished items remain absent from the
   rendered projection.

No assertion may be weakened to make the implementation pass. Any test-runner
or browser dependency required by Stage B must be separately authorized; Stage A
does not install or update dependencies.

## Verification and evidence contract

Stage A verification is limited to the two new documents and repository state:

```text
Node crypto SHA-256 over each Stage A file
.NET SHA256 over each Stage A file
UTF-8 without BOM
CR byte count equals zero
LF-only with exactly one trailing LF
No self-SHA in either Stage A file
git diff --check
git status --short --untracked-files=all
```

Future Stage B verification, after separate authorization, is:

```text
corepack pnpm --filter @student-care/user-web typecheck
corepack pnpm --filter @student-care/user-web lint
corepack pnpm --filter @student-care/user-web build
pnpm exec prettier --check apps/user-web/src/routes/visitor.routes.tsx apps/user-web/src/pages/visitor-home.tsx apps/user-web/src/pages/visitor-content.tsx apps/user-web/src/pages/visitor.test.tsx
git diff --check
```

The Stage B record must additionally report the focused visitor test result,
keyboard and narrow-viewport result, unexpected-request result, exact changed
paths, and any UI verification that could not be run. Stage B must not be
reported as complete from source inspection alone when browser tooling is
available.

## Stop conditions and lifecycle

```text
STAGE_A_TO_OWNER_REVIEW=REQUIRED
STAGE_A_TO_STAGE_B=OWNER_AUTHORIZATION_REQUIRED
STAGE_B_TO_C1=SEPARATE_OWNER_AUTHORIZATION_REQUIRED
STAGE_C1_TO_C2=SEPARATE_OWNER_ACCEPTANCE_REQUIRED
TASK_13_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_13_STAGE_B_AUTHORIZATION=GRANTED
TASK_13_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_13_STAGE_B_OWNER_REVIEW=PASS
TASK_13_STAGE_C1_AUTHORIZATION=GRANTED
TASK_13_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_13_STAGE_C2_AUTHORIZATION=GRANTED
TASK_13_STAGE_C2_STATUS=ACCEPTED
TASK_13_STATUS=ACCEPTED_AND_FROZEN
TASK_14_STARTED=YES_STAGE_C2_ACCEPTED
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
TASK_15_STARTED=NO
TASK_15_PLUS_STARTED=NO
TASK_15_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=V31_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
STOP_REASON=V31_GOVERNANCE_SYNC_OWNER_REVIEW_GATE
```

Stop immediately with `STATUS=BLOCKED` if the V31 baseline, branch, HEAD,
tracked/index cleanliness, target absence, protection count, encoding boundary,
or exact write allowlist is not satisfied. Preserve the scene and do not clean,
restore, stage, commit, or modify unrelated paths.
