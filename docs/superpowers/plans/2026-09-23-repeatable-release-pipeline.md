# Web and WeChat Mini Program Local Release Readiness Plan

> **Current status (2026-10-23):** Local development and release preparation only. A1.266 ran the 15-stage matrix from the first stage: API typecheck/schema/build/test and user-web typecheck/lint/build passed, then `user-web:e2e` failed with exit 1; actionable output was not retained, and admin-web plus Mini stages were not run. A1.264's route repair remains covered by its focused 11/11 checks. User website release readiness and Mini upload readiness remain `NO`. GitHub push, Tencent deployment, WeChat upload, review, and publication remain separate owner-controlled actions and are not authorized by this plan.

**Goal:** Finish and verify the current Next.js user website, Next.js administration website, NestJS/PostgreSQL API, and Taro WeChat Mini Program locally, then provide an exact, repeatable release-readiness checklist without contacting production systems.

**Architecture:** The user and administration websites are separate server-rendered Next.js applications. Both use the NestJS API; the API uses PostgreSQL/Prisma. The WeChat client is `apps/mini-program-taro` and produces a WeChat `dist` package. A static-file-only website deployment and the former `apps/mini-program` source are not the current release targets.

**Tech stack:** Existing pnpm workspace, Next.js, NestJS, Prisma/PostgreSQL, Taro, TypeScript, Node.js. No new dependency is required by this plan.

**Local preflight status (2026-10-23):** A1.261 implemented the fixed 15-stage preflight and verified its fake-runner/static checks. `--plan` reports `PLAN_ONLY` with `executionReadiness=NOT_EVALUATED`; execution blocks on active `.env*` names or symbolic links and output paths that traverse symbolic links. A1.262 captured exact API/Taro output and four Mini license baselines. A1.263's API tests exposed a duplicate route owner, corrected in A1.264 with 11 focused tests passing. A1.266 then passed API typecheck/schema/build/full suite and user-web typecheck/lint/build, but stopped at a failing user-web E2E stage; its runner recorded only an output hash. The next step is a separate diagnostic-only run to capture the failure text. Admin-web and Mini stages remain unrun after that stop; full release readiness remains `NO`.

---

## Verified application map

| App | Source and runtime | Current release implication |
|---|---|---|
| User website | `apps/user-web`; Next.js server rendering; visitor pages use `PUBLIC_API_BASE_URL` and `PUBLIC_CAMPUS_REF`; authenticated same-origin API proxy uses `USER_WEB_NEST_API_BASE_URL`. | It needs a running Next.js server and reachable Nest API. Copying a static `dist` folder is insufficient. The visitor route component is currently untracked and must be included intentionally in any later reviewed source snapshot. |
| Administration website | `apps/admin-web`; separate Next.js application; server-side proxy uses `ADMIN_WEB_NEST_API_BASE_URL`. | It also needs a Next.js server and a supported route to the API. The proxy source is currently untracked and must be included intentionally in any later reviewed source snapshot. |
| API | `apps/api`; Nest production entry uses Prisma/PostgreSQL. Production startup requires `DATABASE_URL` and invitation-account configuration; production binding requires an explicit supported host. | A deployment needs an API service and a provisioned database. Migration source files do not prove that a target database has been migrated. |
| WeChat Mini Program | `apps/mini-program-taro`; Taro outputs WeChat files to `apps/mini-program-taro/dist`. `TARO_APP_API_BASE_URL` is compiled into the bundle and defaults to empty. | A customer-ready package needs an approved HTTPS API origin, an owner-supplied AppID/project configuration, and the WeChat privacy/domain/account checks. No AppID is fabricated in source. |

The current visitor Next.js entry routes are dynamic. The old release design's static upload step is therefore stale. The older release plan also points at `apps/mini-program`; that directory is not the current Taro package.

## Verified command matrix

The root `corepack pnpm build`, `corepack pnpm test`, `corepack pnpm typecheck`, and `corepack pnpm lint` remain useful workspace checks, but the root build does **not** run both Next.js production builds or the Taro WeChat build. Use the app-specific commands as well.

| Scope | Exact package command | Main output |
|---|---|---|
| API type/build/test | `corepack pnpm --filter @student-care/api typecheck`; `corepack pnpm --filter @student-care/api build`; `corepack pnpm --filter @student-care/api test` | `apps/api/dist` (ignored generated output) |
| API schema | `corepack pnpm --filter @student-care/api db:schema:validate` | Validation only; does not apply migrations |
| User website | `corepack pnpm --filter @student-care/user-web next:typecheck`; `corepack pnpm --filter @student-care/user-web next:lint`; `corepack pnpm --filter @student-care/user-web next:e2e`; `corepack pnpm --filter @student-care/user-web next:build` | `.next` by default; `TASK20_NEXT_DIST_DIR` can direct Next output elsewhere |
| Admin website | `corepack pnpm --filter @student-care/admin-web next:typecheck`; `corepack pnpm --filter @student-care/admin-web next:lint`; `corepack pnpm --filter @student-care/admin-web next:e2e`; `corepack pnpm --filter @student-care/admin-web next:build` | `.next` by default; `TASK20_NEXT_DIST_DIR` can direct Next output elsewhere |
| Mini Program | `corepack pnpm --filter @student-care/mini-program-taro typecheck`; `corepack pnpm --filter @student-care/mini-program-taro build:weapp`; `node --experimental-strip-types --test --test-concurrency=1 apps/mini-program-taro/test/*.test.mjs` | `apps/mini-program-taro/dist` |

Build applications sequentially, not concurrently. Before any Taro rebuild, record the exact `dist` path set and license sidecars. The Taro build has previously removed page license sidecars; restore or recreate any missing license notice from a verified source before rebuilding and verify the final license files against the captured baseline. Do not claim a successful build proves a Developer Tools upload or an actual-device workflow.

The package manifests also expose these runtime commands; they were inspected but not started in this audit:

| Runtime | Exact command | Runtime requirement |
|---|---|---|
| User website | `corepack pnpm --filter @student-care/user-web next:start` | Uses the completed user-web Next build and server-only API settings |
| Administration website | `corepack pnpm --filter @student-care/admin-web next:start` | Uses the completed admin-web Next build and server-only API settings |
| Nest API | `corepack pnpm --filter @student-care/api start:nest-api` | Requires `DATABASE_URL`, invitation-account settings, and an explicit production host |
| Mini development preview | `corepack pnpm --filter @student-care/mini-program-taro dev:weapp` | Taro watch build for WeChat Developer Tools; does not upload or publish |

## Runtime settings and owner-held configuration

These are names only; the plan never records values, passwords, tokens, account definitions, or private config contents.

| Setting | Used by | Requirement |
|---|---|---|
| `DATABASE_URL` | Nest API and Prisma | Owner-managed PostgreSQL connection. Never place the value in Git, chat, or build logs. |
| `STUDENT_CARE_INVITE_ACCOUNTS_JSON` | Nest API | Owner-managed invitation account definitions; keep the value in a trusted secret/configuration store. |
| `STUDENT_CARE_API_HOST`, `PORT` | Nest API | Production must use an explicit supported host; `PORT` defaults to 4321 and must be within the accepted range. |
| `USER_WEB_NEST_API_BASE_URL` | User website API proxy | Production HTTPS API origin; server-only. |
| `PUBLIC_API_BASE_URL`, `PUBLIC_CAMPUS_REF` | Server-rendered visitor pages | Server-only API origin and approved public campus reference. No tenant/campus identifier is supplied by the browser. |
| `ADMIN_WEB_NEST_API_BASE_URL` | Administration website API proxy | Production HTTPS API origin; server-only. |
| `TARO_APP_API_BASE_URL` | Taro Mini Program | Set before building the package; public API origin must use HTTPS outside local loopback development. |
| `TARO_APP_ALLOW_LOCAL_HTTP` | Taro local development | Only permits explicitly configured loopback HTTP for local development; never set it to enable a public HTTP origin. |

A1.259 found no `.env.example` in the repository root or the three web/API app folders, and no `project.config.json` in the Taro package or `dist`. No private Mini config was read. A later local task may add safe name-only templates and a preflight validator; it must not invent secret values or an AppID.

## Local-only execution stages

### Stage 1: Finish product work

Continue the existing project-completion plan and synthetic-data requirements. Complete feature work and focused tests before creating a release snapshot. Preserve the current dirty and untracked worktree; do not stage broadly, clean, reset, or copy unknown files.

### Stage 2: Implement a local readiness command

The local tool is implemented as `scripts/local-release-preflight.mjs`. `--plan` only prints the fixed command list and reports that execution readiness has not been evaluated; `--run-local` executes stages sequentially, stops at the first failure, and records exit codes plus output hashes without saving raw output. It passes only an allowlist of operating-system variables, refuses active `.env*` names (including symbolic links), blocks output paths that traverse symbolic links, and isolates Next and browser-test outputs. A1.261's fake-runner tests use synthetic values. A1.263 executed the real matrix only after separate output and license baselines were recorded; it stopped at `api:test`. A1.264 fixed that task's confirmed route collision, but did not resume the matrix. Create a new contract and restart at stage one. The plan-only path itself does not run API, database, external service, SSH, WeChat upload, push, or deployment commands.

### Stage 3: Validate build artifacts and licenses

A1.262 recorded the API `dist`, Taro `dist`, isolated Next targets, and four Mini license notices before A1.263 ran. That run rebuilt API output, then stopped at its API test failure; Mini and both website builds were not reached. A1.264's separate TypeScript output was placed in `apps/api/.dist-task20-a1-264-parent-student-options-validation/`, leaving `apps/api/dist` untouched. Every new matrix run must record and validate its own exact source/output baseline and must include the four Mini notices. Passing one app or a focused test pair does not prove the entire website/API/Mini release set is complete.

### Stage 4: Run synthetic local checks

Use existing fake-client/page/API tests and any already isolated synthetic local environment. Do not connect to the workstation's default PostgreSQL service, a customer database, Tencent, or a real public API. Any temporary database test requires a separately recorded loopback-only directory/port baseline and synthetic tenant data. If those conditions cannot be met, record that integration check as `NOT_RUN` rather than substituting a real service.

### Stage 5: Local readiness decision

Produce separate results for user website, administration website, API, and Mini package. Do not use a single green workspace build as proof that all four are release-ready. Keep `WEBSITE_RELEASE_READY=NO` until a supported server topology, runtime settings, database migration plan, TLS/domain checks, and application smoke evidence are verified. Keep `MINI_UPLOAD_READY=NO` until the exact Taro output has an owner-supplied AppID/project configuration, approved HTTPS API/domain and privacy settings, and a verified Developer Tools upload path.

## Owner-controlled requirements after local development

These actions are not part of local preparation and require a separate explicit authorization at the time of action:

1. **GitHub publication:** choose or approve the repository license first; review the exact source manifest and secrets/untracked-file scan; then separately authorize any commit/push. The repository currently has no root `LICENSE` according to the prior release audit.
2. **Website deployment:** confirm the Tencent hosting topology for two Next.js servers and the Nest API, PostgreSQL provisioning and backups, route/proxy/TLS/domain mapping, secret-store settings, and an owner-approved migration procedure. Recheck server state read-only immediately before any future deployment. A static-only upload does not satisfy the current SSR architecture.
3. **Mini upload:** provide the AppID and account/project configuration inside the owner-controlled Developer Tools environment; confirm allowed request domains, privacy declarations, versioning, upload permissions, and preview-device acceptance. Experience upload, review submission, and public release are separate states.

No production values or credentials should be sent in chat. Their absence does not block local synthetic development; it does keep release readiness at `NO`.

## Acceptance checklist for this plan

- [ ] Current source/build map and commands match the package manifests and app configuration.
- [ ] The root build limitation is explicit; both Next builds, the Nest API, and Taro output each have their own check.
- [ ] Local preflight tests use fakes and cannot push, deploy, connect to production, apply migrations, or upload a Mini Program.
- [ ] Next build outputs and generated API/Taro outputs are baselined and isolated per the next implementation contract.
- [ ] Mini license notices survive the build and match the source baseline.
- [ ] Website, API, and Mini readiness are reported separately, with unverified owner requirements marked `NOT_CHECKED`.
- [ ] No push, deployment, upload, review submission, or publication occurred during local preparation.

## A1.265 matrix attempt (2026-10-23)

A1.265 passed the 13 fake-runner tests and produced a 15-stage `PLAN_ONLY` list. Its offline matrix advanced in order through API typecheck/schema/build/test and user-web typecheck/lint/build, then was interrupted during `user-web:e2e` after a prior isolation warning. Post-stop inspection found the current user E2E tests retain injected Next output directories using `??=`; exact legacy fallback directories had no files with write times after this run began. This does not make the interrupted E2E stage pass.

The API output had 7 changed files, the isolated user Next output gained 333 files, and the run evidence directory had 5 files. Taro output was unchanged; admin build/E2E and Mini stages were not run. Next generated files `apps/user-web/next-env.d.ts` and `apps/admin-web/next-env.d.ts` changed outside the A1.265 generated-output allowlist. Their pre-run contents were not backed up, so current contents were preserved. Source/config/lockfile hashes remained unchanged; staged paths remained zero.

A1.265 diagnostic SHA-256: `A8E56921516AA590B9E19F7985E15D657F4ED01A8081448832E11C70BD5A6C45`; validation SHA-256: `B50724CD01E76AF85F8B95236E9C0907B7AF35ADBE0B0751D895AF0D8BB3D45A`; scope audit SHA-256: `264B43F47B574B6B57661F090DCE9AF9E2864EF74CC293A84E8AC672BE073572`; result SHA-256: `4E371BAECD7D780C95B76E41C20D1448898E3393A2C551BEAD1606AB6304D827`.

Next: create a separate retry contract from stage one. Preserve A1.265 partial outputs and include the two generated `next-env.d.ts` files in the write set. Website release readiness and Mini upload readiness remain `NO`; no push, deployment, upload, or publication was performed.

## A1.266 matrix retry (2026-10-23)

The 13 preflight tests and 15-stage plan-only check passed. The offline matrix passed API typecheck, schema validation, build and full tests, then user-web typecheck, lint and build. It stopped at `user-web:e2e` with exit code 1. The runner stored output SHA-256 `9B446687E7908046D51BC03F400D8B265BE85839893C5887DBE1CB818DC2DB54` only, so the actionable error text is not available yet. Admin-web and Mini stages did not run.

API `dist` stayed at 1,628 unchanged files; A1.266 user Next output added 375 files; Taro `dist` stayed unchanged at 72 files. A1.265 partial outputs and the three named historical Next directories remained unchanged. The two authorized `next-env.d.ts` files changed; source/config/lockfile inputs did not, and no paths were staged.

The diagnostic, validation, scope-audit and result hashes are recorded in `PLANS.md` and `docs/exec-plans/active/project-completion.md`. Next: use a separate diagnostic-only contract to capture the E2E failure text and identify its cause; do not edit product source or rerun the full matrix under A1.266. Website and Mini readiness remain `NO`; no push, deployment, upload, or publication occurred.

## A1.267 user-web E2E diagnosis (2026-10-23)

Contract `artifacts/task20-a1-267-user-web-e2e-diagnostic-20261023/contract.md` (SHA-256 `62A5C562A82EA2309FDD1041E94DED164D84AF483248DB56AA4DFFC467C96ACF`) and baseline `baseline.json` (SHA-256 `2BE1BDFA6033F4AB5B9D5E70312404BC876033C618AA7991BB212DCE4E7E7D56`) authorized one diagnostic user-web E2E run with synthetic loopback services. It produced 3 passes and 5 failures. Two cases timed out starting Next with empty captured output; three timed out waiting for UI readiness or navigation. The common cause is unconfirmed. Historical build outputs and source/config/lockfile inputs remained unchanged; the only app output created was a 61-file isolated admin Next directory, and the authorized admin `next-env.d.ts` changed. No processes or port 4319 listener remained; no paths were staged.

Next: A1.268 completed a static contract audit. It confirmed that the three staff-page readiness/navigation failures use legacy E2E cases that do not sign the browser into the invite-session flow required by the current pages. Invite-based care and daily tests exist but are omitted from `next:e2e`. The two empty-output Next startup timeouts remain unconfirmed because the helper does not capture child `error`/`close` details or failed request status. No product source was changed. See A1.268 evidence in the shared project-completion plan. Create A1.269 to reconcile the E2E selection and capture focused startup diagnostics. Website and Mini readiness remain `NO`; no push, deployment, upload, or release occurred.

## A1.268 user-web E2E contract audit (2026-10-23)

A1.268 compared the current `next:e2e` script, the three failing legacy staff tests, the invite-session pages and clients, and the available invite-based E2E tests. It confirmed that the three staff readiness/navigation failures come from a stale test contract: those legacy tests create old local-profile bearer fixtures but do not log the browser into the invite-session flow used by the current pages, which call same-origin `/api-local/...` endpoints. Invite-based care and daily tests exist but are not selected by `next:e2e`. No product or test source was changed.

The two Next startup timeouts remain unexplained. The helper does not capture child `error`/`close` events, and the A1.267 log has no failed request status. A1.268 therefore makes no claim about their runtime cause. Contract SHA-256: `b206300b03a942dc504dbbead6f1944266c45b1e789c19b825465af173a6c48a`; baseline recorded 20 inputs, with all non-plan inputs unchanged. See the shared project-completion plan for final evidence hashes and scope audit.

Next: create A1.269 to reconcile E2E test selection, cover invite-based administrator task review, and capture startup diagnostics. Website and Mini readiness remain `NO`; no push, deployment, Mini upload, or release occurred.

## A1.269 网页检查启动修复（2026-10-23，实施中）

- 合同：`artifacts/task20-a1-269-e2e-startup-20261023/contract.md`。精确写集包含共享 browser helper、user-web 的 next:e2e 命令、两份新测试、任务证据、隔离 Next 副本及测量编译产物；无业务代码和依赖改动。
- 更正 A1.267/A1.268 的解释：两次堆栈都落在 helper 第 342 行等待 API `/local/profiles`，Next 尚未创建。编译耗时待测量；错误提示误写成 Next，不能据此判断网页服务启动失败。
- 本机 D 盘已找到并实际加载 Superpowers 与 long-horizon-development，沿用唯一长期计划，不另启流程；历史技能缺失记录不作为当前状态。
- 后续不能仅替换旧测试：管理任务分派/检查/取消及管理日报退回/确认仍使用固定合成身份，尚需迁移真实邀请接口和页面。保留旧三项完整断言（角色/校区隔离、失败恢复、版本冲突、审核发布、家长回执和手机布局），逐项迁移后再加入统一发布检查。网站及小程序就绪仍为 NO。
### A1.269 完成记录与剩余问题

- 默认启动原先串行编译耗时实测 32.843 秒，超过旧约 24 秒的服务等待窗口；固定时钟分支的 API 编译为 21.254 秒，说明余量很少，但不能把此测量冒充历史失败当时耗时。已改为复用预先构建的真实合成 API，每项测试独立内存、会话、时钟和随机本机端口；发布矩阵仍先构建再检查，不跳过构建验证。
- 已完成：启动诊断回归 6/6、普通/固定时钟浏览器场景 2/2、邀请家长接送与家长/员工请假流程 2/2、Lint、格式、差异检查和独立复核均通过。清理后要求实际拒绝连接，不能把超时当作服务已关闭。浏览器截图仅证明未配置公开内容时的安全提示，不证明公开内容展示完成。
- 范围：保留原八项端到端测试；只增加两项启动检查。788 个基线输入中仅 helper 与 package 命令变化，新增两份测试；API、四个工作区包、Taro、A1.267 历史 Next 与新 Next 副本的产物哈希未变；无暂存、提交、推送、部署、上传或发布。
- 原来受启动阻塞的两项旧检查已到达页面，但仍失败：费用页未进入 READY（旧本地身份未适配当前邀请会话）；访客未发布内容检查期待 404，当前无 PUBLIC_API_BASE_URL/PUBLIC_CAMPUS_REF，页面显示未配置并返回 200。不能仅改为接受 200；下一批先接入合成公开内容夹具，区分已发布、未发布、未配置和接口故障，再验证状态与隐私边界。
- 下一步 A1.270：修复公开内容页面和测试接线；随后迁移费用/月报及管理任务/日报受邀完整流程，保留全部权限、版本冲突、错误恢复和审核闭环断言。再回到共享的完整发布矩阵，继续管理网页与新版 Taro 验证。网站上线与小程序上传就绪仍为 NO。
- 证据目录：`artifacts/task20-a1-269-e2e-startup-20261023/`，包含合同、输入/产物基线、真实编译计时、失败回归、通过日志、独立复核结论、范围审计和结果。
## A1.270 公开内容详情状态与真实合成接口验证（2026-10-23，实施中）

合同 `artifacts/task20-a1-270-public-content-20261023/contract.md` 已记录精确写集：访客 route-view、相邻 public-institution 测试、next:e2e 命令、一份新 Nest 浏览器测试、三份共享计划和隔离构建/证据；仅允许 user-web next-env.d.ts 与类型检查缓存这两个已有生成副作用。先复现 API 404 被页面当作 200 提示页的问题，再只对明确 EMPTY 状态使用真正404。未配置/服务错误不得被混同为404；用真实 InstitutionService + 内存仓库 + Nest验证发布过滤和跨范围隔离，保留旧测试全部断言，不把短检查当作旧完整流程替代。无外部服务、推送、部署或上传。
### A1.270 完成记录（2026-10-23）

- 最小业务修改：公开详情仅在接口明确404时使用 Next notFound；未配置/读取故障仍保留提示。旧构建已用真实合成接口复现200≠404，修复后独立新构建通过浏览器验证。
- 验证：原7项保留并新增1项，单测8/8；Lint、格式、Next类型检查、生产模式构建通过。真实Nest+内存内容仓库验证已发布首页/机构/详情、5类隐藏或缺失内容404、伪造范围400、未知公开引用403、真实点击、390px截图及无溢出、撤回后404、服务关闭后安全提示；独立只读复核通过。
- 测试入口修正：旧网页tsconfig不适用Next JSX/Bundler；失败日志保留。改为继承实际Next配置定向检查并复用已安装esbuild，不改配置/依赖、不削弱原断言。隔离脚本相对路径笔误也已修正并记录。
- 审计791输入无越界变化，API/四包/Taro/A1.267与A1.269历史Next产物不变；next-env.d.ts为已授权构建副作用，缓存未变，暂存0。证据：artifacts/task20-a1-270-public-content-20261023/result.json；合同SHA 83DA43F208F891C80352AE3C4E48381E437DF04760DFAAA33145CAE512112B3C；范围审计SHA 82DCDB7AC7D3051482E6EBE3CFD33FE9873FA02EA39253DE9450E4308F7CD7FB。
- 限制：此结果不证明数据库持久化、管理发布UI、旧visitor全流程或完整发布矩阵。网页与Mini发布就绪仍为NO，无提交/推送/部署/上传。
- 下一步：迁移家长费用/月报邀请流程测试且保留权限、失败恢复、竞态和回执断言，修正月报将服务故障当成无权限的问题；费用/月报正式存储与管理生命周期尚未完成，随后与管理任务/日报迁移及完整网页/Taro矩阵一并补齐。

## A1.271 家长费用/月报完整邀请流程迁移（2026-10-23，实施中）

合同：artifacts/task20-a1-271-parent-fees-monthly-20261023/contract.md。精确修改五个产品/测试路径（旧完整fees-monthly测试、共享browser helper、月报invite客户端/单测/面板）与三份共享计划；新证据、单测和Next产物隔离，next-env/缓存副作用先备份。通过真实邀请登录连接同一合成业务实例，保留全部原业务与安全断言；费用/流水接口合并后仍保留两轮失败恢复。先修503被误报无权限的真实客户端问题，再验证完整页面流程。

发布缺口：生产配置尚未注入parentGovernanceOperations；当前费用/月报只有合成服务，没有对应已确认的Prisma存储实现；费用创建/发布/撤销管理流程尚未完成。此批仅补齐真实Nest合成验证，不能把现有固定费用状态当作管理生命周期完成。后续按原方案补持久化/管理端，与任务/日报迁移及网页/Taro全矩阵合并收尾。网站及Mini就绪仍NO。

### A1.271 完成记录（2026-10-23）

- 已修复月报服务故障误报无权限：401/403保留DENIED，其余临时故障/无效返回/版本冲突为ERROR；错误页面不再显示读取中，清空旧摘要后可重新连接。红灯明确复现503下DENIED≠ERROR，修后定向5/5通过，保留原确认、隐藏内容与字段校验。
- 原完整费用/月报浏览器检查已迁移真实Nest邀请登录，API与旧合成种子共用同一业务实例；全部原断言保留，费用/流水合并接口仍两轮503，月报第三轮503。已通过：无绑定/待审核隐藏、6份资料和3条流水及金额、解绑重绑、草稿/审核/发布/确认、来源变化重审重发清回执、双击只写一次、旧版本409、双代理禁止写入/伪造范围/非法编号、320/390/1365宽度与无非预期网络/脚本错误。
- 新增真实Cookie校验：仅/api-local路径、HttpOnly、脚本不可读。首次登录前唯一/me401按请求ID精确记录；其他失败不能被排除。Next原生OPTIONS204只允许空响应，旧代理拒绝断言未修改。首次测试少了首页所需care:read，后续Cookie查询用了错误路径，两处均仅修测试准备并保留失败日志。
- 定向类型、Next类型、Lint、格式、新隔离Next构建均通过；helper6/6、普通/固定时钟启动场景2/2（含总测试3/3）通过；独立只读审查通过。实际手机截图已查看，无横向溢出。完整发布矩阵未重跑。
- 范围审计：本批输入与扩展源码清单核对无未解释变化；A1.270已知改动单独列明，API/四包/Taro及A1.267/A1.269/A1.270历史构建保持不变；next-env为已列明副作用。暂存0、无commit/push/部署/上传。证据 artifacts/task20-a1-271-parent-fees-monthly-20261023/result.json；合同SHA 709EE2A47224870AF22C5AEB30507C583564BF956FD3D415CB371F9131D1A2D9；审计SHA D48CE57D61C48787E478D6CFB8455EC281FEDE85D7A80476B5C6ED33638B1838。
- 仍未完成：正式费用/月报持久化和生产模块接线、费用管理生命周期、员工月报管理接口、旧访客/员工/管理流程迁移与完整网页/Taro发布矩阵。继续按原方案补齐；网站与Mini发布就绪仍NO，不把合成流程通过当作已可上线。

## A1.272 日报审核后端闭环（2026-10-23，实施中）

沿用唯一计划与 Long-Horizon 判定。合同和精确写集见 artifacts/task20-a1-272-daily-review-api-20261023/contract.md。先补受邀身份 daily:review、真实 Nest/Prisma 队列及确认/退回/撤回，再以专用 loopback 合成 PostgreSQL 验证范围与并发。管理页面接线和完整网页/Taro门禁仍未完成，发布就绪仍为 NO；不推送、部署或上传。

- A1.272 必要范围补充：共享身份权限测试发现 OpenAPI 缺少 daily:review。新增 MODIFY packages/contracts/openapi/v1.json 与 packages/contracts/test/schema.test.ts，补权限枚举及本批三个审核接口的文档和行为契约校验。基线已单独保存；不放宽现有断言。

- A1.272 验证环境补充：initdb 无法在旧用户 Documents 目录建立数据库（错误 File exists，未建立 pgdata）；不更改该目录权限。专用数据与 PostgreSQL 日志改为 D:/DevTools/student-care-saas-platform/temp/task20-a1-272-daily-review-api-20261023/，仅创建该新目录，验证后停止保留。仓库 artifacts 保留其脱敏运行证据，其余边界不变。


### A1.272 完成记录（2026-10-23）

- 已实现 daily:review 共享权限与 OpenAPI、Nest 审核列表/确认/退回/撤回、Prisma 数据库存储和合成适配器一致接线；未提交草稿不进入审核列表，普通员工列表只返回本人。审批排除同一用户（即使成员记录换新），限定数据库活跃机构/校区/用户/成员及负责班级。
- 验证：真实接口 RED 为404；最终31/31身份/接口契约/本地日报/Nest/生产接线测试、PostgreSQL完整集成1/1、contracts/API类型检查及构建、定向Lint/格式、git diff --check全部通过。数据库测试通过实际HTTP审核替代直接改RETURNED状态，覆盖重连持久性、非空来源快照不变、并发同版本仅一次成功、旧版本、自审、跨范围、停用及撤销班级等。
- 独立复核发现的两项P1已修复并通过最终复核。开工789个输入核对无越界变化，29个对应生成输出变化均在合同内；指定历史Next、Taro及其他三包输出不变，暂存0。
- 环境记录：旧Documents路径initdb失败后改用专用D盘temp新目录；pg_ctl因继承输出句柄导致观察超时，但已通过端口/PID/服务端data_directory确认原实例存活，未重复启动。23条既有迁移仅应用到127.0.0.1:55434新合成库，结束后pg_ctl正常停止并确认无监听，目录保留。pg驱动有未来版本查询弃用提醒，不影响本次通过，依赖未修改。
- 证据：artifacts/task20-a1-272-daily-review-api-20261023/result.json；合同SHA 7984378CFB3BD8E11C833F9E1B09AF5712F154F0F4C13428B9629ABD90169F8E；范围审计SHA 512FF4278DAFFA424A52BEA2BFC9D22211BE652E51F0E2ADCE81F31CD6473DFC。开发阶段仍PARTIAL，网站/小程序发布就绪仍NO，未commit/push/部署/上传。
- 下一步A1.273：管理日报审核页切换为真实邀请身份及同源代理，展示安全提交人名称和可用动作，迁移原完整双端浏览器流程（不删除旧权限/冲突/失败恢复/布局断言）。生产学习摘要仍null、费用/月报持久化、任务审核持久化及完整网页/Taro矩阵继续待办，不能用本批后端通过替代整体完成。

## A1.273 管理日报邀请流程（2026-10-23，实施中）

合同 artifacts/task20-a1-273-daily-review-web-20261023/contract.md 已记录精确写集、基线和验证范围。补安全提交人显示、受邀身份同源审核代理、状态动作及原完整双端浏览器流程；保留旧断言和生产限制。网站/Mini发布就绪仍NO，不执行AI工作流取消请求及推送/部署/上传。

### A1.273 完成记录（2026-10-23）

- 管理日报已从固定示例身份/直连本机地址切换到真实邀请账号、同源Cookie代理和Nest审核接口。登录后正确返回日报；安全提交人名称只增加到审核投影，员工精确字段协议保持不变。SUBMITTED显示确认/退回，CONFIRMED显示退回/撤回，RETURNED不显示审核动作。
- 验证：客户端/代理及相邻测试16/16，API/合同31/31，真实PostgreSQL1/1；contracts/API构建、管理Next类型、双端隔离生产构建、Lint/格式全部通过。原完整双端E2E1/1通过：实际双端登录，草稿/编辑/提交/退回/重提/确认/撤回，版本到10；匿名/无权/跨校区/非法编号/范围注入，409冲突与503故障清空旧数据并恢复、Cookie不可脚本读取、无浏览器令牌/旧入口请求，1365/390/320布局与4张截图；原断言保留。重复操作去重由客户端测试覆盖，浏览器保留实际写入次数断言。
- 独立复核的P2已修复：不再因合法记录超过500条而整队列报错，501条混合记录先红后绿且不截断待审核项；保留字段/动作/重复编号校验。面板增加clientRef身份判断，防止离开页面后的旧回调覆盖新连接。正式历史分页列为后续优化。
- 环境/测试修复：PostgreSQL向Documents写日志被拒，改用已授权D盘temp日志后通过；未更改ACL或迁移结构，原合成库验证后正常停止且无监听。浏览器两次Runtime.evaluate观测超时均已保留，完整业务阶段可达，测试切换标签做布局前显式bringToFront后通过；共享helper未改，未通过放宽断言或重复启动存活进程掩盖失败。
- 范围审计794输入仅合同内变化，16个相应API/contracts生成输出变化；既有指定Next/Taro/其他包产物不变，next-env属于已授权构建副作用，暂存0。合同SHA 4083294AE4F55E0E296187F7C954DB259C0D19F8A85901279D295B83B9AAC536；范围审计SHA 1A00C90B1C48C512780AC51C2D826E9BC82C81CB6623E765AD82D87F8EDF7A59；证据 artifacts/task20-a1-273-daily-review-web-20261023/result.json。
- 局限：管理浏览器复核运行Next开发模式，生产构建单独通过；未放开生产HTTPS/非loopback规则，不能称生产端到端验收。完整网页/Taro矩阵未重跑，网站/Mini就绪仍NO，不推送/部署/上传。
- 下一步A1.274先补任务后端真实身份与Prisma存储，再接管理页面并迁移原完整任务E2E。已只读查明：controller依赖memberForActor且异步operations未await；生产入口无任务服务；员工任务客户端强制synthetic与内部ID；管理页固定身份，登录返回白名单缺staff-tasks。WorkTask表及七项权限已存在，预计无需schema或依赖变更。费用/月报不是前置依赖；任务检查结果又是日报来源，优先闭合任务链。后续继续费用/月报持久化、生产学习摘要、完整网页和新版Taro检查，不将本批通过替代总体目标。

## A1.274 可信任务后端与员工视图（2026-10-23，实施中）

合同 artifacts/task20-a1-274-persistent-staff-tasks-20261023/contract.md 已记录精确写集和验证。补异步可信范围、分派/检查/取消及Prisma存储，员工端迁移安全字段及服务端动作；不改schema或依赖。A1.275接管理页面和迁移原完整管理任务E2E；网站/Mini就绪仍NO，不推送部署上传。

- A1.274 共享类型依赖补充：为 user-web 正确引用 contracts@0.1.0，增加 @student-care/contracts workspace:* 依赖，仅允许 apps/user-web/package.json、pnpm-lock.yaml 的这一 importer 与本机工作区链接变化。依据现有A1依赖授权执行，离线且禁用安装脚本；不做第三方安装或升级。基线、兼容验证与回退见本批合同补充。

### A1.274 完成记录（2026-10-23）

- 已补可信异步Nest任务接口、Prisma正式注册及持久化分派/领取/开始/完成/检查退回/验收/取消。控制器不再依赖固定示例人员；数据库活跃用户/成员/机构/校区/负责班级重新核对，同一用户不得自审；状态与版本条件写入，并发同版本只成功一次。四种目标、五种任务代码、三种优先级，明确选择班级，非UUID班级与2030日期可用，保留退回/取消前结果。
- 员工端改用共享安全任务类型与服务端actions，移除人员/租户/校区/班级等内部编号与synthetic强制要求；旧本机服务保留。新协议已补共享OpenAPI，七个路径八项操作；管理网页尚未迁移，不将接口完成等同页面完成。
- 验证：API/合同33/33、员工客户端5/5、真实PostgreSQL1/1、真实邀请浏览器1/1通过；contracts/API构建、定向及Next类型、Next隔离构建、Lint/格式通过。数据库验证跨范围/非本人/自审、失效成员和范围、重启持久性、三类结果及取消保留，且只有CHECKED任务进入日报来源；浏览器实际登录/双击领取一次/开始/选择结果/完成/退回重做/负责人通过/故障清空/重连不重放、三个宽度与截图、无内部字段/浏览器令牌/额外网络和存储。此新增检查不替代原完整管理任务E2E。
- 独立复核P2已先红后绿修复：原候选可能无法实际执行；补多校区邀请、双合格关系、不可见班级第二DB成员三例，均不可选、创建拒绝、读取拒绝。邀请候选与控制器共用唯一范围规则，DB在整个校区活跃成员中判重后再筛班级。最终复核PASS。
- 必要依赖：仅为user-web添加本仓库 @student-care/contracts@workspace:*，版本0.1.0；源合同与实际package.json为准。pnpm离线安装仍重算快照并缺缓存失败，失败产物保留；本批只撤回安装器重算，精确保留安装前锁文件并增加该importer，使用Node原生工作区junction，无第三方下载或升级。workspace-repair与范围审计已核对。
- 未解决的已有门禁：旧user-web类型检查仍报visitor-public-institution.test.ts导入Next JSX时TS6142；本批新增共享类型的TS6059已消除。Next、定向类型与构建通过不能替代这个FAIL。下一批调整该测试的正确执行入口，保留全部断言，不排除测试或降低标准。
- 审计800输入、24条合同内变化、44个对应生成输出，越界0、暂存0；既有指定Next/Taro/其他包和schema不变，数据库已停止。合同SHA BE82D4A98454F45C90634D50B26407616DDFA3592098D40D6DC4E98D17FB6B9A；范围审计SHA AE678D7F90E3B06749A315BB9D6FE074657C419D41C308557ACD7A9804FB9BC1；证据 artifacts/task20-a1-274-persistent-staff-tasks-20261023/result.json。未commit/push/部署/上传，整体仍PARTIAL、网站和Mini就绪NO。
- A1.275顺序：①管理任务页面邀请身份/同源代理、明确候选及按actions操作；②迁移原完整管理任务E2E，保留分派/检查/取消、跨人/班级/校区/租户、四次读写故障、冲突、重复写入、离页和布局断言，同时修复旧Next测试执行入口并接入统一发布命令；③回到完整网页/Taro矩阵，继续费用/月报持久化、正式学习摘要和其余原方案缺口。生产任务逐操作审计接线需核对，当前人员/版本字段不冒充完整历史日志。

## A1.275 管理任务邀请闭环（2026-10-23，实施中）

沿用唯一计划，合同 artifacts/task20-a1-275-admin-invited-tasks-20261023/contract.md 已列精确写集。接通管理任务邀请身份及同源代理，迁移原完整双端任务流程并保留全部安全/故障/竞态/布局断言；修正旧网页JSX测试入口。本批不改依赖/锁文件/API/schema，历史产物保留，不推送部署上传，整体及发布仍未完成。

- A1.275 运行配置必要补充：允许 MODIFY apps/admin-web/next.tsconfig.json，仅在现有 noEmit/Bundler 配置中开启 allowImportingTsExtensions；同一 TypeScript 投影由代理与客户端复用，Node原生测试和Next均使用准确.ts路径。不改依赖或锁文件，不禁用类型检查。

- A1.275 旧测试入口修正决定：直接给旧编译器开启JSX会使既有有意保留的TS6142断言失效，并混用NodeNext/Next Bundler。保留旧编译规则，只将 visitor-public-institution.test.ts 从旧编译范围转入专用 next-test.tsconfig.json（CREATE），新增 test-next-unit.mjs（CREATE）在真实Next类型检查后用已安装esbuild执行原8项断言；package typecheck/test统一串接两个入口，无测试被跳过或断言删除。授权验证输出 apps/user-web/.test-next-unit/**，不覆盖旧dist；本批旧编译产物重定向本证据目录。

### A1.275 实施与验证记录（2026-10-23，PARTIAL）

- 已实现管理任务邀请登录、同源Cookie代理、可信可分派候选及按服务端actions分派/验收/退回/取消。保留原表单与卡片、左导航及手机布局；不再创建固定负责人会话，不把内部人员/班级/目标编号放入DOM。明确班级引用；中文/带点引用遵循后端80字符非空规则，同名员工/同班对象有可读区分，两个问题均先红后绿修复。无API/schema/依赖/lockfile变更。
- 旧网页TS6142已通过正确分流解决：保留旧编译方式与原有expect-error边界，Next访客测试由独立next-test.tsconfig.json与已安装esbuild执行；package typecheck/test同时连接两种入口，原8项断言文件哈希不变。验证255项通过（27定向/相邻、220旧、8Next）；管理类型、旧类型、双端隔离生产构建、Lint和格式通过。旧测试产物在本批目录，用已核对junction指向真实源码完成原只读断言，不覆盖历史dist。
- 原完整任务E2E已迁移实际邀请登录，双端连接同一合成业务实例；原业务、安全、版本、四类503、双击去重、离页和布局断言保留。两次带RSC消费仪器的完整流程1/1通过，并查看4张截图；此结果不能算原生或生产验收。
- 默认原生E2E仍FAIL：页面切换的RSC返回200且页面可达，但Chrome报告net::ERR_ABORTED，原等待结束断言失败。移动等待次序未解决，按两轮规则停止盲试并保留诊断：独立HTTP可完整读取，未定位显式JS取消。增加 response.clone().arrayBuffer() 可使流程通过，但审查指出它会改变背压/取消，故仅允许显式TASK20_DRAIN_RSC_FOR_DIAGNOSTICS=1诊断，正常命令默认不开启。原failedLoads为空及迟到任务响应必须真实完成的断言未放宽，原生问题未宣称修复。
- 已查明机构概览学习设置仍固定示例负责人、直连旧本地接口：只把该页三个精确调用及其同角色/来源/URL/阶段对应预检列为既有现场，任务页禁止旧入口/Bearer/跨源；这项功能迁移仍未完成，不以任务页改造冒充全管理页完成。
- 范围审计806输入、18合同内变化（含两份next-env副作用），11组历史输出全不变，越界0、暂存0；本机测试服务结束，4319/55434无监听。合同SHA 47E8EB21EA6A35E441A401A1508741F651EE847202E3419ECA0AA21A581577AE；范围审计SHA 6CF7E012B913B43A9448AC87BDB050A1409B4F7494089F4B633AA44648F22AE0；证据 artifacts/task20-a1-275-admin-invited-tasks-20261023/result.json。未commit/push/部署/上传。网站/Mini发布就绪仍NO。
- 当前优先继续闭合A1.275原生浏览器RSC调查：用最小原生对照确认取消来源，必要时精确区分框架正常取消与业务错误，不能启用仪器或一般性忽略网络失败制造通过。随后迁移剩余原员工/成长记录/访客全流程并跑统一网页/Taro矩阵；继续费用/月报正式存储和管理生命周期、机构学习设置迁移、任务逐操作日志及正式学习摘要。最终产物/许可/源指纹与微信开发者工具检查仍为发布前必要项；整体目标保持活动。

## A1.276 原生导航验证闭合（2026-10-23，实施中）

合同 artifacts/task20-a1-276-native-navigation-20261023/contract.md 约束只修改原任务E2E和共享计划，诊断/验证输出隔离。先记录被接住的页面流解析异常，不改变fetch或响应消费；有证据后最小修正，并以无注入完整原生流程为验收。A1.275仍PARTIAL，发布NO，不推送部署上传。

### A1.276 写集补充与验证修正决定（2026-10-23）

- 已验证仅Debugger.enable且不暂停也使流程通过，不能将调试器结果当作普通浏览器已修复；仅保留Response仍失败，GC和RSC解析异常假设未证实。被动服务端观测复现取消，finish正常且gzip完整，encoded3277/decoded8676与浏览器资源计时一致，页面和迟到业务JSON完成。取消的浏览器内部发起点仍未确认，不能声称修复Next。
- 本批转为修正“只以CDP loadingFinished判定传输完成”的过强检查：仅对两个指定管理页面的GET/RSC/200/完整gzip，在同一实际请求指纹、服务端完整结束、浏览器encoded/decoded字节完全相等、页面提交且无重载/异常全部成立时，记录为已证实传输完整后的取消。其他所有业务或网络失败仍FAIL；缺少任一证据仍FAIL。
- 在原4条MODIFY写集外，额外CREATE tests/e2e/helpers/owned-rsc-observer.mjs（纯测试被动HTTP结束记录及失败关闭分类），CREATE tests/e2e/helpers/owned-rsc-observer.test.mjs（正反例）。原完整任务E2E直接加载这些相邻验证，保持标准命令自动运行，不改package或生产代码。仅本批拥有的Next子进程通过NODE_OPTIONS加载观察器；不注入网页脚本、不增加fetch消费，不写响应正文/账号/Cookie/令牌，只写合成请求指纹、长度、完成状态及哈希。唯一运行输出在本批artifacts随机子目录。
- 验证先红后绿：缺损gzip、字节不符、重复/错配指纹、HTTP错误、业务JSON取消、未提交/重载/异常全部拒绝；真实浏览器截断与业务取消反例拒绝；默认无Debugger/无网页注入原完整双端流程通过。保留严格四次503、权限、冲突、重复写入、迟到业务响应实际loadingFinished、布局断言。变更只在测试层；回退为保留现有FAIL和证据，不改产品/依赖/配置/历史产物。整体发布仍NO。

### A1.276 原生任务流程验证收尾（2026-10-23，PASS_LOCAL）

- 默认原完整管理/员工任务E2E已通过，41项（40个完成判断/安全正反例+1个原完整业务流程）；最终运行exit0、44390ms。未启用Debugger、网页脚本注入、Response保留或额外读流，标准入口已删除这些临时分支，诊断副本仅留在artifacts。
- 已证实旧检查存在误报：真实RSC已正常发完完整gzip、浏览器接收的encoded/decoded字节完全一致、页面提交且无重载/异常，随后CDP仍报取消。新增逐请求指纹、唯一服务端finish/完整gzip、实际接收字节和Performance长度/时序的合取判断，只适用于两个明确管理页面GET/RSC/200；任何缺证据或业务JSON取消仍FAIL。浏览器内部取消发起者尚未确定，不称修复Next或所有取消正常。
- 真实原生浏览器负例1/1通过：正常RSC完整54908字节；中途断开的RSC收到25375字节仍拒绝，ERR_INCOMPLETE_CHUNKED_ENCODING；主动取消的业务JSON收到8014字节仍拒绝，net::ERR_ABORTED。即便假设页面已提交，两个反例仍拒绝。被动观察不保存正文、Cookie或账号凭据，日志只含指纹/长度/哈希/结束状态。
- OPTIONS按测试阶段匹配会因异步时序错配；改为浏览器Initiator.requestId与真实机构请求的精确ID/角色/来源/URL关联，保留机构旧入口现场的窄范围例外，任务业务仍禁止旧入口/Bearer/跨源。
- Lint/格式exit0；本批只改测试层，两端业务输入与13组历史产物经806输入审计保持不变，因此复用A1.275已通过的255项产品/旧/Next测试、管理类型及生产构建证据；本批用户隔离生产构建另已通过。4张桌面/手机截图已查看，320px无溢出断言保留。本批未改业务、配置、依赖或lockfile，暂存0。
- 合同SHA 85C1E6D020B492FBCCA2471C2F7A7FFEE070F095A1A392D3E03683E6440E2790。证据 artifacts/task20-a1-276-native-navigation-20261023/result.json、scope-audit.json、browser.json、native-negative/result.json、browser/verified-route-transfers.json；独立只读审查通过，最终清理后完整运行已复测。A1.275原生门禁由本批闭合，其历史PARTIAL文件不覆盖。
- 网站/微信小程序整体就绪仍NO：继续迁移原员工/成长记录/访客完整浏览器检查并完成统一网页/Taro矩阵；之后补机构学习设置、费用/月报正式存储及管理生命周期、任务逐操作审计、正式学习摘要，再闭合源指纹/许可/产物清单和微信开发者工具实际检查。本地合成数据，不提交、推送、部署、上传或发布，整体目标保持活动。

## A1.277 原员工工作台回归合同对齐（2026-10-23，实施中）

合同 artifacts/task20-a1-277-staff-original-contract-20261023/contract.md 记录精确4条写集。原测试已邀请登录，先红后绿更新缺少服务端actions的过期任务样例，保留原家长申请/员工任务/关系审核/家长查看及身份隔离断言；不把前端合成上游测试当真实Nest/PG验证。日报原完整流程已迁移，不重复重写。下一步成长记录原完整回归迁移，再核对访客及统一网页/Taro矩阵。仅本地合成，不改业务/依赖/配置/历史输出，不推送部署上传，整体及发布仍未完成。

### A1.277 原工作台前端合同回归收尾（2026-10-23，PASS_LOCAL）

- 原邀请工作台浏览器测试先失败（缺失actions导致READY不可达，exit1）后完整通过1/1（9187ms）；仅把任务合成样例对齐共享InvitedStaffTaskView的16字段安全投影与四个状态的actions，列表返回{tasks}。未修改任何业务实现、配置或依赖。
- AST词法校验原22个assert调用、29个页面操作调用完全保留；家长申请/员工领取开始完成/员工审核/家长查看结果、家长越权拒绝、同源/浏览器无Bearer/请求无身份范围字段/登录响应无token断言均在。独立只读复核PASS。
- 相邻真实Nest邀请任务流程1/1通过（12469ms），含退回重做、负责人独立确认与异常/去重等既有检查；用户Next隔离生产构建、格式、Lint全部exit0。原前端样例测试不冒充真实Nest/PG，后端与完整管理/员工实际邀请证据继续引用A1.274–276。已查看家长关系审核页面截图。
- 范围审计811输入、15组历史输出保持不变，业务源变化0、越界0、暂存0；仅原测试和三份计划、允许的用户next-env副作用变化。合同SHA 1C95A8BB536A2674EEECF9936FA87AEF2164CE1BEDA13AB39F31EBC5523E84B0；证据 artifacts/task20-a1-277-staff-original-contract-20261023/result.json、original-assertions.json、scope-audit.json。无commit/push/部署/上传。
- 下一批必要前置已查明：原完整成长记录E2E要求撤回与撤销发布，新版真实CareRecordOperations/Nest/Prisma/代理/client整条链尚缺；需要准确审计动作和本地合成数据库的最小枚举迁移，不能借用错误动作或删除断言。原测试的家长解绑/回执重置也缺真实解除关系入口；三标签的同源家长/教师Cookie需要独立浏览器上下文。先分批补正式能力与隔离，再迁移原完整成长流程；日报原完整E2E已在A1.273迁移，不重复重写。网站/Mini整体仍未就绪，目标保持活动。

### A1.278 成长记录撤回与撤销发布（2026-10-23，范围补充待审阅）

合同 artifacts/task20-a1-278-care-record-actions-20261023/contract.md 固定29条写集，其中两条为本批新建。产品实现及目标验证已完成，但最终范围门禁发现 Prisma 生成器额外改动12条未授权生成源码，故依合同停止收尾；这些文件保留原状，未恢复或覆盖。完整结果见 artifacts/task20-a1-278-care-record-actions-20261023/result.json。已准备精确范围补充草案 artifacts/task20-a1-278-care-record-actions-20261023/contract-amendment-proposal.md，SHA-256 3665F25ADF75F33E29A1FB393E00BD1CC79EF88F348BD2EB6D6C75E4AFBD9C32；审阅通过前不继续本批修改或产品验证。仅合成资料和回环数据库；不推送、部署、上传或发布。家长解除绑定及原完整成长 E2E 的多角色隔离仍是后续独立工作，不能据本批上线。

### A1.280 家长解除关系 API（2026-10-23，PARTIAL_LOCAL）

新版家长 API 已增加本人、当前校区、ACTIVE 状态和版本校验后的关系解除；Prisma 使用现有状态/版本/解除时间字段原子更新，合成实现复用旧审计动作。关系 API 定向流程 12 项通过、数据库用例 1 项因未设置 `DATABASE_URL` 跳过；释放 OpenAPI 定向用例 1/1 通过，contracts/API 构建、Lint、格式与 `git diff --check` 通过。完整 contracts 检查 25/26：仅路由清单缺少 A1.278 已加入的成长记录撤回与撤销发布两条路径；该待审范围未在本任务改动。结果与当前合同 SHA 见 `artifacts/task20-a1-280-guardian-relationship-release-20261023/result.json`。无关系审计事件表、家长页面入口、重新申请规则、回执重置或完整浏览器多角色流程；仍不可作为发布就绪证据。无依赖/锁文件变更、暂存或远端操作。

### A1.281 网页家长关系解除入口（2026-10-23）

- **状态：** `PASS_LOCAL_SYNTHETIC`。当前 Next 家长页面已接上关系列表与版本校验解除 API，增加逐页确认、解除回读和已结束展示；解除后不再读取或显示授权/个人信息申请数据，也不误导用户重新申请。
- **验证：** 家长客户端测试 1/1，真实浏览器合成流程 1/1；复核了员工角色审核、家长解除、接口读回及 1365/390/320 像素页面布局。类型检查、ESLint、Prettier、隔离 Next 构建与 `git diff --check` 通过。首次构建触发 Next 版本安全提示并失败，按提示重试成功；本批未改依赖。
- **证据：** 合同 SHA-256 `F5A9F28FE4C62FF88469A891D3201CFBEC6C951E18C0DA5D34DB2FCE12F1E6BE`；结果见 `artifacts/task20-a1-281-web-parent-relationship-release-20261023/result.json`，截图保存在同目录 `browser/`。
- **未完成：** Mini 解除 UI、重新申请及回执、关系历史审计、A1.278范围审阅、完整成长记录多角色回归、网页/Mini发布矩阵和 Next 安全升级仍未完成。本地验证不构成推送、部署或发布授权。

### A1.282 Taro 家长关系解除入口（2026-10-23，PARTIAL）

- 当前 Taro 家长关系页已接现有 API，提供 ACTIVE 关系的原生确认、版本提交和服务端读回；解除后显示结束状态。专项测试 10/10、Taro 全套 84/84、类型检查、ESLint、Prettier 通过，Taro v4.3.0 编译退出码 0。
- 打包仍不完整：原 72 个 dist 路径和 4 份许可说明均未变；新隔离构建产生 70 个路径。两份未自动生成的页面许可说明在两次重编前从原件恢复，仍被构建清理掉，设置 `output.clean=false` 也未生效。停止试错并归类为 `PRODUCT_ISSUE`；下一任务需登记许可说明源文件并安排清理后的复制步骤。
- 真实微信开发者工具交互未运行：当前会话无 Mini/DevTools 自动化工具，`wechatide` 命令也未找到。合同和基线见 `artifacts/task20-a1-282-taro-parent-relationship-release-20261023/`；本地通过不代表已完成视觉验收或上传就绪。

### A1.283 Taro 许可证打包恢复（PASS_LOCAL_SYNTHETIC）

合同 `artifacts/task20-a1-283-taro-license-output-recovery-20261023/contract.md` SHA-256 `1405408A57781F217E7709F2C8D7FA4104F4964A3ED25B7F6A31577AA3F134CF`，结果 SHA-256 `847A6108694A9017297877E8A2AD0D24F31F58582E6346D3BB064149239D83F0`。两份许可证已作为输入保存，Taro 编译成功后由固定脚本复制。专项测试 2/2、Taro 全套 86/86、类型检查、ESLint、Prettier 均通过；隔离构建精确包含 72 个预期路径和 4 份原哈希许可证，原 `dist` 哈希保持不变。验证记录位于 `artifacts/task20-a1-283-taro-license-output-recovery-20261023/validation.log`。

`pnpm` 在当前非交互环境尝试工作区模块目录协调时中止，实际检查改用已安装的 Node 工具执行并通过；不涉及依赖安装或锁文件变化。微信开发者工具视觉/点击复核未运行（当前会话没有可调用的自动化工具）。后续仍需补齐家长关系重新申请/审计、成长记录完整流程以及全端发布矩阵；本地通过不等同于上传或上线授权。

## A1.323 Safe local release preflight (2026-10-25, PARTIAL)

The tool now requires an explicit per-run evidence path for execution and refuses existing evidence or run-specific Next.js output paths before any stage. `--plan` remains read-only. Root aliases expose plan, test, and run; the focused suite is included in the root test command. Use `corepack pnpm run release:preflight:run --artifact-root=artifacts/<unique-run-id>/run` without a separate `--` argument, and only with a fresh path under a separately approved full-matrix contract.

Focused tests 17/17, syntax, Prettier, and ESLint passed. The plan command stayed `PLAN_ONLY/NOT_EVALUATED`. A smoke test mistakenly passed the absent child path `artifacts/task20-a1-323-safe-release-preflight-20261025/run`, which started the local matrix; the process tree was stopped at API build. Prisma Client generation ran, but all 59 generated source hashes still match the earlier baseline and `apps/api/dist` and lockfile content are unchanged. No database or network access occurred; the website and Mini stages did not run. The deviation is documented in `artifacts/task20-a1-323-safe-release-preflight-20261025/`; the task status remains PARTIAL and website/Mini release readiness remains NO.
