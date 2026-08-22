# Phase 1B Task 01 Runtime Baseline Amendment V1.1

## 0. Amendment metadata

```text
AMENDMENT_ID=PHASE_1B_TASK_01_RUNTIME_BASELINE_AMENDMENT
AMENDMENT_VERSION=1.1
PROJECT_ROOT=C:\Users\HU\Documents\student-care-saas-platform

BASE_CONTRACT=PHASE_1B_TASK_01_CODEX_EXECUTION.md
BASE_CONTRACT_SHA256=117C382C91AE1FAB0D03E7BB452B89378E787A699F34D69E520DD75D7DEC3E24

AUTHORITY=PROJECT_OWNER
DECISION_DATE=2026-08-22
```

This amendment is a narrow authoritative override for the Phase 1B Task 01 runtime, pnpm configuration, and first-lockfile procedure. All other scope, safety, TDD, Git, review-package, stop, and non-scope rules in the base contract remain unchanged.

Phase 1A evidence and approved Phase 1A architecture files are historical frozen evidence. They must not be edited to rewrite the old Node 22 / pnpm 10 decision. Phase 1B records the superseding runtime decision in a new file.

---

## 1. Reason for amendment

The read-only Task 01 plan proved that every repository and evidence gate passed. The only blocker was a runtime-policy mismatch:

```text
INSTALLED_NODE=v24.14.0
INSTALLED_PNPM=11.19.0
INSTALLED_COREPACK=0.34.6

OLD_TASK_01_NODE_BASELINE=22.x LTS
OLD_TASK_01_PNPM_BASELINE=10.x
```

The project owner approves Node 24 LTS for the new Phase 1B implementation and will not downgrade the machine to Node 22.

The locally installed pnpm 11.19.0 is sufficient for read-only planning only. The implementation must use a project-pinned pnpm 11.22.0 through Corepack before resolving dependencies or creating the lockfile. No global Node.js replacement or global pnpm installation is authorized.

---

## 2. Superseding runtime policy

### 2.1 Read-only plan gate

```text
PLAN_NODE_RANGE=>=24.14.0 <25.0.0
PLAN_PNPM_RANGE=>=11.19.0 <12.0.0
PLAN_COREPACK_MIN=0.34.6
```

The observed environment is accepted for replanning:

```text
NODE_VERSION=v24.14.0
PNPM_VERSION=11.19.0
COREPACK_VERSION=0.34.6
```

### 2.2 Task 01 implementation gate

```text
NODE_RUNTIME=24.x LTS
NODE_ENGINE_RANGE=>=24.14.0 <25.0.0

PACKAGE_MANAGER=pnpm 11.x
PACKAGE_MANAGER_EXACT=pnpm@11.22.0
PNPM_ENGINE_RANGE=>=11.22.0 <12.0.0
```

The root `package.json` must contain:

```json
{
  "packageManager": "pnpm@11.22.0",
  "engines": {
    "node": ">=24.14.0 <25.0.0",
    "pnpm": ">=11.22.0 <12.0.0"
  }
}
```

Before any dependency resolution, the future approved `/goal` must run from the project root:

```text
corepack pnpm --version
```

Expected result:

```text
11.22.0
```

Corepack must resolve the exact version from the root `packageManager` field. If it cannot do so without global installation, or reports another version, Task 01 must stop before lockfile generation.

The implementation and final evidence commands must use `corepack pnpm ...` so that the package-manager version is deterministic even if another `pnpm` executable is present on PATH.

---

## 3. Locked technology baseline after amendment

```text
NODE_RUNTIME=24.x LTS
PACKAGE_MANAGER=pnpm 11.22.0
LANGUAGE=TypeScript 5.7.x strict
API=Fastify 5.x
WEB_CLIENT_BASELINE=React 19.x + Vite 6.x
VALIDATION_BASELINE=Zod 3.x
TEST_BASELINE=Node test runner
DATABASE_BASELINE=PostgreSQL 16
CACHE_BASELINE=Redis 7 optional and not used in Task 01
AI_PROVIDER=DISABLED
```

Task 01 installs only dependencies required for the minimal workspace, quality gates, and Fastify health route. React, Vite, Zod, database, Redis, COS, AI, payment, and deployment dependencies remain outside Task 01.

---

## 4. pnpm 11 project configuration

Task 01 does not require a custom registry or authentication configuration. Therefore:

```text
CREATE_.npmrc=NO
```

For pnpm 11, project settings must be placed in:

```text
pnpm-workspace.yaml
```

The replanned configuration must use the smallest verified pnpm 11-compatible set, expected to include:

```yaml
packages:
  - "apps/*"

engineStrict: true
strictPeerDependencies: true
sharedWorkspaceLockfile: true
ignoreScripts: true
```

Codex must verify the exact setting names against the installed pnpm 11 CLI before implementation. It must not add unrelated settings.

If a required package cannot function with lifecycle scripts disabled:

1. stop before installation;
2. identify the exact package and lifecycle script;
3. explain why Task 01 requires it;
4. propose the narrowest package-specific allowlist;
5. wait for project-owner approval.

It must never silently enable all lifecycle scripts.

---

## 5. Correct first-lockfile sequence

A frozen install cannot create the initial lockfile. The revised Task 01 plan must use:

### Step A — create approved manifests and configuration

Create only the project-owner-approved files and exact dependency versions.

### Step B — verify project-pinned pnpm

```text
corepack pnpm --version
```

Expected: `11.22.0`.

### Step C — create lockfile without lifecycle scripts

```text
corepack pnpm install --lockfile-only --ignore-scripts
```

### Step D — inspect lockfile and package metadata

Verify:

- only approved direct dependencies exist;
- no unexpected workspace package exists;
- integrity fields are present;
- no registry other than the approved default registry is configured;
- no package requires an unapproved lifecycle script;
- licenses and security metadata meet the approved policy.

### Step E — install from the frozen lockfile

```text
corepack pnpm install --frozen-lockfile --ignore-scripts
```

### Step F — run Task 01 red-green and final quality gates

Use `corepack pnpm` for all package-manager commands.

### Step G — reproducibility check

Run a second:

```text
corepack pnpm install --frozen-lockfile --ignore-scripts
```

Then prove it creates no tracked-file difference.

Forbidden:

```text
--force
--no-verify-store-integrity
lockfile repair
checksum bypass
unbounded dependency update
silent lifecycle-script enablement
```

---

## 6. Dependency proposal status

The previous seven-package set is accepted as the maximum Task 01 dependency categories, not as final approved versions:

```text
fastify
@eslint/js
@types/node
eslint
prettier
typescript
typescript-eslint
```

The new read-only plan must re-list every dependency with:

- exact version candidate;
- runtime or development scope;
- package location;
- necessity;
- Node 24 compatibility;
- pnpm 11 compatibility;
- lifecycle scripts;
- license;
- maintenance status within the approved major;
- rollback/removal procedure.

No registry access is authorized during `/plan`.

In the future approved `/goal`, before creating the lockfile, Codex may query package metadata for only these seven package names. It must stop if:

- an exact version does not exist;
- Node 24 is unsupported;
- a high/critical advisory affects the chosen version;
- an unapproved lifecycle script is required;
- license metadata is absent or outside the approved policy;
- an eighth direct dependency becomes necessary.

No React, Vite, Zod, Prisma, PostgreSQL client, Redis, COS, AI SDK, Playwright, Docker, or Task 02–18 dependency may be installed.

---

## 7. Revised file planning requirement

Because `.npmrc` is removed, the replanned file list must be recalculated.

The revised plan must add one new decision record:

```text
docs/project/PHASE_1B_RUNTIME_BASELINE_DECISION.md
```

It must record:

- the historical Node 22 / pnpm 10 decision;
- the Phase 1B Node 24 / pnpm 11.22 superseding decision;
- the reason for the change;
- accepted runtime ranges;
- the Corepack project-pin rule;
- the pnpm 11 configuration location;
- the lockfile sequence;
- the no-global-runtime-change rule;
- the fact that Phase 1A frozen evidence was not modified;
- rollback and future upgrade policy.

No other Phase 1A file may be edited to change the old baseline.

---

## 8. Revised review-package requirement

The new plan must recalculate:

- exact file list;
- exact review-package list;
- member count;
- member-list SHA-256.

The review package must include:

```text
PHASE_1B_TASK_01_CODEX_EXECUTION.md
PHASE_1B_TASK_01_RUNTIME_BASELINE_AMENDMENT_V1_1.md
docs/project/PHASE_1B_RUNTIME_BASELINE_DECISION.md
```

It must not include `.npmrc`.

All original exclusions remain:

```text
.git/
node_modules/
package-manager caches
.env*
phase-inputs/
dist/
build/
coverage raw caches
temporary red-test fixtures
Phase 1A review ZIPs
production secrets
unrelated files
```

The project owner must approve the recalculated member count and member-list SHA before ZIP generation.

---

## 9. Required read-only replan output

After this amendment is copied to the project root, Codex must run a new read-only `/plan` and:

1. verify the base contract SHA;
2. verify this amendment SHA;
3. verify Node `v24.14.0`, pnpm `11.19.0`, and Corepack `0.34.6`;
4. mark the old runtime mismatch as superseded;
5. preserve all other start gates;
6. propose project-pinned pnpm `11.22.0` through Corepack;
7. omit `.npmrc`;
8. use pnpm 11 settings in `pnpm-workspace.yaml`;
9. correct the initial lockfile sequence;
10. re-evaluate the exact seven dependency versions;
11. provide the corrected red-green TDD plan;
12. provide the corrected explicit Git staging paths;
13. provide the recalculated exact review-package member list, count, and SHA;
14. stop without writing, branching, installing, contacting a registry, or starting Task 01.

---

## 10. Continuing stop conditions

Return `BLOCKED` if:

- Node is outside `>=24.14.0 <25.0.0`;
- planning pnpm is outside `>=11.19.0 <12.0.0`;
- Corepack is below `0.34.6`;
- Corepack cannot resolve project-pinned pnpm `11.22.0` during the future goal without global installation;
- the base contract or amendment hash is wrong;
- source branch or source HEAD moved;
- worktree contains unapproved content;
- target branch already exists;
- Phase 1A frozen evidence changed;
- dependency metadata fails the policy;
- a required lifecycle script lacks explicit approval;
- installation requires a global Node or pnpm change;
- any Task 02 or later scope is introduced.

No destructive recovery, remote, push, PR, deployment, real personal data, payment, or live AI is authorized.
