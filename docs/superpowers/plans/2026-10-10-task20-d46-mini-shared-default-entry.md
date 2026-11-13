# TASK20 D46 Mini shared workflow default entry

> **For agentic workers:** Use the existing project completion plan and this task contract; keep the contract, implementation, tests, and verification evidence in one shared execution record.

**Goal:** Make the already implemented local shared Mini workflow the default on first entry, so parents and staff do not land on disconnected legacy pages or have to discover a hidden “enter collaboration” control.

**Architecture:** Keep the existing shared client and routes. Enable shared mode at page-module startup, load the local synthetic identity list on the first page show without choosing or connecting an identity automatically, and remove the visible controls that switch to the independent offline presentation. Keep the old mode-switch methods only for internal regression fixtures, not in WXML. Preserve the legacy source as an unreachable user path.

**Tech Stack:** Existing Mini Program TypeScript, WXML, Node test runner, local loopback synthetic service; no new packages.

---

## 0. Authorization and baseline

- **Task ID:** `TASK20_D46_MINI_SHARED_DEFAULT_ENTRY`.
- **Authority:** The active project-completion goal and the owner's instruction to continue local project development autonomously; this task does not expand into real services, production readiness, or release actions.
- **Starting main worktree:** `C:\Users\HU\Documents\student-care-saas-platform`, branch `feature/phase-1b-task-19-final-delivery-acceptance`, HEAD `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`. The main worktree already contains many unrelated modified and untracked paths; preserve them exactly.
- **Implementation worktree:** `C:\Users\HU\.codex\worktrees\task20-d46-mini-shared-default-entry`, branch `codex/task20-d46-mini-shared-default-entry`, based on the starting HEAD.
- **Isolated baseline overlay:** The implementation sources and tests currently exist as dirty or untracked main-tree work, so copy their current read-only baseline into the new worktree before editing. Copy `.ts` implementation files under `apps/mini-program/src/` while excluding every `*.test.ts` and specifically excluding `src/pages/staff.test.ts`; copy only the `index.ts`, `index.js`, `index.wxml`, `index.wxss`, and `index.json` files under `pages/parent/home`, `pages/parent/binding`, `pages/staff/workbench`, and `pages/staff/quick-action`; copy `templates/local-synthetic.wxml`; copy the three exact test files in the write set; and copy `apps/mini-program/tsconfig.json`. Do not copy or inspect `staff.test.ts`. Create a junction to the existing root `node_modules` only if required; do not install or alter dependencies. Use the main worktree's existing `apps/api/dist` as the current loopback test server by setting `LOCAL_SYNTHETIC_CORE_ROOT` to the main worktree root; the sibling `task20-local-shared-core` build may lag and must not be treated as the current source of truth.
- **Write-set baseline SHA-256 before worktree overlay:** `page.ts` `B0BB547633696467785E7FDD260A13F5071E22A1FC501301CE871FC463E2816E`; `local-synthetic.wxml` `CF12FF86C573AEF43C867C2904112CC3AF07BD3CBEEF3650F133D9DFC97B7864`; `shared-pickup.test.ts` `290EE2DAB5B2AEC1379B8D4784C58DBD29B64ECE5F3BB23FF41E7842B851392F`; `mini-workflow-ui.test.ts` `7C2BEF74E819F6C4E6F5DC9B0533CE1728F0DAE36622E58BAE1E8061CCDA3025`; `supply-request.test.ts` `89013309CDEA35212E5C4143086366DC44CC349709EA315AEF3FB5DC9988B1B0`; `page.js` `F4CF37BAD1859BE9A81F2421D205593297B7D95F81607468351A6D858680008A`.
- **Requirements evidence:** Project Plan v2.0, page 30, requires the family/teacher pickup process to use one auditable connected flow with guardian authorization, staff checks, parent feedback, and exception handling. Existing Mini pickup workflow already implements that local synthetic flow; the defect is that cold start hides it behind an independent legacy page.
- **Root cause already observed:** `src/local-synthetic/page.ts` initializes module `enabled` and page `sharedMode` to `false`; `onLoad`/`onShow` therefore call the legacy page lifecycle. The shared pickup test then manually calls `handleSharedEnable` and `handleSharedConnect`, masking what a new user sees. `templates/local-synthetic.wxml` exposes both “进入本机协同” and “返回离线展示”. A second issue surfaced under the shared default: the wrapper suppresses legacy handlers while enabled, but the shared staff category tabs still use `handleStaffSectionChange`, so those tabs stop responding. Allow this single category-only handler in shared mode; keep every other legacy handler gated.
- **Data and service boundary:** Use only the existing fictional profiles and loopback local synthetic API. Do not auto-select or auto-connect an identity. No real people, authentication, remote network, API/database outside the existing local synthetic server, persistence, partner cloud, or AI.

## 1. Acceptance criteria

1. A cold first entry to the parent or staff Mini page renders the shared workflow immediately; no prior tap on “进入本机协同” is needed.
2. The first `onShow` loads the local sample identity list. The user still selects an identity, and the page does not establish a session automatically.
3. The shared template no longer offers “进入本机协同” or “返回离线展示”; no normal user control switches back to the disconnected legacy presentation. Internal mode methods may remain for direct test setup but must not be bound from WXML.
4. Shared staff category tabs still work with shared mode enabled; all other legacy handlers remain gated. Existing synthetic pickup authorization, human checks, exception handling, daily workflow, and role restrictions remain unchanged.
5. Page tests prove the cold-start behavior without manually invoking the old enable/connect controls; static workflow tests prove the obsolete entry/exit controls are gone.
6. Mini typecheck, focused tests, relevant cross-page shared-service regression, ESLint, Prettier, generated-JS check, `git diff --check`, and exact write-set audit pass. `apps/mini-program/src/pages/staff.test.ts` is not read, run, copied, or modified.

## 2. Exact write set

Implementation paths:

- `apps/mini-program/src/local-synthetic/page.ts`
- `apps/mini-program/templates/local-synthetic.wxml`
- `apps/mini-program/src/pages/shared-pickup.test.ts`
- `apps/mini-program/src/pages/mini-workflow-ui.test.ts`
- `apps/mini-program/src/pages/supply-request.test.ts`
- `apps/mini-program/src/local-synthetic/page.js` — only if generated by this task and its content changes.

Governance paths:

- `docs/superpowers/plans/2026-10-10-task20-d46-mini-shared-default-entry.md`
- `PLANS.md`
- `docs/exec-plans/active/project-completion.md`
- `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`

Any other file changing is outside scope and must be restored from the task's own baseline or reported if it is pre-existing; do not change it.

## 3. Test-first implementation sequence

1. In the isolated worktree, remove the manual enable/connect calls from the registered-page pickup fixture and assert that the first page has `sharedMode=true`, profiles are loaded, and it remains unconnected; for later pages, verify shared mode and loaded profiles without assuming the shared client has no existing session. Update the existing Mini workflow UI assertions to require the shared shell and absence of obsolete controls. Update the supply-request fixture to assert shared mode first, then explicitly enter its internal offline fallback so legacy-only model tests stay isolated.
2. Run the focused tests before changing implementation. The cold-start assertion must fail because the baseline starts in offline mode; a setup/import error is not an acceptable red result.
3. Set the shared module's initial mode on, derive each page's initial `sharedMode` from it, and have `onShow` load profiles on first entry (refresh only an already connected client). Remove the two mode-switch controls from the shared WXML while leaving legacy source and internal test hooks intact.
4. Run the focused tests until green, then run the Mini typecheck and existing shared-service regressions. If `page.ts` changed, regenerate only `src/local-synthetic/page.js` with the TypeScript options from `apps/mini-program/tsconfig.json`; capture and compare all generated Mini JS hashes to prove no other output changed.
5. Selectively synchronize only the changed implementation paths into the main worktree after checking their pre-sync hashes against the captured baseline. Update the active record, roadmap row, and `PLANS.md` with actual commands/results, exact changed paths, UI limitations, and remaining owner/native review gates.
6. Re-run the focused tests, Mini typecheck, Mini registration guard, ESLint, Prettier, scoped `git diff --check`, and exact path/hash audit in the main worktree.

## 4. Verification commands

From the isolated worktree, run with the existing local Node and dependency tree only:

- `node --experimental-transform-types --test apps/mini-program/src/pages/shared-pickup.test.ts apps/mini-program/src/pages/mini-workflow-ui.test.ts apps/mini-program/src/pages/supply-request.test.ts`
- `node_modules/.bin/tsc.cmd -p apps/mini-program/tsconfig.json --noEmit --allowImportingTsExtensions` (the existing visitor TypeScript entrypoints use `.ts` import suffixes; the flag is command-only because this check emits no files, and no project configuration is changed).
- `node_modules/.bin/eslint.cmd apps/mini-program/src/local-synthetic/page.ts apps/mini-program/src/pages/shared-pickup.test.ts apps/mini-program/src/pages/mini-workflow-ui.test.ts apps/mini-program/src/pages/supply-request.test.ts`
- `node_modules/.bin/prettier.cmd --check` on the five authored TypeScript/WXML paths above. If the installed CLI cannot start, do not edit dependencies: use the installed Prettier API with resolved project config on the authored TypeScript files and only the changed range for WXML, recording any pre-existing whole-file formatting differences.
- If generating `page.js`, run `node -e "const fs=require('node:fs');const ts=require('typescript');const p='apps/mini-program/tsconfig.json';const c=ts.getParsedCommandLineOfConfigFile(p,{},ts.sys);if(!c)process.exit(1);const r=ts.transpileModule(fs.readFileSync('apps/mini-program/src/local-synthetic/page.ts','utf8'),{compilerOptions:c.options,reportDiagnostics:true});if(r.diagnostics?.length){console.error(ts.formatDiagnosticsWithColorAndContext(r.diagnostics,{getCurrentDirectory:ts.sys.getCurrentDirectory,getCanonicalFileName:x=>x,getNewLine:()=>ts.sys.newLine}));process.exit(1)}fs.writeFileSync('apps/mini-program/src/local-synthetic/page.js',r.outputText)"`.
- Run the existing Mini shared-service regression after selective synchronization against the main worktree's existing API build: set `LOCAL_SYNTHETIC_CORE_ROOT` to the main worktree root, then run `node --experimental-transform-types --test tests/mini-shared-service.test.mjs`. The experimental flag is required by the current Node runtime to transform TypeScript parameter properties; it is command-only and changes no project file.
- Run the Mini page-registration guard only if it can be invoked without reading the protected staff test or changing unrelated generated outputs.
- Run `git diff --check` only on this contract's changed tracked paths; separately compare hashes for copied/untracked baseline and every path in the exact write set.

No dependency installation, lockfile/config edits, commit, push, deploy, publishing, or release. Actual WeChat DevTools interaction is reported separately as `NOT_RUN` if no interactive controller is available.

### 2026-10-10 verification environment clarification

The existing sibling shared-core build was found to lag the current API source: its compiled learning-session deletion rejected a teacher clearing a handed-off session, while the main worktree's already-built `apps/api/dist` contains the current implementation. Verification therefore uses the latter without rebuilding or changing API files. The installed Prettier CLI entrypoint has an unexpected leading Unicode character before its shebang; use the API fallback above and leave dependency files untouched.

## 5. Stop conditions

- Stop if making shared mode default requires new routes, API behavior, real identity, or a change outside the exact write set.
- Stop if first entry would silently pick a parent/teacher identity or connect a session without user choice.
- Stop if the Mini typecheck/test workflow would read, run, copy, or modify `apps/mini-program/src/pages/staff.test.ts`.
- Stop if selective sync would overwrite a main-tree change made after the baseline hash capture.
- Stop if the task emits a generated file outside the listed conditional output.
