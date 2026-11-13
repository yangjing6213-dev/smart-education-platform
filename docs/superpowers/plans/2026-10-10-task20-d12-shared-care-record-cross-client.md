# D12 Shared Care Record Across Web, Admin, and Mini

**Goal:** Make one locally generated care-record ID flow from the employee report screen through Admin review and publication to the same parent record in User Web and Mini.

**Architecture:** Reuse the existing loopback-only synthetic care-record service and its session-bound roles. Each client must load and mutate the same server record; if the service is unavailable, the screen must show a disconnected/empty state instead of substituting its own local copy. Keep the service in memory and keep all data synthetic.

**Tech Stack:** Existing Fastify local-synthetic service, TypeScript client adapters, native Mini `wx.request`, Node built-in tests, and local preview servers; browser interaction is a separate manual gate when available.

---

## Current evidence and confirmed gap

- `apps/api/src/local-synthetic/routes.ts` already exposes `/local/care-records` and versioned submit, review, publish, revoke-publication, and receipt actions.
- Before D12A, `apps/admin-web/src/main.ts` seeded `syntheticCareRecordReviewRows` in page memory.
- Before D12A, `apps/user-web/src/main.ts` owned a separate `careRecordState` created with `createInitialCareRecordState()`.
- Mini parent and staff pages already wrap the shared client through `withLocalSynthetic`; `tests/mini-shared-service.test.mjs` proves a same-server Mini employee-to-parent record flow in source and generated-JavaScript modes. The remaining gap was the ordinary, disconnected page still showing an independent in-memory care-record form/list.
- D12B removes that misleading offline fallback and points staff and parents to the existing shared mode. D12A proves a shared ID through User Web employee, Admin reviewer, and User Web parent paths. D12C now proves one exact ID across Mini, User Web, and Admin plus independent parent receipts, revocation, and volatile state clearing after service restart.

## Split into independently testable steps

### D12A: User Web and Admin use the shared service

Use separate local-synthetic sessions: `teacher-east` creates and submits, `owner-east` reviews and publishes, and `parent-alpha` reads and acknowledges. Keep review and publication as distinct actions. Verify the parent receives the exact ID and version returned to the employee, and that revoke removes it from the parent projection.

Exact D12A source/test write set, repeated in the execution contract before code changes:

- User Web adapter and connection tests: `apps/user-web/src/local-synthetic/care-record-client.ts` and its test.
- User Web screen wiring and behavior tests: `apps/user-web/src/main.ts`, `apps/user-web/src/pages/care-record-workflow.ts`, and `apps/user-web/src/pages/care-record-workflow.test.ts`.
- User Web local preview proxy and its allowlist test: `apps/user-web/preview.mjs` and `apps/user-web/test/preview.test.mjs`; permit only the local-synthetic care-record session and record endpoints needed by this flow.
- Admin adapter and connection tests: `apps/admin-web/src/local-review/care-record-client.ts` and `apps/admin-web/test/care-record-client.test.mjs`.
- Admin screen wiring and behavior tests: `apps/admin-web/src/main.ts`, `apps/admin-web/src/pages/care-record-review.tsx`, and `apps/admin-web/test/care-record-review.test.mjs`.
- Admin local review proxy and its allowlist test: `apps/admin-web/src/local-proxy.mjs` and `apps/admin-web/test/preview.test.mjs`; permit only the local-synthetic care-record session and record endpoints needed by this flow.
- Cross-client preview integration: `tests/e2e/care-record-shared.spec.ts`; run the real clients through both loopback preview proxies and verify the shared record ID/version.

Verification: each new adapter test runs against the actual in-process local-synthetic server; focused care-record tests, both Web typechecks/builds, scoped ESLint, Prettier API checks, preview proxy tests, and a same-origin preview integration flow passed. The integration flow creates the record through the employee client, reviews/publishes through Admin, and reads/acknowledges the same ID through the parent client; route smoke and loopback checks passed. DOM clicks and visual browser review remain `NOT_RUN` because no browser automation package or interaction controller is installed.

D12A result (2026-10-10): `PASS_LOCAL_SYNTHETIC`; 13/13 User Web tests, 5/5 Admin tests, 1/1 User Web proxy test, 2/2 Admin preview/proxy tests, and 1/1 shared-ID E2E passed. Fifteen authorized source/test paths were selectively synced with matching source/destination SHA-256 values. D12B and D12C have since completed their local checks; Owner Review is not claimed.

### D12B: Remove disconnected Mini growth-record copies

The shared Mini staff/parent workflow already existed. D12B removes the independent in-memory growth-record form/list from the ordinary disconnected views and tells each role to enter the existing local shared mode. This prevents an offline draft or prefilled list from being confused with a record visible to the other clients. The fixed-choice shared form and distinct submit, review, publish, read, and acknowledgement actions remain in the shared template.

Exact D12B source/test write set from its execution contract:

- `apps/mini-program/src/pages/mini-workflow-ui.test.ts`
- `apps/mini-program/pages/parent/home/index.wxml`
- `apps/mini-program/pages/staff/quick-action/index.wxml`
- No TypeScript or generated JavaScript output changed.

Verification: Mini workflow Page tests passed 9/9 in source and generated-JavaScript modes; Mini shared-service Page tests passed 5/5 in both modes; typecheck, scoped ESLint, page-registration guard, changed-test-block Prettier check, and `git diff --check` passed. Whole-file Prettier is `PARTIAL` because unchanged source already contains formatting drift; WXML has no configured Prettier parser. The three authorized paths were selectively synced and match the isolated worktree byte-for-byte. WeChat Developer Tools interaction/visual review remains `NOT_RUN`.

### D12C: Cross-client acceptance and restart behavior

Run one ordered flow against the shared service: employee creates a report, employee submits, Admin reviews, Admin publishes, parent Web and Mini read the same ID/version, each parent receipt is recorded independently, Admin revokes publication, and both parent projections stop showing the report. Restart the service and confirm the volatile record is gone and each client displays a clear empty/disconnected state.

Verification: use a single documented local script or browser/API harness that records the ID at every handoff; assert the ID is byte-for-byte identical, assert no parent visibility before publication or after revocation, assert no data survives restart, and assert zero non-loopback requests. Keep this separate from real authentication, real student data, persistence, external notifications, formal AI, deployment, and release.

The D12C execution contract is `docs/superpowers/plans/2026-10-10-task20-d12c-three-client-care-record.md`. Its only product/test path is `tests/e2e/care-record-shared.spec.ts`; the existing User Web/Admin integration harness was extended to run actual Mini staff and parent Page handlers against the same in-memory service. The test covers one shared ID through User Web parent `parent-alpha` and Mini, then uses separately approved Mini parent profiles `parent-alpha` and `parent-beta` to verify per-guardian receipts. The User Web adapter intentionally supports only `parent-alpha` in D12A; D12C did not widen that product interface just for a test. Publication revocation and close/recreate state clearing pass in source and generated-JavaScript modes. `LOCAL_SYNTHETIC_CORE_ROOT` points to the existing isolated service build; no dependency or external service was added.

D12C result (2026-10-10): `PASS_LOCAL_SYNTHETIC`; the expanded E2E passed 1/1 in TypeScript-source and generated-JavaScript modes. One record moved v1 draft → v2 submitted → v3 confirmed → v4 published; User Web and Mini `parent-alpha` independently showed `ACKNOWLEDGED`, while Mini `parent-beta` showed its own `UNREAD` → `READ` → `ACKNOWLEDGED` receipt. Admin revocation hid the record from both parent projections. Recreated the in-memory service on the same loopback port: the prior owner handle was rejected, and newly connected Web employee/parent, Admin reviewer, and Mini profiles saw empty projections. All requests remained on `127.0.0.1`; 199 Mini calls were observed per run. The isolated and main test path both have SHA-256 `EE87CCBCD478073F64B2B1B91613CB7668446145F58009BAC163C9736381096A`. D12A Web/Admin suites passed 109/109 and 110/110; D12B Mini Page/service tests passed 9/9 and 5/5 in both modes. Mini typecheck, page-registration guard, scoped ESLint, changed-test Prettier, and whitespace check passed. A missing shared-core environment variable caused one initial setup-only failure; the rerun with the existing core path passed. No source/test files outside the single D12C E2E path were changed for this slice. Owner Review and WeChat Developer Tools visual review remain separate and are not claimed.

D12 is complete for local synthetic implementation and automated verification. This evidence does not represent real institution acceptance, production authentication, persistent storage, or visual/touch review in WeChat Developer Tools.

## Execution rules

- Before each D12 sub-step, create its exact-write-set execution contract and use a dedicated worktree. Preserve existing dirty and untracked files; selectively sync only after comparing destination/source hashes.
- Write the failing shared-ID test first. Do not count local model tests or matching pre-seeded text as cross-client proof.
- Keep `apps/mini-program/src/pages/staff.test.ts` untouched.
- Do not install dependencies, modify lockfiles, add external services, or commit, push, deploy, or publish.
- D10/G25 native visual review remains an independent pending manual gate; it does not authorize replacing it with automated screenshots or block this service integration work.
