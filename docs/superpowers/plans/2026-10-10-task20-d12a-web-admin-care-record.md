# TASK20_D12A_WEB_ADMIN_SHARED_CARE_RECORD

## Objective

Connect the existing User Web employee/parent care-record screens and Admin review screen to the existing loopback-only synthetic care-record API. One record created by `teacher-east` must keep the same ID through `owner-east` review/publication and `parent-alpha` read/acknowledgement.

This is local-only synthetic workflow work. The shared API implementation is read-only and outside this task.

## Exact write set

Implementation worktree: `C:\Users\HU\.codex\worktrees\task20-d12a-web-admin-care-record`.

- `apps/user-web/src/main.ts`
- `apps/user-web/src/pages/care-record-workflow.ts`
- `apps/user-web/src/pages/care-record-workflow.test.ts`
- `apps/user-web/src/local-synthetic/care-record-client.ts` (new)
- `apps/user-web/src/local-synthetic/care-record-client.test.ts` (new)
- `apps/user-web/preview.mjs`
- `apps/user-web/test/preview.test.mjs`
- `apps/admin-web/src/main.ts`
- `apps/admin-web/src/pages/care-record-review.tsx`
- `apps/admin-web/test/care-record-review.test.mjs`
- `apps/admin-web/src/local-review/care-record-client.ts` (new)
- `apps/admin-web/test/care-record-client.test.mjs` (new)
- `apps/admin-web/src/local-proxy.mjs`
- `apps/admin-web/test/preview.test.mjs`
- `tests/e2e/care-record-shared.spec.ts` (new)
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`
- `docs/superpowers/plans/2026-10-10-task20-d12-shared-care-record-cross-client.md`
- this contract

Seed the worktree only from these current source/test files and required read-only package manifests/configuration. Keep all destinations byte-for-byte verified before overlay. Selectively sync only the listed files after implementation; never replace a differing whole file without first merging its unrelated current content.

## Allowed behavior

- Create a fixed synthetic employee report using `teacher-east`, submit it, and show the service-returned ID/version.
- Review and publish as the API-authorized `owner-east`; review and publication remain separate actions.
- Show the published record to `parent-alpha` from the shared API and record read/acknowledgement against the same ID/version.
- Revoke publication and make the record disappear from the parent projection immediately after refresh.
- Fail closed when the loopback API is unavailable, the response is malformed, the profile lacks the needed action, or a record version is stale. Do not silently fall back to the local in-memory example state.
- Add a same-origin preview integration flow that exercises the User Web and Admin clients through their actual local preview proxies, asserts the exact ID/version across employee, reviewer, and parent handoffs, and confirms the client requests stay on loopback. The installed environment has no browser automation package or interaction controller, so DOM clicks and visual review are reported separately as not run.
- Permit the exact required `/local/care-records` session/read/write paths through the two existing loopback preview proxies; keep their current same-origin, loopback, payload-size, header, and no-query checks, and add regression coverage for both accepted and rejected paths.

## Prohibited

- No Mini files in this subtask; Mini is D12B and gets its own contract/worktree.
- No API, database, authentication, production service, external network, persistence, notification provider, or formal AI changes.
- No route additions, configuration changes, dependency installation, dependency manifest or lockfile changes.
- Do not modify `apps/mini-program/src/pages/staff.test.ts`.
- No commit, push, deployment, or release.

## Verification and acceptance

1. Write failing User Web and Admin adapter tests first. Run them against the actual existing local-synthetic server; verify the initial failure is due to the missing integration.
2. Run the adapter tests through this sequence: employee create/submit; owner review; owner publish; parent list/read/ack; owner revoke; parent refresh hides the record. Assert the exact same ID and incremented versions at every step.
3. Build User Web and Admin with the installed TypeScript compiler, then run the emitted User Web tests from `apps/user-web/dist/pages/care-record-workflow.test.js` and `apps/user-web/dist/local-synthetic/care-record-client.test.js`; run the Admin `.mjs` focused tests directly. The TypeScript test sources import emitted `.js` modules, so Node cannot run those source tests before compilation.
4. Run `apps/user-web/test/preview.test.mjs`, `apps/admin-web/test/preview.test.mjs`, and `tests/e2e/care-record-shared.spec.ts` with Node's built-in test runner; also run both typechecks, scoped ESLint, Prettier checks on authored modules/tests and `git diff --check`.
5. Audit all modified and generated files against the exact write set; confirm no `pnpm-lock.yaml`, Mini, API, config, or external-network change. Record source/destination SHA-256 values for selective sync.

## Stop conditions

Stop if the existing API cannot perform the flow without service changes, if the UI can only pass by keeping independent local state or seeding matching text, if the test requires a non-loopback request, or if any write outside the list above becomes necessary.

## Verification results (2026-10-10)

- User Web page/client tests: 13/13; Admin review/client tests: 5/5; User Web preview proxy: 1/1; Admin preview and proxy: 2/2; shared-ID preview integration flow: 1/1.
- User Web TypeScript build and static browser-asset validation passed; Admin TypeScript build passed. The E2E flow also confirmed the employee report, reviewer actions, and parent projection retain one ID through acknowledgement and revocation, with each workflow version increment checked.
- Scoped ESLint passed. Prettier's installed CLI entry file begins with an unexpected leading character, so the installed Prettier package API was used to format/check 14 authored files without changing dependencies. The Admin `main.ts` retained the repository's existing formatting to avoid an unrelated whole-file rewrite.
- `git diff --check` passed with line-ending notices only. The 15 source/test paths were selectively synced and their SHA-256 values matched; no Mini, API service, configuration, dependency manifest, or lockfile path was changed for D12A.
- Manual browser clicks and visual review: `NOT_RUN`. The automated integration uses actual local previews/proxies and real clients but does not claim DOM interaction or visual acceptance. Owner review remains unclaimed.
