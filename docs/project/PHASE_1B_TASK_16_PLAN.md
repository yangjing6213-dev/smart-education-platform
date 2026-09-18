# Task 16 Internal Employee Mini Program Implementation Plan

> **For agentic workers:** This plan is a Stage A contract for a later,
> separately authorized implementation. Stage B workers must use the exact
> allowlist and stop at the owner-review gate. Steps use checkbox syntax for
> tracking.

**Goal:** Build a phone-first internal employee mini-program workbench with
safe quick actions and authorized synthetic-data flows.

**Architecture:** Keep the mini-program boundary local and platform-native.
`staff.routes.ts` owns route selection and access decisions, `workbench.ts`
owns the scoped workbench projection, `quick-action.ts` owns one safe local
action flow, and `staff.test.ts` owns the contract and isolation checks.
Trusted access input is treated as server-owned semantics even though Stage B
uses only in-memory synthetic fixtures.

**Tech Stack:** Existing mini-program TypeScript runtime, local Node test
runner, existing repository TypeScript/ESLint/Prettier toolchain, and no new
dependencies.

---

## Plan state and baseline

```text
TASK_ID=PHASE_1B_TASK_16
ACTIVE_GOVERNANCE=docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md
ACTIVE_GOVERNANCE_SHA256=7BECA819534A223D84C4D95FD117FC68C4B9CD4CDFC2E5345AF09E9547D188AB
BASELINE_BRANCH=feature/phase-1b-task-04-identity-membership
BASELINE_HEAD=9de01c4f5953ad48552c447fa8922da785f14e71
DEPENDENCIES=TASK_04|TASK_09|TASK_10|TASK_11|TASK_15
TASK_16_STARTED=YES_STAGE_C2_ACCEPTED
STAGE_A_STATUS=OWNER_REVIEW_PASSED
STAGE_A_OWNER_REVIEW=PASS
STAGE_B_AUTHORIZATION=GRANTED
STAGE_B_STATUS=OWNER_REVIEW_PASSED
STAGE_B_OWNER_REVIEW=PASS
STAGE_C1_AUTHORIZATION=GRANTED
STAGE_C1_STATUS=OWNER_REVIEW_PASSED
STAGE_C1_OWNER_REVIEW=PASS
STAGE_C2_AUTHORIZATION=GRANTED
STAGE_C2_STATUS=ACCEPTED
STAGE_C2_OWNER_REVIEW=PASS
TASK16_STATUS=ACCEPTED_AND_FROZEN
TASK16_ACCEPTANCE_PATH=docs/project/PHASE_1B_TASK_16_ACCEPTANCE.md
TASK16_ACCEPTANCE_SHA256=A77C3FDCD079271AE12CDF9D16A6D4F50B05936F9F231AE26B6F405E7F489FF5
TASK17_PLUS_STARTED=NO
TASK17_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK16_STAGE_C2_OWNER_REVIEW_GATE
STOP_REASON=TASK16_STAGE_C2_OWNER_REVIEW_GATE
```

Stage A historically created only `PHASE_1B_TASK_16_CODEX_EXECUTION.md` and
this plan. Stage B, C1, and C2 were later executed only under their separate
authorizations; the resulting Task 16 artifacts are now accepted and frozen.
V39 is HISTORICAL/FROZEN; V42 is the current active governance authority.

## Exact file map

| Future responsibility | Exact Stage B file |
|---|---|
| Internal route map, active-member guard, and back-navigation targets | `apps/mini-program/src/routes/staff.routes.ts` |
| Phone-first employee workbench and scoped synthetic projection | `apps/mini-program/src/pages/staff/workbench.ts` |
| Local quick-action selection and safe authorized action result | `apps/mini-program/src/pages/staff/quick-action.ts` |
| Focused RED/GREEN contract, access denial, isolation, and no-I/O tests | `apps/mini-program/src/pages/staff.test.ts` |

No fifth file is permitted. The mini-program files must not import user-web
components, user-web pages, server adapters, admin UI, database clients,
provider SDKs, or persistence helpers.

## Task 1: Establish the failing contract

**Files:**

- Create: `apps/mini-program/src/pages/staff.test.ts`
- Read-only inputs: the four exact Task 16 Stage B paths and the approved
  Task 16 contract

- [ ] Write tests for route denial when the identity is a visitor, the
  membership is suspended or revoked, the membership is missing, the tenant
  differs, the campus differs, or the required employee capability is absent.
- [ ] Write route and back-navigation assertions for `/staff/workbench` and
  `/staff/quick-action` using phone-oriented route names only.
- [ ] Write assertions that synthetic public projections reject malformed,
  disabled, private, draft, stale, foreign, or unpublished records.
- [ ] Add an I/O guard that fails if `fetch`, external URL loading, provider
  calls, storage writes, or persistence adapters are invoked.

Run:

```text
node --test --experimental-strip-types apps/mini-program/src/pages/staff.test.ts
```

Expected RED result: the test runner reports failures because the four Stage B
modules do not yet exist or do not yet provide the required route and guard
contracts. The failure must be confined to the four-file allowlist.

## Task 2: Implement route and access boundaries

**File:** `apps/mini-program/src/routes/staff.routes.ts`

- [ ] Define the internal route keys and the workbench-to-quick-action route
  transition.
- [ ] Accept only trusted active employee membership with matching tenant and
  campus scope and the required capability.
- [ ] Return a safe denied route result for visitor, inactive, suspended,
  revoked, missing, foreign, malformed, or capability-deficient input.
- [ ] Keep route behavior synchronous, deterministic, local, and free of
  network or persistence access.

Expected GREEN contribution: the route tests pass for all denial cases and
authorized employees receive only the two allowlisted route targets.

## Task 3: Implement the phone-first workbench

**File:** `apps/mini-program/src/pages/staff/workbench.ts`

- [ ] Define a compact workbench projection for employee tasks and safe
  synthetic records.
- [ ] Filter records by trusted tenant and campus scope before rendering.
- [ ] Render only published, enabled, well-formed synthetic records; map every
  unsafe input to a safe empty or denied state without exposing raw fields.
- [ ] Keep the view appropriate for phone dimensions and expose an explicit
  platform focus order for the primary workbench and quick-action entry.

Expected GREEN contribution: scoped workbench tests pass and foreign or
malformed records never appear in the result.

## Task 4: Implement the local quick-action flow

**File:** `apps/mini-program/src/pages/staff/quick-action.ts`

- [ ] Define a small set of local employee actions using synthetic data only.
- [ ] Require the same active membership, tenant, campus, and capability guard
  as the route layer.
- [ ] Return safe unavailable or denied states for unauthorized actions.
- [ ] Do not submit data, write storage, call a provider, load an external
  resource, or invoke formal AI.
- [ ] Preserve phone back-navigation semantics without introducing a shared
  route registry or fifth file.

Expected GREEN contribution: authorized actions produce bounded synthetic
results and every unauthorized action fails closed.

## Task 5: Run the complete local verification matrix

**Files:** the four exact Stage B files only.

- [ ] Run the focused test command and record the exact pass/fail counts.
- [ ] Run `node_modules/.bin/tsc.cmd -p apps/mini-program/tsconfig.json --noEmit`.
- [ ] Run ESLint on the four exact files.
- [ ] Run Prettier check on the four exact files.
- [ ] Run `git diff --check` and `git diff --cached --check`.
- [ ] Independently check UTF-8 without BOM, LF-only, and exactly one trailing
  LF for each changed file.
- [ ] Verify no dependency, network, service, database, persistence, provider,
  external resource, or non-allowlisted write occurred.
- [ ] Report `UI_NOT_VISUALLY_VERIFIED=YES` if no browser or visual runtime is
  available. Do not install a visual tool.

The configured build may be run only if an existing local command is proven
not to write outside the four-file allowlist. If it would write `dist`,
cache, coverage, or any other path, mark build `NOT_RUN` and report the
boundary instead of changing configuration or cleaning output.

## Task 6: Stage B owner-review gate

- [ ] Confirm the exact four-file allowlist and no fifth-file requirement.
- [ ] Confirm Stage B source behavior, tests, typecheck, lint, format, and
  diff checks.
- [ ] Confirm Stage B files use synthetic data and preserve visitor, tenant,
  campus, capability, and minor-safety boundaries.
- [ ] Report `TASK16_STAGE_B_STATUS=IMPLEMENTED_AND_VERIFIED` only when all
  applicable checks genuinely pass.
- [ ] Stop at `TASK16_STAGE_B_OWNER_REVIEW_GATE`; do not create C1 artifacts,
  C2 acceptance, JSON receipts, governance versions, or Task 17+ files.

## Lifecycle gates

Stage A was limited to the two formalization documents and ended at its then
active governance owner-review gate. Stage B repair required a separately
authorized fifth file and a new explicit owner authorization and was limited
to the four exact files above. C1 required Stage B owner review and separately
authorized review/manifest/ZIP paths. C2 required independent C1 verification
and separate acceptance authorization. No stage passed authorization to the
next stage automatically.

## Encoding, preservation, and fail-closed rules

Both Stage A documents must be UTF-8 without BOM, LF-only, exactly one
trailing LF, and must not contain their own final SHA. V34 and all Task 01-15
frozen evidence remain unchanged. Protected untracked paths are path-level
preservation boundaries and must not be read or modified. Any request for a
fifth file, package change, shared contract change, network access, service,
database, migration, or later-stage artifact is a hard `STATUS=BLOCKED`.

TASK16_STAGE_A_STATUS=OWNER_REVIEW_PASSED
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
