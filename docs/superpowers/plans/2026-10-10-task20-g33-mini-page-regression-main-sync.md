# TASK20 G3.3 Mini Page Regression Main-Tree Sync

## Goal

Make the already verified Mini Page-level synthetic shared-service regression reproducible from the main worktree, in both TypeScript-source and compiler-generated JavaScript modes. The test covers parent binding request, scoped staff review, leave lifecycle, care record review/publication, monthly feedback, resource scope, template linkage, and stale hidden-page response handling.

This is a local test-only sync under the standing autonomous-development direction in the current `PLANS.md` control plane. It does not implement or change product behavior.

## Exact write set

- `tests/mini-shared-service.test.mjs` — create from the read-only source-worktree test with one portability change: resolve the local shared-core directory from `LOCAL_SYNTHETIC_CORE_ROOT`, defaulting to the existing sibling `../task20-local-shared-core`.
- `PLANS.md` — record contract, evidence, and next open gate.
- `docs/exec-plans/active/project-completion.md` — record exact result and limitations.
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` — reconcile the G3.3 Mini test evidence and remaining native gate.
- This contract.

Source evidence: `C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign/tests/mini-shared-service.test.mjs`, SHA-256 `709F55B38070020235AB1A14FD587DC34B4F805EF57387856D16870A62413417`. The source test remains read-only.

## Read-only preflight

- Confirm the destination test does not exist before creation.
- Compare all runtime files read by the test between the main tree and source tree. The 17-path preflight found matching content; the only byte-level difference was CRLF versus LF in `pages/staff/workbench/index.wxml`, and normalized text matched. Do not copy or edit any runtime file.
- Use the current local shared-core worktree through an environment variable for main-tree runs. The test retains its relative sibling default for the source worktree.

## Verification

- Demonstrate that the unmodified copied test cannot resolve the sibling shared-core path from the main tree, then add only the environment override and rerun.
- From the main repository root, run all five tests in source mode and again with `MINI_SHARED_RUNTIME=generated`, using `LOCAL_SYNTHETIC_CORE_ROOT=C:/Users/HU/.codex/worktrees/task20-local-shared-core`.
- Run ESLint and Prettier on the new test, `git diff --check`, and exact write-set/status audit. Confirm source test SHA remains unchanged and no Mini runtime file, `staff.test.ts`, configuration, dependency, or lockfile changed.

## Restrictions and stop conditions

- Synthetic data and an ephemeral loopback service only; no real identity, data, persistence, external service, or outbound network.
- Do not edit Mini product code, pages, routes, `app.json`, `index.json`, `staff.test.ts`, API code, or shared-core code.
- No dependency or lockfile changes, no commit/push/deploy/release.
- Stop if an in-scope test cannot run without modifying a runtime file outside the write set, or if the main-tree runtime content is semantically different from the verified source runtime.

