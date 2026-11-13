# TASK20 G3.2 Main-Tree Web Daily Sync

Date: 2026-10-08

## Authority and audit findings

- Product authority: `student-care-platform-complete-plan-v2.0.pdf`, SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`.
- G3.2 source implementation contract: `docs/superpowers/plans/2026-10-07-g32-staff-daily-source-linkage.md`, SHA-256 `86B6C05DBB4A2A242EC35045B3A07DA86A9841A62C845948B5969C286791659A`.
- Authority: the user's standing direction to continue local synthetic development autonomously. This sync remains a local-only extension of that scope.
- Read-only comparison on 2026-10-08 found the G3.2 Core API contracts, repository, service, and tests byte-identical between source and main trees. The Mini shared client, page model, Page controller/WXML/WXSS, and three compiler outputs are also byte-identical. No API or Mini copy is needed.
- The main tree lacks the User Web and Admin Web daily-report modules. User Web's source module depends on a shared `client.ts` that is absent in the main tree. The Admin source worktree exposes a separate review URL, which this sync will not add. Instead, both functions will be adapted into existing routes with narrow, local-only clients.
- Existing pages: User Web `/staff/report`; Admin Web `/admin/staff`. Preserve their current G3.1 and other content.

## Goal

Make the existing User Web employee report page and Admin Web employee page complete the shared G3.2 daily-report lifecycle using the already-present local service and the same report ID/version:

`teacher creates draft → submits → owner returns → teacher resubmits → owner confirms`

Only fixed choices and synthetic identities are used. Category counts may be shown; source payloads and student identities must remain hidden.

## Required behavior

1. User Web uses the fixed synthetic `teacher-east` session to create, list, submit, and resubmit daily reports on `/staff/report`.
2. Admin Web uses the fixed synthetic `owner-east` reviewer on `/admin/staff` to view its authorized queue and confirm or return reports.
3. Both clients validate campus/class scope and current version, refresh from the existing local service after actions, omit credentials, and allow only loopback API requests and the exact routes needed for G3.2.
4. Show only fixed-choice values, report status/version, and counts for TASK, ATTENDANCE, PICKUP, and PICKUP_EXCEPTION references. Never render source IDs, student IDs/names, or source payloads.
5. Parent-facing routes cannot read internal reports. No new web route, API endpoint, page registration, storage, dependency, or external service is added.
6. Keep G3.1 task assignment and all existing dirty/untracked content intact. Do not copy either source `main.ts` wholesale.

## Exact write set

1. `PLANS.md` — record this contract, state, and verification.
2. `docs/exec-plans/active/project-completion.md` — reconcile G3.2 main-tree status and evidence.
3. `docs/superpowers/plans/2026-10-08-g32-main-tree-web-sync.md` — this contract.
4. `apps/user-web/src/local-synthetic/staff-daily.ts` — new minimal fixed-scope parser, renderer, and local client adapted for the main tree.
5. `apps/user-web/src/local-synthetic/staff-daily.test.ts` — new focused tests.
6. `apps/user-web/src/main.ts` — mount the daily panel on the existing `/staff/report` page only.
7. `apps/user-web/src/styles/user-web.css` — append only the daily panel styles.
8. `apps/admin-web/src/local-review/staff-daily.ts` — new minimal fixed-scope reviewer parser, renderer, and local client.
9. `apps/admin-web/test/staff-daily.test.mjs` — new focused tests.
10. `apps/admin-web/src/main.ts` — mount the reviewer panel within the existing `/admin/staff` page only.

No other path may be created or modified. In particular: no API, Mini, preview server, route registration, config, test fixture, dependency, lockfile, `staff.test.ts`, `app.json`, or `index.json` change.

## Implementation and verification sequence

1. Add focused failing tests first for fixed choices, strict scope parsing, route allowlists, credentials omitted, stale-version rejection, and fixed role behavior. Observe the expected RED results before implementation.
2. Implement the two small local clients and panel renderers; mount them into the existing pages without copying whole files or adding routes.
3. Run User Web and Admin focused tests, TypeScript checks/builds, targeted ESLint, Prettier on authored files and edited regions, `git diff --check`, and exact write-set review.
4. Use a one-off Playwright script via standard input against the running local demo. Click the complete lifecycle on one synthetic record, verify the same ID and version sequence, test parent denial, and assert no external requests/page errors. Do not create a script or screenshot file.
5. Restart the approved local demo after browser testing to clear volatile synthetic records. Confirm it is ready on loopback.
6. Perform a fresh diff/security review. Keep G3.2 Owner Review pending and native WeChat DevTools clicks `NOT_RUN`.

## Stop conditions

Stop if any required source cannot be integrated into the two existing pages without a new route, if a local request would leave loopback, if the main API/Mini byte-identity assumption changes, or if a protected/out-of-scope file, real data/service, dependency, or persistent storage becomes necessary. Preserve existing working-tree content and report the exact blocker.

Status at creation: `IN_PROGRESS`.

## Completion evidence (2026-10-08)

- Status: `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW`. The existing User Web `/staff/report` and Admin Web `/admin/staff` routes now complete the shared daily-report workflow. API and Mini source were not changed; no new route, dependency, persistent storage, real service, or real data was introduced.
- Tests: User Web full suite 24/24; User daily/task focused tests 7/7; Admin daily/task focused tests 6/6; User/Admin typechecks and builds pass; targeted ESLint passes. Authored files and the edited `main.ts` regions pass Prettier. `git diff --check` and exact write-set audit pass.
- Browser verification: on one synthetic report ID, create draft, submit (v2), return (v3), resubmit (v4), and confirm (v5) all passed. Parent-session access to `/local/staff-daily-owned` returned 403. External requests: 0. Browser page errors: 0.
- The Admin Web full package suite remains 4/5 because its existing static assertion in `test/home-content.test.mjs` matches `globalThis.fetch` in the pre-existing Health Incident loopback preview callback in `src/main.ts`. Neither out-of-scope file was changed; the daily/task focused suite passes 6/6.
- The approved local demo was restarted after browser testing. It is ready on API `127.0.0.1:4317`, User Web `127.0.0.1:12159`, and Admin Web `127.0.0.1:12160`; employee and reviewer queues are empty. This clears only in-memory synthetic test rows.
- Owner Review remains pending. Native WeChat DevTools clicks remain `NOT_RUN` and are not inferred from browser verification.
