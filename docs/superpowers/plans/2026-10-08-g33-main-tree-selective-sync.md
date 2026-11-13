# TASK20 G3.3 Main-Tree Selective Sync

## Goal

Bring the already locally verified synthetic monthly-feedback workflow into the current main worktree without replacing its accumulated work. Preserve the same scoped source summaries, staff feedback record/version, reviewer decisions, and parent-only published summary.

This is a selective reconciliation contract under the owner's standing authorization for autonomous local development. The earlier G3.3 source contract remains historical evidence; its `MAIN_TREE_BUSINESS_SYNC` non-goal applied to that implementation lane and is superseded for this narrow sync only by this contract and the current `PLANS.md` control plane.

## Exact write set

Only these 12 paths may be created or modified:

1. `PLANS.md`
2. `docs/exec-plans/active/project-completion.md`
3. `docs/superpowers/plans/2026-10-08-g33-main-tree-selective-sync.md`
4. `apps/user-web/src/main.ts`
5. `apps/user-web/src/local-synthetic/monthly-feedback.ts`
6. `apps/user-web/src/local-synthetic/monthly-feedback-client.ts`
7. `apps/user-web/src/local-synthetic/monthly-feedback.test.ts`
8. `apps/user-web/src/styles/user-web.css`
9. `apps/user-web/test/monthly-feedback-browser.mjs`
10. `apps/admin-web/src/main.ts`
11. `apps/admin-web/src/local-review/monthly-feedback.ts`
12. `apps/admin-web/test/monthly-feedback.test.mjs`

`PLANS.md`, both application entrypoints, the stylesheet, and the active completion record already contain other work. Preserve every unrelated line and the existing G3.2 implementation. Do not replace either entrypoint from a source worktree.

## Integration decisions

- Mount employee authoring at existing `/staff/report`, parent reading/acknowledgement at existing `/web/parent/home`, and reviewer queue inside existing `/admin/staff`.
- Do not create or link the source lane's `/admin/monthly-feedback-review` route. Do not add a page, route registration, navigation entry, or configuration.
- The main worktree does not contain the source lane's broad generic User Web client. Add a small monthly-feedback-only client rather than copying unrelated client code.
- Add only scoped monthly-feedback presentation rules to the existing User Web stylesheet because the source lane's matching rules are absent in the main worktree.
- Reuse the current local synthetic API unchanged. Use only fixed synthetic roles, IDs, and data; the transport must allow only loopback monthly-feedback/session requests.
- The browser harness may launch the existing local synthetic API and User/Admin previews on temporary loopback ports. It must block and report any external request and close all child processes.

## Non-goals and stop conditions

- No API, database, Mini Program, real authentication, real student data, external service, persistence, production AI, dependency, lockfile, project configuration, `staff.test.ts`, commit, push, deployment, or release changes.
- Do not change or remove unrelated worktree changes, untracked files, or the previously retained rollback worktrees.
- If an existing route cannot host the experience, an API behavior change is needed, an out-of-scope path is required, or a conflict would overwrite unrelated content, stop and report before editing outside this write set.
- Native WeChat Developer Tools acceptance remains `NOT_RUN`; this web sync does not claim it.

## Acceptance and verification

1. Add focused User Web and Admin Web behavior tests before implementation; verify they fail for the missing workflow.
2. Verify staff can create/edit/submit/resubmit a feedback draft; an authorized campus reviewer can return, confirm, publish, and refresh it; a bound parent can see only the published fixed summary and acknowledge it.
3. Verify source changes invalidate the published projection, clear the previous parent acknowledgement, and never expose source IDs, source details, class/teacher/reviewer identities, or internal review data to the parent.
4. Run the browser lifecycle against the actual local previews, including responsive overflow, page/console/network errors, and zero external requests.
5. Run focused tests, User/Admin typechecks, target ESLint, Prettier on written files, `git diff --check`, and an exact changed-path audit.
6. After browser verification, restart the local synthetic demo only as needed to clear ephemeral rows; verify its reviewer queue is empty. Keep Owner Review pending until the user reviews the result.

## Source evidence

- Product authority: `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md` and the PDF v2.0 authority recorded in `PLANS.md`.
- G3.3 implementation contract: `docs/superpowers/plans/2026-10-07-g33-monthly-feedback-source-linkage.md`, SHA-256 `DEFD87C0199E3CFEE65EE387C80D95F754D63E949BA1E43CE7C8588ECC0BDD34`.
- Existing source implementations: `task20-web-completion` and `task20-admin-completion` worktrees. They are read-only references for this sync.
