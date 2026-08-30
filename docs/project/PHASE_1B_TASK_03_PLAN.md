# Phase 1B Task 03 Tenant/Campus Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `test-driven-development` for every
> behavior change and `verification-before-completion` before reporting results. This execution
> is explicitly inline, committed in separate implementation/evidence records, and limited to the
> project-owner-approved whitelist.

**Goal:** Implement deterministic fail-closed tenant/campus scope resolution, scope-aware cache
keys, and an isolated Fastify scope boundary using synthetic data only.

**Architecture:** `@student-care/tenant` owns the public scope types and pure resolution/cache
logic and depends only on `@student-care/validation.uuidSchema`. The API plugin consumes the
tenant package, decorates scoped requests, and denies marked routes before handlers execute. No
production API wiring, identity storage, database, client, network, or cache backend is added.

**Tech Stack:** TypeScript 5.7.3, Node.js 24 test runner, Fastify 5.12.1, pnpm 11.22.0 workspace,
Zod 3.25.76 only through `@student-care/validation`.

---

## Authority and execution invariants

- Contract: `PHASE_1B_TASK_03_CODEX_EXECUTION.md`
- Contract SHA-256: `5DACCFDABCE2EF597F852D0DAB00ACC2FC7388FB25D58551199586A4CE6152D9`
- Source HEAD: `d122cb693de9cbc5782ee006b094ce410c76f365`
- Branch: `feature/phase-1b-task-03-tenant-campus-scope`
- Implementation commit: `dd72ddcb2975e237dce95dfb81238d9367d7be99`
- Acceptance record commit: `314b8dbbe15ea32300a2b253b287151005db4cec`
- The implementation and acceptance record are committed; no Task 04 work is authorized.
- No push, PR, deployment, service startup, registry, external request, real data, or Task 04
  implementation.
- `apps/api/src/index.ts`, `apps/api/src/server.ts`, the contract, and all Task 02 evidence remain
  byte-for-byte unchanged. Task 03 evidence artifacts are writable only in the separately approved
  final evidence slice below.
- The single approved
  `corepack pnpm install --offline --lockfile-only --ignore-scripts` invocation has been exhausted.
  Its lockfile result contains only the tenant-to-validation and API-to-tenant local workspace
  links; package versions, integrity records, peer suffixes, snapshots, and external resolutions
  remain unchanged. `pnpm-lock.yaml` is frozen for the remainder of this continuation.
- The project owner has ratified the current ignored `node_modules` workspace junctions for this
  working tree only. No further `pnpm install`, dependency synchronization, manual junction or
  symlink, registry or network access is authorized. Local verification must invoke the existing
  `tsc`, ESLint, Prettier, and Node executables directly rather than a pnpm command that may trigger
  dependency synchronization.
- The initial implementation slice was limited to the ten non-lockfile work files:
  `apps/api/package.json`, `apps/api/src/plugins/scope.plugin.ts`,
  `apps/api/test/scope.plugin.test.ts`, `docs/project/PHASE_1B_TASK_03_PLAN.md`,
  `packages/tenant/package.json`, `packages/tenant/tsconfig.json`,
  `packages/tenant/src/index.ts`, `packages/tenant/src/resolve-scope.ts`,
  `packages/tenant/src/scope-context.ts`, and `packages/tenant/test/isolation.test.ts`.
- The project owner has now authorized the final evidence slice. Its additional write boundary is
  limited to `scripts/verify_task_03.mjs`, `tests/contracts/package-boundaries.test.mjs`,
  `SHA256SUMS_PHASE_1B_TASK_03.txt`,
  `docs/reviews/PHASE_1B_TASK_03_REVIEW.md`, and
  `artifacts/review-package/student-care-platform-phase1b-task-03-review-pack-v1.0.zip`.
  Existing implementation files, package manifests, and `pnpm-lock.yaml` remain read-only.

### Task 1: Establish the tenant package and RED scope tests

**Files:**

- Create: `packages/tenant/package.json`
- Create: `packages/tenant/tsconfig.json`
- Create: `packages/tenant/test/isolation.test.ts`

- [x] Create `@student-care/tenant` with the exact exports pattern used by contracts/validation,
      the exact five contract scripts, and the sole dependency
      `@student-care/validation=workspace:*`.
- [x] Create the shared strict TypeScript configuration with `rootDir: "."`, `outDir: "dist"`,
      declarations, declaration maps, and source maps.
- [x] Write table-driven synthetic tests that import the wished-for public API from
      `../src/index.js` and prove these requirements:
  - non-object, missing, empty, malformed, non-string, whitespace, and invalid-UUID actors deny
    with `TRUSTED_PRINCIPAL_MISSING`;
  - valid actor plus missing or structurally invalid membership denies with `MEMBERSHIP_MISSING`;
  - suspended membership wins before requested tenant/campus validation;
  - cross-tenant and illegal-campus candidates deny deterministically in contract order;
  - missing and explicit `undefined` requested fields succeed without coercion or trimming;
  - cache scope/components reject invalid UUIDs, non-strings, empty/whitespace/control/non-ASCII,
    and 129-character values as `CACHE_KEY_INVALID`;
  - valid but mismatched candidates deny as `CACHE_KEY_COLLISION`;
  - exact keys serialize `["scope-v1", tenantId, campusId ?? null, namespace, resource, key]` and
    differ across tenant/campus scope.
- [x] Run:

  ```text
  corepack pnpm --filter @student-care/tenant test
  ```

  Expected RED: TypeScript cannot resolve the not-yet-created `../src/index.js`; the failure must
  be caused by missing production code, not malformed test syntax.

### Task 2: GREEN tenant scope and cache logic

**Files:**

- Create: `packages/tenant/src/scope-context.ts`
- Create: `packages/tenant/src/resolve-scope.ts`
- Create: `packages/tenant/src/index.ts`

- [x] Define exactly the approved readonly interfaces and unions:

  ```ts
  export interface TrustedActor {
    readonly actorId: string;
  }
  export interface TrustedMembership {
    readonly tenantId: string;
    readonly campusIds: readonly string[];
    readonly status: "ACTIVE" | "SUSPENDED";
  }
  export interface ResolveScopeInput {
    readonly trustedActor: TrustedActor | null | undefined;
    readonly membership: TrustedMembership | null | undefined;
    readonly requestedTenantId?: unknown;
    readonly requestedCampusId?: unknown;
  }
  export interface ScopeContext {
    readonly actorId: string;
    readonly tenantId: string;
    readonly campusId?: string;
  }
  export type ScopeDenialReason =
    | "TRUSTED_PRINCIPAL_MISSING"
    | "MEMBERSHIP_MISSING"
    | "MEMBERSHIP_SUSPENDED"
    | "TENANT_SCOPE_MISMATCH"
    | "CAMPUS_SCOPE_INVALID"
    | "CACHE_KEY_INVALID"
    | "CACHE_KEY_COLLISION";
  export interface ScopeDenial {
    readonly ok: false;
    readonly reason: ScopeDenialReason;
  }
  export interface ScopeResolutionSuccess {
    readonly ok: true;
    readonly scopeContext: ScopeContext;
  }
  export type ScopeResolutionResult = ScopeResolutionSuccess | ScopeDenial;
  export interface ScopeCacheKeyComponents {
    readonly namespace: string;
    readonly resource: string;
    readonly key: string;
  }
  export interface ScopeCacheKeySuccess {
    readonly ok: true;
    readonly key: string;
  }
  export interface ScopeCacheKeyDenial {
    readonly ok: false;
    readonly denial: ScopeDenial;
  }
  export type ScopeCacheKeyResult = ScopeCacheKeySuccess | ScopeCacheKeyDenial;
  ```

- [x] Implement `resolveScope(input: ResolveScopeInput): ScopeResolutionResult` with runtime object
      guards and the exact actor → membership → suspended → tenant → campus order. Use only
      `uuidSchema.safeParse`; never trim or coerce. Omit the optional campus property rather than
      assigning `undefined`.
- [x] Implement cache component validation with `^[A-Za-z0-9._:-]{1,128}$`, validate actor/tenant/
      campus UUIDs, return nested typed denials, and exact-compare candidates.
- [x] Export both modules with NodeNext `.js` specifiers.
- [x] After the single approved lockfile-only operation in Task 5, run the tenant test and coverage
      commands. Expected GREEN: all behavior tests pass, line coverage is at least 90%, and branch
      coverage is 100%.

### Task 3: RED and GREEN Fastify boundary

**Files:**

- Create: `apps/api/test/scope.plugin.test.ts`
- Create: `apps/api/src/plugins/scope.plugin.ts`
- Modify: `apps/api/package.json`

- [x] Add `@student-care/tenant=workspace:*`, preserve contracts/validation/Fastify, add the exact
      API `test:coverage` script, and extend `test` to health plus scope tests.
- [x] Before creating the plugin, write independent Fastify tests that directly execute
      `await scopePlugin(app, { getScopeInput })` before route registration and prove:
  - marked denial returns the exact 403 `FORBIDDEN_SCOPE` envelope with the actual `request.id`;
  - the denied handler invocation count remains zero;
  - success assigns the exact `request.scopeContext` before the handler;
  - an unmarked route never calls `getScopeInput` and retains `scopeContext === undefined`.
- [x] Run the focused API test command. Expected RED: the plugin module is missing.
- [x] Implement module augmentation, `decorateRequest("scopeContext", undefined)`, and a root
      `preHandler` that acts only when `routeOptions.config.scopeRequired === true`. On denial,
      return the fixed envelope; on success, assign scope context. Do not change index/server or add
      `fastify-plugin`.
- [x] Run API tests and API coverage. Expected GREEN: scope tests and unchanged health regression
      pass; plugin lines ≥90% and branches 100%.

### Task 4: Workspace RED/GREEN boundaries and scripts

**Files:**

- Modify: `tests/workspace/paths.test.mjs`
- Modify: `tests/contracts/package-boundaries.test.mjs`
- Modify: `package.json`

- [x] Add required Task 03 implementation paths to the workspace test without requiring the
      forbidden Task 03 SHA manifest, review report, or ZIP.
- [x] Extend package-boundary tests to assert tenant's sole dependency and exports, API's approved
      dependency set, tenant's forbidden imports, and runtime use of tenant exports.
- [x] Run both tests before their supporting files/scripts are complete and capture the expected
      RED failures.
- [x] Set root `typecheck`, `lint`, `format:check`, `test`, `test:coverage`, `build`, and `verify` to
      the exact contract strings. Separately run tenant and API package lint because the canonical
      root lint string does not include them.

### Task 5: Lockfile-only update and fail-closed link gate

**File:**

- Modify only if necessary: `pnpm-lock.yaml`

- [x] Run exactly once:

  ```text
  corepack pnpm install --offline --lockfile-only --ignore-scripts
  ```

- [x] Verify the lockfile adds only:

  ```text
  apps/api -> @student-care/tenant -> link:../../packages/tenant
  packages/tenant -> @student-care/validation -> link:../validation
  ```

- [x] Verify package versions, integrity fields, peer suffixes, `packages`, and `snapshots` sections
      are byte-for-byte unchanged from HEAD.
- [x] Verify `packages/tenant/node_modules/@student-care/validation` and
      `apps/api/node_modules/@student-care/tenant` resolve locally. If either is absent, stop and
      request the minimum separate offline workspace-link authorization; do not install or create
      links manually.

### Task 6: Task 03 verifier

**File:**

- Create: `scripts/verify_task_03.mjs`

- [x] Verify root, branch, source-baseline ancestry, committed Task 03 implementation and acceptance
      anchors, clean index, zero remotes, contract/authority/Task 02 hashes, exact whitelist status,
      frozen API entry/server/health, package scripts/dependencies,
      lockfile-only diff, package direction, synthetic/no-network/no-secret boundaries, and absence
      of Task 04 artifacts.
- [x] Parse the contract's 64 candidate member lines and verify continuous numbering, unique
      ordinal paths, 2199 UTF-8 bytes, and SHA-256
      `23EF5FC311BC2B64F15E617EA91FEA91BC9102992D89688CAC4022F72785AC1D`.
- [x] Implement a tri-state evidence gate: all absent selects implementation mode, all present
      selects final-review mode, and partial presence fails closed with exit code 1.
- [x] Generate and validate the Task 03 SHA manifest, review report, and exact 64-member ZIP;
      the owner acceptance record is committed and the verifier checks its acceptance anchor.
- [x] Run `node scripts/verify_task_03.mjs`; expected final line:

  ```text
  TASK_03_FINAL_REVIEW_VERIFY=PASS
  ```

### Task 7: Final verification and committed handoff

- [x] Run Node, Corepack, and pnpm version checks.
- [x] Run focused tenant/API lint, tests, and coverage with the existing local executables.
- [x] Run the root typecheck, lint, format check, test, coverage, build, and verifier-equivalent
      checks in contract order without invoking dependency synchronization.
- [x] Run `git diff --check`, `git diff --cached --check`, whitelist diff audit,
      `git status --short --branch --untracked-files=all`, and `git remote -v`.
- [x] Record the historical format-gate conflict: before final evidence generation, the exact
      command was blocked solely by the explicitly forbidden/missing
      `SHA256SUMS_PHASE_1B_TASK_03.txt`; the path was not used to weaken the contract.
- [x] Leave the implementation, evidence, and acceptance record in explicit commits for the
      project-owner's audit; do not start Task 04.
