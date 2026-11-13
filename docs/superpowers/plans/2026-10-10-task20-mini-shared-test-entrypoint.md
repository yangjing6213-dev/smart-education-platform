# TASK20 Mini Shared-Page Test Entrypoint

## Goal

Make the Mini shared-service Page regression added to the main tree in the prior G3.3 sync easy to invoke as a dedicated root-package test command. Keep it separate from the legacy full repository test command, which does not include the Mini application.

This is test tooling only. It does not change product behavior.

## Exact write set

- `package.json` — add one `test:mini-shared-service` script; preserve existing `test` and `test:coverage` values and all other local edits.
- `tests/mini-shared-service.test.mjs` — fail early with an actionable message if the shared-core worktree cannot be resolved; keep the environment override and sibling default.
- `PLANS.md` — record this contract and evidence.
- `docs/exec-plans/active/project-completion.md` — update D09 status and evidence.
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` — update the test-entrypoint gap status.
- This contract.

## Baseline and verification

- Baseline: the root package has no Mini Page test script; the existing root `test` command covers contracts/API/Admin and must remain unchanged.
- `tests/mini-shared-service.test.mjs` currently resolves `LOCAL_SYNTHETIC_CORE_ROOT`, defaulting to the sibling `../task20-local-shared-core`. The main tree requires the environment override because the shared-core worktree is elsewhere.
- Verify the main test reports a clear setup message when the shared-core path is missing; run the dedicated test command in source mode and generated-JS mode with the local shared-core worktree configured; run ESLint, project-config Prettier on the edited files, `git diff --check`, and exact scope/status audit.

## Restrictions and stop conditions

- Do not change the existing full test command, test/coverage behavior, dependency declarations, lockfile, product code, routes, configuration, API, or Mini page behavior.
- Do not touch `staff.test.ts` or the source worktree's regression file.
- Use only synthetic data and the ephemeral local shared service. No real identity/data, persistence, external service, commit, push, deploy, or release.
- If the new entrypoint would require an install or a product-code edit, stop and report.

