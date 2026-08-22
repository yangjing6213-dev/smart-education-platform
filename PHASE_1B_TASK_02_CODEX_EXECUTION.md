# Phase 1B Task 02 Codex Execution Contract

## 0. Contract metadata

```text
CONTRACT_ID=PHASE_1B_TASK_02_CODEX_EXECUTION
CONTRACT_VERSION=1.0
PROJECT_NAME=student-care-saas-platform
PROJECT_ROOT=C:\Users\HU\Documents\student-care-saas-platform

SOURCE_BRANCH=feature/phase-1b-task-01-workspace-quality
SOURCE_HEAD=badc119aa62835fae9fd45da089a19dafd063ddd
TARGET_BRANCH=feature/phase-1b-task-02-shared-contracts-validation

TASK_01_PROJECT_OWNER_ACCEPTANCE=PASS
TASK_01_REVIEW_PACKAGE=artifacts/review-package/student-care-platform-phase1b-task-01-review-pack-v1.0.zip
TASK_01_REVIEW_PACKAGE_SHA256=E5821FB7578EA37403B19FA39B8E68B2B781A6C606FD7A17B282C59270B3C846
TASK_01_REVIEW_PACKAGE_MEMBER_COUNT=20
TASK_01_REVIEW_PACKAGE_MEMBER_LIST_SHA256=FDEB4361570446DD359A8032E4B581591EBB652D838D027F5BC337CEF21FCFAB

AUTHORIZED_TASK=TASK_02_SHARED_CONTRACTS_AND_VALIDATION
AUTHORIZED_TASK_COUNT=1
TASK_03_STARTED=NO
PRODUCTION_DEPLOYMENT=NO
GIT_PUSH=NO
REAL_PERSONAL_DATA=NO
LIVE_AI_MODEL=NO
PAYMENT_INTEGRATION=NO
```

This contract authorizes only the Phase 1B Task 02 read-only plan gate. Formal Task 02 implementation begins only after the project owner reviews the `/plan` output and sends a separate `/goal` approval that explicitly sets `PHASE_1B_TASK_02_STARTED=YES`.

---

## 1. Objective

Implement the second independently reviewable Phase 1B increment:

> Shared V0.1 TypeScript contracts and strict executable validation.

Task 02 must turn the approved V0.1 API, content, and error design files into reusable packages that can be consumed by the API and later clients without duplicating schemas.

The required outcome is:

- a dependency-light `@student-care/contracts` package containing stable shared values and TypeScript types;
- a `@student-care/validation` package containing strict Zod 3 validators;
- stable API success and error envelope validation;
- strict request and content validation with deterministic issue paths;
- synthetic contract tests proving valid data is accepted and malformed, oversized, unknown, incomplete, or over-posted data is rejected;
- the existing Task 01 quality commands updated so Task 02 packages participate in typecheck, lint, format, test, build, and verify;
- no tenant resolver, identity system, database, business repository, UI, network route, AI, payment, upload, or deployment implementation.

---

## 2. Authority and required read order

Codex must read these sources in order:

1. This Task 02 contract and its externally supplied SHA-256.
2. `AGENTS.md`.
3. `package.json`.
4. `pnpm-workspace.yaml`.
5. `tsconfig.base.json`.
6. `docs/project/PHASE_1B_RUNTIME_BASELINE_DECISION.md`.
7. `docs/reviews/PHASE_1B_TASK_01_REVIEW.md`.
8. `SHA256SUMS_PHASE_1B_TASK_01.txt`.
9. `docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md`.
10. `docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md`.
11. `docs/architecture/API_CONTRACT_BASELINE.md`.
12. `docs/architecture/MODULE_BOUNDARIES_BASELINE.md`.
13. `docs/architecture/TEST_STRATEGY_BASELINE.md`.
14. `docs/architecture/SECURITY_AND_PRIVACY_BASELINE.md`.
15. `docs/contracts/V0_1_API_SCHEMA.json`.
16. `docs/contracts/V0_1_CONTENT_SCHEMA.json`.
17. `docs/contracts/V0_1_ERROR_CATALOG.md`.
18. `docs/contracts/V0_1_PERMISSION_MATRIX.md`.
19. `docs/contracts/V0_1_ACCEPTANCE_TRACEABILITY.md`.

The approved files are the source of truth. The plan must preserve their terminology, shape, and boundaries. It must not silently “improve,” broaden, or reconcile a source conflict.

When sources are incomplete or inconsistent, the read-only plan must:

1. quote or identify each conflicting source and field;
2. explain the implementation impact;
3. present the smallest viable resolution options;
4. recommend one option;
5. leave the point pending project-owner approval before `/goal`.

---

## 3. Locked runtime and package-manager policy

Task 02 inherits the accepted Task 01 runtime baseline:

```text
NODE_RUNTIME=24.x LTS
NODE_ENGINE_RANGE=>=24.14.0 <25.0.0
PACKAGE_MANAGER_EXACT=pnpm@11.22.0
PNPM_ENGINE_RANGE=>=11.22.0 <12.0.0
LANGUAGE=TypeScript 5.7.3 strict
TEST_RUNNER=Node test runner
LIFECYCLE_SCRIPTS=DISABLED
```

All future package-manager commands must use:

```text
corepack pnpm
```

Codex must not install or replace a global Node.js or pnpm runtime.

Task 02 may propose exactly one new external direct dependency category:

```text
zod >=3 <4
```

The exact stable version is not pre-approved. The read-only plan must propose a candidate. The later approved `/goal` may query official npm-compatible registry metadata for `zod` only before installation and must verify:

- exact version exists;
- stable, not prerelease;
- Node 24 compatibility;
- pnpm 11 compatibility;
- license;
- lifecycle scripts;
- high or critical security advisories;
- maintenance status within the approved major.

No second external direct dependency is authorized.

Internal workspace references such as `workspace:*` do not count as additional external dependencies, but every direction must conform to the approved module baseline.

---

## 4. Mandatory source-gap and conflict audit

The Task 02 `/plan` must explicitly audit at least the following source issues. It must not silently choose an answer.

### 4.1 UUID rule

- `V0_1_CONTENT_SCHEMA.json` uses the pattern `^[0-9a-f-]{36}$`.
- `V0_1_API_SCHEMA.json` uses OpenAPI `format: uuid`.
- The API baseline says identifiers are opaque UUIDs.

The plan must propose one canonical executable UUID rule and explain compatibility consequences.

### 4.2 Client-supplied campus scope

- `ContentInput` in `V0_1_API_SCHEMA.json` includes optional `campus_id`.
- `API_CONTRACT_BASELINE.md` says `tenant_id`, `campus_id`, role, actor, and permission fields are never trusted from a client body.

The plan must distinguish untrusted request syntax from trusted server scope and recommend whether the Task 02 request validator rejects, strips, or structurally separates `campus_id`. No implementation is authorized until the owner approves this resolution.

### 4.3 Collection pagination response

- The prose API baseline says collection responses include `page` and `page_size`.
- The OpenAPI file defines a generic `page` object but does not define its exact properties.

Task 02 must not invent a cursor metadata structure. The plan must either limit Task 02 to validated request pagination plus generic envelope boundaries, or propose a precise deferred decision.

### 4.4 Error `details` shape

The error catalog allows optional structured `details` but does not define an exact schema. The plan must propose a safe JSON-compatible boundary without adding unsupported domain fields.

### 4.5 Request ID rule

Approved sources require `request_id` but do not define a single exact length or format. The plan must propose a minimal stable rule and identify it as a new Task 02 decision rather than a source-derived fact.

---

## 5. Start-gate conditions for read-only `/plan`

The plan run must verify:

1. Project root is exactly:
   `C:\Users\HU\Documents\student-care-saas-platform`
2. Current branch is exactly:
   `feature/phase-1b-task-01-workspace-quality`
3. Current HEAD is exactly:
   `badc119aa62835fae9fd45da089a19dafd063ddd`
4. Source HEAD is the current branch tip.
5. Worktree and index are clean except this approved untracked Task 02 contract.
6. Git remote count is zero.
7. Target branch does not already exist.
8. Task 01 review package exists and matches:
   - SHA-256: `E5821FB7578EA37403B19FA39B8E68B2B781A6C606FD7A17B282C59270B3C846`
   - member count: `20`
   - member-list SHA-256: `FDEB4361570446DD359A8032E4B581591EBB652D838D027F5BC337CEF21FCFAB`
9. The accepted Task 01 commit is the only commit after the Phase 1A Batch B source head for that branch.
10. Task 01 workspace commands and health route exist.
11. `packages/contracts/` and `packages/validation/` do not already exist.
12. No Task 03 tenant implementation, identity implementation, database, migration, client app, `.env`, production key, deployment artifact, or unrelated project content exists.
13. Node, Corepack, and project-pinned pnpm match the accepted runtime policy.
14. `corepack pnpm install --frozen-lockfile --ignore-scripts` is not run during `/plan`; the plan may inspect files and tool versions only.

Any mismatch must return `BLOCKED` and stop without changing the repository.

---

## 6. Task 02 required plan output

The read-only plan must provide a complete implementation plan and stop. It must include all sections below.

### 6.1 Exact file map

The plan must list every file to create or modify, one responsibility per file.

Allowed existing files to modify:

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
.prettierignore
eslint.config.mjs
apps/api/package.json
apps/api/tsconfig.json
```

Only modify `apps/api` files when needed to prove the shared contracts are consumable; do not add a business route.

Allowed new path families:

```text
PHASE_1B_TASK_02_CODEX_EXECUTION.md

docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md
docs/project/PHASE_1B_TASK_02_*.md
docs/reviews/PHASE_1B_TASK_02_*.md

packages/contracts/**
packages/validation/**

tests/contracts/**
scripts/verify_task_02.mjs

SHA256SUMS_PHASE_1B_TASK_02.txt
artifacts/review-package/student-care-platform-phase1b-task-02-review-pack-v1.0.zip
```

The plan may propose fewer files, but it must not create empty future packages or placeholder-only modules.

Every created package must participate in real typecheck, lint, test, and build commands.

### 6.2 Task 01 acceptance record

The plan must create a new record rather than modifying Task 01 frozen evidence:

```text
docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md
```

It must record:

```text
TASK_01_PROJECT_OWNER_ACCEPTANCE=PASS
TASK_01_ACCEPTANCE_DATE=2026-08-22
TASK_01_BRANCH=feature/phase-1b-task-01-workspace-quality
TASK_01_COMMIT=badc119aa62835fae9fd45da089a19dafd063ddd
TASK_01_REVIEW_PACKAGE_SHA256=E5821FB7578EA37403B19FA39B8E68B2B781A6C606FD7A17B282C59270B3C846
TASK_01_REVIEW_PACKAGE_MEMBER_COUNT=20
TASK_01_REVIEW_PACKAGE_MEMBER_LIST_SHA256=FDEB4361570446DD359A8032E4B581591EBB652D838D027F5BC337CEF21FCFAB
TASK_01_RISK_GLOB_10_5_0=NON_BLOCKING_TRANSITIVE_DEPENDENCY_WATCH
```

It must also state that Task 01 review files and ZIP remain frozen.

### 6.3 Package boundaries

The plan must preserve this dependency direction:

```text
@student-care/contracts
        ↓
@student-care/validation
        ↓
@student-care/api and later consumers
```

Rules:

- `contracts` must not depend on Zod or `validation`.
- `contracts` may contain only stable constants, readonly value sets, TypeScript types, and no runtime parsing side effects.
- `validation` may depend on `contracts` and Zod.
- API code may consume both packages but must not duplicate the schemas.
- No client, tenant, auth, database, storage, AI, or feature module may be created.
- No package may import from `apps/api`.
- Package exports must be explicit and testable.

### 6.4 Minimum executable contract surface

The plan must map source-supported fields into an executable surface that includes at least:

#### Stable error codes

All codes from `V0_1_ERROR_CATALOG.md`:

```text
UNAUTHENTICATED
FORBIDDEN_ROLE
FORBIDDEN_SCOPE
NOT_FOUND_SCOPED
VALIDATION_FAILED
CONSENT_REQUIRED
CONFLICT_STATE
VERSION_MISMATCH
IDEMPOTENCY_REPLAY_MISMATCH
RATE_LIMITED
FILE_TYPE_REJECTED
FILE_SCAN_PENDING
AI_SAFETY_BLOCKED
PROVIDER_UNAVAILABLE
DELETION_PENDING
INTERNAL_ERROR
```

#### Request-side primitives

- canonical UUID;
- `page_size` integer 1–100 with approved default behavior;
- cursor string max 500;
- idempotency key length 16–128;
- `If-Match` string max 80;
- content title max 120;
- daily report note max 4000;
- hint level integer 0–3;
- consent/supervision must be literal `true`;
- strict unknown-property rejection.

#### Content-item validation

From `V0_1_CONTENT_SCHEMA.json`:

- content type enum;
- status enum;
- visibility enum;
- block kind enum;
- title, summary, block-count, block-text, and href limits;
- version integer minimum 1;
- `synthetic_data` literal true;
- strict object validation;
- published content requires `published_at`;
- valid date-time handling;
- nullable campus/file/link fields only where the approved schema allows them.

#### API envelopes

- success envelope with `data` and `request_id`;
- error envelope with stable `code`, safe `message`, `request_id`, and owner-approved optional details boundary;
- no stack trace, SQL, credentials, raw prompt, hidden reasoning, or child free text in error details.

The plan must state exactly which source-defined request schemas are implemented in Task 02 and which are deferred.

### 6.5 Red-green TDD sequence

The plan must include exact failing tests, commands, expected exits, and minimal green implementations for at least:

1. contracts package missing exports;
2. validation package missing schema exports;
3. malformed UUID rejected;
4. oversized title, summary, block text, daily-report note, cursor, idempotency key, and `If-Match` rejected;
5. unknown content type/status/visibility/block kind rejected;
6. extra properties rejected at every approved strict object boundary;
7. missing or false consent rejected;
8. missing or false supervision rejected;
9. hint level outside 0–3 rejected;
10. `PUBLISHED` content without `published_at` rejected;
11. invalid date-time rejected;
12. `synthetic_data=false` rejected;
13. unknown error code rejected;
14. valid success and error envelopes accepted;
15. issue paths are deterministic and asserted;
16. API can import and use the shared validator without adding a business route;
17. package dependency direction verifier rejects a reverse import;
18. all temporary red fixtures are explicitly removed and excluded from commit/ZIP.

Tests must use Node's test runner and existing TypeScript tooling. No additional test framework is authorized.

### 6.6 Workspace commands

The plan must show exactly how the existing commands are updated so all three packages participate:

```text
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm test
corepack pnpm build
corepack pnpm verify
```

The plan must ensure:

- Task 01 health tests still pass;
- contracts and validation tests run;
- package builds produce no forbidden circular dependency;
- build output is excluded from Git and the review ZIP;
- a second frozen install produces no tracked change.

### 6.7 Dependency metadata proposal

The plan must propose one exact Zod 3 candidate and state that it is unverified until `/goal` registry metadata checks.

The future `/goal` may query metadata for `zod` only. It must stop before lockfile modification if the candidate:

- does not exist;
- is prerelease;
- does not support Node 24;
- has high/critical advisory;
- has unacceptable or missing license;
- requires an unapproved lifecycle script;
- requires another new direct external dependency.

### 6.8 Git discipline

The target branch is:

```text
feature/phase-1b-task-02-shared-contracts-validation
```

Task 02 authorizes exactly one implementation commit:

```text
feat: add shared v0.1 contracts and validation
```

The plan must provide explicit `git add -- <paths>` commands.

Forbidden:

```text
git add .
git add -A
commit --amend
rebase
reset
clean
restore
stash
remote add
push
PR
deployment
```

The real commit SHA must be recorded only in the external final receipt after commit, not written into the commit's own review report.

### 6.9 Review-package proposal

The plan must propose:

```text
artifacts/review-package/student-care-platform-phase1b-task-02-review-pack-v1.0.zip
SHA256SUMS_PHASE_1B_TASK_02.txt
```

It must output:

- exact sorted member list;
- member count;
- member-list SHA-256;
- internal Manifest strategy;
- root Manifest and ZIP digest strategy;
- safety validation commands;
- excluded paths.

The package must exclude:

```text
.git/
node_modules/
package-manager caches
.env*
dist/
build/
coverage raw caches
temporary red-test fixtures
Phase 1A review ZIPs
Task 01 review ZIP
production secrets
real personal data
unrelated files
```

The project owner must approve the exact member count and member-list SHA before ZIP generation.

---

## 7. Explicit non-scope

Task 02 must not implement or create:

- Task 03 tenant request scope;
- request-scoped tenant or campus resolution;
- sessions, identity, membership, roles, permissions, or auth;
- database schema, Prisma, SQL, migrations, seeds, or database clients;
- Redis, queues, workers, cron, or caches;
- COS, upload, signed links, or file adapters;
- content repositories, publishing services, institution, teacher, activity, meal, guide, resource, partner-link, care, guardian, task, report, or AI business modules;
- new HTTP business routes;
- user web, admin web, or mini-program applications;
- real WeChat configuration;
- payment;
- live AI, RAG, OCR, model SDK, or prompts;
- Docker, CI/CD, Tencent Cloud deployment, domain, TLS, or monitoring integration;
- real personal data.

The existing `/health` route must remain unchanged except for imports strictly required to prove package consumption, and it must continue returning only:

```json
{"status":"ok"}
```

---

## 8. Data, security, and network rules

- Use only clearly synthetic UUIDs and text.
- Do not create values resembling real phone numbers, identity numbers, email addresses, health records, pickup details, or family relationships.
- Do not read or print machine secrets.
- Application code and tests must not perform external network requests.
- Registry access in the later `/goal` is limited to pnpm lockfile resolution, audit, and metadata for `zod`.
- Lifecycle scripts remain disabled.
- No telemetry, analytics, external font, or remote resource is authorized.
- Error messages and issue details must be safe for clients and must not expose source code, stack traces, SQL, environment values, provider data, prompts, or hidden reasoning.

---

## 9. Verification requirements for the future `/goal`

The approved Task 02 implementation must run fresh evidence for:

```text
node --version
corepack --version
corepack pnpm --version
corepack pnpm install --frozen-lockfile --ignore-scripts
corepack pnpm audit --audit-level high --registry=https://registry.npmjs.org
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm test
corepack pnpm build
corepack pnpm verify
corepack pnpm install --frozen-lockfile --ignore-scripts
git diff --check
git diff --cached --check
git status --short --branch --untracked-files=all
git log -1 --oneline
git remote -v
```

It must also verify:

- Task 01 review package remains unchanged;
- Task 01 acceptance record matches the approved anchors;
- only one new external direct dependency category was added;
- `contracts` does not depend on Zod or `validation`;
- `validation` depends only on `contracts`, Zod, and approved tooling;
- API imports shared packages without duplicating schemas;
- strict validators reject all required malformed cases;
- valid synthetic fixtures parse consistently;
- no Task 03 directory or implementation exists;
- no external application/test request occurs;
- no secret or personal-data pattern exists;
- second frozen install produces no tracked change;
- fixed review ZIP and Manifest pass independently;
- local build outputs and caches are excluded;
- no remote, push, PR, or deployment occurs.

---

## 10. Completion gates

Task 02 may report internal `PASS` only if all are true:

```text
PHASE_1B_TASK_02_STATUS=PASS
PHASE_1B_TASK_02_STARTED=YES
TASK_03_STARTED=NO

SOURCE_HEAD_IS_ANCESTOR=YES
TASK_01_ACCEPTANCE_RECORD_STATUS=PASS
TASK_01_FROZEN_REVIEW_PACKAGE_STATUS=PASS
RUNTIME_STATUS=PASS
DEPENDENCY_POLICY_STATUS=PASS
LOCKFILE_REPRODUCIBILITY_STATUS=PASS
CONTRACTS_PACKAGE_STATUS=PASS
VALIDATION_PACKAGE_STATUS=PASS
REQUEST_VALIDATION_STATUS=PASS
CONTENT_VALIDATION_STATUS=PASS
ERROR_CONTRACT_STATUS=PASS
ENVELOPE_CONTRACT_STATUS=PASS
STRICT_UNKNOWN_KEY_STATUS=PASS
DETERMINISTIC_ISSUE_PATH_STATUS=PASS
PACKAGE_DIRECTION_STATUS=PASS
API_CONSUMPTION_STATUS=PASS
TYPECHECK_STATUS=PASS
LINT_STATUS=PASS
FORMAT_CHECK_STATUS=PASS
UNIT_TEST_STATUS=PASS
BUILD_STATUS=PASS
TASK_01_REGRESSION_STATUS=PASS
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

Internal PASS does not authorize Task 03.

---

## 11. Blocked handling

Before the target branch is created, a blocked plan or execution must report externally and must not modify repository files.

After the target branch is created, a blocker may be recorded only in the Task 02 review file authorized by the approved plan.

Never modify the frozen Task 01 review report, Task 01 Manifest, Task 01 ZIP, Task 01 contracts, Phase 1A reports, Phase 1A Manifests, or Phase 1A ZIPs.

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
- conflicting source or command;
- exit code;
- affected files;
- verified completed work;
- minimum safe resolution;
- confirmation that Task 03 did not start.

---

## 12. Plan-mode stop rule

The current `/plan` run is read-only.

It must not:

- create or modify files;
- create or switch branches;
- install or update dependencies;
- access a package registry;
- change the lockfile;
- start a service;
- run writing build commands;
- stage or commit;
- generate a ZIP;
- set `PHASE_1B_TASK_02_STARTED=YES`;
- start Task 03.

After outputting the full source-conflict audit, exact file map, package interfaces, dependency proposal, red-green TDD sequence, quality-command changes, Git plan, exact review-package proposal, risks, completion gates, and stop conditions, Codex must stop for project-owner review.
