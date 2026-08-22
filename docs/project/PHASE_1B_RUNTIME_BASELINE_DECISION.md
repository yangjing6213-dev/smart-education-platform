# Phase 1B Runtime Baseline Decision

## Authority

This record applies only to Phase 1B Task 01 and preserves the historical Phase 1A
decision without editing any frozen Phase 1A evidence.

```text
BASE_CONTRACT=PHASE_1B_TASK_01_CODEX_EXECUTION.md
BASE_CONTRACT_SHA256=117C382C91AE1FAB0D03E7BB452B89378E787A699F34D69E520DD75D7DEC3E24
RUNTIME_AMENDMENT=PHASE_1B_TASK_01_RUNTIME_BASELINE_AMENDMENT_V1_1.md
RUNTIME_AMENDMENT_SHA256=73BD643C6660334D1136BA32D9B3599C002E6152ED8F717C563C4202D2254108
DECISION_AUTHORITY=PROJECT_OWNER
DECISION_DATE=2026-08-22
```

## Historical baseline

Phase 1A and the original Task 01 contract recorded Node.js 22.x LTS and pnpm 10.x.
Those files remain historical evidence and are not rewritten by this record.

```text
HISTORICAL_NODE_RANGE=22.x LTS
HISTORICAL_PNPM_RANGE=10.x
```

## Superseding Phase 1B baseline

The project owner approved Node.js 24 and a project-pinned pnpm 11.22.0 because the
available machine runtime is Node `v24.14.0` with pnpm 11, and global runtime
downgrade or replacement is not authorized.

```text
PHASE_1B_NODE_RANGE=>=24.14.0 <25.0.0
PHASE_1B_PNPM_EXACT=pnpm@11.22.0
PHASE_1B_PNPM_RANGE=>=11.22.0 <12.0.0
```

## Corepack and pnpm configuration

The root `package.json` owns the exact `packageManager` pin. Every package-manager
command uses `corepack pnpm`; no global pnpm or Node replacement is allowed.

The pnpm 11 settings belong only in `pnpm-workspace.yaml`:

```yaml
engineStrict: true
strictPeerDependencies: true
sharedWorkspaceLockfile: true
ignoreScripts: true
```

The implementation gate must verify that pnpm 11.22.0 recognizes each setting before
resolving dependencies. An unrecognized setting is a stop condition, not a reason to
create `.npmrc` or add unrelated configuration.

## Initial lockfile procedure

The first lockfile is created with the project-pinned package manager and scripts
disabled:

```text
corepack pnpm --version
corepack pnpm install --lockfile-only --ignore-scripts
corepack pnpm install --frozen-lockfile --ignore-scripts
```

After the quality gates pass, the same frozen install runs a second time and must not
produce a tracked diff. Integrity, direct dependency membership, license metadata,
security advisories, and lifecycle scripts are checked before the first install.

## No global runtime change and rollback

No global Node.js or pnpm installation is changed. If pnpm 11.22.0 cannot be resolved
by Corepack without a global change, Task 01 stops before lockfile generation. A future
runtime change requires a new owner-approved amendment, a new SHA, and an updated
decision record; it must not rewrite this record or Phase 1A evidence.

## Frozen evidence and scope

Phase 1A contracts, baselines, prototypes, screenshots, validators, manifests, review
reports, review ZIPs, and `docs/reviews/BLOCKERS.md` remain unchanged. This record does
not authorize Task 02, database work, clients, deployment, live AI, payment, or real
personal data.
