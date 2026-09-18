# Phase 1B Task 15 Codex Execution Contract

This document preserves the approved Task 15 contract and records its
post-C2 accepted-and-frozen lifecycle. Task 15 Stage B, C1, and C2 completed
within their approved boundaries. The next-task stop flags retained below are
HISTORICAL/FROZEN snapshots, not current global task status.

## Authorization and anchors

```text
TASK_ID=PHASE_1B_TASK_15
TASK_NAME=INTERNAL_EMPLOYEE_USER_WEB
STAGE=STAGE_C2_ACCEPTANCE
CONTRACT_STATUS=ACCEPTED_AND_FROZEN
EXECUTION_DATE=2026-09-13
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
CURRENT_BRANCH=feature/phase-1b-task-04-identity-membership
CURRENT_HEAD=9de01c4f5953ad48552c447fa8922da785f14e71
ACTIVE_GOVERNANCE_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md
ACTIVE_GOVERNANCE_SHA256=7BECA819534A223D84C4D95FD117FC68C4B9CD4CDFC2E5345AF09E9547D188AB
OWNER_AUTHORIZATION_EVIDENCE=PROJECT_OWNER_CONFIRMED_TASK15_STAGE_A_FORMALIZATION_2026-09-13
TASK_14_STATUS=ACCEPTED_AND_FROZEN
TASK_15_STARTED=YES_STAGE_C2_ACCEPTED
TASK_15_STAGE_A_AUTHORIZATION=GRANTED
TASK_15_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK_15_STAGE_A_OWNER_REVIEW=PASS
TASK_15_STAGE_A_EXECUTION_RECEIPT_CHANNEL=DELAYED_RECOVERY_ACCEPTED_BY_OWNER
TASK_15_STAGE_B_AUTHORIZATION=GRANTED
TASK_15_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED
TASK_15_STAGE_C1_AUTHORIZATION=GRANTED
TASK_15_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK_15_STAGE_C1_OWNER_REVIEW=PASS
TASK_15_STAGE_C2_AUTHORIZATION=GRANTED
TASK_15_STAGE_C2_STATUS=ACCEPTED_AND_FROZEN
TASK_15_STAGE_C2_OWNER_REVIEW=PASS
TASK_15_STATUS=ACCEPTED_AND_FROZEN
UI_NOT_VISUALLY_VERIFIED=YES
OWNER_REVIEW_GATE=TASK15_STAGE_C2_OWNER_REVIEW_GATE
STOP_REASON=TASK15_STAGE_C2_OWNER_REVIEW_GATE
```

V42 is the current governance authority. The earlier Stage A and pre-C2
authorization values remain HISTORICAL/FROZEN contract snapshots only and do
not override the accepted Task 15 state above. Under V42, Task 16 and Task 17
are accepted and frozen; Task 18+ remains unstarted and unauthorized.

## Identity, dependencies, and objective

```text
TASK_15_DEPENDENCIES=TASK_04|TASK_09|TASK_10|TASK_11|TASK_12|TASK_13
TASK_15_INPUTS=MEMBERSHIP_POLICY|GUIDE_RESOURCE_CONTRACTS|DAILY_REPORT_CONTRACT
TASK_15_OUTPUT=INTERNAL_EMPLOYEE_WEB_WORKBENCH_LONG_CONTENT_TASK_AND_REPORT_VIEWS
TASK_15_IMPLEMENTATION_SCOPE=USER_WEB_ONLY_CONTRACT_ADAPTERS
TASK_15_PROVIDER_ACCESS=DISALLOWED
TASK_15_PERSISTENCE=DISALLOWED_FOR_STAGE_B_SYNTHETIC_SCOPE
TASK_15_REAL_DATA=DISALLOWED
TASK_15_EXTERNAL_RESOURCES=ZERO
TASK_15_UNEXPECTED_REQUESTS=ZERO
TASK_15_COMMIT_MESSAGE=feat: add internal employee web surface
```

Task 15 is the internal employee user-web surface. It is intended for
authorized synthetic staff identities and must provide a workbench, long-form
guide/resource content, task views, and daily report views. It must remain
separate from visitor pages, the mini-program surface, staff/admin management
surfaces, and server-owned authorization.

The implementation must preserve tenant and campus scope. The server resolves
identity, active membership, role, capability, tenant, and campus scope from
trusted context. The user-web adapter may render approved contract data, but it
must not treat client-supplied tenant IDs, campus IDs, roles, memberships,
capabilities, publication claims, or ownership claims as authorization.

## Exact future Stage B boundary

After separate Stage B authorization, the only implementation and test files
are:

```text
apps/user-web/src/routes/staff.routes.tsx
apps/user-web/src/pages/staff-workbench.tsx
apps/user-web/src/pages/staff-report.tsx
apps/user-web/src/pages/staff.test.tsx
```

The route file owns only internal employee web route selection. The workbench
file owns the staff landing projection, scoped task/resource navigation, and
long-content entry points. The report file owns the authorized daily report
projection and permitted summary state. The test file owns focused RED/GREEN
assertions for access denial, scope isolation, report authorization, and
request/resource boundaries.

A fifth file, shared-contract edit, route-registry edit outside the four-file
list, package/configuration edit, dependency requirement, lockfile change, or
server policy change is an immediate `STATUS=BLOCKED` result. The executor must
not expand this allowlist.

## Product and authorization requirements

The future Stage B surface must:

- deny visitor identities and suspended or inactive staff identities;
- deny missing sessions, revoked memberships, forged role claims, and absent
  employee capability;
- keep search and task/report results within the server-enforced tenant and
  permitted campus scope;
- deny cross-campus search and direct foreign-campus identifiers even when
  supplied by the client;
- deny teacher-only summaries to staff without the teacher capability and show
  a safe unavailable/denied state without raw private fields;
- allow an authorized synthetic teacher to complete the approved daily report
  flow and view only the permitted AI summary projection;
- keep long-form guide/resource content in the user-web surface without
  importing mini-program pages, visitor pages, server adapters, or admin UI;
- use clearly synthetic, labeled, non-real data only.

The implementation must not expose student names, phone numbers, identity
numbers, addresses, photos, health, attendance, pickup, grades, family
relationships, or other sensitive minor data. Any child-related field used in
fixtures must be synthetic, minimized, scoped, redacted, and safe for the
approved staff capability. No real credentials, production data, provider
URLs, storage, browser persistence, analytics, or external resources may be
used.

## HISTORICAL/FROZEN: Stage lifecycle and gates

```text
STAGE_A=CONTRACT_AND_IMPLEMENTATION_PLAN_FORMALIZATION
STAGE_A_STATUS=OWNER_REVIEW_PASSED
STAGE_A_TO_OWNER_REVIEW=COMPLETED
STAGE_A_TO_STAGE_B=SEPARATE_OWNER_AUTHORIZATION_REQUIRED
STAGE_B=IMPLEMENTATION_AND_FOCUSED_VERIFICATION
STAGE_B_AUTHORIZATION=GRANTED
STAGE_B_STATUS=NOT_STARTED
STAGE_B_OWNER_REVIEW=REQUIRED_BEFORE_C1
STAGE_C1=REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP
STAGE_C1_AUTHORIZATION=GRANTED
STAGE_C1_STATUS=OWNER_REVIEW_PASSED
STAGE_C1_OWNER_REVIEW=PASS
STAGE_C2=ACCEPTANCE_RECORD_ONLY
STAGE_C2_AUTHORIZATION=GRANTED
STAGE_C2_STATUS=ACCEPTED_AND_FROZEN
STAGE_C2_OWNER_REVIEW=PASS
TASK_15_STATUS=ACCEPTED_AND_FROZEN
UI_NOT_VISUALLY_VERIFIED=YES
TASK_16_PLUS_STARTED=NO
TASK_16_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK15_STAGE_C2_OWNER_REVIEW_GATE
STOP_REASON=TASK15_STAGE_C2_OWNER_REVIEW_GATE
```

The original Stage A lifecycle above is retained as a historical contract
shape; its former pre-C2 values are HISTORICAL/FROZEN, not current status.
The next-task NO/NOT_GRANTED flags record Task 15's historical stop boundary,
not current global status, and do not revoke later owner authorizations.

Stage B may begin only after the owner separately reviews this Stage A package
and grants Stage B authorization. Stage B must stop at its own owner-review
gate. C1 requires separate authorization after Stage B implementation and
verification. C2 requires separate acceptance authorization after independent
C1 verification. A C2 acceptance does not authorize Task 16.

## TDD and verification contract for future Stage B

Stage B must use TDD within the four-file boundary:

```text
RED=visitor_and_suspended_staff_denied|cross_campus_search_denied|teacher_only_summary_denied
GREEN=authorized_synthetic_teacher_report_flow|permitted_summary_only|zero_external_resources
REGRESSION=focused_test|typecheck|lint|prettier|git_diff_check
```

The focused test must initially fail for the missing route/page behavior and
then pass without weakening denial assertions. It must prove visitor access,
suspended staff access, missing membership, cross-campus search, foreign
identifiers, teacher-only summary denial, authorized teacher report flow,
synthetic data boundaries, and zero unexpected requests or external resources.

After Stage B authorization, use only already-installed local tooling. Run the
focused test first, then the applicable local typecheck, lint, Prettier, and
`git diff --check` commands for the four files. Do not install dependencies,
start services, call a provider, use a browser network, modify the lockfile, or
write a fifth file. If visual user-web runtime verification is unavailable,
report `UI_NOT_VISUALLY_VERIFIED`.

All Stage A documents must be UTF-8 without BOM, LF-only, exactly one trailing
LF, and must not contain their own actual SHA. Stage A must not stage or commit
the two documents.

## Stop conditions

Stop with `STATUS=BLOCKED` and preserve the scene if V33, branch, HEAD,
protected-path set, target-file state, index/tracked-worktree boundary, or
exact two-file Stage A allowlist conflicts with this contract. Do not repair
unrelated changes or infer authorization for Stage B, C1, C2, or Task 16+.
