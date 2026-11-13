# TASK20 G3.1 — Task assignment and independent check

Date: 2026-10-07

## Authority and source

- Product source: `student-care-platform-complete-plan-v2.0.pdf`, SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`.
- Relevant source sections: page 18 (cross-client task handoff and task results as daily-report/statistics sources), page 32 (task categories, responsibility, target, deadline/priority, result, optional checker and audit), page 36 (manager quick action to assign tasks).
- Roadmap source: `docs/exec-plans/active/project-completion.md`; G3.1 is task assignment/check, while the older `g31-staff-daily-workflows-synthetic.md` filename describes daily reports now mapped to G3.2.
- Authority to proceed: user's standing instruction to complete the remaining project stages autonomously and current direction “进入下一批”.
- Existing implementation base: local-synthetic service and the existing staff workbench / Admin review / Mini quick-action page. This task does not replace the old daily-report slice.

## Goal

Build the smallest complete synthetic task lifecycle across the existing shared local service, User Web, Admin Web, and Mini:

`负责人分派 → 教师领取 → 开始 → 完成 → 负责人独立检查`

The task is one shared object ID/version across all three clients. The service derives tenant, campus, class, staff identity, permissions, and audit scope from its current synthetic session; request bodies cannot grant themselves scope.

## Required behavior

1. A campus owner can create a task from a fixed synthetic catalog covering daily, temporary, student follow-up, activity, and emergency work. The owner selects an authorized staff member, target (class, synthetic student, activity, or own campus), due date, and priority.
2. The assigned staff member alone can claim, start, and complete the task. Completion uses fixed result choices and does not accept real student details or attachments.
3. The owner can independently confirm or return a completed task. An assignee cannot check their own task. A returned task can be claimed and worked again; a task can be cancelled only by an authorized owner and only before it reaches a terminal checked/cancelled state.
4. Every successful action increments the version and records actor, object, version, action, outcome, time, tenant, and campus in the existing in-memory audit trail. Old versions, duplicate transitions, wrong role, wrong class/campus/tenant, wrong assignee, and self-check fail closed.
5. The lifecycle uses simple states: `ASSIGNED`, `CLAIMED`, `IN_PROGRESS`, `COMPLETED`, `CHECKED`, `RETURNED`, and `CANCELLED`. The UI may show overdue based on due date without rewriting the stored status. No Gantt chart, work-hour tracking, or complex approval chain.
6. UI uses the existing User Web staff workbench, Admin staff-task page, and Mini staff quick-action page. No Mini page registration/config changes or external routes are needed. Pages show the same task ID, current status, and version after refresh.

## Safety boundary and deferred source-plan items

- Use only obviously fictional synthetic identities, tasks, and dates in an in-memory local session. Do not connect real identity, students, institutions, notification delivery, database, partner cloud, AI, file storage, or external services.
- Free-form task/completion text and photo/file attachments are deferred: they can carry real minor information and require storage/privacy controls outside this synthetic slice. The UI uses fixed descriptions and fixed completion outcomes. Record this as an explicit remaining project-plan gap; do not claim attachment handling complete.
- This is local Phase 3 product-flow demonstration evidence, not proof that the V0.1 release includes task management and not release readiness.
- No dependencies, lockfiles, `staff.test.ts`, `app.json`, `index.json`, root/private project configuration, commits, pushes, deployment, or publication.

## Exact write set

Main control plane:

- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-07-g31-task-assignment-lifecycle.md` (this contract)

Shared local service worktree `C:\Users\HU\.codex\worktrees\task20-local-shared-core`:

- `apps/api/src/local-synthetic/repository.ts`
- `apps/api/src/local-synthetic/sessions.ts`
- `apps/api/src/local-synthetic/routes.ts`
- `apps/api/src/local-synthetic/server.ts`
- `apps/api/src/local-synthetic/task-assignment.service.ts` (new)
- `apps/api/test/local-synthetic-task-assignment.test.ts` (new)
- `tests/local-synthetic/task-assignment.test.mjs` (new)
- `docs/exec-plans/active/task-assignment-core.md` (new)

User Web worktree `C:\Users\HU\.codex\worktrees\task20-web-completion`:

- `apps/user-web/preview.mjs` (allow only the task-assignment local endpoints required below)
- `apps/user-web/src/local-synthetic/client.ts`
- `apps/user-web/src/local-synthetic/task-assignment.ts` (new)
- `apps/user-web/src/local-synthetic/task-assignment.test.ts` (new)
- `apps/user-web/src/main.ts`
- `apps/user-web/src/styles/user-web.css`
- `apps/user-web/test/task-assignment-browser.mjs` (new)
- `docs/exec-plans/active/web-task-assignment.md` (new)

Scope clarification (2026-10-07): the existing User Web preview proxy has a path-and-method allowlist. The task lifecycle cannot run through the actual shared local service until the matching task endpoints are explicitly allowed there. This contract now includes that single proxy file; its allowlist change must remain restricted to task assignee/read/review and task transition endpoints, with no general proxy or routing expansion.

Admin Web worktree `C:\Users\HU\.codex\worktrees\task20-admin-completion`:

- `apps/admin-web/src/main.ts`
- `apps/admin-web/src/local-review/client.ts`
- `apps/admin-web/src/local-review/task-assignment.ts` (new)
- `apps/admin-web/src/local-proxy.mjs`
- `apps/admin-web/test/task-assignment.test.mjs` (new)
- `apps/admin-web/test/preview.test.mjs`
- `docs/exec-plans/active/admin-task-assignment.md` (new)

Mini worktree `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`:

- `apps/mini-program/src/local-synthetic/client.ts`
- `apps/mini-program/src/local-synthetic/client.js` (generated only when the normal compiler reports changed output)
- `apps/mini-program/src/local-synthetic/page.ts`
- `apps/mini-program/src/local-synthetic/page.js` (generated only when the normal compiler reports changed output)
- `apps/mini-program/pages/staff/quick-action/index.ts`
- `apps/mini-program/pages/staff/quick-action/index.wxml`
- `apps/mini-program/pages/staff/quick-action/index.wxss`
- `apps/mini-program/pages/staff/quick-action/index.js` (only if the normal compiler reports changed output)
- `apps/mini-program/src/pages/task-assignment.test.ts` (new)
- `docs/exec-plans/active/mini-task-assignment.md` (new)

Scope clarification (2026-10-07): the Mini runtime freshness guard reports changed compiler outputs for `apps/mini-program/src/local-synthetic/client.js` and `apps/mini-program/src/local-synthetic/page.js`. These two generated files are added to the write set solely for normal compiler output; do not hand-edit them or include any other generated output. The contract hash is updated in `PLANS.md` before writing either file.

All prior dirty and untracked work in these worktrees is protected. Preserve G2.4 changes and all other unrelated state.

## Test-first sequence

1. Add failing service tests for fixed task catalog, valid/invalid state transitions, scope, role, assignee, independent checker, version conflicts, and audit events; confirm failure before service implementation.
2. Implement service/repository/session routes, then pass API unit and real loopback tests.
3. Add failing client/page tests for same-ID status refresh, duplicate/stale actions, profile/scope switch clearing, no-network leakage, and fixed-field UI; then connect the existing three clients through the shared service and actual Admin/User Web preview proxies.
4. Compile Mini and update its generated JS only if the runtime compiler reports actual output differences.

## Verification

- Service: API typecheck, ESLint, focused service tests and `node --test tests/local-synthetic/task-assignment.test.mjs` against an in-process loopback server.
- User Web: typecheck, focused tests, ESLint, Prettier, existing preview/browser integration test, and `git diff --check`.
- Admin Web: TypeScript build, focused task/preview tests, full Admin test folder, ESLint, Prettier, proxy GET/write boundary checks, and `git diff --check`.
- Mini: typecheck, source and generated Page tests, ESLint, Prettier for authored TS/WXML, runtime freshness/registration guard, and `git diff --check`.
- Cross-client: verify one task ID/version crosses owner and staff pages, no external request or persistent storage is introduced, and changed paths stay within this write set.
- DevTools/browser visual clicks are reported separately. If no controller is available, mark native visual review `NOT_RUN`; do not infer it from tests.

## Stop conditions

Stop this slice if the implementation needs a path outside this write set, new routing/configuration or page registration, free-form minor content/storage, external services, or dependency/lockfile changes. Record the exact missing piece and keep the affected gate `NOT_RUN`/`BLOCKED` rather than broadening the contract silently.

Status at creation: `IN_PROGRESS`.
