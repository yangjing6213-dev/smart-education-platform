# Phase 1B Task 01 Codex Execution Contract

## 0. Contract metadata

```text
CONTRACT_ID=PHASE_1B_TASK_01_CODEX_EXECUTION
CONTRACT_VERSION=1.0
PROJECT_NAME=student-care-saas-platform
PROJECT_ROOT=C:\Users\HU\Documents\student-care-saas-platform

SOURCE_BRANCH=planning/phase-1a-batch-b
SOURCE_HEAD=0c991fe2426d647644369d86b3e3ae595f4e0a41
TARGET_BRANCH=feature/phase-1b-task-01-workspace-quality

PHASE_1A_STATUS=ACCEPTED
PHASE_1B_PLAN_TASK_COUNT=18
AUTHORIZED_TASK=TASK_01_MONOREPO_AND_QUALITY_TOOLS
AUTHORIZED_TASK_COUNT=1

PLAN_MODE_STATUS=AUTHORIZED_READ_ONLY
PHASE_1B_STARTED=NO_UNTIL_GOAL_APPROVAL
TASK_02_STARTED=NO
PRODUCTION_DEPLOYMENT=NO
GIT_PUSH=NO
REAL_PERSONAL_DATA=NO
LIVE_AI_MODEL=NO
PAYMENT_INTEGRATION=NO
```

This contract authorizes only the Phase 1B start-gate audit and Task 01 planning. Formal Task 01 implementation begins only after the project owner reviews the `/plan` output and sends a separate `/goal` approval that explicitly sets `PHASE_1B_STARTED=YES_FOR_TASK_01_ONLY`.

---

## 1. Objective

Prepare the first independently reviewable implementation increment of Phase 1B:

> Establish the monorepo and deterministic quality-tool baseline required by every later Phase 1B task.

Task 01 must produce a minimal, compilable, testable workspace with deterministic commands for:

- type checking;
- linting;
- formatting checks;
- unit tests;
- builds;
- a health route that exposes no business or personal data.

Task 01 must not implement content, tenancy, identity, permissions, database, file storage, UI pages, AI, payment, deployment, or any later task.

---

## 2. Authority and required read order

Codex must read these sources in order:

1. This contract and the externally supplied SHA-256.
2. `AGENTS.md`.
3. `docs/project/PHASE_1A_BATCH_A_ACCEPTANCE.md`.
4. `docs/project/PHASE_1A_BATCH_B_DECISION_BASELINE.md`.
5. `docs/project/PHASE_1A_BATCH_B_SCOPE_AND_NON_SCOPE.md`.
6. `docs/architecture/TECH_STACK_BASELINE.md`.
7. `docs/architecture/REPOSITORY_STRUCTURE_BASELINE.md`.
8. `docs/architecture/TEST_STRATEGY_BASELINE.md`.
9. `docs/architecture/ENVIRONMENTS_AND_DEPLOYMENT_BASELINE.md`.
10. `docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md`.
11. `docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md`.
12. `docs/contracts/V0_1_ACCEPTANCE_TRACEABILITY.md`.
13. `docs/reviews/PHASE_1A_BATCH_B_REVIEW.md`.

The approved source baseline remains authoritative. Chat history may clarify intent but must not expand or replace the approved files.

---

## 3. Locked technical policy

The plan must preserve the approved major/minor technology baseline:

```text
NODE_RUNTIME=22.x LTS
PACKAGE_MANAGER=pnpm 10.x
LANGUAGE=TypeScript 5.7.x strict
API=Fastify 5.x
WEB_CLIENT_BASELINE=React 19.x + Vite 6.x
VALIDATION_BASELINE=Zod 3.x
TEST_BASELINE=Node test runner
DATABASE_BASELINE=PostgreSQL 16
CACHE_BASELINE=Redis 7 optional and not used in Task 01
AI_PROVIDER=DISABLED
```

Task 01 does not need to install every future dependency. It must install only the minimum dependencies required to make Task 01's workspace, health route, typecheck, lint, format check, unit test, and build commands real and deterministic.

During `/plan`, Codex must propose:

- exact package names;
- exact versions or exact resolution policy;
- why each dependency is necessary for Task 01;
- whether it is production or development scope;
- license and security-check approach available without adding unrelated tooling;
- lockfile behavior;
- rollback/removal steps.

No dependency may be installed until the project owner approves the exact list in the later `/goal`.

If the installed Node or pnpm major version does not match the locked baseline, the plan must report `BLOCKED`; it must not install or upgrade global runtimes.

---

## 4. Start-gate conditions

The read-only `/plan` audit must verify:

1. Project root is exactly:
   `C:\Users\HU\Documents\student-care-saas-platform`
2. Current branch is:
   `planning/phase-1a-batch-b`
3. Current HEAD is:
   `0c991fe2426d647644369d86b3e3ae595f4e0a41`
4. Worktree and index are clean.
5. Git remote count is zero.
6. The source branch and HEAD have not moved.
7. Phase 1A Batch B review package exists and matches:
   - path: `artifacts/review-package/student-care-platform-phase1a-batch-b-review-pack-v1.0.zip`
   - SHA-256: `103793276662C11AFFF18460FDD6BDD4FFC8B7B9617817810426D00BDF2CC2C1`
   - member count: `86`
   - member-list SHA-256:
     `B6ED195F1F41AB731F53AFA65071037BE23A56F3547B543160A41F0CE6A33C30`
8. Target branch does not already exist.
9. No root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `apps/`, `packages/`, `infrastructure/`, or `tests/` implementation tree already exists.
10. No `.env`, production secret, personal data, deployment artifact, package cache, or unrelated project file exists.
11. The new contract is the only approved untracked root file for this start gate.

Any mismatch must return `BLOCKED` and stop without changing the repository.

---

## 5. Task 01 required plan output

The `/plan` response must provide a complete implementation plan, not code changes.

It must include:

### 5.1 Exact file map

Codex must propose every file to create or modify, with one responsibility per file.

The plan may propose only the minimal Task 01 subset under these path families:

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.base.json
eslint.config.mjs
.prettierrc.json
.prettierignore
.npmrc

apps/api/**
apps/user-web/**
apps/admin-web/**
apps/mini-program/**

packages/contracts/**
packages/validation/**
packages/auth/**
packages/tenant/**
packages/config/**
packages/ui-web/**
packages/ui-mini/**
packages/test-utils/**

scripts/**
tests/workspace/**
docs/project/PHASE_1B_TASK_01_*.md
docs/reviews/PHASE_1B_TASK_01_*.md
artifacts/review-package/student-care-platform-phase1b-task-01-review-pack-v1.0.zip
SHA256SUMS_PHASE_1B_TASK_01.txt
PHASE_1B_TASK_01_CODEX_EXECUTION.md
```

Restrictions:

- Package directories may contain only minimal manifests, TypeScript configuration, and placeholder-free compile/test entry points required to prove the workspace.
- No business modules are allowed except the API health route.
- No future directory may be created merely as an empty placeholder. Each created package must participate in an actual workspace command or dependency-direction check.
- The plan must state which path families are not needed and therefore will not be created.

### 5.2 Dependency whitelist proposal

The plan must list every package and exact approved version candidate.

It must distinguish:

- root development dependency;
- API runtime dependency;
- package-specific dependency;
- no-install runtime already present.

The plan must not use `latest`, `*`, broad unbounded ranges, or hidden global dependencies.

### 5.3 Red-green TDD sequence

The plan must include the actual failing tests and commands for:

1. required workspace path resolution;
2. invalid TypeScript causing typecheck failure;
3. formatting violation causing format-check failure;
4. lint violation causing lint failure;
5. failing unit test causing test command failure;
6. failing health-route expectation before implementation;
7. build failure before valid source exists.

For each red test, the plan must state:

- exact fixture path;
- exact command;
- expected non-zero exit;
- expected failure reason;
- cleanup or isolation approach.

Then it must specify the minimum implementation and focused green command.

### 5.4 Workspace commands

The final root commands must be deterministic and documented:

```text
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm verify
```

`pnpm verify` must run all Task 01 quality gates in a stable order and fail on the first or aggregated error according to the approved plan.

### 5.5 Health route boundary

The health route must:

- expose only service status and build-safe metadata;
- contain no tenant, campus, user, child, database, secret, environment value, or internal provider detail;
- be covered by a unit or route-injection test;
- not require a database, Redis, COS, external network, or production configuration.

### 5.6 Git and review discipline

The plan must use:

```text
TARGET_BRANCH=feature/phase-1b-task-01-workspace-quality
COMMIT_SUBJECT=chore: establish phase 1b workspace quality baseline
```

Only one implementation commit is authorized for Task 01.

The plan must define:

- explicit `git add -- <paths>` commands;
- no `git add .`;
- no `git add -A`;
- no amend, rebase, reset, clean, stash, remote, push, PR, or deployment;
- final clean worktree and empty index;
- external final receipt records the commit SHA to avoid self-reference.

### 5.7 Review package proposal

The plan must propose:

- exact review-package member list;
- member count;
- deterministic member-list hashing algorithm;
- ZIP path;
- independent manifest path;
- verification commands;
- excluded files and directories.

The ZIP must exclude:

```text
.git/
node_modules/
package-manager cache
.env*
phase-inputs/
production secrets
coverage raw caches
temporary fixtures
unrelated Phase 1A ZIP files
```

The project owner must approve the exact review-package member count and member-list SHA before ZIP generation.

---

## 6. Explicit non-scope

Task 01 must not implement or create:

- Task 02 shared contract validators beyond minimal workspace compile fixtures;
- Task 03 tenant scope;
- Task 04 identity or membership;
- content or publication models;
- institution, teacher, activity, meal, guide, resource, or partner-link modules;
- database schema, Prisma, SQL, migrations, seeds, or database connections;
- Redis, queue, worker, or cron behavior;
- COS SDK, upload, file metadata, or signed links;
- visitor, guardian, teacher, staff, or admin product pages;
- real WeChat app configuration or login;
- payment;
- live AI, RAG, OCR, model SDK, or AI request;
- Docker, CI/CD, Tencent Cloud deployment, domain, TLS, monitoring integration, or production environment files;
- real personal data or copied institution operational data.

The existing Phase 1A low/high-fidelity prototypes and frozen review evidence must remain unchanged.

---

## 7. Data, security, and network rules

- Use only clearly synthetic fixtures.
- Do not create names, phone numbers, identity numbers, health records, pickup data, or family relationships that resemble real people.
- Do not read or print secrets from the machine.
- Package installation, when later approved, may contact only the configured npm-compatible package registry and normal package-integrity endpoints.
- Application code and tests must not make external network requests.
- No postinstall script may perform unrelated downloads or system modification.
- The plan must identify packages with lifecycle scripts and state how they will be controlled or audited.
- No telemetry, analytics, crash reporting, or external font/resource is authorized.

---

## 8. Verification requirements for the future goal

The approved Task 01 goal must run fresh evidence for:

```text
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm verify
git diff --check
git diff --cached --check
git status --short --branch --untracked-files=all
git log -1 --oneline
git remote -v
```

The implementation must also verify:

- lockfile is committed and reproducible;
- a second `pnpm install --frozen-lockfile` makes no tracked change;
- workspace package graph has no forbidden dependency direction;
- no external request occurs during unit tests;
- no secret or personal-data pattern is present;
- no future task is started;
- no deployment or push occurs.

---

## 9. Completion gates

Task 01 may report internal `PASS` only if all are true:

```text
PHASE_1B_TASK_01_STATUS=PASS
PHASE_1B_STARTED=YES_FOR_TASK_01_ONLY
TASK_02_STARTED=NO

SOURCE_HEAD_IS_ANCESTOR=YES
TARGET_BRANCH_STATUS=PASS
WORKSPACE_STRUCTURE_STATUS=PASS
DEPENDENCY_POLICY_STATUS=PASS
LOCKFILE_REPRODUCIBILITY_STATUS=PASS
TYPECHECK_STATUS=PASS
LINT_STATUS=PASS
FORMAT_CHECK_STATUS=PASS
UNIT_TEST_STATUS=PASS
BUILD_STATUS=PASS
HEALTH_ROUTE_STATUS=PASS
SECURITY_SCAN_STATUS=PASS
REVIEW_PACKAGE_STATUS=PASS

GIT_WORKTREE_STATUS=CLEAN
GIT_INDEX_STATUS=CLEAN
GIT_REMOTE_COUNT=0
GIT_PUSH_EXECUTED=NO
PRODUCTION_DEPLOYMENT_EXECUTED=NO
REAL_PERSONAL_DATA_USED=NO
LIVE_AI_MODEL_USED=NO
PAYMENT_INTEGRATION_EXECUTED=NO
PROJECT_OWNER_ACCEPTANCE=PENDING
```

Internal PASS does not authorize Task 02.

---

## 10. Blocked handling

Before the target branch is created, a blocked plan/execution must only report externally and must not modify repository files.

After the target branch is created, a blocker may be recorded only in the Task 01 review file authorized by the approved plan.

Never modify the frozen Phase 1A Batch A or Batch B reports, manifests, ZIPs, screenshots, prototypes, product documents, architecture baselines, or validators.

Do not perform destructive recovery:

```text
git reset
git clean
git restore
git stash
git rebase
git commit --amend
branch deletion
force checkout
```

A blocked receipt must include:

- exact failing gate;
- command and exit code;
- affected files;
- verified completed work;
- minimum safe resolution;
- confirmation that Task 02 did not start.

---

## 11. Plan-mode stop rule

The current `/plan` run is read-only.

It must not:

- create or modify files;
- create or switch branches;
- install or update dependencies;
- access package registries;
- initialize applications;
- run writing build commands;
- start local services;
- commit;
- create a ZIP;
- start Task 01 implementation;
- set `PHASE_1B_STARTED=YES`;
- start Task 02.

After outputting the complete Task 01 implementation plan, dependency proposal, exact file whitelist, exact test sequence, review-package proposal, risks, and stop conditions, Codex must stop for project-owner review.
