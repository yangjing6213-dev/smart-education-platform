# TASK20 G3.1 Main-Tree Selective Web Sync

Date: 2026-10-08

## Authority and source

- Product source: `student-care-platform-complete-plan-v2.0.pdf`, SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`.
- Implementation source contract: `docs/superpowers/plans/2026-10-07-g31-task-assignment-lifecycle.md`, SHA-256 `78C62A8D6B019699C11B09ED0E3361573C15A8333E7CF286FF6268B06580C91A`.
- Authority to continue: user's standing direction to complete the remaining project stages autonomously; this sync stays inside that synthetic local-development scope.
- The existing local service already exposes G3.1 task routes in the main tree. G3.1 Mini source and generated implementation are not changed by this sync. The missing behavior is the main-tree User Web and Admin Web wiring.

## Goal

Make the existing local synthetic task lifecycle visible and usable from both web clients:

`Admin assigns → assigned teacher claims, starts, and completes → a different authorized owner checks or returns`

Both clients must use the same local service, task ID, and version chain. Existing routes stay in place: User Web `/staff/workbench`; Admin Web `/admin/staff`.

## Required behavior

1. User Web workbench loads tasks for the fixed synthetic `teacher-east` session and offers only the next permitted action: claim, start, or submit one fixed completion result.
2. Admin Web employee page loads the fixed synthetic `owner-east` session and supports task assignment, independent check/return, and cancellation before a terminal state.
3. Both clients reject malformed or out-of-scope task data, send the current version, and refresh from the shared local service after a successful action.
4. Requests are limited to `http://127.0.0.1` on the configured local service port and to the exact session, staff-task, assignee, review, and synthetic student-option routes required by G3.1. Credentials are omitted. No request may go to a non-loopback origin.
5. Use only fixed catalog values and synthetic identities. Do not add free-text student data, attachments, persistence, external services, new routes, or page registration.
6. Preserve the current main-tree workbench, Admin staff page, and unrelated edits. Do not copy a whole source `main.ts`, shared client aggregator, preview server, or package manifest.

## Exact write set

Control and roadmap:

- `PLANS.md` — record this contract, current sync status, and verification outcome.
- `docs/exec-plans/active/project-completion.md` — reconcile G3.1 main-tree status and remaining review gates.
- `docs/superpowers/plans/2026-10-08-g31-main-tree-selective-sync.md` — this contract.

User Web:

- `apps/user-web/src/local-synthetic/task-assignment.ts` (new; fixed-scope parser, renderer, and local task client).
- `apps/user-web/src/local-synthetic/task-assignment.test.ts` (new; parser, renderer, and client behavior).
- `apps/user-web/src/main.ts` (mount the shared task panel on the existing staff workbench; preserve other page logic).
- `apps/user-web/src/styles/user-web.css` (task-panel styling only).

Admin Web:

- `apps/admin-web/src/local-review/task-assignment.ts` (new; fixed-scope Admin task client and panel renderer).
- `apps/admin-web/test/task-assignment.test.mjs` (new; parser, assignment, and independent-check behavior).
- `apps/admin-web/src/main.ts` (mount the panel on the existing employee page and use an exact localhost route allowlist).

No other paths may be modified or created. In particular: no API, Mini, config, preview, dependency, lockfile, or protected `apps/mini-program/src/pages/staff.test.ts` changes.

## Implementation sequence

1. Add focused failing tests first for Web task parsing/scope, fixed choices, stale-version rejection, and Admin assignment/check behavior.
2. Implement only the two new task modules and their existing-page mounts. Keep each fetch transport constrained to the loopback service and this task's route allowlist.
3. Run a one-off Playwright browser workflow against the local service. It uses fixed catalog fields and checks one shared ID/version chain; restart the local in-memory demo service after verification to clear test-created state. The browser script is supplied through standard input and creates no repository file or dependency.
4. Update roadmap evidence and audit the exact write set. Do not change Owner Review or native WeChat DevTools acceptance to PASS.

## Verification

- User Web: focused task tests, typecheck, lint, build, and formatting checks on exact authored files.
- Admin Web: focused task tests, typecheck, lint, build, and formatting checks on exact authored files.
- Cross-client Playwright: assign one fixed task in `/admin/staff`, claim/start/complete it in `/staff/workbench`, then independently check it in `/admin/staff`; assert the same ID and sequential versions, and assert zero external requests/page errors. Use the already-installed local browser package only; do not install or add dependencies.
- Run `git diff --check`, inspect the exact scoped diff/status, and verify no protected or unrelated path changed.
- Report native WeChat DevTools visual clicks as `NOT_RUN`; browser tests do not substitute for native interaction.

## Verification outcome (2026-10-08)

- User Web task tests: 4/4; typecheck, build, and targeted ESLint pass. Admin Web task tests: 4/4; TypeScript build and targeted ESLint pass.
- Cross-client browser workflow: one synthetic task ID was created in Admin, observed unchanged by ID in User Web, then transitioned through versions 1→2→3→4→5 (assign, claim, start, complete, independent check). Zero external requests and zero page errors.
- The integrated local demo was gracefully restarted before and after browser verification; temporary in-memory task records were cleared. The final launcher preflight passed and the local demo is running on loopback.
- Prettier passes for the new task modules/tests, task-panel CSS, contract and execution-plan notes, and both edited G3.1 mount-function regions. Full-file Prettier remains `NOT_PASS` for `PLANS.md` and the two previously dirty web `main.ts` files; their unrelated existing contents were preserved instead of reformatting the whole files.
- `git diff --check` and exact-write-set review are recorded in `PLANS.md`. Owner Review remains pending; native WeChat DevTools clicks remain `NOT_RUN`.

## Stop conditions

Stop if either existing page cannot host the panel without changing an out-of-scope route/configuration, if the shared local service contract is inconsistent with the source contract, if a fetch would leave loopback, or if any dependency, lockfile, real data, persistence, or protected path change becomes necessary. Preserve unrelated work and report the exact blocker.

Status at completion: `PARTIAL_VERIFICATION;LOCAL_SYNTHETIC_WEB_FLOW_PASS;OWNER_REVIEW_PENDING;NATIVE_DEVTOOLS_NOT_RUN`.
