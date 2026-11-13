# TASK20 G3.2 — Employee daily report source linkage

## 0. Authority and current baseline

- Project route: `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`, G3.2; current state is recorded in `docs/exec-plans/active/project-completion.md` and `PLANS.md`.
- G3.1 task assignment/check is locally implemented in its isolated lanes and remains `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW`; this contract does not change that review state or claim main-tree business integration.
- User authorization: continue the approved local project roadmap autonomously and enter the next batch. This task covers only G3.2 internal daily-report source linkage and Mini shared-service integration.
- Work remains in the existing isolated worktrees listed below. Use conspicuously synthetic in-memory records only. No real organization, child data, authentication, database, storage, external network/service, formal AI, dependency/lockfile change, commit, push, deployment, release, or main-tree business-code integration.
- Existing G3.2 fixed fields, return/resubmit lifecycle, reviewer permissions, and route registrations remain in place. No new page or route is allowed.

## 1. Goal and behavior

Attach auditable source references to internal employee daily reports and make the existing Mini daily-report controls use the same local shared service and report ID/version as Web and Admin.

When an authorized employee creates a report for a date, the local service automatically snapshots references from that employee's server-derived tenant, campus, and single class scope:

- checked staff tasks whose due date equals the report date;
- attendance rows for the report date;
- pickup records for the report date;
- pickup exceptions for the report date.

Each stored reference contains only a fixed source kind, opaque source ID, and source version. It contains no student ID/name, free text, medical detail, or other source payload. The report's existing fixed-choice fields remain manually selected and editable; source references do not automatically infer health, safety, behavior, or learning conclusions. Editing a draft or resubmitting a returned report refreshes its reference snapshot for that date. The author and authorized reviewer can see category counts; parent-facing reads must never return internal reports or references.

Mini's existing staff quick-action page must load, create, submit, return, resubmit, and review these same service-backed daily reports. It must not keep presenting the separate offline-only daily workflow as if it were shared. Existing Web/Admin daily endpoints and role checks are reused; no new endpoint is needed.

## 2. Non-goals and safety boundaries

- No real data, identities, credentials, photos, free-text child records, persistence, external requests, notifications, or production services.
- No parent daily-report visibility or publication flow.
- No new route, page registration, app/project configuration, dependency, or lockfile change.
- No unrelated Mini visual redesign, old worktree cleanup, or main-tree business-code sync.
- Do not change `apps/mini-program/src/pages/staff.test.ts`, `app.json`, any `index.json`, or any path outside this contract.

## 3. Exact write set

### Shared local service worktree

`C:/Users/HU/.codex/worktrees/task20-local-shared-core`

- MODIFY `packages/contracts/src/staff-daily.ts`
- MODIFY `apps/api/src/local-synthetic/repository.ts`
- MODIFY `apps/api/src/local-synthetic/staff-daily.service.ts`
- MODIFY `apps/api/test/local-synthetic-staff-daily.test.ts`
- MODIFY `tests/local-synthetic/staff-daily.test.mjs`
- MODIFY `docs/exec-plans/active/staff-daily-core.md`

### User Web worktree

`C:/Users/HU/.codex/worktrees/task20-web-completion`

- MODIFY `apps/user-web/src/local-synthetic/staff-daily.ts`
- MODIFY `apps/user-web/src/local-synthetic/staff-daily.test.ts`
- MODIFY `apps/user-web/test/staff-daily-browser.mjs`
- MODIFY `docs/exec-plans/active/web-staff-daily.md`

### Admin Web worktree

`C:/Users/HU/.codex/worktrees/task20-admin-completion`

- MODIFY `apps/admin-web/src/local-review/staff-daily.ts`
- MODIFY `apps/admin-web/test/staff-daily.test.mjs`
- MODIFY `docs/exec-plans/active/admin-staff-daily.md`

### Mini worktree

`C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign`

- MODIFY `apps/mini-program/src/local-synthetic/client.ts`
- MODIFY `apps/mini-program/src/local-synthetic/page.ts`
- MODIFY `apps/mini-program/src/local-synthetic/client.test.ts`
- MODIFY `apps/mini-program/pages/staff/quick-action/index.ts`
- MODIFY `apps/mini-program/pages/staff/quick-action/index.wxml`
- MODIFY `apps/mini-program/pages/staff/quick-action/index.wxss`
- MODIFY `docs/exec-plans/active/mini-staff-daily.md`
- MODIFY generated `apps/mini-program/src/local-synthetic/client.js`, `apps/mini-program/src/local-synthetic/page.js`, and `apps/mini-program/pages/staff/quick-action/index.js` only when the compiler reports changed output.

### Control-plane records in the main worktree

- CREATE this contract.
- MODIFY `PLANS.md` to record this exact contract SHA and active status.
- MODIFY `docs/exec-plans/active/project-completion.md` to record verified G3.2 progress and remaining gates.
- No business source code in the main worktree.

## 4. TDD and verification

1. In the API lane, first add a failing service test proving that report creation attaches only eligible same-date, same-tenant/campus/class source references, includes each allowed source category, excludes out-of-scope or other-date records, and returns only `{kind, id, version}`. Also test refresh on edit/resubmit and parent denial.
2. Implement the smallest server-derived source snapshot and contract/repository type change. Preserve existing role, scope, version, fixed-choice and audit behavior.
3. Add Web and Admin tests before changing their projection/rendering. Show category counts and the captured source version without exposing child identity or source payload.
4. Add Mini client tests before wiring its existing page. The same teacher-created report must appear in the authorized reviewer queue with the same ID/version; stale and unauthorized actions remain rejected. Parent Mini sessions must not load internal daily rows.
5. Run focused API, Web, Admin and Mini tests; relevant typechecks, ESLint, Prettier, Mini runtime freshness guard, actual local preview/loopback checks where available, `git diff --check`, and exact write-set audits in every lane.
6. Perform a fresh manual diff/security review after tests. WeChat DevTools visual clicks are a separate gate: if no automation controller is available, record `NOT_RUN`; do not infer native acceptance from source tests.

## 5. Acceptance criteria

- Same-scope source references are server-derived, date-filtered, versioned, and limited to the four fixed kinds above.
- Report fields remain fixed-choice and editable; references refresh only on draft edit/returned resubmit.
- Internal references are visible only to the author and permitted reviewer; parent and platform-only sessions cannot read them.
- Web, Admin, and Mini operate on the shared local report ID/version and show concise source-category counts; no offline-only Mini daily state is presented as shared.
- Existing routes, page registration, privacy boundaries, return/resubmit behavior, and unrelated working-tree contents remain intact.
- Every changed path is in this exact write set; no dependency/lockfile or generated JS changes without actual compiler output differences.

## 6. Stop conditions

Stop the affected lane and report the exact reason if a required path falls outside this write set, the current lane no longer contains the stated G3.1/G3.2 baseline, a test requires changing protected files, the shared data cannot be safely scoped from the server session, or a new route/configuration/dependency/external service appears necessary. Do not silently expand the write set or repair unrelated pre-existing failures.

Initial status: `IN_PROGRESS`.
