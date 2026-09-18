# Phase 1B Task 16 Codex Execution Contract

TASK_ID=PHASE_1B_TASK_16
TASK_NAME=INTERNAL_EMPLOYEE_MINI_PROGRAM
STAGE=STAGE_C2_ACCEPTANCE
CONTRACT_STATUS=ACCEPTED_AND_FROZEN
ACTIVE_GOVERNANCE=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md
ACTIVE_GOVERNANCE_SHA256=7BECA819534A223D84C4D95FD117FC68C4B9CD4CDFC2E5345AF09E9547D188AB
BASELINE_BRANCH=feature/phase-1b-task-04-identity-membership
BASELINE_HEAD=9de01c4f5953ad48552c447fa8922da785f14e71
BASELINE_INDEX=READ_ONLY_CLEAN_AT_STAGE_A_START
TASK_15_STATUS=ACCEPTED_AND_FROZEN
TASK_16_STARTED=YES_STAGE_C2_ACCEPTED
TASK16_STAGE_A_STATUS=OWNER_REVIEW_PASSED
TASK16_STAGE_A_OWNER_REVIEW=PASS
TASK16_STAGE_B_AUTHORIZATION=GRANTED
TASK16_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK16_STAGE_B_OWNER_REVIEW=PASS
TASK16_STAGE_C1_AUTHORIZATION=GRANTED
TASK16_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK16_STAGE_C1_OWNER_REVIEW=PASS
TASK16_STAGE_C2_AUTHORIZATION=GRANTED
TASK16_STAGE_C2_STATUS=ACCEPTED
TASK16_STAGE_C2_OWNER_REVIEW=PASS
TASK16_STATUS=ACCEPTED_AND_FROZEN
TASK16_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_16_ACCEPTANCE.md
TASK16_ACCEPTANCE_SHA256=A77C3FDCD079271AE12CDF9D16A6D4F50B05936F9F231AE26B6F405E7F489FF5
TASK17_PLUS_STARTED=NO
TASK17_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK16_STAGE_C2_OWNER_REVIEW_GATE
STOP_REASON=TASK16_STAGE_C2_OWNER_REVIEW_GATE

## 1. Authority and purpose

This contract formalizes Phase 1B Task 16, Internal employee mini program.
V39 is HISTORICAL/FROZEN evidence only. V42 is the current active authority
and is not modified by this record. Task 16 Stage A, Stage B, Stage C1, and
Stage C2 have completed their authorized gates; Task 16 is accepted and
frozen, and work stops before Task 17+.

Task 16 depends on Tasks 04, 09, 10, 11, and 15. The mini program is a
phone-first internal employee surface for a compact workbench, safe quick
actions, and authorized synthetic-data workflows. It must preserve the
already-frozen Task 01-15 evidence and the separation between the mini program,
user web, server adapters, and administrative management surfaces.

## 2. Exact Stage B allowlist

Stage B may be considered only after a separate owner authorization. Its exact
future file allowlist is:

```text
apps/mini-program/src/routes/staff.routes.ts
apps/mini-program/src/pages/staff/workbench.ts
apps/mini-program/src/pages/staff/quick-action.ts
apps/mini-program/src/pages/staff.test.ts
```

No other source, test, configuration, package, route registry, governance,
acceptance, review, manifest, ZIP, or receipt file may be created or modified
under this contract. If implementation requires a fifth file, a dependency,
or a shared-contract change, the correct result is `STATUS=BLOCKED`; the
allowlist must not be expanded by inference.

## 3. Required behavior

The future Stage B implementation must:

- provide a compact internal employee workbench for phone dimensions;
- provide platform-native navigation between the workbench and quick actions;
- render only clearly synthetic, non-identifying data;
- keep employee data scoped by trusted active membership, tenant, campus, and
  approved capability;
- deny visitor identities, suspended or inactive employees, missing or revoked
  memberships, foreign tenants, foreign campuses, and absent capabilities;
- fail closed for missing, malformed, stale, disabled, private, draft, or
  otherwise unpublished projections;
- expose teacher-only or similarly privileged actions only when the trusted
  capability is present;
- keep all quick actions local and deterministic, with no real submission,
  persistence, provider, formal AI, or production side effect;
- avoid imports from user-web pages, server adapters, admin UI, or unrelated
  package boundaries.

The implementation must use the product term “employee” for the internal
surface and retain the visitor boundary for unauthenticated public access.
All examples must be labeled or structurally obvious as synthetic data and
must not contain real names, contact details, addresses, health information,
attendance records, pickup data, grades, or family relationships.

## 4. TDD and verification contract

Stage B must begin with a focused RED test or minimal reproduction in
`apps/mini-program/src/pages/staff.test.ts`. The initial RED must cover at
least denied visitor access, denied suspended or revoked membership, denied
foreign tenant/campus access, and denied missing capability. It must also
cover the expected route and back-navigation contract for phone dimensions.

The GREEN implementation must then prove:

- authorized active employees reach the workbench;
- quick-action navigation and back navigation remain local and predictable;
- tenant and campus filtering excludes foreign synthetic records;
- malformed or unsafe projections become a safe denied, empty, or error state;
- zero `fetch`, provider calls, storage writes, external resources, and
  persistence adapters are used.

The planned Stage B local checks are:

```text
node --test --experimental-strip-types apps/mini-program/src/pages/staff.test.ts
node_modules/.bin/tsc.cmd -p apps/mini-program/tsconfig.json --noEmit
node_modules/.bin/eslint.cmd apps/mini-program/src/routes/staff.routes.ts apps/mini-program/src/pages/staff/workbench.ts apps/mini-program/src/pages/staff/quick-action.ts apps/mini-program/src/pages/staff.test.ts
node_modules/.bin/prettier.cmd --check apps/mini-program/src/routes/staff.routes.ts apps/mini-program/src/pages/staff/workbench.ts apps/mini-program/src/pages/staff/quick-action.ts apps/mini-program/src/pages/staff.test.ts
git diff --check
git diff --cached --check
```

These commands are a future Stage B plan, not Stage A execution. If the
existing mini-program typecheck project or a required local validator is
absent, Stage B must stop as `STATUS=BLOCKED` rather than create configuration
or install a dependency. Browser or visual verification is not implied by
this contract; if unavailable, the Stage B receipt must say
`UI_NOT_VISUALLY_VERIFIED=YES`.

## 5. Lifecycle gates

`STAGE_A_FORMALIZATION` historically created exactly the two Stage A documents,
verified their format and hashes, and stopped at the then-active governance
owner-review gate.

`STAGE_B_IMPLEMENTATION` may begin only after explicit owner authorization.
It is limited to the four exact files above, uses TDD, runs the applicable
local checks, and stops at `TASK16_STAGE_B_OWNER_REVIEW_GATE`. A passing local
receipt is not C1 authorization.

`STAGE_C1_REVIEW_MANIFEST_AND_DETERMINISTIC_ZIP` may begin only after Stage B
owner review. It may create only the separately authorized review, detached
manifest, and deterministic ZIP paths. It must stop at the C1 owner-review
gate.

`STAGE_C2_ACCEPTANCE_RECORD_ONLY` began only after independent C1 verification
and explicit owner authorization. It created only the acceptance record and
the explicitly authorized external receipt, then stopped before Task 17.

No stage may infer authorization from a prior stage's local PASS. Task 17+
remains unstarted and unauthorized.

## 6. Preservation and stop conditions

V38, Task 01-16 frozen evidence, the old Task 06 verifier, the existing
governance references, `pnpm-lock.yaml`, and all protected untracked paths are
read-only preservation boundaries. This governance synchronization does not read protected file
contents, modify them, restore them, clean them, move them, stage them, or
commit them.

No network, registry, dependency installation or update, service, database,
migration, branch, worktree, push, PR, deployment, or production data is
allowed. No real credentials, formal AI, provider, persistence, or external
resource may be introduced.

Both Stage A documents must be UTF-8 without BOM, LF-only, and have exactly
one trailing LF. Neither document may contain its own final SHA; hashes are
reported externally. Any boundary conflict, unexpected pre-existing target,
non-allowlisted write, or missing authorization is fail-closed.

TASK16_STAGE_B_AUTHORIZATION=GRANTED
TASK16_STAGE_B_STATUS=OWNER_REVIEW_PASSED
TASK16_STAGE_B_OWNER_REVIEW=PASS
TASK16_STAGE_C1_AUTHORIZATION=GRANTED
TASK16_STAGE_C1_STATUS=OWNER_REVIEW_PASSED
TASK16_STAGE_C1_OWNER_REVIEW=PASS
TASK16_STAGE_C2_AUTHORIZATION=GRANTED
TASK16_STAGE_C2_STATUS=ACCEPTED
TASK16_STAGE_C2_OWNER_REVIEW=PASS
TASK16_STATUS=ACCEPTED_AND_FROZEN
TASK16_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_16_ACCEPTANCE.md
TASK16_ACCEPTANCE_SHA256=A77C3FDCD079271AE12CDF9D16A6D4F50B05936F9F231AE26B6F405E7F489FF5
TASK17_PLUS_STARTED=NO
OWNER_REVIEW_GATE=TASK16_STAGE_C2_OWNER_REVIEW_GATE
STOP_REASON=TASK16_STAGE_C2_OWNER_REVIEW_GATE
