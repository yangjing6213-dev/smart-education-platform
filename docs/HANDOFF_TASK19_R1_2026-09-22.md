# 项目交接文件：学生托管 SaaS / Task 19 R1

- 交接对象：本地另一个 Codex 账号
- 交接来源线程：`codex://threads/01a05b8d-22d2-7c21-a058-3b074499b89e`
- 交接日期：2026-09-22
- 仓库：`C:\Users\HU\Documents\student-care-saas-platform`
- 本文件状态：只读审计后的交接说明；当前是新建未跟踪文件，未暂存、未提交；不构成新的任务授权、验收、push、部署或发布授权。

## 1. 先看结论

当前代码已经包含一组较新的 user-web、微信小程序访客切片和小程序员工入口提交，但当前唯一活动治理仍明确把工作停在 `TASK19_R1_STAGE_A_OWNER_REVIEW_GATE`：R1 实施未授权，Task 19 Stage B/C1/C2 与 Task 20+ 未授权。因此，代码现场与治理控制面存在漂移。新账号必须先做控制面复核并取得负责人明确授权，不能因为 HEAD 中已有实现或远端已同步就继续开发、验收或发布。

当前状态建议标记为：`BLOCKED / CONTROL_PLANE_DRIFT`。

## 2. 当前现场（以本次只读检查为准）

| 项目 | 实测结果 |
|---|---|
| 分支 | `feature/phase-1b-task-19-final-delivery-acceptance` |
| HEAD | `bd0001faa8e2fd7bbabe86e3d778ba24431107e8` |
| HEAD 提交 | `feat: add mini-program staff entry pages` |
| origin | `https://github.com/yangjing6213-dev/smart-education-platform.git` |
| 远端关系 | 当前 `HEAD` 与 `origin/feature/phase-1b-task-19-final-delivery-acceptance` 同步（本次观测） |
| tracked/index 状态 | 2026-09-23 10:46 +08:00 实测 13 个已跟踪小程序文件有未暂存修改，暂存区为 0；这些变化在交接审核过程中由并行现场持续出现，未归因、未回退、未暂存，接管时必须重新计数 |
| 未跟踪状态 | 同一时点实测 883 条未跟踪路径（含两份交接文件和小程序编译/配置现场）；R1 合同定义的 71 条保护基线只是子集，不等于全部 883 条；既有未跟踪内容不得删除、移动、覆盖、清理或批量暂存 |
| V42 SHA-256 | `7BECA819534A223D84C4D95FD117FC68C4B9CD4CDFC2E5345AF09E9547D188AB` |
| Node/pnpm 约束 | Node `>=24.14.0 <25.0.0`；pnpm `>=11.22.0 <12.0.0` |

### 2.1 腾讯云网站部署状态

交接中没有可直接执行的腾讯云服务器网站部署手册。本次检查到的 `docs/architecture/ENVIRONMENTS_AND_DEPLOYMENT_DRAFT.md` 是未来环境与部署草案，明确说明“上述环境名称不表示当前已存在”，没有确认服务器、域名/TLS、云资源、部署流水线、备份/回滚实测、监控或当前线上版本；草案也明确要求任何后续部署由新任务授权。`AGENTS.md` 的当前禁止项明确包含“上传腾讯云或部署测试/生产环境”。因此：

- 历史 Batch A/Batch B 合同只记录过候选 V0.1 应用服务器规格：腾讯云轻量应用服务器通用型、4 核 CPU、8GB 内存、180GB SSD、12Mbps、2000GB/月流量；这只是测试/单机构初期试点候选，不是已购买、已配置或已上线实例，也不足以推断正式多机构生产容量；
- 当前未确认任何腾讯云网站部署目标、服务器地址、线上站点、账号/权限或部署方式；
- 该缺项不是新账号可自行补做的任务，当前不得连接服务器、读取云凭据、上传文件、创建资源或部署；
- 如负责人未来要求云部署，必须先另行签发明确授权与执行合同，给出目标环境、网站/服务范围、授权账号和最小权限、批准的访问方式、构建产物来源、域名/TLS/DNS责任人、备份与回滚方案、健康检查与验收标准、维护窗口和停止条件；
- 授权前只可基于本地草案补充问题清单或部署设计，不能把草案写成已配置、已验证或已上线的事实。

最近提交：

1. `bd0001f` — `feat: add mini-program staff entry pages`
2. `3d738c7` — `feat: extend user-web and mini-program slices`
3. `3f4e148` — `feat(user-web): complete visitor runtime presentation`
4. `678fdf6` — `docs(task19): record R1 remote push state`
5. `6f02fa1` — `feat: add user-web runtime for Task 19 R1`

### 2.2 现场与 R1 合同的冲突

R1 合同记录的 Stage A baseline 是 `a95aba6a8feebea4e8e047cc8b13a36a7e160e04`，且只允许四份治理文件写入；合同明确禁止 R1 实现、产品测试、浏览器、服务、提交、push、部署和发布。当前 HEAD 已包含上述实现提交，明显超出该合同基线。这里不能推断这些提交是否已获得负责人批准，也不能把它们自动升级为已验收结果。

README 当前仍是陈旧快照，写着旧分支、Task 17 和 Task 18+ 未启动等信息；不要用 README 覆盖 `AGENTS.md`、`PLANS.md`、V42 或 R1 合同的当前控制面。

### 2.3 当前未提交的小程序开发现场

交接最终复核时发现一组新的、未提交且未暂存的小程序修改；最新快照共 13 个 tracked 文件：4 个原生页面 TypeScript 入口、visitor home WXML/WXSS、visitor navigation、visitor/staff adapter/tests 和 `tsconfig.json`。可见意图包括把内部 import 从 `.ts` 调整为 `.js`、把小程序 TypeScript 输出改向 CommonJS/Node resolution、扩展 visitor 测试以要求员工入口、项目配置和可执行 JavaScript 入口，以及增加访客页的员工入口展示。与此同时，未跟踪区出现编译后的页面 JavaScript 和两个项目配置文件。

这些变化代表正在发生的本地开发现场，但当前没有可验证的执行合同、作者回执、测试结果或负责人授权。接管账号必须保留这些字节，先记录 `git diff --name-status`、`git diff --stat` 和未跟踪元数据；不得擅自完成、回退、格式化、暂存或提交。只有负责人确认这是一项获授权的小程序编译/入口修复波次后，才能继续验证。

## 3. 当前唯一控制面与硬边界

权威顺序：

1. `AGENTS.md`
2. `PLANS.md`
3. `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md`
4. `PHASE_1B_TASK_19_R1_CODEX_EXECUTION.md`
5. `docs/project/PHASE_1B_TASK_19_R1_PLAN.md`

关键状态：

```text
ACTIVE_GOVERNANCE=V42
PHASE_1B_ACTIVE_TASK=TASK19_R1_STAGE_A_FORMALIZATION
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
```

R1 计划的未来 Stage B 目标只包括：dependency-free user-web HTML/CSS 入口、Node 内置 build、`127.0.0.1:0` loopback preview、`/visitor` 与 `/web/visitor/home` 兼容映射、三视口视觉与可访问性核验。它不包含课程、校区、接送、报名、支付、认证或其他新业务。

当前阶段还禁止：

- 读取、删除、移动、覆盖或批量暂存保护未跟踪路径；
- `git add .`、`git add -A`、强制 Git、清理工作树；
- 安装依赖、修改 lockfile、接入真实服务或真实数据；
- 修改冻结验证器、Task 19 永久输出或 V42；
- push、deploy、release、云构建、微信体验版上传；
- 腾讯云登录/SSH、服务器或 COS 访问、云资源创建、站点文件上传、DNS/TLS/域名变更、测试或生产部署；
- 在未得到负责人授权前执行 R1 Stage B 的实现或验证。

## 4. 已有代码范围（只描述 HEAD 中已跟踪内容，不等于验收）

### user-web

- `apps/user-web/index.html`
- `apps/user-web/src/main.ts`
- `apps/user-web/src/styles/user-web.css`
- `apps/user-web/src/pages/visitor-home.tsx`
- `apps/user-web/src/pages/visitor-content.tsx`
- `apps/user-web/src/routes/visitor.routes.tsx`
- `apps/user-web/src/routes/staff.routes.tsx`
- 员工页面：`staff-workbench.tsx`、`staff-report.tsx`、`staff-guides.tsx`、`resources.tsx`
- 员工/访客测试：`staff-content.test.tsx`、`visitor.test.tsx`
- 本地静态链路：`build.mjs`、`preview.mjs`
- 本地模拟图片资源：`apps/user-web/src/assets/*`

### mini-program

- 原生壳：`app.json`、`app.ts`、`app.wxss`
- 访客：`pages/visitor/home/*`、`pages/visitor/content/*`
- 员工：`pages/staff/workbench/*`、`pages/staff/quick-action/*`
- 安全投影与路由：`src/pages/visitor/*`、`src/navigation/routes.ts`、`src/routes/staff.routes.ts`
- focused tests：`src/pages/visitor.test.ts`、`src/pages/staff.test.ts`
- 当前 `apps/mini-program` 没有 `package.json`；其 TypeScript 配置使用根 workspace 工具链。

### 设计/计划文件

- `docs/superpowers/plans/2026-09-22-mini-program-visitor-slice.md`
- `docs/superpowers/specs/2026-09-22-mini-program-visitor-slice-design.md`

这些文件描述了实现意图和测试方案，但不能替代当前治理授权或现场验证。

## 5. 历史交接证据（仅供背景，不作为当前 PASS）

历史线程摘要显示：

- 曾在 `678fdf6171d845866403cfb22634c14e90a8904c` 做过精确四文件治理收敛，历史时点保留约 860 个未跟踪路径；
- Task 19 Post-R1 聚合状态为 `BLOCKED`；
- Lane A 因隔离 worktree 无 `node_modules`、TypeScript、ESLint、Prettier 且禁止安装而 `BLOCKED`；
- Lane B 的六个浏览器场景通过 HTTP、路由、无横向溢出、44px 和 loopback 检查，但 contrast 采集为 `null`、移动 focus 含 `body`，所以只能 `PARTIAL/UNVERIFIED`；
- Lane C 因 clean HEAD 缺少 `scripts/verify-final-delivery.mjs` 与 focused release spec 而 `BLOCKED`；
- 历史证据异常状态为 `UNAVAILABLE`，不得升级为当前完成。
- 原 `PHASE_1B_TASK_19_CODEX_EXECUTION.md` 内仍有旧 continuation snapshot，可能写着 Stage B `GRANTED/IN_PROGRESS`；该段必须按 `HISTORICAL/FROZEN` 处理，当前以 `AGENTS.md`、`PLANS.md` 和 R1 contract/plan 的 `NOT_GRANTED` 为准。

历史摘要文件：`C:\Users\HU\.codex\memories\rollout_summaries\2026-09-01T05-59-31-Ta9M-student_care_task19_manager_validation_blocked.md`。历史结果必须以当前 Git、文件和测试重新核验。

## 6. 新账号接手后的第一轮操作

在负责人没有补充授权前，只执行以下只读预检，不执行产品验证或写操作：

```powershell
Set-Location 'C:\Users\HU\Documents\student-care-saas-platform'
git branch --show-current
git rev-parse HEAD
git status --short --untracked-files=all
git status --porcelain=v1 --untracked-files=no
git log -5 --oneline --decorate
git remote -v
Get-FileHash -Algorithm SHA256 'docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md'
rg -n 'ACTIVE_GOVERNANCE|TASK19_R1|TASK19_STAGE_B|TASK19_STAGE_C1|TASK19_STAGE_C2|TASK20_PLUS|OWNER_REVIEW_GATE|STOP_REASON' AGENTS.md PLANS.md PHASE_1B_TASK_19_R1_CODEX_EXECUTION.md docs/project/PHASE_1B_TASK_19_R1_PLAN.md
```

可选的只读产品/交付清单核对（仍不得读保护未跟踪路径内容）：

```powershell
rg -n 'PRODUCTION_DEPLOYMENT_EXECUTED|腾讯云|上传腾讯云|部署测试/生产环境|服务器|域名|备份|回滚' AGENTS.md README.md docs/architecture/ENVIRONMENTS_AND_DEPLOYMENT_DRAFT.md docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md
```

该核对用于确认部署授权边界与已知资料缺口，不得据此连接腾讯云或执行部署。

预检记录必须包含：当前 HEAD、分支、tracked/index 状态、未跟踪数量、V42 SHA、控制面字段、与 R1 baseline 的差异。任何状态漂移都先标记 `BLOCKED` 并等待负责人决定，不要自动修复。

## 6.1 获得对应授权后的本地开发命令

以下命令只是授权后的验证矩阵；本次交接没有执行它们。执行前必须确认负责人已经授权相应 Stage、文件范围和测试范围：

```powershell
# user-web
corepack pnpm --filter @student-care/user-web typecheck
corepack pnpm --filter @student-care/user-web lint
corepack pnpm --filter @student-care/user-web build
corepack pnpm --filter @student-care/user-web test
node --experimental-strip-types --test tests/e2e/user-web-runtime.spec.ts

# mini-program（没有独立 package.json，使用根 workspace 工具链）
node --test --experimental-strip-types apps/mini-program/src/pages/visitor.test.ts
node --test --experimental-strip-types apps/mini-program/src/pages/staff.test.ts
node_modules/.bin/tsc.cmd -p apps/mini-program/tsconfig.json --noEmit
node_modules/.bin/eslint apps/mini-program --ext .ts
node_modules/.bin/prettier --check apps/mini-program

# 变更范围核对
git diff --check
git status --short --untracked-files=all
git status --porcelain=v1 --untracked-files=no
```

user-web 预览只能在明确授权后执行：先完成 build，再运行 `corepack pnpm --filter @student-care/user-web preview`；只接受程序输出的实际 `127.0.0.1` 端口，不把端口 `0` 当作浏览器地址。浏览器核验必须记录 `/visitor`、`/web/visitor/home`、员工路径、三种视口、控制台/请求、横向溢出、44px 触控、contrast 和 focus 结果。

## 7. 负责人授权后的分支流程

只有负责人以明确文字授权相应阶段后，才可继续：

### 若只授权治理收敛 / Stage A

- 只允许四份 R1 治理文件；不实现、不测试、不启动服务、不提交。
- 复核 source whitelist 与基线分类；更新控制面必须重新计算 SHA，并检查所有消费者。
- 停在 `TASK19_R1_STAGE_A_OWNER_REVIEW_GATE`。

### 若明确授权 R1 Stage B

先建立新的、可审查的执行合同或在现合同中形成兼容的授权更新，记录允许文件、禁止范围、验收标准和回滚边界。然后严格按 R1 11 路径白名单执行：

1. 先写失败测试/最小复现；
2. 实现 user-web runtime/build/preview/route parity；
3. 运行 typecheck、lint、Prettier、focused tests、runtime test；
4. 运行真实 `127.0.0.1` 三视口浏览器核验；
5. 核对无外部请求、无横向溢出、44px 触控、contrast、focus、console/request 健康；
6. 只生成授权的临时证据，不写 Task 19 永久交付包；
7. 做独立 Git scope 审计，之后停在负责人验收门。

### 若明确授权 mini-program / staff slice

先把当前 HEAD 中已有的相关提交列入授权范围并由负责人决定是否接受、回退或拆分；不能把它们默认为 R1 产物。继续前必须单独写明：允许的文件、是否允许测试、是否允许提交、是否允许远端写入。

### 若负责人另行要求腾讯云网站部署

这属于独立的高风险外部环境任务，不在 R1 或本交接文件的授权内。先取得负责人针对“目标环境 + 具体写操作”的明确授权，并形成单独部署合同；部署前必须核实当前站点/服务、运行版本、数据分类、云端访问范围、备份和恢复演练、回滚路径、DNS/TLS影响、费用边界、日志/健康检查和人工验收人。不得从仓库历史草案推测服务器、凭据、域名、云产品或命令；不得将密钥写入或回显到本地、文档或日志。缺少任何关键现场信息时停止并标记 `BLOCKED`，先由负责人或云资源管理员提供经批准的非秘密配置与安全访问路径。

## 7.1 项目总体完成情况

下表把“历史已接受”“当前代码存在”“当前正在治理”“未完成/阻塞”分开，避免把代码提交误写成验收结果：

| 范围 | 当前交接状态 | 说明 |
|---|---|---|
| Phase 1A Batch A | `PASS / HISTORICAL / FROZEN` | 项目负责人验收记录存在；只作为冻结输入，不代表当前生产系统。 |
| Phase 1A Batch B | `INTERNAL PASS / HISTORICAL / FROZEN` | 合同中的治理、原型、基线、验证和证据门禁已记录；仍明确 `PRODUCTION_DEPLOYMENT_EXECUTED=NO`，历史文件中的 owner acceptance 字段不能升级为当前部署授权。 |
| Phase 1B Task 01–16 | `ACCEPTED_AND_FROZEN`（按当前控制面） | 相关 acceptance/plan 文件和 SHA 锚点保留；不应回写或重做历史证据。 |
| Phase 1B Task 17 | `ACCEPTED_AND_FROZEN` | API/admin-web 入口和六类审计动作有本地验证记录；UI 视觉限制属于历史证据。 |
| Phase 1B Task 18 | `ACCEPTED_AND_FROZEN` | 三端隔离回归与 localhost smoke 有 checkpoint/负责人 review 记录；不等于发布或生产部署。 |
| Task 19 原最终交付 | `NOT_CLOSED / PAUSED` | final-delivery 证据包、manifest、ZIP、完整 release 验收没有被当前现场重新证明；历史验证曾因依赖、验证器和 contrast/focus 门禁阻塞。 |
| Task 19 R1 Stage A | `PROPOSED_PENDING_OWNER_REVIEW` | 当前唯一活动治理边界；只 formalize user-web runtime/visual blocker，不授权实现。 |
| user-web 当前 HEAD 实现 | `PRESENT_IN_CODE / NOT_ACCEPTED` | HEAD 中已有 visitor runtime、staff routes/pages、build/preview 和静态资源，但提交超出 R1 baseline，必须由负责人收敛授权。 |
| mini-program visitor slice | `PRESENT_IN_CODE / NOT_REVERIFIED` | 四页原生壳、访客 home/content、安全过滤和本地导航已存在；原 visitor 计划仍全部未勾选。 |
| mini-program staff slice | `PRESENT_IN_CODE / OUTSIDE_ORIGINAL_VISITOR_PLAN` | workbench/quick-action 与 staff route/test 已进入 HEAD；原 visitor 计划只写两页，未形成独立验收回执。 |
| mini-program 当前工作树波次 | `DIRTY / IN_PROGRESS_UNVERIFIED` | 最新快照 13 个 tracked 文件未暂存修改，另有编译 JavaScript/项目配置等未跟踪现场；该数字仍可能变化，作者、授权和验证结果待负责人确认。 |
| API、数据库、真实身份、真实微信授权、伙伴云、正式 AI、支付 | `NOT_CONNECTED / NOT_AUTHORIZED` | 当前代码和计划边界仍是模拟数据与本地投影，不能当作可上线业务。 |
| 腾讯云网站部署 | `NOT_VERIFIED / NOT_AUTHORIZED` | 没有已确认服务器、域名、云资源、流水线、备份回滚或上线版本。 |
| 微信开发者工具编译、模拟器、真机、体验版、审核、生产发布 | `NOT_RUN / NOT_AUTHORIZED` | 没有当前可核验的发布配置或发布证据；设计计划明确把体验版发布列为非目标。 |

### 已冻结的 Phase 1B 功能链（历史完成范围）

以下是当前控制面认可的历史功能链；“已接受/冻结”表示对应治理证据已冻结，不表示当前 HEAD 的新增提交已经重新验收：

| 任务 | 历史交付范围 | 当前交接说明 |
|---|---|---|
| T01 | workspace 与基础工程 | 已接受/冻结 |
| T02 | shared contracts 与 validation | 已接受/冻结 |
| T03 | tenant/campus scope | 已接受/冻结 |
| T04 | identity 与 employee login 边界 | 已接受/冻结 |
| T05 | content/publishing 基础 | 已接受/冻结 |
| T06 | institution/home content | 已接受/冻结 |
| T07 | public teachers | 已接受/冻结 |
| T08 | activities/meals | 已接受/冻结 |
| T09 | newcomer guides | 已接受/冻结 |
| T10 | resources/search | 已接受/冻结 |
| T11 | partner-cloud 安全入口与边界，不是伙伴云 API 接入 | 已接受/冻结 |
| T12 | file upload/COS adapter boundary，不是真实 COS 连接 | 已接受/冻结 |
| T13 | visitor user-web | 已接受/冻结 |
| T14 | visitor mini-program | 已接受/冻结；历史视觉运行时限制仍需区分 |
| T15 | internal employee user-web | 已接受/冻结 |
| T16 | mini-program staff workbench/quick actions | 已接受/冻结；历史 UI 视觉限制仍需区分 |
| T17 | API/admin-web audit entry 与六类审计动作 | 已接受/冻结，本地集成验证记录存在 |
| T18 | 三端回归、安全隔离、localhost smoke、release-readiness gate | 已接受/冻结；不等于外部发布 |

这些任务的 acceptance/review 文件包含历史时间点字段，若与 `PLANS.md` 或 V42 冲突，以当前 `AGENTS.md`、`PLANS.md` 和 V42 控制面为准。当前不允许借历史功能链直接启动真实微信、COS、腾讯云或生产服务。

### 历史技术草案与当前落地形态

- 历史架构草案曾建议 Taro + React + TypeScript（小程序）、Next.js + React（用户网页/管理后台）、NestJS、PostgreSQL + Prisma、Redis、COS、Docker + Nginx；这些是规划方向，不是当前已部署架构。
- `docs/architecture/TECH_STACK_BASELINE.md` 的规划基线还记录过 Node 22 LTS、pnpm 10、React 19/Vite 6、PostgreSQL 16、Redis 7 和 COS port；当前根工程实际约束是 Node 24.14.0、pnpm 11.22.0，版本漂移必须以当前 `package.json` 和锁文件核对，不能把历史基线当作当前运行环境。
- 当前 HEAD 的小程序落地形态是原生微信 JSON/WXML/WXSS 加 TypeScript 本地适配器，依赖根 workspace 的 Node/TypeScript；没有完成从草案栈到正式服务栈的迁移，也没有真实 API、数据库、COS、Redis 或微信云连接。
- 当前 user-web 有 native HTML/ES module、Node 内置 build/preview 和合成数据投影；不能把它称为已上线 Next.js 应用。

## 7.2 微信小程序开发、配置与发布交接

### 当前已存在的开发内容

- `app.json` 当前登记四个本地页面：访客首页、访客内容、员工工作台、员工快捷动作。
- `app.ts` 只有本地 `onLaunch` 壳，不调用 API、存储或云服务。
- `app.wxss` 提供全局颜色、排版、焦点、44px 触控目标和 reduced-motion 规则。
- 访客切片使用合成响应，仅显示 `PUBLISHED + PUBLIC + PUBLIC scope + SIMULATED + FRESH + ENABLED` 内容，并提供 loading/empty/error/published 状态和安全 slug 导航。
- 员工切片使用合成员工、租户和校区数据，提供 workbench 与 quick-action；`staff.routes.ts` 对身份、membership、tenant、campus 和 capability 失败关闭。
- 员工页目前是可通过直接页面路径加载的本地演示页：没有真实登录、身份初始化、会话恢复或正式员工入口，访客页也没有进入员工工作台的产品入口；`activeEmployee`、tenant/campus 和 records 都是硬编码合成数据。
- focused tests 位于 `apps/mini-program/src/pages/visitor.test.ts` 和 `apps/mini-program/src/pages/staff.test.ts`。
- `apps/mini-program/tsconfig.json` 使用根 workspace TypeScript 配置；该目录没有独立 `package.json` 和 npm/pnpm scripts。
- `docs/product/PAGE_INVENTORY.md` 规划的是 20 个 A 级小程序页面、13 个用户网页页面、14 个机构管理网页页面、12 个 B 流程和 10 个 C 类文档项；当前原生小程序只有 4 个页面代码，不能把原型清单当作已实现页面。
- 因此小程序当前可按“4/20 个 A 级原生页面存在，剩余 16 个 A 级小程序页面及 12 个 B 流程未完成/未形成原生运行时”交接；访客四页也只是局部切片，不覆盖机构、教师、活动、餐食、校区联系、员工登录、指南、资源、伙伴云和账号等完整清单。

### 配置和发布缺口

- `apps/mini-program/project.config.json` 与 `project.private.config.json` 当前存在但未跟踪；它们属于保护未跟踪内容，本次没有读取其内容，也没有核验 AppID、开发者账号、微信开发者工具设置或私有环境字段。
- 没有已确认的 `sitemap.json`、cloudfunctions/cloudbase、微信云环境 ID、体验版上传脚本、CI 发布脚本、版本号策略或发布回滚记录。
- 没有已确认的服务器域名、业务域名、request/upload/download/file 合法域名、网络超时配置、隐私协议配置或后端 API 线上地址。
- 没有执行微信开发者工具编译、模拟器检查、真机检查、体验版上传、审核或生产发布。
- WXML/WXSS 的微信运行时兼容性、焦点行为、窄屏表现和真机触控行为均未经过开发者工具或真实设备复核。
- 现有 visitor 设计计划的 Tasks 1–6 checkbox 仍未勾选；staff slice 后续增加了页面和配置，但没有同步的独立验收合同。计划原文还要求 `app.json` 只登记两个 visitor 页面，而当前登记四页，说明计划与代码发生了范围漂移。

### 负责人授权后的微信小程序流程

1. 负责人先明确授权范围：visitor、staff，还是两者；是否允许读取/修改两个 `project.config*` 文件；是否允许微信开发者工具、模拟器、真机和体验版操作。
2. 由项目负责人或微信管理员通过安全渠道提供非秘密项目配置确认和开发者工具访问方式；不要把 AppID 私有配置、Token、证书或密钥写入 Git、交接文件或日志。
3. 本地先运行 visitor/staff focused tests、mini-program TypeScript、ESLint、Prettier，再在微信开发者工具中导入 `apps/mini-program`，确认四个页面注册和 WXML/WXSS 编译结果。
4. 在模拟器和批准的测试设备上核对访客导航、员工权限失败关闭、44px 触控、窄屏布局、无外部请求、无真实数据和无敏感字段泄露。
5. 若要接入 API、微信登录、上传、云开发或腾讯云后端，必须另立任务合同，明确合法域名、环境隔离、`tenant_id/campus_id`、权限、隐私同意、日志审计、失败降级和回滚；当前不能直接加 `wx.request`、`wx.login`、`wx.uploadFile` 或云 SDK。
6. 体验版上传、审核和生产发布分别需要单独授权、版本号、变更摘要、隐私合规确认、人工验收、发布窗口和回滚方案；当前均为 `NOT_AUTHORIZED`。

## 8. 交接后的开发纪律

- 任何完成声明都必须有本轮命令、退出码和可复核文件/Git证据。
- `PASS` 只描述实际执行且成功的内部证据，不代表负责人验收、生产可用或发布完成。
- `BLOCKED` 用于缺少授权、控制面漂移、依赖/验证器缺失或关键门禁未闭合；不要把 `UNKNOWN` 或 `PARTIAL` 改写成 PASS。
- 同一错误最多自动修复两轮；重复失败后分类为 `PRODUCT_ISSUE` 或 `INFRASTRUCTURE_ISSUE`。
- 保持模拟数据、无真实登录、无真实 AI、无生产数据库、无密钥。

## 9. 交接签收模板

新账号完成预检后，应回执：

```text
HANDOFF_RECEIVED=YES
REPOSITORY=C:\Users\HU\Documents\student-care-saas-platform
BRANCH=<actual branch>
HEAD=<actual sha>
TRACKED_WORKTREE=<CLEAN|DIRTY>
UNTRACKED_COUNT=<actual count>
ACTIVE_GOVERNANCE=<actual value>
ACTIVE_TASK=<actual value>
R1_IMPLEMENTATION_AUTHORIZED=<actual value>
CONTROL_PLANE_DRIFT=<YES|NO>
STATUS=BLOCKED|READY_FOR_OWNER_REVIEW
NEXT_ACTION=<one bounded action>
```

本交接文件的验收边界是：新账号能够复现实测现场、识别控制面与代码漂移、保存保护路径，并知道在什么授权下可以继续。它不声明当前产品已通过 R1 或 Task 19 验收。

## 10. 可直接发送给新账号的完整交接指令

```text
你现在接管 C:\Users\HU\Documents\student-care-saas-platform。请先读取 docs/HANDOFF_TASK19_R1_2026-09-22.md，再读取 AGENTS.md、PLANS.md、V42 治理文件和 R1 contract/plan。

当前现场：分支 feature/phase-1b-task-19-final-delivery-acceptance，HEAD 为 bd0001faa8e2fd7bbabe86e3d778ba24431107e8。2026-09-23 10:46 +08:00 最新快照有 13 个已跟踪小程序文件未暂存修改、暂存区为 0、883 条未跟踪路径；现场仍可能被另一个本地进程或账号继续修改，接管时先重新计数。R1 合同另有 71 条保护基线子集。保留全部现场，不读取保护未跟踪内容，不删除、移动、覆盖、清理、格式化、暂存或提交这些变化。

先只读执行：
1. 核对 branch、HEAD、origin、Git status、未跟踪数量和 V42 SHA-256。
2. 核对 ACTIVE_GOVERNANCE=V42、ACTIVE_TASK=TASK19_R1_STAGE_A_FORMALIZATION、R1_IMPLEMENTATION_AUTHORIZED=NO、Task19 Stage B/C1/C2=NOT_GRANTED、Task20+=NOT_GRANTED。
3. 把当前状态标记为 BLOCKED / CONTROL_PLANE_DRIFT：HEAD 已包含 user-web 与 mini-program 实现，但治理文件没有给这些实现当前授权，不能自动验收、回退、继续开发或发布。
4. 忽略旧 `PHASE_1B_TASK_19_CODEX_EXECUTION.md` 中可能出现的 Stage B `GRANTED/IN_PROGRESS` continuation snapshot；它是历史冻结字段，不能覆盖当前 R1 `NOT_GRANTED` 控制面。
5. 记录当前 dirty wave：最新快照 13 个 tracked 小程序文件在修改 import/tsconfig/tests/WXML/WXSS，另有编译 JavaScript 和 project config 未跟踪现场；作者、授权和测试结果未知，保持 `IN_PROGRESS_UNVERIFIED`，不要接着改或回退。
6. 记录阶段状态：Phase 1A 与 Phase 1B Task01-18 是历史接受/冻结证据；Task19 final delivery 未闭合；R1 Stage A 等负责人 review；mini-program visitor/staff 代码存在但未当前复验/验收。
7. 记录小程序事实：当前只有 4 个原生页面代码（visitor home/content、staff workbench/quick-action）；V0.1 页面清单规划 20 个 A 级小程序页面和 12 个 B 流程，因此剩余页面/流程未完成。project.config.json 与 project.private.config.json 虽存在但属于未跟踪保护内容，不能读取其 AppID 或私有值。
8. 记录发布事实：没有经核验的微信开发者工具编译、模拟器、真机、体验版、审核、生产发布；没有经核验的腾讯云服务器、域名、DNS/TLS、COS、备份、回滚、监控或线上版本。历史候选服务器规格（4核/8GB/180GB SSD/12Mbps/2000GB/月）只是 V0.1 候选，不是上线证据。

负责人没有明确授权前：不安装依赖、不运行产品测试/构建/浏览器/微信开发者工具、不接入 API/微信登录/云开发/COS、不连接腾讯云、不上传体验版、不部署、不 push、不 release、不修改 lockfile，不处理保护未跟踪路径。

只有在负责人签发新的阶段合同后，才按授权范围执行本地验证；微信体验版/审核/生产发布和腾讯云部署必须分别授权，并单独记录目标环境、最小权限、域名/合法域名、隐私合规、备份、回滚、健康检查、人工验收和停止条件。

完成只读预检后回执：
HANDOFF_RECEIVED=YES
HEAD=<actual sha>
ACTIVE_TASK=<actual value>
CONTROL_PLANE_DRIFT=YES|NO
MINI_PROGRAM_NATIVE_PAGES=4_OF_20_PLANNED
MINI_PROGRAM_WORKTREE=DIRTY_IN_PROGRESS_UNVERIFIED
WECHAT_DEVTOOLS_STATUS=NOT_RUN|PASS|BLOCKED
WECHAT_EXPERIENCE_RELEASE=NOT_AUTHORIZED
TENCENT_CLOUD_DEPLOYMENT=NOT_VERIFIED_AND_NOT_AUTHORIZED
STATUS=BLOCKED|READY_FOR_OWNER_REVIEW
NEXT_ACTION=<one bounded action>
```

