# TASK20_PHASE2_M32D_M32F_WEB_ADMIN_MAIN_TREE_SYNC

## Purpose and status

- Status: authorized autonomous continuation of the user's project-completion instruction; implementation and selective synchronization are in progress.
- Authority: current user instruction to continue project development without repeated authorization, together with previously approved M32D and M32F synthetic workflow contracts.
- Basis: `docs/superpowers/plans/2026-10-01-task20-phase2-m32d-leave-review-synthetic.md` and `docs/superpowers/plans/2026-10-01-task20-phase2-m32f-care-record-synthetic.md`.
- Worktree: `C:\Users\HU\.codex\worktrees\task20-phase2-web-admin-sync`.

## Objective

Bring the already implemented M32D leave-review and M32F care-record workflows into the current main-tree User Web and Admin Web entrypoints. Preserve existing main-tree features and keep each web app's demo state local and in memory. This work does not close M3.2 and does not authorize M3.3.

## Exact write set

User Web:

1. `apps/user-web/src/main.ts` — additive route, employee workflow, parent published-record view and actions.
2. `apps/user-web/src/routes/staff.routes.tsx` — fail-closed leave-review capability and scope check.
3. `apps/user-web/src/pages/staff-leave-review.tsx` — leave-review view model and rendering.
4. `apps/user-web/src/pages/staff-leave-review.test.ts` — leave-review authorization, status, scope and batch behavior.
5. `apps/user-web/src/pages/care-record-workflow.ts` — fixed-option care-record state model and projections.
6. `apps/user-web/src/pages/care-record-workflow.test.ts` — state, version, role, scope, publish/withdraw and parent acknowledgement tests.
7. `tests/e2e/leave-review.spec.ts` — local User Web leave-review workflow smoke.
8. `tests/e2e/care-record-review.spec.ts` — local employee review/publish and parent read/acknowledge smoke.

Admin Web:

9. `apps/admin-web/src/main.ts` — additive navigation and local rendering/actions for both reviews.
10. `apps/admin-web/src/pages/leave-review.tsx` — campus-scoped review and platform aggregate-only view.
11. `apps/admin-web/test/leave-review.test.mjs` — role, scope and aggregate privacy tests.
12. `apps/admin-web/src/pages/care-record-review.tsx` — minimal scoped review and anonymous platform counts.
13. `apps/admin-web/test/care-record-review.test.mjs` — scope, state and anonymous-view tests.

Governance:

14. This execution contract.
15. `docs/exec-plans/active/project-completion.md`.
16. `PLANS.md`.

The source-worktree contracts modified `staff-report.tsx` and `parent-home.ts`; the current main tree assembles both existing views in `main.ts` and does not contain the source branch's parent-binding support modules. This contract therefore preserves the same behavior in `main.ts` without porting unused page files or dependencies. No other path is in scope. `apps/mini-program/src/pages/staff.test.ts`, all Mini files, APIs, databases, authentication, partner services, dependencies, lockfiles and unrelated main-tree changes are protected.

## Behavior and safety

- Use only clearly labelled fictional data in per-app in-memory state. The User Web, Admin Web and Mini do not share state; do not imply a web review changed a Mini submission.
- Care records use fixed options only. Review confirmation and parent publication are separate actions; parents can only read currently published summaries and acknowledge them separately.
- Revalidate role, active membership, tenant, campus, class, relationship, state and version at each action. Batch review is all-or-nothing. Platform views show anonymous counts only.
- No free-text child details, network calls, persistence, real notifications, real identity, API/database/partner service, production AI, new dependency, or lockfile change.
- Existing `/staff/report`, `/web/parent/home`, and current Admin shell are reused. No API route or Mini page route is added.

## Verification

- Establish focused-test RED for missing main-tree modules/entrypoints before integrating implementation.
- Run User Web and Admin Web focused tests, typechecks and builds; run existing focused E2E flows against loopback-only previews where the existing runner permits; run targeted ESLint and Prettier checks, `git diff --check`, no-network/source review, and exact write-set audit.
- Re-run relevant existing User/Admin regression tests after main-tree selective synchronization.
- Native WeChat DevTools clicks are outside this web/admin task and remain `NOT_RUN` until actually performed by a person in the simulator.
- Preserve all pre-existing dirty and untracked paths. Do not stage, clean, commit, push, deploy, publish, or claim Owner Review.

## Stop conditions

Stop and report if safe integration requires a path outside the exact write set, a real external service, dependency/lockfile change, destructive cleanup, or overwriting unrelated content. Keep current main-tree modules intact and merge only task-specific file deltas from the isolated worktree.
