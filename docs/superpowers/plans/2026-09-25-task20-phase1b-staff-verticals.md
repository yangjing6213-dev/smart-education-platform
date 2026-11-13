# Task20 Phase1B Staff Verticals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` to implement this contract task-by-task. Steps use checkbox syntax and must remain within the exact write set.

**Status:** `DRAFT_PENDING_IMPLEMENTATION_AUTHORIZATION`

**Goal:** Complete the Phase 1B V0.1 employee-facing vertical slice across user-web and the existing native Mini staff pages, with synthetic access, tenant/campus scoping, guides/resources navigation, teacher public/internal separation, and a non-interactive partner-cloud explanation.

**Architecture:** Reuse the existing Web staff route selector and page projections, extending only the missing partner-cloud wiring and the evidence needed to prove access isolation. Reuse the two registered Mini staff pages and their local projection modules; do not add Mini routes or replace the protected historical staff test. All state remains in memory and all displayed records are synthetic.

**Tech Stack:** Existing TypeScript/TSX, native WXML/WXSS, Node `node:test`, TypeScript 5.7, ESLint, Prettier, the existing user-web preview, and the existing Mini TypeScript compiler/page-registration guard. No new package, API, database, authentication provider, storage, or external service.

---

## 1. Authority and contract boundary

- Product authority: `C:\Users\HU\Desktop\同芯机构项目\student-care-platform-complete-plan-v2.0.pdf`, SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`.
- Master implementation plan: `docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md`, SHA-256 `ADE8ECCC5FF23A39E9E9FB5871675C2320F663B26CC0418C33738FFD317DB38B`.
- Contract ID: `TASK20_PHASE_1B_STAFF_VERTICALS`.
- Owner authorization in this turn: contract planning only. Implementation authorization remains `NOT_GRANTED` until this plan's exact write set is explicitly approved.
- Isolation required for implementation: `C:\Users\HU\.codex\worktrees\task20-phase1b-staff-verticals` on a dedicated `codex/` branch.

The contract implements V3 Task M1.2 only. It does not begin M1.3 administration, M1.4 institution cooperation, Phase 2 parent work, or any real-service integration.

## 2. Exact write set for a future implementation authorization

### 2.1 Governance files

`MODIFY`:

- `PLANS.md` — record implementation status, verification, Owner Review, and remaining risks.

### 2.2 Web files

`MODIFY`:

- `apps/user-web/src/main.ts`
- `apps/user-web/src/routes/staff.routes.tsx`
- `apps/user-web/src/pages/staff-workbench.tsx`
- `apps/user-web/src/pages/staff-guides.tsx`
- `apps/user-web/src/pages/resources.tsx`
- `apps/user-web/src/pages/partner-link.tsx`
- `apps/user-web/src/pages/staff.test.tsx`
- `apps/user-web/src/pages/staff-content.test.tsx`
- `tests/e2e/staff.spec.ts`
- `tests/e2e/user-web-runtime.spec.ts`

The Web contract may wire the already-existing `PartnerLinkPage` module at `/web/staff/partner-cloud`; it may not introduce an additional page module or an external destination.

### 2.3 Mini files

`MODIFY`:

- `apps/mini-program/pages/staff/workbench/index.ts`
- `apps/mini-program/pages/staff/workbench/index.wxml`
- `apps/mini-program/pages/staff/workbench/index.wxss`
- `apps/mini-program/pages/staff/quick-action/index.ts`
- `apps/mini-program/pages/staff/quick-action/index.wxml`
- `apps/mini-program/pages/staff/quick-action/index.wxss`
- `apps/mini-program/src/routes/staff.routes.ts`
- `apps/mini-program/src/pages/staff/workbench.ts`
- `apps/mini-program/src/pages/staff/quick-action.ts`

`CREATE` one focused test file:

- `apps/mini-program/src/pages/staff-verticals.test.ts`

`MODIFY` only when this contract's TypeScript compile changes their contents:

- `apps/mini-program/pages/staff/workbench/index.js`
- `apps/mini-program/pages/staff/quick-action/index.js`
- `apps/mini-program/src/routes/staff.routes.js`
- `apps/mini-program/src/pages/staff/workbench.js`
- `apps/mini-program/src/pages/staff/quick-action.js`

### 2.4 Explicitly protected paths

The implementation must not modify or create:

- `apps/mini-program/src/pages/staff.test.ts` (the existing historical assertion exception remains untouched)
- `apps/mini-program/app.json`, any `index.json`, or any visitor page
- `apps/user-web/src/pages/visitor*`, visitor routes, or public-content data
- `apps/api/`, `packages/`, database/schema/migration files, authentication code, lockfiles, or dependency manifests
- any new Mini route/page directory
- any production configuration, secret, external URL, network client, storage adapter, partner-cloud API, commit, push, deployment, upload, or release artifact

## 3. Required behavior

### 3.1 Access and scope matrix

The Web and Mini projections must fail closed for each of these inputs:

| Input                                                                           | Expected result                  |
| ------------------------------------------------------------------------------- | -------------------------------- |
| active employee, active membership, matching tenant/campus, required capability | authorized page or local action  |
| visitor identity or missing session                                             | denied state; no staff content   |
| missing membership                                                              | denied state; no staff content   |
| suspended or revoked membership                                                 | denied state; no staff content   |
| foreign tenant or campus on identity or membership                              | denied state; no foreign content |
| missing route capability                                                        | denied state; no action result   |
| malformed record or non-published record                                        | error/empty state; no raw fields |

The employee demonstration must remain clearly labeled synthetic and non-authenticating. Scope is derived from the synthetic access object; no frontend tenant ID is trusted as an authority.

### 3.2 Web verticals

- Keep `/staff/workbench`, `/staff/report`, `/staff/guides`, and `/web/staff/resources` behavior and existing public/internal separation intact.
- Wire `/web/staff/partner-cloud` to the existing partner page projection.
- Render the partner page as a local, non-interactive explanation: symbolic name, purpose, category/role description, and an explicit “暂未开放/入口不可用” state. It must contain no `<a href>` to a partner host, no `window.open`, no `fetch`, no storage write, and no network request list entry.
- Guides and resources must expose list, no-result, detail-selection, and return behavior using existing local event handling. Every state must retain a `role="status"` announcement and keyboard-reachable controls.
- Workbench task/resource records must include only `PUBLISHED` synthetic records from the active tenant/campus; private, draft, stale, disabled, and foreign records remain absent.
- Public teacher content remains the public projection; internal pages must not render private profile fields, student names, contact data, health data, or hidden archive fields.

### 3.3 Mini verticals

- Keep only `pages/staff/workbench/index` and `pages/staff/quick-action/index`.
- Workbench must expose ready, empty, and denied states, local task projection, quick-action navigation, and return-to-visitor navigation.
- Quick action must expose only the two existing bounded local actions and a deterministic back fallback.
- WXML/WXSS must keep 44px touch targets, status announcements, narrow-phone layout, and no external resources.
- Mini focused tests must live in the new `staff-verticals.test.ts`; the protected `staff.test.ts` is read-only.

## 4. TDD implementation sequence

### Task 1: Freeze the implementation baseline

Files: no product files; use the isolated implementation worktree.

- [ ] Record `HEAD`, branch, target file hashes, tracked status, and protected-path status before editing.
- [ ] Confirm no dependency installation is required and the existing Node/pnpm toolchain is available.
- [ ] Run the current Web staff focused tests, Mini staff focused tests, and staff E2E once; record the known historical Mini `staff.test.ts` exception without changing it.

### Task 2: Add Web red tests for the missing partner boundary

Files: `apps/user-web/src/pages/staff-content.test.tsx`, `apps/user-web/src/pages/staff.test.tsx`, `tests/e2e/staff.spec.ts`, `tests/e2e/user-web-runtime.spec.ts`.

- [ ] Add a test named `partner page is unavailable without an external destination` that asserts the rendered page contains the synthetic label and unavailable copy, has no `href`/`https://`/`window.open`/`fetch`, and returns an empty external-request list.
- [ ] Add access cases for missing membership, suspended membership, revoked membership, foreign tenant, foreign campus, and missing partner capability; each must return the denied route and no private text.
- [ ] Add a runtime path assertion for `/web/staff/partner-cloud` and preserve the four existing staff paths.
- [ ] Run the focused Web tests and confirm the new assertions fail because the partner route is not yet wired.

### Task 3: Implement the minimal Web staff slice

Files: the Web write set in section 2.2.

- [ ] Extend `StaffRouteKey` and the route union with the existing partner-cloud path and its required capability check.
- [ ] Render the partner projection from `main.ts` through the internal shell, keeping the synthetic/non-authenticated badge and existing navigation.
- [ ] Make the partner view explicitly unavailable and non-interactive while preserving safe symbolic metadata.
- [ ] Keep guides/resources selection local and keyboard accessible; do not add a server adapter or persistence.
- [ ] Run the new focused tests and verify they pass without changing the protected Mini test.

### Task 4: Add Mini red tests in a new focused file

Files: create `apps/mini-program/src/pages/staff-verticals.test.ts`.

- [ ] Test active scoped employee ready projection and both bounded actions.
- [ ] Test visitor, missing membership, suspended, revoked, foreign tenant/campus, and missing capability denial.
- [ ] Test WXML contains status announcements, only the two existing staff routes, no external URL, no storage/fetch usage, and no new page registration.
- [ ] Run `node --test --experimental-strip-types apps/mini-program/src/pages/staff-verticals.test.ts` and verify the new assertions fail before touching the Mini implementation.

### Task 5: Implement the minimal Mini staff slice

Files: the Mini write set in section 2.3.

- [ ] Keep `getStaffRoute`, `buildWorkbenchProjection`, and `runQuickAction` as the access/data boundary; reject malformed, non-synthetic, non-published, disabled, stale, private, and foreign records.
- [ ] Preserve the existing two registered pages and update only their page data, WXML, and WXSS where the focused tests prove a gap.
- [ ] Keep all navigation local to `/pages/staff/workbench/index`, `/pages/staff/quick-action/index`, and `/pages/visitor/home/index`.
- [ ] Compile only the listed Mini source files when generated JS changes; never emit into the main worktree outside the listed paths.
- [ ] Run the new focused tests and then rerun the pre-existing `staff.test.ts` as an observation; do not edit its existing failure.

### Task 6: Cross-client and visual verification

Run from the implementation worktree after Tasks 3 and 5:

```powershell
corepack pnpm --filter @student-care/user-web typecheck
corepack pnpm --filter @student-care/user-web lint
corepack pnpm --filter @student-care/user-web build
corepack pnpm --filter @student-care/user-web test
node --test --experimental-strip-types apps/user-web/dist/pages/staff.test.js apps/user-web/dist/pages/staff-content.test.js
node --test --experimental-strip-types apps/mini-program/src/pages/staff-verticals.test.ts
node --test --experimental-strip-types tests/e2e/staff.spec.ts tests/e2e/user-web-runtime.spec.ts
node_modules/.bin/tsc.cmd -p apps/mini-program/tsconfig.json --noEmit
node scripts/verify_mini_page_registration.mjs --require-generated-js
node_modules/.bin/eslint apps/user-web/src/main.ts apps/user-web/src/routes/staff.routes.tsx apps/user-web/src/pages/staff-workbench.tsx apps/user-web/src/pages/staff-guides.tsx apps/user-web/src/pages/resources.tsx apps/user-web/src/pages/partner-link.tsx apps/user-web/src/pages/staff.test.tsx apps/user-web/src/pages/staff-content.test.tsx apps/mini-program/pages/staff apps/mini-program/src/routes/staff.routes.ts apps/mini-program/src/pages/staff apps/mini-program/src/pages/staff-verticals.test.ts
node_modules/.bin/prettier.cmd --check --ignore-unknown PLANS.md apps/user-web/src/main.ts apps/user-web/src/routes/staff.routes.tsx apps/user-web/src/pages/staff-workbench.tsx apps/user-web/src/pages/staff-guides.tsx apps/user-web/src/pages/resources.tsx apps/user-web/src/pages/partner-link.tsx apps/user-web/src/pages/staff.test.tsx apps/user-web/src/pages/staff-content.test.tsx tests/e2e/staff.spec.ts tests/e2e/user-web-runtime.spec.ts apps/mini-program/pages/staff apps/mini-program/src/routes/staff.routes.ts apps/mini-program/src/pages/staff apps/mini-program/src/pages/staff-verticals.test.ts
git diff --check
```

- [ ] Web Playwright checks `/staff/workbench`, `/staff/report`, `/staff/guides`, `/web/staff/resources`, and `/web/staff/partner-cloud` at 390×844, 768×900, and 1280×900. Record page errors, severe console errors, failed requests, external requests, horizontal overflow, focus order, and 44px targets.
- [ ] Mini DevTools compilation and user visual review cover workbench ready/denied, quick action, back fallback, no external requests, and no unexpected registered pages. If automation is unavailable, mark it `NOT_RUN` and request the user's manual review; do not convert static checks into visual PASS.
- [ ] Audit that no API, database, storage, authentication provider, partner-cloud call, dependency, lockfile, or protected path changed.

## 5. Acceptance and stop gates

The contract is `PASS` only when every section 3 behavior is covered by a focused or runtime assertion, the exact write set is the only diff, Web and Mini quality checks pass, and Owner Review accepts the evidence. The historical Mini `staff.test.ts` exception remains separately reported and cannot be silently upgraded or fixed under this contract.

Stop immediately when implementation requires a new route directory, a protected test change, a dependency, an API/database/authentication change, a real or external URL, a storage write, a generated file outside section 2.3, or a production/deployment action. Record the blocker and leave the worktree unchanged beyond already-authorized paths.

## 6. Handoff record

At implementation completion, update `PLANS.md` with:

- `TASK20_PHASE_1B_STAFF_VERTICALS_STATUS=IMPLEMENTED_AND_VERIFIED_PENDING_OWNER_REVIEW`
- exact worktree path and branch
- CREATE/MODIFY path lists and hashes
- Web/Mini focused counts, E2E counts, typecheck, lint, format, build, page-guard, visual and network results
- the known historical `staff.test.ts` result and any remaining `PLANS.md` formatting drift
- `TASK20_PHASE_1B_STAFF_VERTICALS_OWNER_REVIEW=REQUIRED`

No commit, push, deployment, upload, release, or next-phase authorization is implied by this plan.
