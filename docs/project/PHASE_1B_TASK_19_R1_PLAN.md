# Phase 1B Task 19 R1 User Web Runtime and Visual Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a dependency-free, real browser runtime for the existing user-web visitor projection and produce temporary three-viewport readiness evidence without expanding Task 19's permanent delivery set.

**Architecture:** Keep the existing JSX-free visitor projection as the business and security boundary. Add a native browser ES-module entry, first-party CSS, a deterministic Node-built-in asset copy step, and a Node-built-in loopback preview server. Both `/visitor` and `/web/visitor/home` resolve to the same home projection; R1 adds no business feature and performs no external request.

**Tech Stack:** Node.js 24.14.0 built-ins, TypeScript 5.7.3 native ES modules, pnpm 11.22.0, repository ESLint and Prettier, Node test runner, existing browser tooling.

---

TASK_ID=PHASE_1B_TASK_19_R1
TASK_NAME=TASK19_R1_USER_WEB_RUNTIME_AND_VISUAL_READINESS
TASK19_R1_STARTED=NO
TASK19_R1_STAGE_A_STATUS=PROPOSED_PENDING_OWNER_REVIEW
TASK19_R1_IMPLEMENTATION_AUTHORIZED=NO
TASK19_STAGE_B_AUTHORIZATION=NOT_GRANTED
TASK19_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK19_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK20_PLUS_STARTED=NO
TASK20_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK19_R1_STAGE_A_OWNER_REVIEW_GATE
STOP_REASON=TASK19_R1_STAGE_A_OWNER_REVIEW_GATE

## R1 remote state observation

GIT_PUSH_EXECUTED=YES
GIT_PUSH_COMMIT=6f02fa113e69b14e05ca5a8ea03d3c1769aa8da2
GIT_PUSH_TIME=2026-09-21T01:36:02+08:00
GIT_PUSH_ACTOR=UNKNOWN
PUSH_AUTHORIZATION=NOT_VERIFIABLE_FROM_CURRENT_RECORD

## Scope lock

This plan formalizes a Task 19 blocker repair. It does not authorize execution.
Task 19 Stage B remains paused, and the existing Task 06 and Task 18 historical
evidence exceptions retain their accepted meanings.

### Source file map

| Operation | Path                                          | Responsibility                                                              |
| --------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| CREATE    | `apps/user-web/index.html`                    | Browser document, semantic shell, local CSS and ES-module references        |
| MODIFY    | `apps/user-web/package.json`                  | Existing-toolchain build, preview, and focused test scripts only            |
| CREATE    | `apps/user-web/src/main.ts`                   | Browser route selection, synthetic-data composition, navigation state       |
| CREATE    | `apps/user-web/src/styles/user-web.css`       | First-party responsive and accessible visual system                         |
| MODIFY    | `apps/user-web/src/routes/visitor.routes.tsx` | Preserve `/visitor`; add `/web/visitor/home` compatibility mapping          |
| MODIFY    | `apps/user-web/src/pages/visitor-home.tsx`    | Semantic home markup and non-functional empty-state presentation            |
| MODIFY    | `apps/user-web/src/pages/visitor-content.tsx` | Shared semantic shell and local navigation consistency                      |
| CREATE    | `apps/user-web/build.mjs`                     | Deterministic static-asset validation and copy using Node built-ins         |
| CREATE    | `apps/user-web/preview.mjs`                   | Loopback-only static server using Node built-ins                            |
| MODIFY    | `apps/user-web/src/pages/visitor.test.tsx`    | Route parity, fail-closed content, empty-state, and keyboard contract tests |
| CREATE    | `tests/e2e/user-web-runtime.spec.ts`          | Built runtime, server boundary, and route-parity integration tests          |

Generated `apps/user-web/dist/**` and future
`artifacts/task-19/tmp/r1-user-web/**` diagnostics are temporary outputs. They
are not permanent source files and do not expand Task 19's 31 permanent paths.

## Task 1: Lock the failing runtime contract

**Files:**

- Modify: `apps/user-web/src/pages/visitor.test.tsx`
- Create: `tests/e2e/user-web-runtime.spec.ts`

- [ ] **Step 1: Add a focused route-parity test**

Add a table-driven assertion that passes `/visitor` and
`/web/visitor/home` to `selectVisitorRoute`, then verifies both results have
`kind === "HOME"`, heading `访客首页`, identical item slugs, identical
`focusOrder`, empty request arrays, and empty external-destination arrays.

- [ ] **Step 2: Add the empty-state presentation contract**

Assert the visitor home contains the exact labels `暂无课程`, `暂无活动`, and
`暂无校区`, while containing no course, campus, pickup, enrollment, payment, or
external navigation route.

- [ ] **Step 3: Add the runtime integration contract**

The new runtime spec must use Node built-ins only. It must assert:

```ts
assert.equal(indexHtml.includes("./styles/user-web.css"), true);
assert.equal(indexHtml.includes("./main.js"), true);
assert.doesNotMatch(indexHtml, /https?:\/\//u);
assert.equal(visitor.status, 200);
assert.equal(compatibility.status, 200);
assert.equal(visitor.body, compatibility.body);
assert.equal(startup.host, "127.0.0.1");
assert.ok(startup.port > 0);
```

The test must also prove traversal is rejected, `GET` and `HEAD` work, and the
server exits cleanly.

- [ ] **Step 4: Run only the focused tests and confirm RED**

Run:

```powershell
corepack pnpm --filter @student-care/user-web build
node --test apps/user-web/dist/pages/visitor.test.js
node --experimental-strip-types --test tests/e2e/user-web-runtime.spec.ts
```

Expected before implementation: the alias/empty-state assertion fails and the
runtime spec fails because the browser entry, CSS, and preview server do not
exist. Any dependency or lockfile mutation is an immediate stop.

## Task 2: Add deterministic browser assets

**Files:**

- Create: `apps/user-web/index.html`
- Create: `apps/user-web/build.mjs`
- Modify: `apps/user-web/package.json`

- [ ] **Step 1: Create the browser document**

Use semantic `header`, `nav`, `main`, and `footer` landmarks. Include a visible
on-focus skip link and these local references only:

```html
<link rel="stylesheet" href="./styles/user-web.css" />
<script type="module" src="./main.js"></script>
```

Do not add inline presentation CSS, external URLs, third-party fonts, or copied
reference-site content.

- [ ] **Step 2: Add the static-copy build step**

`build.mjs` must use `node:fs/promises`, `node:path`, and `node:url`. It must:

1. validate that the emitted browser graph contains no bare module import;
2. create `dist/styles`;
3. copy `index.html` to `dist/index.html`;
4. copy `src/styles/user-web.css` to `dist/styles/user-web.css`;
5. verify `dist/main.js` exists; and
6. fail nonzero if any generated HTML or CSS contains `http://` or `https://`.

- [ ] **Step 3: Update package scripts without dependencies**

The script contract is:

```json
{
  "build": "tsc -p tsconfig.json && node build.mjs",
  "preview": "node preview.mjs",
  "test": "tsc -p tsconfig.json && node --test dist/pages/visitor.test.js"
}
```

Keep every existing package field and dependency declaration unchanged.

- [ ] **Step 4: Verify deterministic output**

Run the build twice from unchanged source. Hash `dist/index.html`,
`dist/styles/user-web.css`, `dist/main.js`, and the visitor route/page modules.
Expected: both SHA sets are byte-identical.

## Task 3: Establish browser routing and rendering

**Files:**

- Create: `apps/user-web/src/main.ts`
- Modify: `apps/user-web/src/routes/visitor.routes.tsx`
- Modify: `apps/user-web/src/pages/visitor-home.tsx`
- Modify: `apps/user-web/src/pages/visitor-content.tsx`

- [ ] **Step 1: Preserve and alias the visitor route**

Normalize the pathname without query or trailing slash. Treat `/visitor` and
`/web/visitor/home` as HOME. Preserve `/visitor/content/:slug` exactly. Unknown
paths must fail closed to the existing unavailable-content projection.

- [ ] **Step 2: Compose the browser page**

`main.ts` must import only relative `.js` modules, call
`createSyntheticVisitorResponse()`, select from `window.location.pathname`, and
place the accepted escaped HTML into the document's application root. It may
handle same-origin links with `history.pushState` and `popstate`; it must not
call `fetch`, use storage, open a WebSocket, or contact an external URL.

- [ ] **Step 3: Add semantic visitor presentation**

The page must contain a skip target, one H1, status text with `aria-live`, a
primary content CTA, and three explicit non-functional empty-state blocks:

```html
<section aria-labelledby="courses-empty-heading">
  <h2 id="courses-empty-heading">暂无课程</h2>
</section>
<section aria-labelledby="events-empty-heading">
  <h2 id="events-empty-heading">暂无活动</h2>
</section>
<section aria-labelledby="campuses-empty-heading">
  <h2 id="campuses-empty-heading">暂无校区</h2>
</section>
```

These blocks must not link to unimplemented business pages.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:

```powershell
corepack pnpm --filter @student-care/user-web test
node --experimental-strip-types --test tests/e2e/user-web-runtime.spec.ts
```

Expected: all focused assertions pass with zero external request behavior.

## Task 4: Add the first-party responsive design system

**Files:**

- Create: `apps/user-web/src/styles/user-web.css`

- [ ] **Step 1: Define original tokens**

Use project-owned tokens with zero letter spacing and restrained geometry:

```css
:root {
  --color-brand-blue: #2455a6;
  --color-brand-purple: #7446a8;
  --color-ink: #172238;
  --color-muted: #526076;
  --color-surface: #ffffff;
  --color-soft: #eef3f8;
  --focus-ring: #b23a67;
  --radius-control: 6px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
}
```

These values are original project tokens, not copied reference-site assets.

- [ ] **Step 2: Implement responsive composition**

Desktop uses a constrained content width, horizontal navigation, a media/overlay
hero hierarchy, and compact repeated sections. At `max-width: 720px`, switch to
a real menu button and a single-column flow. Do not preserve a fixed desktop
canvas on mobile, and do not size typography with viewport width.

- [ ] **Step 3: Enforce interaction accessibility**

Every link and button must have `min-inline-size` or padding sufficient for a
`44x44px` narrow-viewport target. Use `:focus-visible` with a visible outline
and offset. Ensure normal text contrast is at least `4.5:1`, large text/UI
contrast is at least `3:1`, and focused controls are not clipped.

- [ ] **Step 4: Verify both narrow widths statically**

Inspect media rules for `390px` and `320px`. Expected: no fixed minimum width,
no absolute positioning that creates horizontal overflow, and no hidden focus
target.

## Task 5: Add the loopback-only preview server

**Files:**

- Create: `apps/user-web/preview.mjs`

- [ ] **Step 1: Implement the server boundary**

Use only Node built-ins. The constants and listen boundary are fixed:

```js
const HOST = "127.0.0.1";
const REQUESTED_PORT = 0;
server.listen(REQUESTED_PORT, HOST, () => {
  const address = server.address();
  // Emit PID, address.port, and http://127.0.0.1:<actual-port>.
});
```

Resolve every request against `dist`, reject traversal, serve only `GET` and
`HEAD`, and map `/visitor` plus `/web/visitor/home` to `index.html`.

- [ ] **Step 2: Add deterministic startup and shutdown records**

The startup line must be parseable JSON containing `pid`, `host`, `port`, and
`baseUrl`. Shutdown must close the exact server and confirm the listener is gone.

- [ ] **Step 3: Run the runtime integration test**

Run:

```powershell
node --experimental-strip-types --test tests/e2e/user-web-runtime.spec.ts
```

Expected: dynamic port greater than zero, loopback host only, route parity,
correct MIME types, traversal rejection, and clean shutdown.

## Task 6: Run quality and real-browser readiness gates

**Files:**

- Read only: the 11 source-whitelist files
- Temporary output only: `apps/user-web/dist/**`
- Temporary evidence only: `artifacts/task-19/tmp/r1-user-web/**`

- [ ] **Step 1: Run static quality gates**

```powershell
corepack pnpm --filter @student-care/user-web build
corepack pnpm --filter @student-care/user-web typecheck
corepack pnpm --filter @student-care/user-web lint
corepack pnpm exec prettier --check apps/user-web/index.html apps/user-web/package.json apps/user-web/src/main.ts apps/user-web/src/styles/user-web.css apps/user-web/src/routes/visitor.routes.tsx apps/user-web/src/pages/visitor-home.tsx apps/user-web/src/pages/visitor-content.tsx apps/user-web/build.mjs apps/user-web/preview.mjs apps/user-web/src/pages/visitor.test.tsx tests/e2e/user-web-runtime.spec.ts
corepack pnpm --filter @student-care/user-web test
node --experimental-strip-types --test tests/e2e/user-web-runtime.spec.ts
```

Expected: every command exits 0 and `pnpm-lock.yaml` remains byte-identical.

- [ ] **Step 2: Start dynamic preview**

Start `corepack pnpm --filter @student-care/user-web preview`, parse its JSON
startup record, and verify the listener belongs to that PID and is bound only to
the reported `127.0.0.1` address.

- [ ] **Step 3: Run six browser cases**

For `/visitor` and `/web/visitor/home`, run `1440x1024`, `390x844`, and
`320x568`. Record screenshot, `scrollWidth/clientWidth`, body width, key
bounding boxes, computed colors, contrast, Tab order, focus ring visibility,
touch-target sizes, console, page errors, failed requests, and every request
origin.

Expected for each case: no horizontal overflow, no clipped text or focus,
minimum `44x44px` controls on narrow screens, compliant contrast, zero page or
severe console error, zero failed request, and zero external request.

- [ ] **Step 4: Stop and verify cleanup**

Terminate only the recorded preview PID, verify its listener count is zero, and
clean only R1 temporary files created and registered during that run. Do not
touch the 31 permanent outputs, protected paths, or pre-existing evidence.

## Task 7: Review the exact write set

**Files:**

- Modify/Create: only the 11 source-whitelist paths
- Read only: governance, frozen evidence, Task 19 permanent outputs, and
  protected paths

- [ ] **Step 1: Verify source scope**

```powershell
git diff --name-only
git diff --check
git diff --cached --check
```

Expected: only the 11 authorized source/test paths appear, index is clean, and
both diff checks pass.

- [ ] **Step 2: Verify governance boundaries**

Confirm Task 19 historical exceptions are unchanged, Task 19 C1/C2 and Task
20+ remain unauthorized, V42 and `pnpm-lock.yaml` are byte-identical, and no
31-path permanent output has changed.

- [ ] **Step 3: Stop for owner review**

Report exact file SHA values, commands and exit codes, six browser cases,
temporary output inventory, preview cleanup, protected-path metadata status,
and every unrun gate. Do not stage, commit, push, deploy, release, or resume Task
19 Stage B without separate authorization.

## Stage A self-review

- Spec coverage: the plan covers the exact 11 source files, dependency-free
  build, dynamic loopback preview, route parity, responsive visual evidence,
  accessibility, network isolation, and stop conditions.
- Placeholder scan: no implementation step relies on an unspecified file,
  command, output root, route, or acceptance criterion.
- Type consistency: route names, status fields, output roots, and source paths
  match the execution contract.
- Current status: every checkbox remains unchecked because implementation is
  not authorized.

Stage A stops at `TASK19_R1_STAGE_A_OWNER_REVIEW_GATE`.
