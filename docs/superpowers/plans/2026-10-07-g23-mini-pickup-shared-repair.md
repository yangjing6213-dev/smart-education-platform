# TASK20 G2.3 Mini Pickup Shared Integration and Regular Window Repair

STATUS=IN_PROGRESS_LOCAL_SYNTHETIC
DATE=2026-10-07

## Goal

Close the G2.3 Mini gap by connecting the already registered parent-home and staff quick-action shared panels to the existing local synthetic pickup service. First reproduce and repair the service mismatch where `REGULAR` authorizations are described as daily windows but are evaluated as one continuous start-to-end interval.

Only synthetic profiles and data are allowed. This task does not make pickup suitable for real student release.

## Scope and boundaries

- Parent Mini flow: list own authorizations for the selected approved child; create a regular or one-day temporary draft with fixed synthetic recipients and explicit dates/times; activate only after a separate confirmation tap; issue a short-lived service credential for the current page; revoke an active authorization only after an explicit confirmation; view the parent's safe completed-pickup result.
- Staff Mini flow: read only the scoped pickup queue; submit the presented credential for a short-lived verification step; require all three manual checks before confirming departure; show the service record after success.
- Teacher exception entry and owner follow-up use only the existing fixed categories and outcomes. An exception never creates or implies a successful pickup.
- Use only existing routes under `/local/pickup-*`. Do not add a parent acknowledgement endpoint or claim a notification was delivered; the service has no parent confirmation action for pickup results.
- For `REGULAR`, the start/end dates are inclusive and the time window applies separately on every Shanghai calendar day in that range. `TEMPORARY` remains a single-day interval.
- Credentials and verification steps stay transient in page memory, clear on identity/student change, page hide, revoke, expiry, disconnect, or error, and must not appear in logs or ordinary list projections.
- No new page or route. Use the existing registered parent home, staff quick-action page, shared client/page adapter, and shared WXML template.

## Exact write set

Main worktree governance:

- `PLANS.md` — record this contract, its hash, status, and evidence.
- `docs/exec-plans/active/project-completion.md` — make G2.3 the current in-progress target and record the outcome.
- `docs/superpowers/plans/2026-10-07-g23-mini-pickup-shared-repair.md` — this task contract.

Shared-core worktree `C:\Users\HU\.codex\worktrees\task20-local-shared-core`:

- `apps/api/src/local-synthetic/pickup.service.ts` — correct only the `REGULAR` daily-window predicate if the regression is reproduced.
- `apps/api/test/local-synthetic-pickup.test.ts` — add the fixed-clock regression coverage.
- `docs/exec-plans/active/pickup-regular-window-repair.md` — record baseline, reproduction, fix, and verification.

Mini worktree `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`:

- `apps/mini-program/src/local-synthetic/client.ts` — typed pickup projections, existing route allowlist, role-gated reads and commands.
- `apps/mini-program/src/local-synthetic/client.js` — update only when regenerated from the changed TypeScript source and content differs.
- `apps/mini-program/src/local-synthetic/page.ts` — connect the existing parent/staff pages to pickup reads/actions and transient page state.
- `apps/mini-program/src/local-synthetic/page.js` — update only when regenerated from the changed TypeScript source and content differs.
- `apps/mini-program/src/pages/shared-pickup.test.ts` — new source/generated actual-Page tests against the local synthetic server, including route allowlisting, response validation, role gates, and secret-free state.
- `apps/mini-program/templates/local-synthetic.wxml` — add the compact parent and staff controls and clarify that only the remaining modules are offline-only.
- `docs/exec-plans/active/mini-pickup-shared-integration.md` — record baseline, implementation, verification, and native-tool status.

Before editing, record each worktree's branch, HEAD, target-file state, and diff baseline. Preserve all other existing changes and untracked paths. Any necessary path outside this write set stops this task until its scope is reviewed and explicitly recorded; do not work around that boundary.

## Acceptance and verification

1. Add and run a fixed-clock API regression first. It must fail on the current implementation for a middle day outside the daily `REGULAR` hours, then pass after the narrow predicate repair. Keep `TEMPORARY` single-day behavior unchanged.
2. Verify the Mini client uses only the existing pickup routes, validates service responses, gates operations by the returned session actions, and clears credentials/checks after identity changes, page hide, expiry, revoke, and errors.
3. Exercise parent authorization draft → explicit activation → credential issue → staff credential check → three manual checks → service confirmation → parent safe result through actual registered Mini Page handlers, with the same in-memory service and synthetic profiles. Also cover fixed exception entry/review, wrong-role/stale events, identity change, and no credential leakage.
4. Run focused API tests/typecheck/lint/format and Mini source plus generated Page tests, TypeScript check, lint/format, page registration/runtime guard, `git diff --check`, and exact write-set audit.
5. Attempt native WeChat DevTools review only if its automation channel is available. If it times out or is unavailable, report native review `NOT_RUN` or `PARTIAL`; do not label the whole pickup workflow accepted.

## Exclusions

No fees, notices, attendance redesign, unrelated workflows, new routes/pages/configuration, protected `apps/mini-program/src/pages/staff.test.ts`, app/page registration files, API route/schema changes, dependencies, lockfiles, real authentication, real data, network services, database, partner cloud, formal AI, persistent storage, commit, push, deploy, upload, or release.

## Stop conditions

Stop and report if the baseline cannot be identified, the regression test does not reproduce, the existing API contract is insufficient for this scope, the worktree conflicts with the exact write set, native verification would require changing configuration or adding tools, or any excluded path/service becomes necessary.
