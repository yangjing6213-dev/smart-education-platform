# TASK20 D12B Mini Shared Care-Record Verification Contract

Date: 2026-10-10

## Objective

Verify that the existing Mini parent and staff Page handlers use the same local synthetic care-record service as the shared client, and reconcile the D12 control plane. The implementation already exists: both pages are wrapped by `withLocalSynthetic`; the shared template exposes staff report, submit, review, publication, parent read, and acknowledgement actions; `MiniSharedClient.connect()` clears the previous role projection before loading the next role. The missing D12B evidence is the isolated, repeatable source/generated-JavaScript verification and accurate phase status.

The first audit pass confirmed the existing shared-mode service integration, but checking the ordinary page exposed a contract gap: when shared mode is off, the legacy in-memory growth-record form/list is still visible and can look like the shared workflow. That conflicts with the parent D12 rule that an unavailable service must not be represented by a separate local record copy. This contract is therefore amended before implementation to remove only those misleading offline growth-record controls and point both roles to the already-existing shared mode. Do not add another Mini service client.

## Contract integrity and authority

- Parent plan: `docs/superpowers/plans/2026-10-10-task20-d12-shared-care-record-cross-client.md`, pre-execution SHA-256 `1278AF4B16FDDA768439A263D006386A6F19158B34A503BBCB31EEF94D299D7C`.
- Predecessor: D12A `docs/superpowers/plans/2026-10-10-task20-d12a-web-admin-care-record.md`, SHA-256 `F39FF09291C8D896C8C88F70806257B030F608716D2D330F2A1960CB4FC0AF2F`.
- The owner has authorized autonomous local project development. This contract does not authorize real student data, real authentication, external services, dependency or lockfile changes, commits, pushes, deployment, or release.

## Exact write set

The exact product/test write set, confirmed before the first product edit, is:

- MODIFY `apps/mini-program/src/pages/mini-workflow-ui.test.ts`.
- MODIFY `apps/mini-program/pages/parent/home/index.wxml`.
- MODIFY `apps/mini-program/pages/staff/quick-action/index.wxml`.
- No TypeScript or generated JavaScript output was required because the existing shared-service mode was already wired. No generated output changed.

The following governance paths may be created or updated:

- CREATE `docs/superpowers/plans/2026-10-10-task20-d12b-mini-shared-care-record.md` (this contract and evidence record).
- MODIFY `docs/superpowers/plans/2026-10-10-task20-d12-shared-care-record-cross-client.md`.
- MODIFY `PLANS.md`.
- MODIFY `docs/exec-plans/active/project-completion.md`.
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`.

The following are read-only verification inputs, not part of the write set:

- `apps/mini-program/src/pages/mini-workflow-ui.test.ts`
- `tests/mini-shared-service.test.mjs`
- Mini Page TypeScript, WXML, shared template/client modules, `apps/mini-program/tsconfig.json`, and `apps/mini-program/app.json`
- `scripts/verify_mini_page_registration.mjs`
- Existing local shared-core worktree at `C:\Users\HU\.codex\worktrees\task20-local-shared-core`

## Isolated worktree and execution

- Dedicated worktree: `C:\Users\HU\.codex\worktrees\task20-d12b-mini-shared-care-record`.
- Seed only the current Mini app source/test inputs required by these read-only checks; do not alter their contents in the D12B worktree.
- Run the focused Mini shared-service Page integration test in source mode and generated-JavaScript mode; run the Mini workflow Page test in both modes; run Mini TypeScript, scoped ESLint/Prettier checks, and the page-registration guard.
- Record all commands, outcomes, generated-JavaScript mode results, exact worktree scope, and manual-review limitations here and in the D12 control-plane documents.
- The scope amendment above was made before product/test edits. A failing UI assertion was recorded first; then only the two WXML regions were changed so the offline page directs users to the shared mode while the shared template continues to host service-backed care-record actions.

## Acceptance criteria

1. Mini's actual parent/staff Page handlers complete a same-service care-record flow: staff creates and submits; an authorized reviewer returns/reviews and publishes separately; parent sees the exact record ID, reads the details, and acknowledges; another parent scope does not see the record.
2. Source and generated-JavaScript focused suites pass against the existing local shared-core service.
3. Typecheck, scoped ESLint/Prettier checks, registration guard, and `git diff --check` pass; no files outside the exact product/test and governance write sets, protected tests, config, dependency, or lockfile are changed.
4. The control plane records D12B as verified only if the checks actually pass. Do not claim WeChat DevTools interaction or visual review unless it is performed.

## Stop conditions

- Stop if verification requires a write outside the exact governance write set.
- Stop if a test fails due to a product defect; update this contract with the minimal source/test write set before repairing it.
- Stop before any real service, persistence, non-loopback network, dependency, lockfile, commit, push, deployment, or publication change.

## Evidence

- The preflight and page-level service suite confirmed that both Mini pages already use `withLocalSynthetic`; no second service client was added. The actual gap was that ordinary non-connected pages still displayed a separate in-memory growth-record form/list, which could be mistaken for the shared record flow.
- The updated UI assertion failed before the WXML repair, then passed after the two offline regions were replaced by clear “enter local shared mode” guidance. The staff guidance points to the existing shared “成长” category; the parent guidance says records are available after connecting the parent identity and that disconnected mode does not show a local copy.
- The isolated worktree and main tree now match byte-for-byte across the Mini source/page/template inputs. Exactly the three authorized product/test paths differ from the pre-edit baseline; `apps/mini-program/src/pages/staff.test.ts`, config, generated JS, dependency files, and lockfile are unchanged.
- Mini workflow Page tests: source 9/9 and generated-JavaScript mode 9/9. Mini shared-service Page tests: source 5/5 and generated-JavaScript mode 5/5. Mini typecheck, scoped ESLint, page-registration guard, changed assertion-block Prettier API check, and `git diff --check` passed.
- Whole-file Prettier remains `PARTIAL`: existing formatting drift occurs in unchanged Mini TypeScript content; the changed test block itself matches Prettier output. WXML is not supported by the repository Prettier parser. No unrelated reformatting was performed.
- WeChat Developer Tools interaction/visual review is `NOT_RUN`; this automated evidence does not claim real-device acceptance. No external requests, dependency changes, commits, pushes, deployments, or publication occurred.

## Status

`PASS_LOCAL_SYNTHETIC; SELECTIVELY_SYNCED; OWNER_REVIEW_NOT_CLAIMED; WECHAT_DEVTOOLS_VISUAL_REVIEW_NOT_RUN; WHOLE_FILE_PRETTIER_PARTIAL_PREEXISTING_DRIFT`.
