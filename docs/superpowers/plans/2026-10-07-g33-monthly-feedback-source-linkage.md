# TASK20 G3.3 — Monthly feedback source linkage and Mini shared projection

## 0. Authority and baseline

- Roadmap authority: `docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md`; current control plane: `PLANS.md` and `docs/exec-plans/active/project-completion.md`.
- G3.2 daily source linkage is locally verified in isolated worktrees and remains `PASS_LOCAL_SYNTHETIC_PENDING_OWNER_REVIEW`; this contract does not change that state or claim main-tree business integration.
- The user authorized autonomous continuation of the project roadmap. Work remains in the existing isolated worktrees; use synthetic in-memory records only. No real identity, child data, authentication, database, persistence, external network/service, formal AI, dependencies/lockfile changes, main-tree business-code integration, commit, push, deployment, or release.
- Existing monthly feedback routes, status lifecycle, fixed-choice supplements, scope checks, and parent relationship checks are reused. No new route or page registration is allowed.

## 1. Goal and source rules

Replace placeholder monthly source labels/version counters with auditable references to eligible existing records, and connect the Mini employee and parent monthly-feedback views to the same shared local service used by Web and Admin.

For the feedback month, the server derives all source rows from the active session's tenant, campus, and class scope:

- published, confirmed growth records in the month;
- completed attendance entries in the month with no pending correction;
- confirmed employee daily reports in the month.

Each internal reference contains only a fixed source kind, opaque record ID, record version, and service date. It contains no student identity, note, free text, medical detail, or source payload. Staff may see fixed source labels, dates, and category counts. Parent projections continue to expose only month, status, the four approved fixed summary items, and acknowledgement state; they must never include source references or internal review data.

Creating or rebuilding a draft snapshots current eligible references. Reads and explicit source refresh compare the snapshot to current scoped rows. A source change updates the source version and invalidates an already published summary to `REVIEW_REQUIRED`, clears its published/acknowledged state, and hides its previous items from the parent. `source-refresh` may remain as a refresh action but must inspect real source rows and must not manufacture a source change or increment a synthetic counter. Stale versions remain rejected.

Mini's existing staff quick-action page and parent home shared template must load and act on the same monthly feedback ID/version. Teacher create/submit, authorized reviewer confirm/return/publish, and parent read/acknowledge remain governed by existing service actions. The old offline monthly-feedback panel must no longer appear as though it were the shared workflow.

## 2. Non-goals

- No real data, identities, free-text content, persistence, external requests, notifications, or production services.
- No automatic ability, discipline, health, psychological, or academic conclusions.
- No parent visibility into internal source IDs, labels, review queues, or audit actions.
- No new route, page registration, app/project configuration, dependency, or lockfile change.
- No unrelated Mini redesign, old worktree cleanup, or main-tree business-code sync.
- Do not modify `apps/mini-program/src/pages/staff.test.ts`, `app.json`, any `index.json`, or paths outside this contract.

## 3. Exact write set

### Shared service worktree

`C:/Users/HU/.codex/worktrees/task20-local-shared-core`

- MODIFY `packages/contracts/src/monthly-feedback.ts`
- MODIFY `apps/api/src/local-synthetic/repository.ts`
- MODIFY `apps/api/src/local-synthetic/monthly-feedback.service.ts`
- MODIFY `apps/api/test/local-synthetic-monthly-feedback.test.ts`
- MODIFY `tests/local-synthetic/monthly-feedback.test.mjs`
- MODIFY `docs/exec-plans/active/monthly-feedback-core.md`

### User Web worktree

`C:/Users/HU/.codex/worktrees/task20-web-completion`

- MODIFY `apps/user-web/src/local-synthetic/client.ts`
- MODIFY `apps/user-web/src/local-synthetic/monthly-feedback.ts`
- MODIFY `apps/user-web/src/local-synthetic/monthly-feedback.test.ts`
- MODIFY `apps/user-web/src/main.ts`
- MODIFY `apps/user-web/test/monthly-feedback-browser.mjs`
- MODIFY `docs/exec-plans/active/web-monthly-feedback.md`

### Admin Web worktree

`C:/Users/HU/.codex/worktrees/task20-admin-completion`

- MODIFY `apps/admin-web/src/local-review/monthly-feedback.ts`
- MODIFY `apps/admin-web/src/main.ts`
- MODIFY `apps/admin-web/test/monthly-feedback.test.mjs`
- MODIFY `docs/exec-plans/active/admin-monthly-feedback.md`

### Mini worktree

`C:/Users/HU/.codex/worktrees/task20-mini-brand-redesign`

- MODIFY `apps/mini-program/src/local-synthetic/client.ts`
- MODIFY `apps/mini-program/src/local-synthetic/client.test.ts`
- MODIFY `apps/mini-program/src/local-synthetic/page.ts`
- MODIFY `apps/mini-program/templates/local-synthetic.wxml`
- MODIFY `apps/mini-program/pages/staff/quick-action/index.ts`
- MODIFY `apps/mini-program/pages/staff/quick-action/index.wxml`
- MODIFY `apps/mini-program/pages/staff/quick-action/index.wxss`
- MODIFY `tests/mini-shared-service.test.mjs`
- MODIFY `docs/exec-plans/active/mini-monthly-feedback.md`
- MODIFY generated `apps/mini-program/src/local-synthetic/client.js`, `apps/mini-program/src/local-synthetic/page.js`, and `apps/mini-program/pages/staff/quick-action/index.js` only when the TypeScript compiler reports changed output.

### Main worktree control plane only

- CREATE this contract.
- MODIFY `PLANS.md` with this contract SHA and active G3.3 status.
- MODIFY `docs/exec-plans/active/project-completion.md` with evidence and remaining gates.
- No business source code in the main worktree.

## 4. TDD and verification

1. Add failing API tests for exact same-scope/month source selection, source ID/version/date capture, excluded unpublished/pending/out-of-scope records, parent projection secrecy, and source-change invalidation without fabricated refreshes.
2. Implement actual source snapshots and comparison in the existing service; preserve fixed-choice input, tenant/campus/class authorization, status versions, audit, and parent relationship checks.
3. Add Web/Admin parser and rendering tests; browser flows must create or change real local synthetic source records, then verify staff refresh/review and that parent summaries hide immediately until re-approved.
4. Add Mini shared-client/page tests before UI wiring. Verify one feedback ID/version across teacher, reviewer, and parent; parent sessions request only the parent projection; source references never enter parent view; stale and unauthorized actions fail.
5. Run focused API/Web/Admin/Mini tests, typechecks, ESLint, Prettier, actual Web/Admin preview browser checks, Mini loopback/Page tests, Mini runtime freshness guard, `git diff --check`, and exact write-set audits. Update only compiler-reported Mini JavaScript outputs.
6. Perform a fresh privacy/security and diff review. WeChat DevTools manual clicks remain `NOT_RUN` unless actually performed; no test or screenshot may be described as native acceptance.

## 5. Acceptance criteria

- Monthly feedback source references point to actual eligible same-scope/month records and contain only fixed kind, opaque ID, version, and date.
- A real source change invalidates an already published parent summary; parent sees no stale items until a fresh human review and publication.
- Web, Admin, and Mini use the same monthly feedback ID/version; Mini parent home can view and acknowledge only the safe fixed summary.
- No artificial source counter action remains; refresh reads current source records.
- All changed paths are in this write set; no dependency/lockfile, route/configuration, or external-service changes.

## 6. Stop conditions

Stop the affected lane and report if the current baseline conflicts with G3.2, a required path falls outside this write set, source scope cannot be derived from the session, parent output would require internal data, tests require changing protected files, or a route/configuration/dependency/external service appears necessary. Preserve every unrelated dirty or untracked path.

Initial status: `IN_PROGRESS`.
