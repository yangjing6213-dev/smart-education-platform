# Phase 1B Task 19 R1 Codex Execution Contract

TASK_ID=PHASE_1B_TASK_19_R1
TASK_NAME=TASK19_R1_USER_WEB_RUNTIME_AND_VISUAL_READINESS
TASK_TYPE=TASK19_BLOCKER_REPAIR_SUBTASK
ACTIVE_GOVERNANCE=V42
TASK19_R1_STARTED=NO
TASK19_R1_STAGE_A_STATUS=PROPOSED_PENDING_OWNER_REVIEW
TASK19_R1_IMPLEMENTATION_AUTHORIZED=NO
TASK19_STAGE_B_STATUS=PAUSED_FOR_R1_OWNER_REVIEW
TASK19_STAGE_B_AUTHORIZATION=NOT_GRANTED
TASK19_STAGE_C1_AUTHORIZATION=NOT_GRANTED
TASK19_STAGE_C2_AUTHORIZATION=NOT_GRANTED
TASK20_PLUS_STARTED=NO
TASK20_PLUS_AUTHORIZATION=NOT_GRANTED
OWNER_REVIEW_GATE=TASK19_R1_STAGE_A_OWNER_REVIEW_GATE
STOP_REASON=TASK19_R1_STAGE_A_OWNER_REVIEW_GATE

## 1. Authority and baseline

- Repository root: `C:\Users\HU\Documents\student-care-saas-platform`.
- Stage A branch: `feature/phase-1b-task-19-final-delivery-acceptance`.
- Stage A baseline HEAD: `a95aba6a8feebea4e8e047cc8b13a36a7e160e04`.
- Active authority remains
  `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md`
  with SHA-256
  `7BECA819534A223D84C4D95FD117FC68C4B9CD4CDFC2E5345AF09E9547D188AB`.
- The planning method is the complete local
  `C:\Users\HU\.codex\skills\writing-plans\SKILL.md`, SHA-256
  `4FD4627D2C02367879C0307D7249270BED633317FF9BE82E926A6D57BF5D331B`.
- R1 is a blocker-repair subtask inside Task 19. It is not Task 20 and does
  not authorize Task 19 Stage B, C1, C2, push, deployment, release, or any
  production operation.
- R1 does not change the existing Task 06 or Task 18 historical-evidence
  exceptions. Those limitations remain exactly as recorded by the accepted
  Task 19 contracts and evidence.

## 2. Stage A exact write set

Stage A may create or modify only these four governance files:

1. `AGENTS.md` (modify)
2. `PLANS.md` (modify)
3. `PHASE_1B_TASK_19_R1_CODEX_EXECUTION.md` (create)
4. `docs/project/PHASE_1B_TASK_19_R1_PLAN.md` (create)

Stage A must not stage or commit any path. It must not implement R1, build the
product, start a service, run product tests, run a browser, or write Task 19
delivery evidence.

## 3. Goal and bounded user value

R1 closes only the user-web runtime and visual-readiness gap that prevents Task
19 from obtaining real product-browser evidence. A separately authorized R1
Stage B may:

1. establish a real user-web HTML entry;
2. establish first-party CSS assets;
3. produce reproducible browser-loadable output;
4. preview that output with a Node built-in HTTP server bound only to
   `127.0.0.1:0`;
5. preserve the existing `/visitor` route;
6. map `/web/visitor/home` to the same accepted visitor-home projection;
7. render only existing content and clearly synthetic data;
8. define the non-functional empty states `暂无课程`, `暂无活动`, and
   `暂无校区`; and
9. provide real three-viewport visual evidence for Task 19 review.

R1 must not implement course catalog, course detail, campus directory, pickup,
enrollment, payment, authentication, or any other new business feature.

## 4. Candidate Stage B source whitelist

The classification below was verified at baseline HEAD
`a95aba6a8feebea4e8e047cc8b13a36a7e160e04`. Stage B must recheck existence,
tracked status, and history before writing. Any classification drift is
`STATUS=BLOCKED` pending owner review.

### 4.1 CREATE

| Path                                    | Baseline state    | Baseline history |
| --------------------------------------- | ----------------- | ---------------- |
| `apps/user-web/index.html`              | absent, untracked | none             |
| `apps/user-web/src/main.ts`             | absent, untracked | none             |
| `apps/user-web/src/styles/user-web.css` | absent, untracked | none             |
| `apps/user-web/build.mjs`               | absent, untracked | none             |
| `apps/user-web/preview.mjs`             | absent, untracked | none             |
| `tests/e2e/user-web-runtime.spec.ts`    | absent, untracked | none             |

### 4.2 MODIFY

| Path                                          | Baseline state | Last path history                          |
| --------------------------------------------- | -------------- | ------------------------------------------ |
| `apps/user-web/package.json`                  | tracked file   | `78a0d9ef80a5c0bf634ab46f730cd386c05a180c` |
| `apps/user-web/src/routes/visitor.routes.tsx` | tracked file   | `69ee287fdebe6e90ee170ce3405cae5f832ac48b` |
| `apps/user-web/src/pages/visitor-home.tsx`    | tracked file   | `69ee287fdebe6e90ee170ce3405cae5f832ac48b` |
| `apps/user-web/src/pages/visitor-content.tsx` | tracked file   | `69ee287fdebe6e90ee170ce3405cae5f832ac48b` |
| `apps/user-web/src/pages/visitor.test.tsx`    | tracked file   | `69ee287fdebe6e90ee170ce3405cae5f832ac48b` |

No other permanent source or test path is permitted. Generated
`apps/user-web/dist/**` output and future R1 diagnostics under
`artifacts/task-19/tmp/r1-user-web/**` are temporary, ignored outputs rather
than additions to this source whitelist. Their creation and exact cleanup must
be separately authorized in R1 Stage B. They must never expand or overwrite
the 31-path Task 19 permanent output set.

## 5. Explicit prohibitions

R1 must not modify, delete, move, stage, or commit:

- `tests/e2e/visitor.spec.ts`;
- any other frozen Task 18 test or verifier;
- `apps/mini-program/**`;
- product API, database, schema, or migration paths;
- `pnpm-lock.yaml`, dependency declarations, or package versions;
- V42 or any Task 01-18 frozen evidence;
- the accepted Task 19 checkpoint or its historical-exception semantics;
- any of the 31 Task 19 permanent output paths;
- any protected untracked path; or
- any Task 20+ file.

R1 must not copy the reference site's source, images, fonts, icons, text, brand
assets, or distinctive composition. It may reuse only general design rules:
blue/purple brand contrast, a media-overlay hierarchy, a clear CTA, a
single-column mobile layout, and semantic landmarks. No external asset or font
request is allowed.

## 6. Technical feasibility decision

The current user-web package uses TypeScript 5.7.3 through the existing root
toolchain. `apps/user-web/tsconfig.json` emits ES modules to `dist` and the
accepted visitor runtime graph uses relative `.js` imports. The current browser
runtime graph contains no bare module import. Therefore:

- `tsc` output can be loaded by a browser as native ES modules once a real
  `index.html`, `main.js`, and copied CSS asset exist;
- no bundler is required for the approved R1 scope;
- `build.mjs` may use only Node built-ins to validate and copy static assets
  after `tsc` succeeds; and
- `preview.mjs` may use only Node built-ins to serve the generated `dist`
  directory.

Before implementation, Stage B must inspect the exact browser graph:

```powershell
rg -n "(?:from|import\()\s*['\"][^./]" `
  apps/user-web/src/main.ts `
  apps/user-web/src/routes/visitor.routes.tsx `
  apps/user-web/src/pages/visitor-home.tsx `
  apps/user-web/src/pages/visitor-content.tsx
```

Expected result: no matches. Node-only imports in `*.test.tsx`, `build.mjs`, or
`preview.mjs` are not browser imports. If the browser graph contains a bare
module import, requires Vite/Webpack or another bundler, or needs any dependency
or lockfile change, Stage B must stop with:

```text
DEPENDENCY_EXPANSION_REQUIRED
```

No dependency installation, online fallback, or temporary lockfile rewrite is
permitted.

## 7. Build and preview design

The planned build remains deterministic and dependency-free:

1. `tsc -p apps/user-web/tsconfig.json` emits JavaScript, declarations, and
   source maps to `apps/user-web/dist/`.
2. `apps/user-web/build.mjs` verifies that the browser graph has no bare module
   import, copies `apps/user-web/index.html` to `apps/user-web/dist/index.html`,
   and copies `apps/user-web/src/styles/user-web.css` to
   `apps/user-web/dist/styles/user-web.css`.
3. The generated HTML references only `./styles/user-web.css` and
   `./main.js`; it must not contain an external URL.
4. Repeating the build from unchanged source must produce byte-identical HTML,
   CSS, and JavaScript assets.

The planned preview server must:

- use `node:http`, `node:fs`, `node:path`, and `node:url` only;
- bind exactly `127.0.0.1` with requested port `0`;
- read `server.address().port` after listen succeeds;
- print one machine-readable startup record containing PID, actual port, and
  base URL;
- serve `GET` and `HEAD` only from `apps/user-web/dist`;
- map `/visitor` and `/web/visitor/home` to `dist/index.html`;
- reject traversal, encoded traversal, and paths outside `dist`;
- set explicit HTML, CSS, JavaScript, and icon MIME types;
- produce no external request; and
- close cleanly on `SIGINT` or `SIGTERM`.

Port `0` is never a browser URL. Browser validation must use the actual port
reported after startup.

## 8. Runtime and visual behavior

`apps/user-web/src/main.ts` is the browser composition boundary. It may import
only the accepted visitor route and page modules with relative `.js` specifiers.
It must render existing synthetic visitor data and must not call `fetch`, open a
WebSocket, read storage, or contact an external destination.

`/visitor` and `/web/visitor/home` must select the same home projection and
produce the same heading, state, item identifiers, focus order, and external
request set. Existing `/visitor/content/:slug` behavior remains unchanged.

The HTML/CSS must provide:

- semantic `header`, `nav`, `main`, `section`, and `footer` landmarks;
- a visible skip link;
- a first-party blue/purple palette with no copied Wix values required for
  identity;
- an optional media region with a readable overlay and a no-image fallback;
- a clear primary CTA and secondary text action;
- a true mobile navigation control with `aria-expanded` and `aria-controls`;
- a single-column mobile layout with no fixed-width desktop canvas;
- visible keyboard focus using `:focus-visible`;
- minimum `44px` interactive target dimensions at narrow viewports;
- WCAG AA text contrast (`4.5:1` normal text, `3:1` large text and UI
  boundaries); and
- explicit non-functional empty-state blocks for `暂无课程`, `暂无活动`, and
  `暂无校区`, without routes or business actions that imply those features are
  implemented.

## 9. Future R1 Stage B validation matrix

R1 Stage B is not authorized by this contract. If separately authorized, it
must run and record every row below.

| Gate               | Required validation                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Build              | `corepack pnpm --filter @student-care/user-web build`; exit 0; expected HTML/CSS/JS assets present; repeated asset SHA values identical |
| Typecheck          | `corepack pnpm --filter @student-care/user-web typecheck`; exit 0                                                                       |
| ESLint             | `corepack pnpm --filter @student-care/user-web lint`; exit 0                                                                            |
| Prettier           | Local Prettier check over all 11 source-whitelist files; exit 0                                                                         |
| Focused page tests | Compile and run `apps/user-web/dist/pages/visitor.test.js`; 0 failed                                                                    |
| Runtime test       | `node --experimental-strip-types --test tests/e2e/user-web-runtime.spec.ts`; 0 failed                                                   |
| Preview            | Bind `127.0.0.1:0`; record PID, actual port, base URL, startup and shutdown                                                             |
| Route parity       | `/visitor` and `/web/visitor/home` return HTTP 200 and the same accepted visitor-home projection                                        |
| Desktop            | `1440x1024`; screenshot plus DOM and accessibility metrics                                                                              |
| Mobile             | `390x844`; screenshot plus DOM and accessibility metrics                                                                                |
| Small mobile       | `320x568`; screenshot plus DOM and accessibility metrics                                                                                |
| Horizontal fit     | For both routes and all viewports, `documentElement.scrollWidth === documentElement.clientWidth` and body overflow is zero              |
| Geometry           | Record header, navigation, hero, CTA, empty-state, and footer bounding boxes                                                            |
| Contrast           | Record foreground/background colors and computed contrast for body text, headings, links, CTA, status text, and focus ring              |
| Keyboard           | Tab order begins with skip link and reaches navigation, CTA, content action, and footer without traps                                   |
| Focus              | Every interactive element has a visible `:focus-visible` indication not clipped by overflow or viewport chrome                          |
| Touch              | Every interactive control at `390x844` and `320x568` has a target of at least `44x44` CSS pixels                                        |
| Browser health     | 0 page errors, 0 severe console errors, 0 failed requests, and 0 unexpected external requests                                           |
| Git scope          | Only the 11 source-whitelist paths plus declared ignored/temp outputs changed; index remains clean until separately authorized          |

The browser matrix contains six exact route/viewport cases: two routes times
three viewports. R1 evidence is temporary readiness evidence only. It does not
replace or modify Task 19's 31 permanent outputs and cannot be called final
delivery acceptance.

## 10. Stop conditions

Stage B must stop without widening scope if any of these occurs:

- a required permanent source or test file is outside the 11-path whitelist;
- a product API, schema, database, migration, mini-program, or Task 20 change is
  required;
- a dependency, bundler, online install, or lockfile change is required;
- a browser asset contains an external URL or a browser request leaves
  `127.0.0.1`;
- `/visitor` and `/web/visitor/home` cannot share one accepted projection;
- a frozen test must be modified, skipped, weakened, or reclassified;
- a protected path or Task 19 permanent output would be modified;
- generated output escapes the declared `dist` or Task 19 temporary roots;
- real personal data, credentials, production secrets, or production services
  are needed; or
- implementation attempts to copy the reference site's protected materials.

The required stop classifications are `DEPENDENCY_EXPANSION_REQUIRED`,
`SCOPE_EXPANSION_REQUIRED`, `PRODUCT_UI_REPAIR_SCOPE_REQUIRED`, or
`STATUS=BLOCKED`, whichever precisely matches the evidence.

## 11. Stage A owner review criteria

Owner review passes only when:

- the Stage A Git write set is exactly the four governance files;
- CREATE/MODIFY classifications match the baseline;
- the no-dependency feasibility conclusion and its stop rule are explicit;
- build, preview, route parity, accessibility, and three-viewport gates are
  complete;
- Task 19 historical exceptions and 31 permanent outputs remain unchanged;
- `TASK19_R1_STARTED=NO` and
  `TASK19_R1_IMPLEMENTATION_AUTHORIZED=NO` remain true;
- Task 19 Stage B, C1, C2, and Task 20+ remain unauthorized; and
- no implementation, test, browser, service, staging, commit, push, deployment,
  or release action has occurred.

Stage A stops at `TASK19_R1_STAGE_A_OWNER_REVIEW_GATE`.
