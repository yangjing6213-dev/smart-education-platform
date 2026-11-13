# TASK20 G2.4 follow-up — Mini shared fee views and Admin scoped summary

## 0. Authority and source of truth

- Product plan: `student-care-platform-complete-plan-v2.0.pdf`, SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`.
- Existing phase plan: `docs/superpowers/plans/2026-10-04-g24-fees-receipts-agreement-synthetic.md`, SHA-256 `38113C36633E75FD8546953C6C6B90618C096363BA07353B5D93E8A804C4AD11`.
- Current implementation evidence: shared fee service and User Web adapter already exist; Mini shared mode still uses no fee adapter, and Admin `/admin/fees` still projects fixed rows without requesting the shared summary.
- Authority to proceed: user's standing direction to complete the remaining project work autonomously and latest instruction “进入下一批”.
- This is a narrow completion slice of G2.4, not a replacement for the existing G2.4 contract. Existing shared service and User Web work are reused unchanged.

## 1. Goal and acceptance criteria

1. In Mini parent shared mode, fetch fee/receipt/agreement documents through the existing `/local/fees` service endpoint and show only read-only, current selected-child documents. Available and paid documents may show their synthetic summary and amount; unavailable documents show the service reason and never show a fabricated zero amount. Switching identity or child must not leave a previously selected detail visible.
2. In Admin `/admin/fees`, replace fixed per-student rows with the existing `/local/fee-summary` endpoint. Campus identities may see only campus aggregate counts and amount total; platform identity sees anonymous counts only. The page has no student/document rows and no payment, refund, signature, or download action.
3. Keep all data synthetic and local. Do not change the API/service contract, User Web, routes, app registration, dependencies, lockfiles, protected `staff.test.ts`, or the main-tree business implementation.
4. Tests must demonstrate the missing shared behavior first, fail for the expected reason, then pass after implementation. Include source and generated Mini Page coverage and an Admin shared-client plus preview-proxy regression.
5. No DevTools native visual claim unless an actual click review is performed. No main-tree Mini/Admin business sync in this slice.

## 2. Exact write set

Main control plane:

- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-07-g24-mini-admin-shared-fees.md` (this contract)

Admin worktree `C:\Users\HU\.codex\worktrees\task20-admin-completion`:

- `apps/admin-web/src/local-review/client.ts`
- `apps/admin-web/src/local-review/fees-view.ts`
- `apps/admin-web/src/main.ts`
- `apps/admin-web/src/local-proxy.mjs`
- `apps/admin-web/test/fees.test.mjs`
- `apps/admin-web/test/preview.test.mjs`
- `docs/exec-plans/active/admin-fees-sharing.md`

Mini worktree `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`:

- `apps/mini-program/src/local-synthetic/client.ts`
- `apps/mini-program/src/local-synthetic/client.js` (only if regenerated content changes)
- `apps/mini-program/src/local-synthetic/page.ts`
- `apps/mini-program/src/local-synthetic/page.js` (only if regenerated content changes)
- `apps/mini-program/templates/local-synthetic.wxml`
- `apps/mini-program/src/pages/shared-fees.test.ts`
- `docs/exec-plans/active/mini-fees-sharing.md`

## 3. Non-goals and stop conditions

- No payment, refund, signing, external file download, network service, persistent storage, real identity, real student data, production database, AI, or partner-cloud integration.
- Do not edit the old broad G2.4 contract, API/shared service, User Web, `app.json`, page `index.json`, generated files outside the two conditional paths above, `staff.test.ts`, configuration, dependencies, or lockfiles.
- Do not alter existing user changes or unrelated untracked files in either worktree.
- If the existing API response cannot support these read-only projections, stop the affected client slice and record the exact missing contract; do not expand the write set.
- No commit, push, deployment, publication, or release.

## 4. Verification

Admin:

- First run the new focused fee tests and observe the expected missing shared-summary behavior.
- Run the Admin TypeScript build, focused fee/client tests, preview/proxy tests, ESLint, Prettier, and `git diff --check`.
- Exercise the real localhost preview proxy against an in-process synthetic HTTP fixture; verify `/local/fee-summary` passes only as GET and other unlisted methods/paths remain rejected.

Mini:

- First run `shared-fees.test.ts` in source mode and observe the expected missing shared fee behavior.
- Run the test again in generated mode after compilation; run Mini typecheck, focused shared fee and pickup tests, ESLint, Prettier, runtime registration/output freshness guard, and `git diff --check`.
- Verify the generated Page output changes only when the existing compiler reports changed output. DevTools visual clicks are recorded separately and never inferred from Page tests.

Cross-scope:

- Audit each worktree's changed paths against this exact write set, inspect diffs and status, preserve unrelated work, then update this active record and `PLANS.md` with actual command outcomes and remaining native/Main-tree-sync status.

## 5. Completion status

Status at creation: `IN_PROGRESS`. A local automated pass is not native DevTools acceptance, owner acceptance, main-tree integration, or production readiness.
