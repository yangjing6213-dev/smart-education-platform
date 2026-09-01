# Phase 1B Task 04 Stage A Formalization Plan

> **For agentic workers:** The current authorization is limited to Stage A
> formalization. Before any later behavior change, use
> `long-horizon-development`, `using-superpowers`, `brainstorming`,
> `writing-plans`, `test-driven-development`, and
> `verification-before-completion`; use `systematic-debugging` on any failure
> and `requesting-code-review` before later completion claims.

**Goal:** Render the approved Task 04 contract and this plan, then stop for
independent owner review without starting identity or login implementation.

**Architecture:** A future Task 04 will add a provider-independent internal
identity and membership policy boundary. Public `/me` and `/memberships`
transport types belong to `@student-care/contracts`; trusted server-side
identity, session, membership, and capability policy belong to
`@student-care/auth`. The existing Task 03 scope plugin remains responsible
for tenant/campus scope context and its existing denial envelope.

**Tech Stack:** Fastify 5.12.1, Node.js 24.14.0, Corepack pnpm 11.22.0
offline, TypeScript 5.7.3, Node.js test runner, and existing workspace tools.

---

## Fixed authority anchors

```text
TASK_ID=PHASE_1B_TASK_04
TASK_NAME=IDENTITY_AND_INTERNAL_EMPLOYEE_LOGIN_FOUNDATION
PROJECT_ROOT=C:/Users/HU/Documents/student-care-saas-platform
SOURCE_BRANCH=feature/phase-1b-task-03-tenant-campus-scope
SOURCE_HEAD=af9219def7fab5b68f7b9c611cc5a6fb0e1822c2
TARGET_BRANCH=feature/phase-1b-task-04-identity-membership
GOVERNANCE_AUTHORITY_PATH=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V1.md
GOVERNANCE_AUTHORITY_SHA256=FD9DC8D4FA11222B70ED549818C431FD12B7E87B0F045EFAE856991EE008F051
V2_2_DRAFT_STATUS=READY_FOR_OWNER_REVIEW
V2_2_EXTERNAL_JSON_SHA256=6B5DC5603D288B186AD5EA46361C263D3DBDC8C231E854C074F2F25AC352E5ED
V2_2_CANONICAL_SHA256=2B12E3121C7EB786CFC40CE0FC3680DE5EB0D91DB1A12E61ED241F5A3D2EC27E
TASK_04_STARTED=NO
TASK_04_IMPLEMENTATION_AUTHORIZATION=NOT_GRANTED
TASK_04_GOAL_AUTHORIZATION=NOT_GRANTED
DEPENDENCIES=T02 -> T03
PUBLIC_API_DTOS=@student-care/contracts
INTERNAL_AUTH_POLICY_TYPES=@student-care/auth
MEMBERSHIPS_ROUTE=ACTIVE_ONLY
TASK_03_VERIFIER=HISTORICAL_FROZEN
ACTIVE_ROOT_VERIFIER=TASK_04_AWARE
LONG_HORIZON_DEVELOPMENT_REQUIRED=YES
SUPERPOWERS_REQUIRED=using-superpowers|brainstorming|writing-plans|test-driven-development|verification-before-completion|requesting-code-review
SYSTEMATIC_DEBUGGING_REQUIRED_ON_ANY_FAILURE=YES
```

The exact-file SHA-256 values for this plan and
`PHASE_1B_TASK_04_CODEX_EXECUTION.md` are recorded only in the external Stage
A receipt. Neither file self-references its own digest.

## Lifecycle controls

```text
FORMAT_GATE_POLICY=StageA_after_render_check_only_existing_contract_and_plan|StageB_root_format_check_requires_only_existing_StageA_and_StageB_text_files|StageC1_after_generation_check_review_text_and_validate_manifest_deterministically|ZIP_is_binary_hash_and_member_validation_only_not_prettier|StageC2_after_owner_PASS_check_acceptance_record|no_stage_gate_requires_absent_future_stage_paths
STAGE_A_EXACT_FILES=PHASE_1B_TASK_04_CODEX_EXECUTION.md|docs/project/PHASE_1B_TASK_04_PLAN.md
STAGE_C1_EXACT_FILES=docs/reviews/PHASE_1B_TASK_04_REVIEW.md|SHA256SUMS_PHASE_1B_TASK_04.txt|artifacts/review-package/student-care-platform-phase1b-task-04-review-pack-v1.0.zip
STAGE_C2_EXACT_FILES=docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md
OWNER_REVIEW_GATE=after_StageC1_evidence_before_StageC2_acceptance
ACCEPTANCE_RECORD_POLICY=create_only_after_explicit_project_owner_PASS|record_actual_StageB_implementation_commit_and_final_manifest_ZIP_SHAs|separate_commit|never_prewrite_or_claim_owner_acceptance
COMMIT_BOUNDARIES=StageA_contract_formalization|StageB_implementation_verification|StageC1_final_evidence|OWNER_REVIEW_GATE|StageC2_acceptance_record_only
STAGE_C2_AUTHORIZATION=NOT_AUTHORIZED_UNTIL_EXPLICIT_PROJECT_OWNER_PASS
```

Stage A checks only the two text files in `STAGE_A_EXACT_FILES` after they are
rendered. It must not require a Stage B file, Stage C1 review/manifest/ZIP, or
the Stage C2 acceptance record. Stage B, Stage C1, and Stage C2 are not
authorized by this plan or the current formalization.

## Task 1: Stage A contract and plan formalization

**Files:**

- Create: `PHASE_1B_TASK_04_CODEX_EXECUTION.md`
- Create: `docs/project/PHASE_1B_TASK_04_PLAN.md`

**Objective:** Render only the approved Task 04 contract and this execution
plan without creating a Task 04 branch, starting `/goal`, or changing code,
tests, scripts, dependencies, or evidence.

- [x] Render the contract with the fixed authority anchors, trust boundary,
      active-membership policy, scope composition rule, frozen Task 03 verifier
      policy, and lifecycle controls.
- [x] Render this plan with the exact current and future file boundaries.
- [ ] Verify both rendered files are UTF-8 without BOM, LF-only, and end in
      exactly one trailing LF.
- [ ] Verify independent Node crypto and .NET SHA-256 values agree for each
      rendered file.
- [ ] Verify the working tree has exactly the two Stage A paths, the index is
      clean, no remote exists, and no Stage B/C1/C2 artifact exists.
- [ ] Record only the allowed external receipt and stop for independent owner
      review.

## Task 2: Future Stage B identity and membership implementation

**Authorization:** Not granted. This task may start only after a separate
project-owner implementation authorization and `/goal` authorization.

**New Task 04 files:**

```text
packages/contracts/src/identity.ts
packages/contracts/test/identity.test.ts
packages/auth/package.json
packages/auth/tsconfig.json
packages/auth/src/index.ts
packages/auth/src/identity.ts
packages/auth/src/session.ts
packages/auth/src/membership-policy.ts
packages/auth/test/policy.test.ts
apps/api/src/plugins/auth.plugin.ts
apps/api/src/routes/me.route.ts
apps/api/src/routes/memberships.route.ts
apps/api/test/task04.routes.test.ts
scripts/verify_task_04.mjs
```

**Active shared files authorized only for the future Stage B approval:**

```text
packages/contracts/package.json
packages/contracts/src/index.ts
apps/api/package.json
apps/api/src/server.ts
package.json
pnpm-lock.yaml
tests/contracts/package-boundaries.test.mjs
tests/workspace/paths.test.mjs
```

**Frozen files that Stage B must not rewrite:**

```text
scripts/verify_task_03.mjs
PHASE_1B_TASK_03_CODEX_EXECUTION.md
docs/project/PHASE_1B_TASK_03_PLAN.md
docs/project/PHASE_1B_TASK_03_ACCEPTANCE.md
docs/reviews/PHASE_1B_TASK_03_REVIEW.md
SHA256SUMS_PHASE_1B_TASK_03.txt
artifacts/review-package/student-care-platform-phase1b-task-03-review-pack-v1.0.zip
apps/api/src/app.ts
pnpm-workspace.yaml
tsconfig.base.json
packages/contracts/src/errors.ts
packages/contracts/src/content.ts
packages/contracts/src/requests.ts
packages/contracts/test/schema.test.ts
```

After later approval, work must proceed Red -> Green -> Refactor/Regression:

1. Create failing synthetic tests for trusted identity/session and membership
   policy. The policy must deny missing, expired, revoked, and forged sessions;
   suspended, revoked, or foreign-tenant memberships; client role claims; and
   disallowed or foreign campus candidates.
2. Implement the smallest pure provider-independent auth policy. The server
   accepts only trusted server-side authentication results; client identity,
   role, tenant, and campus claims are untrusted.
3. Create failing Fastify integration tests for `/me` and `/memberships`, then
   implement only active-membership responses. `/memberships` returns only
   visible `ACTIVE` memberships and never returns invited, suspended, or
   revoked membership detail.
4. Compose Task 04 trusted identity/membership inputs before the Task 03 scope
   plugin. Retain Task 03 scope derivation and its existing denial envelope.
5. Evolve only the listed active shared root scripts and boundary tests. The
   root verifier must migrate to `scripts/verify_task_04.mjs`; it must preserve
   historical Task 03 SHA evidence without treating
   `scripts/verify_task_03.mjs` as a current-HEAD pass gate.

Stage B may not add a real login flow, WeChat authorization, SMS, OAuth, OIDC,
password handling, custom cryptography, token issuance, persistent session,
database schema/migration, production identity provider, payment, cloud
service, client app, real personal data, production credential, Task 05+, or
an external runtime dependency. Any lockfile change requires explicit approval
and offline reproducibility evidence.

## Task 3: Future Stage B verification

**Authorization:** Not granted. Do not run this task during Stage A.

After separate approval, the future Task 04 verifier must support
`--mode=structure` and `--mode=final-review`. It must verify frozen Task 03
file and evidence anchors without modifying or executing the historical Task 03
verifier as a current-HEAD pass gate.

The future root script migration is fixed as follows:

```text
ROOT_SCRIPT_MIGRATION_POLICY=typecheck_and_build_include_@student-care/contracts_@student-care/validation_@student-care/tenant_@student-care/api_@student-care/auth|lint_includes_contracts_validation_tenant_api_auth|test_includes_contracts_validation_tenant_api_auth_and_active_workspace_boundary_tests|test_coverage_includes_auth_and_api_task04_deny_branches_and_active_boundary_tests|verify_ends_with_scripts/verify_task_04.mjs|format_check_in_stage_b_covers_only_existing_stage_a_and_stage_b_text_files|scripts/verify_task_03.mjs_is_not_modified
FUTURE_TASK04_VERIFICATION_COMMANDS=corepack pnpm typecheck|corepack pnpm lint|corepack pnpm format:check|corepack pnpm test|corepack pnpm test:coverage|corepack pnpm build|node scripts/verify_task_04.mjs --mode=structure|node scripts/verify_task_04.mjs --mode=final-review
```

The future verification scope includes auth policy, Fastify route integration,
all deny branches, Task 03 scope regression, `/health` regression,
contracts/validation/tenant/API regression, package-boundary/workspace-path
tests, typecheck, lint, format, test, coverage, build, secret/real-data scan,
network scan, and Task 05+ boundary scan. All changed auth and API deny
branches require 100 percent coverage.

## Task 4: Future Stage C1 final evidence

**Authorization:** Not granted. Do not create the listed files during Stage A
or Stage B.

**Files:**

```text
docs/reviews/PHASE_1B_TASK_04_REVIEW.md
SHA256SUMS_PHASE_1B_TASK_04.txt
artifacts/review-package/student-care-platform-phase1b-task-04-review-pack-v1.0.zip
```

After the authorized Stage B implementation is complete, Stage C1 first
generates the review report, SHA manifest, and ZIP. It then checks review text
formatting, manifest determinism, and ZIP hash, members, and contents. The ZIP
is binary evidence and never runs through Prettier. Stop after C1 at
`OWNER_REVIEW_GATE`.

## Task 5: Future Stage C2 owner acceptance

**Authorization:** Not granted until the project owner gives explicit `PASS`
after Stage C1 review.

**File:**

```text
docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md
```

Stage C2 creates the acceptance record only after the owner review gate. It is
a separate commit that records the actual Stage B implementation commit and the
final manifest and ZIP SHA values. It must never be prewritten or claim owner
acceptance before the owner supplies that explicit decision.

## Stage A stop conditions

Stop and preserve the actual state on anchor drift, a non-whitelist file,
encoding failure, SHA disagreement, a missing Stage A file, a future Task 04
artifact, real data, secret, network or registry operation, dependency action,
service, database/migration, Git operation, Task 05+ work, or any attempt to
start Stage B/C1/C2. A Stage A result is only formalization evidence pending
independent owner review; it grants no implementation authorization.
