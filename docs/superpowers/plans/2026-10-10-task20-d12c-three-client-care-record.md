# TASK20 D12C Three-Client Shared Care-Record Acceptance

Date: 2026-10-10

## Objective

Complete D12's local synthetic acceptance by exercising one care-record ID through the existing User Web employee client, Mini staff Page, Admin reviewer, User Web parent `parent-alpha`, and Mini parent Page. Verify review/publication separation, independent parent receipts, revocation, and volatile-state clearing after restarting the local synthetic service.

This is an integration-test-only slice. Do not change product behavior unless the existing page handlers fail an acceptance check; if that happens, stop and amend the exact product write set before editing implementation.

## Authority and prior evidence

- Current project plan: `docs/superpowers/plans/2026-10-10-task20-d12-shared-care-record-cross-client.md`, current SHA-256 `66884500FD452E7F6E04BF245B3A270077ADE0FAE18DEDD53FBB590AC1EE41C6`.
- D12A Web/Admin contract SHA-256 `F39FF09291C8D896C8C88F70806257B030F608716D2D330F2A1960CB4FC0AF2F`.
- D12B Mini contract SHA-256 `C92D8B24CB546E3E45E9D9EE0FFDAB76240F1BEEC1C47BC7D77F9741E5458FE6`.
- Owner authorized autonomous local implementation and verification. This contract does not allow real identity/student data, persistent storage, external services, dependency/lockfile changes, commits, pushes, deployment, release, or publication.

## Exact write set

Product/test write set:

- MODIFY `tests/e2e/care-record-shared.spec.ts` only.

Governance write set:

- CREATE `docs/superpowers/plans/2026-10-10-task20-d12c-three-client-care-record.md`.
- MODIFY `docs/superpowers/plans/2026-10-10-task20-d12-shared-care-record-cross-client.md`.
- MODIFY `PLANS.md`.
- MODIFY `docs/exec-plans/active/project-completion.md`.
- MODIFY `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`.

Read-only inputs may be copied into the isolated test worktree to reproduce the current main-tree baseline. They must not be edited. Generated files are not expected to change.

## Isolation and test setup

- Dedicated worktree: `C:\Users\HU\.codex\worktrees\task20-d12c-cross-client-care-record`.
- Branch: `codex/task20-d12c-cross-client-care-record`.
- Seed the current read-only User Web, Admin Web, Mini source/page/template/generated-JS inputs, root package metadata, and this existing E2E test from the main worktree. Reuse the already-installed `node_modules` through a junction; do not install packages.
- Use the existing shared-core worktree at `C:\Users\HU\.codex\worktrees\task20-local-shared-core` through `LOCAL_SYNTHETIC_CORE_ROOT`.
- Test both Mini TypeScript source mode and generated-JavaScript mode. In source mode, map Mini-internal `.js` imports to the corresponding `.ts` files using the existing Node module-hook pattern; generated mode must use the committed/current generated `.js` inputs.
- Bind test services and preview proxies to loopback only. The Mini request mock may rewrite the fixed development address to the test's ephemeral loopback port and must reject any non-loopback target.

## Acceptance and verification

The integration test must prove, using actual page/client handlers and one live in-memory local-synthetic server:

1. User Web employee creates and submits a synthetic record; Mini staff reads that same ID from the shared review queue.
2. Admin reviews and publishes that exact ID as separate versioned actions.
3. User Web parent `parent-alpha` reads and acknowledges the exact ID; Mini parent `parent-alpha` sees the same acknowledgement, while separately approved Mini parent `parent-beta` independently sees `UNREAD` and can record its own receipt. This verifies shared state across clients and separate receipts across guardians.
4. Admin revokes publication; both parent projections stop showing the record after refresh.
5. Close and recreate the local synthetic server on the same loopback port. The previous session is rejected, and newly connected employee/reviewer/parent projections contain no prior record.
6. Captured requests stay on loopback; no external network calls are made.

Run the extended test in source and generated modes:

```powershell
$env:LOCAL_SYNTHETIC_CORE_ROOT='C:\Users\HU\.codex\worktrees\task20-local-shared-core'
node --experimental-strip-types --test tests/e2e/care-record-shared.spec.ts
$env:MINI_SHARED_RUNTIME='generated'
node --experimental-strip-types --test tests/e2e/care-record-shared.spec.ts
```

Also run the existing D12A focused Web/Admin/proxy checks and D12B Mini Page/service tests in the integrated main tree after selective sync, plus Mini typecheck, scoped ESLint, Prettier check for the changed test block, `git diff --check`, and exact-scope/hash audit. Report whole-file formatting drift separately; do not reformat unrelated baseline content.

## Stop conditions

- Stop if the test requires edits outside the one authorized E2E test path or any listed governance path.
- Stop if current source/generated page behavior fails and a product change would be necessary; amend this contract and its SHA before product edits.
- Stop on non-loopback transport, persistence, external service, dependency/lockfile, real data, commit, push, deploy, release, or publish requirements.
- Do not claim WeChat Developer Tools click/visual review; this task verifies local integration behavior only.

## Evidence

The first integration run confirmed the Mini test must call the real page `onShow` lifecycle and provide the full WXML dataset (`bindingId` and `publicationVersion`) for care receipts. It also showed the D12A User Web adapter intentionally accepts only `parent-alpha`; rather than expand product scope, independent second-guardian receipt coverage uses Mini's existing `parent-beta` profile. The test uses a fresh loopback HTTP connection per request and restarts both preview processes after recreating the core, so a stale keep-alive socket cannot mask the service-restart behavior. The Mini parent and staff pages share one in-memory identity; the restart check therefore invalidates the current parent handle first, then switches to a fresh staff and parent identity and verifies that every projection remains empty.

Final execution (2026-10-10): the E2E passed 1/1 in both TypeScript-source and generated-JavaScript modes. Source mode observed synthetic record `a1251f46-138c-4a9d-a58d-e061d36dfdf1`; generated mode observed synthetic record `6626e490-2453-44c9-a7b7-3ef85278ac47`. Each followed draft v1 → submitted v2 → confirmed v3 → published v4. The Web parent and Mini `parent-alpha` each showed `ACKNOWLEDGED`; separately approved Mini `parent-beta` showed `UNREAD` → `READ` → `ACKNOWLEDGED`. Revocation removed the record from both parent projections. After the core restarted on the same loopback port, the prior owner handle returned 401, newly connected Web employee/parent and Admin reviewer projections were empty, and the Mini session became disconnected before new empty staff/parent sessions were opened. All 199 Mini requests per run stayed on `127.0.0.1`; Web/Admin client requests also asserted loopback-only destinations. The isolated test and main-tree test SHA-256 both equal `EE87CCBCD478073F64B2B1B91613CB7668446145F58009BAC163C9736381096A`. D12A Web tests passed 109/109, Admin tests 110/110, and D12B Mini Page/service tests passed 9/9 and 5/5 in both source and generated modes. Mini typecheck and generated-page registration guard passed; scoped ESLint and the changed test's Prettier check passed. The installed Prettier entry file begins with an unexpected U+3001 character; the check was run without modifying the dependency by stripping that one leading character in memory for this invocation. A first Web test attempt omitted `LOCAL_SYNTHETIC_CORE_ROOT` and failed its setup assertion; rerunning with the contract's existing shared-core worktree passed. No dependency installation or lockfile change occurred.

## Status

`IMPLEMENTED_AND_VERIFIED_LOCAL_SYNTHETIC; ISOLATED_TEST_SELECTIVELY_SYNCED_AND_HASH_MATCHED; OWNER_REVIEW_NOT_CLAIMED; WECHAT_DEVTOOLS_VISUAL_REVIEW_NOT_RUN`.
