# TASK20 Phase 2 M32G Coverage Matrix Implementation Plan

> **For agentic workers:** Execute this documentation-only audit inline. Keep all application code unchanged. Each checkbox records a completed audit action.

**Goal:** Compare current synthetic User Web, Admin Web and Mini Program evidence against V3 M3.2, record every known gap, and set a verified target sequence for M3.3 through M6 without claiming unfinished or locally simulated work is production-ready.

**Architecture:** Read the V3 plan and existing source/test evidence from the isolated implementation worktree. Record the object-by-client matrix and next goals in this plan and `PLANS.md`; this task changes no business code and does not integrate the isolated worktree into the main tree.

**Tech Stack:** Markdown, Git metadata, `rg`, existing Node tests and local browser evidence already produced by M32F.

---

## Authority and write set

- V3 source: `docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md`
- V3 SHA-256: `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38B`
- M32F implementation worktree: `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`
- M32F contract: `docs/superpowers/plans/2026-10-01-task20-phase2-m32f-care-record-synthetic.md`
- M32F contract SHA-256: `FF253AEE7F5974BD99AD1C9B5158FAE86C55CB889D5FEF6EB1680A301ECC3EBC`
- Exact write set for this audit: `PLANS.md` and this plan file only.
- Prohibited: application code, tests, Mini page configuration, generated JavaScript, dependencies, lockfiles, main-tree business synchronization, commit, push, deployment and release.

## Audit findings

| V3 M3.2 object     | User Web evidence                                                                                                                                                                             | Mini evidence                                                                                                                        | Admin Web evidence                                                                                                                                          | Current finding                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `Student`          | Parent binding and update projections require the approved synthetic student and exact scope; `apps/user-web/src/pages/parent-binding.test.ts`, `parent-updates.test.ts`                      | Equivalent binding/update gates; `apps/mini-program/src/pages/parent/binding.test.ts`, `parent/updates.test.ts`                      | No student-detail management is included in the M3.2 review screens                                                                                         | Sufficient only as a synthetic scope reference; no student administration or real student records                                            |
| `GuardianRelation` | Ordered application, consent, same-scope review, reject, release and replacement; `apps/user-web/src/pages/parent-binding.test.ts`                                                            | Same local relation flow; `apps/mini-program/src/pages/parent/binding.test.ts`                                                       | No separate Admin Web relation-management screen                                                                                                            | M3.1 relationship demonstration exists; all effects remain local and role-simulated                                                          |
| `CareRecord`       | M32F fixed-choice create/submit/review/return/resubmit/withdraw, batch atomicity, separate publish/revoke and parent read/ack; 8 focused tests                                                | M32F staff and parent path; 5 focused tests                                                                                          | M32F scope-limited confirm/return and anonymous aggregate-only platform view; 3 focused tests                                                               | Implemented locally in all three clients; no cross-client synchronization; M32F Owner Review and Mini DevTools visual review remain pending  |
| `Leave`            | Guardian fixed-choice request, withdrawal, scoped individual/batch review and parent receipt; `parent-leave.test.ts`, `staff-leave-review.test.ts`                                            | Fixed-choice request, scoped review, return/resubmit, cancellation and receipt; `parent/leave.test.ts`, `staff/leave-review.test.ts` | Scoped review model and aggregate-only platform role; `apps/admin-web/test/leave-review.test.mjs`                                                           | Synthetic local flows exist; prior Owner Review evidence is recorded in `PLANS.md`; post-layout Mini DevTools recheck remains `NOT_RUN`      |
| `Notice`           | Parent Web list/detail/read/ack, versioned receipt, scope and revocation tests; `parent-updates.test.ts`                                                                                      | Parent Mini equivalent; `parent/updates.test.ts`                                                                                     | No distinct scoped Notice author/review/publish/revoke workflow is present in the M32.2 Admin pages; generic home-content publication is a different object | Parent consumption is covered, but V3 notice authoring/review coverage needs a separately scoped gap task before M3.2 can be declared closed |
| `HealthIncident`   | Fixed-choice report, six workflow states, scoped review, batch validation, separate publication/revocation and parent projection; `health-incident-workflow.test.ts`, `parent-health.test.ts` | Equivalent fixed-choice report/review/publication and parent receipt; `health-incidents.test.ts`, `parent/health.test.ts`            | Scoped review and aggregate-only platform projection; `health-incident-review.test.ts`                                                                      | Synthetic client flows exist; M32E Owner Review remains pending                                                                              |
| `ConsentRecord`    | Binding consent is explicit and purpose-bound; parent update visibility requires active, matching consent; `parent-binding.test.ts`, `parent-updates.test.ts`                                 | Matching explicit consent and release/replacement clearing; `parent/binding.test.ts`, `parent/updates.test.ts`                       | No distinct consent-review screen; current use is an access gate for local demonstrations                                                                   | Consent is represented and checked, but no standalone consent history/withdrawal management workflow is evidenced                            |

### Cross-cutting M3.2 findings

1. V3's six workflow states are implemented for the status-bearing CareRecord, Leave and HealthIncident flows. Student and GuardianRelation use their own binding lifecycle; Notice uses read/acknowledgement states; ConsentRecord is a purpose-bound access record. M32G must preserve these domain-specific lifecycles rather than inventing irrelevant states.
2. Role, tenant, campus, class and active relationship checks are tested in the existing models. Admin platform roles are aggregate-only for CareRecord and HealthIncident and do not receive row details.
3. User Web, Mini and Admin demonstrations keep separate in-memory state. No cross-client sync, remote notification delivery or shared backend is claimed.
4. The missing Admin Notice management evidence is a real M3.2 closure gap. Create a narrow M32H contract for synthetic Admin Web Notice author/review/publish/revoke and verify that parent Web/Mini consume only explicitly published, same-scope fixtures. Do not broaden this into shared storage, networking or real notifications.
5. The existing consent gate is sufficient for the current synthetic binding/update demo; any standalone consent history or withdrawal screen requires a separate V3 traceability decision and must not be assumed in M32H.

## Remaining V3 goals and acceptance targets

| Goal                                              | User Web                                                                            | Admin Web                                                                                    | Mini Program                                                                                                                    | Acceptance target                                                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M32H: close the Notice management gap             | Read only published, matching synthetic notices and keep separate read/ack receipts | Fixed synthetic author/review/publish/revoke; scope checks and anonymous-only platform view  | Read only published same-scope notices; separate read/ack; clear receipts on relation changes                                   | Focused tests cover publish gate, revoke, stale version, duplicate acknowledgement and scope denial; E2E proves no network/storage and no cross-client-sync claim |
| M3.3: pickup authorization and record             | Parent sees valid synthetic authorization and event history                         | Review scope, exception queue and metadata-only audit                                        | Fast manual identity check, teacher confirmation, block invalid/revoked/foreign/repeated pickup, show local parent-notice state | No face recognition; no valid authorization, campus mismatch, revoked authorization, duplicate pickup and anomaly all fail closed                                 |
| M4.1: staff task lifecycle                        | View assigned tasks and authorized-class history                                    | Create/assign/review synthetic tasks with owner, scope, due date, priority, result and audit | Fast task view and idempotent start/complete actions                                                                            | Daily/temporary/student/activity/emergency types; pending/in-progress/done/overdue/cancelled; duplicate actions idempotent; cross-scope denial                    |
| M4.2: monthly teacher feedback                    | Parent sees only a confirmed summary                                                | Lead reviewer edits/confirms/returns a draft assembled from approved synthetic sources       | Teacher reviews and submits a draft; no automatic parent send                                                                   | Draft → teacher edit → lead confirm/return → parent summary; sensitive conclusions and capability/discipline labels forbidden                                     |
| M4.3: teaching resources and knowledge            | Search, filter, favorite and recent-use views                                       | Maintain synthetic source/owner/version/scope/expiry/revoke fields                           | Quick search/read and favorites for authorized resources                                                                        | Tests cover version changes, expired/revoked items, scope filters and absence of student data                                                                     |
| M5.1: constrained learning hints                  | Parent/teacher controls and a safe progress summary                                 | Review synthetic safety aggregates and disable the demonstration                             | Student tries first, then receives hint levels 0/1/2/3 and a reinforcement question                                             | No direct answer, homework writing, exam cheating, open-ended chat, emotional companionship, diagnosis or automatic ability labels                                |
| M5.2: safety and manual takeover                  | Opt out and delete local demo state                                                 | Review versioned, synthetic safety measures and manual handoff                               | Fixed refusal/fallback examples, teacher handoff and clear/close action                                                         | Test input boundaries, refusal/fallback, close/delete, reviewability and safety-event count; no formal AI/model integration                                       |
| M6.1: tenant/campus/role boundary                 | Demonstrate tenant and campus scoping                                               | Verify scoped roles, capabilities and aggregate-only platform view                           | Fail closed when actor, member, relation, tenant or campus changes                                                              | Negative tests cover cross-tenant/campus/class, revoked member/relation, altered role and stale actions                                                           |
| M6.2: operating/finance/recruitment/license views | Read synthetic summaries only                                                       | Synthetic read-only FeeItem/Bill/Payment/Refund/StaffPerformance/License/Recruitment views   | Show only role-appropriate read-only snapshots                                                                                  | No payment, financial writes, personal data, real recruitment or license submission                                                                               |
| M6.3: environment/recovery/supply chain           | Document environment and release boundaries                                         | Document key handling, logs, alerts, backup/restore and rollback requirements                | Document client build/config boundaries                                                                                         | Planning and local checks only; any cloud write, production secret, deployment, upload or release requires a separate explicit contract                           |

## Tasks

### Task 1: Verify the plan baseline

- [x] Read the V3 M3.2–M6 requirements and verify the fixed V3 SHA-256.
- [x] Read the M32F 21-path contract and verify its fixed SHA-256.
- [x] Check exact M32F focused tests, builds/typechecks, source lint/format, E2E, page guard and diff check in the implementation worktree.

### Task 2: Complete the seven-object coverage audit

- [x] Trace each object to User Web, Mini and Admin evidence using the exact files in the matrix.
- [x] Record Notice author/review/publish/revoke as the remaining M3.2 gap.
- [x] Keep Owner Review and Mini native DevTools status separate from automated local PASS results.

### Task 3: Set the next goals

- [x] Order M32H before M3.3 so M3.2 is not closed while Notice review is absent.
- [x] Break M3.3, M4, M5 and M6 into surface-specific acceptance targets above.
- [x] Keep real services, real personal data, model integration, deployment and release outside these synthetic targets.

### Task 4: Update the control plane

- [x] Update `PLANS.md` with M32F local verification, Owner Review still pending, M32G matrix result and the M32H/M3.3–M6 target order.
- [x] Confirm this documentation task wrote only `PLANS.md` and this plan file in the main workspace.
- [x] Run `git diff --check` in the main workspace and verify this plan's SHA-256.

## Verification commands and expected result

Run from `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`:

```powershell
node --test apps/user-web/dist/pages/care-record-workflow.test.js
node --test apps/admin-web/test/care-record-review.test.mjs
node --experimental-strip-types --test apps/mini-program/src/pages/care-records.test.ts
node --experimental-strip-types --test apps/mini-program/src/pages/mini-brand-ui.test.ts
node --experimental-strip-types --test tests/e2e/care-record-review.spec.ts
corepack pnpm --filter @student-care/user-web build
corepack pnpm --filter @student-care/admin-web build
corepack pnpm --filter @student-care/admin-web typecheck
corepack pnpm exec tsc -p apps/mini-program/tsconfig.json --noEmit
corepack pnpm exec eslint apps/user-web/src/main.ts apps/user-web/src/pages/staff-report.tsx apps/user-web/src/pages/care-record-workflow.ts apps/user-web/src/pages/care-record-workflow.test.ts tests/e2e/care-record-review.spec.ts apps/user-web/src/pages/parent-home.ts apps/mini-program/src/pages/care-records.ts apps/mini-program/src/pages/care-records.test.ts apps/mini-program/src/pages/parent/session.ts apps/mini-program/pages/staff/quick-action/index.ts apps/mini-program/pages/parent/home/index.ts apps/admin-web/src/main.ts apps/admin-web/src/pages/care-record-review.tsx apps/admin-web/test/care-record-review.test.mjs
corepack pnpm exec prettier --check apps/user-web/src/main.ts apps/user-web/src/pages/staff-report.tsx apps/user-web/src/pages/care-record-workflow.ts apps/user-web/src/pages/care-record-workflow.test.ts tests/e2e/care-record-review.spec.ts apps/user-web/src/pages/parent-home.ts apps/mini-program/src/pages/care-records.ts apps/mini-program/src/pages/care-records.test.ts apps/mini-program/src/pages/parent/session.ts apps/mini-program/pages/staff/quick-action/index.ts apps/mini-program/pages/parent/home/index.ts apps/admin-web/src/main.ts apps/admin-web/src/pages/care-record-review.tsx apps/admin-web/test/care-record-review.test.mjs
rtk git diff --check
```

Expected: all commands exit `0`; E2E reports `1/1`; each focused suite reports all tests passing; browser requests, localStorage and sessionStorage remain empty. TypeScript-generated Mini `.js` outputs are not passed through ESLint/Prettier because doing so would mutate compiler artifacts; authored source files are checked. WeChat DevTools visual review stays `NOT_RUN` until the owner performs it.
