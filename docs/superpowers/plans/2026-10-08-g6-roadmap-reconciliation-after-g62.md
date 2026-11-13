# G6.2 后项目路线核对与下一目标计划

> **执行说明：** 本文件记录一次文档范围的路线核对。产品代码继续留在隔离工作树；本任务不把本机合成演示写成真实服务或正式验收。

**目标：** 对照项目方案、V3 实施路线和当前证据，核对 G6 隐私/统一服务/恢复目标的完成状态，并按现有优先级确定下一项可执行任务。

**依据：** 项目方案 V2.0 第 15 章及附录 C（PDF 第 43、58 页）；`docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`；`PLANS.md`；G6.1 与 G6.2 已批准合同及执行记录。

**本任务写集：** 仅修改 `PLANS.md` 中 Task20 当前/下一目标和本次核对状态；新建本计划文件。没有业务代码、配置、测试、依赖或主工作树产品代码改动。

## 核对结果

项目方案把未成年人信息作为最高优先级风险：采集前需明确目的和必要性、监护人同意版本记录及影响评估；使用中需最小采集、按权限隔离、敏感字段最少展示、保留访问/导出/更正/删除流程记录，并说明第三方数据流；退出时需支持查询、更正、复制、删除、撤回同意、保存期限与到期删除。正式试点还要核验实际地区、供应商和数据流，报告本身不替代监管部门或专业人员意见。项目开发阶段只使用虚构数据，不接入真实学生信息。

| G6 目标                                            | 当前证据                                                                                                     | 状态                        | 尚缺内容                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. 统一服务与逐对象接线                            | G6.1 隐私申请与 G6.3 同意/期限 API 已在本地合成服务中；G6.2 家长网页/管理网页仍仅覆盖隐私请求。              | `PARTIAL`                   | G6.3 尚未接入 Web/Mini 页面；其他对象仍按各自任务状态管理。                                                                                                 |
| 2. 服务端可信范围与最少审计                        | G6.1 按负责人会话和校区/班级范围处理合成申请；G6.2 非负责人拒绝队列并只显示最少字段。                        | `PASS_LOCAL_SYNTHETIC_ONLY` | 尚未连接正式身份和真实多租户数据；不得据此声明生产隔离已验收。                                                                                         |
| 3. 三端共用 ID、版本、发布及清理规则               | 当前隐私申请有 API/Web/Admin 本机合成流程；小程序没有纳入 G6.2。                                             | `PARTIAL`                   | 需按各自页面职责复核小程序接入是否必要，不能把网页自动测试等同微信开发者工具实点。                                                                     |
| 4. 数据库、持久化和迁移/回滚                       | G6.1/G6.2 明确使用内存数据；重启清空。                                                                       | `NOT_IMPLEMENTED`           | 真实数据库、迁移、回滚与跨设备持久化未实施；本地演示不冒充此能力。                                                                                     |
| 5. 构建、路由、权限负测、浏览器/微信操作、恢复说明 | User Web 49/49、Admin Web 31/31、G6.1 API 4/4；两端类型检查/构建/ESLint 通过；完整 `git diff --check` 通过。 | `PARTIAL`                   | 五个既存大文件的完整 Prettier 检查未通过；本轮没有浏览器自动化控制器，UI 实际视觉点击未执行；全量路由、微信实际操作和备份恢复仍需按模块闭环。          |
| 6. 同意与隐私权利                                  | G6.1/G6.2 支持四类合成申请；G6.3 增加用途、版本、授权、撤回与期限复核 API，演示变化均为 `dataChanged=false`。 | `PARTIAL`                   | G6.3 尚无 Web/Mini 页面；真实期限、删除、必要保留、影响评估和供应商核验仍须专业人员及负责人确认。                                                       |
| 7. 正式上线前置条件                                | 项目计划明确由负责人提供真实机构范围、数据授权、微信主体/环境、域名/云预算及供应商决定。                     | `BLOCKED_BY_DESIGN`         | 这些外部决定尚未提供；本地开发不得创建生产资源、使用真实数据或自行替负责人作决定。                                                                     |

## G6.2 当前状态

- `TASK20_G62_PRIVACY_REQUEST_STATUS=PARTIAL_LOCAL_SYNTHETIC`。家长网页可提交/查看/撤回合成申请；负责人网页可开始审核并记录模拟完成，不访问学生列表。独立复审已关闭递归身份检查和 409 冲突不重试两项问题。
- User Web focused tests `49/49`、Admin Web focused tests `31/31`、G6.1 API focused tests `4/4`；类型检查、编译/构建、ESLint 和新文件 Prettier 通过；lockfile SHA 保持不变。
- 全文件 Prettier 检查仍在 User Web `client.ts`、`main.ts`、`preview.mjs` 与 Admin Web `main.ts`、`local-proxy.mjs` 失败。整文件格式化会重写合同开始前已有现场，因此本轮保持原样，不用扩大的格式差异换取表面全绿。
- `UI_NOT_VISUALLY_VERIFIED`：当前没有可调用的浏览器控制器；Edge 已安装，但未执行页面实际点击。负责人复核和主工作树产品代码同步均未宣称完成。

## 下一目标与边界

G5.5 主工作树选择性整合于 2026-10-08 完成：在不覆盖主树其他页面的前提下，接入媒体模型、文件生命周期页面与页面测试，替换 /admin/files 静态占位，并由统一启动入口传入实际本机服务端口；客户端仅允许 127.0.0.1 与 /local/*。Admin 生命周期测试 11/11、媒体 API 测试 5/5、启动器 8 项通过/1 项因 127.0.0.1:4317 已被占用而跳过、Admin 类型检查与构建/ESLint/Prettier/差异检查通过，独立复核无 Critical/Important。之后使用一次性 Admin 页面预览和独立内存 API 完成真实浏览器点击：校区负责人查看授权范围、无引用素材归档、有引用素材保持可用、平台视图仅看匿名摘要、只读模式禁用写操作；20 个请求均发往独立 4319，浏览器错误 0、外部请求 0、现有 4317 收到请求 0。截图保存在系统临时目录 `g55-media-owner-east.png`、`g55-media-platform.png`、`g55-media-readonly.png`。本地浏览器与视觉复核通过，负责人 Owner Review 仍待进行。

G5.1A 成员管理主工作树接入于 2026-10-08 完成自动验证：从只读来源选择性接入同校区合成员工状态管理，不覆盖员工证照、材料、招聘和运营区块；退出员工页或进入拒绝视图时结束成员会话，并阻止并发旧响应覆盖新列表。Admin 全量测试 51/51、成员专项 7/7；统一启动器 8 项通过、1 项因既有 `127.0.0.1:4317` 进程而跳过；类型检查、构建、ESLint、目标文件 Prettier、员工路由 HTTP smoke、`git diff --check` 和精确写集审计通过。成员 API 单测未能越过既有测试根路径错误加载 Fastify，但启动器端到端测试实际覆盖成员读取、版本化状态变更、旧版本 `409` 和事件记录。独立复核无 Critical/Important，离页清理、并发刷新问题及对应 Minor 均已关闭。完整 Admin `main.ts` 格式检查受相邻旧修改影响，新增成员片段已单独核对符合 Prettier；未整文件重写。网页人工点击 `NOT_RUN`，Owner Review `PENDING`。

G5.1A 后续路线复核记录已由 2026-10-08 的 G5.2B 主树基线重核修正：小程序目标文件已与来源逐字节一致；主树 User Web 缺家长首页，Admin Web 缺费用入口，因此不能按旧 G5.2B 合同直接同步。该重核取代本段原定的“先做 G5.2B 直接选择性同步”下一步。当前先为 G6 家长网页/管理网页入口收敛制定精确写集，再按 V3 未完成矩阵继续；本地测试结果仍不等于 Owner Review 或视觉验收。

G5.3B 证据已复核：管理网页类型检查通过，材料/招聘及证照聚焦测试 6/6 通过，实际浏览器流程通过且无外部请求，ESLint 与新增文件格式检查通过；未修改合同白名单内代码。Owner Review 仍待负责人审阅，主工作树整合未执行。随后复核 G5.3A：主树 Admin 类型检查、编译、聚焦测试 6/6、ESLint、Prettier 通过；隔离 Core 已编译测试 5/5、目标 ESLint 与新增文件 Prettier 通过。完整 API 类型检查本轮仍因隔离工作树引用主树旧契约导出及统计模块类型诊断失败；本轮浏览器运行时缺失，未重做页面点击，既有点击通过仅保留为历史记录。G5.3A Owner Review 仍待负责人审阅，Core API 未同步主树。下一项是完成 Web/Mini 当前状态证据审计并落地统一剩余实施计划，再按清单开展 G6 主树选择性整合。

G6 后续任务必须继续把“本机合成”与“正式能力”分开：先单独建立同意记录和保存期限模型的实施合同，再做 API/Web/Mini 各端所需入口；任何阶段都不接入真实学生数据或真实服务，也不执行生产迁移。持久化、真实法律/机构审核和正式上线只有在项目方案要求的前置决定齐备后才能另行处理。

## Mini 当前验证基线修复合同

**任务：** `TASK20_MINI_ROUTE_ASSERTION_RECONCILIATION`，作为 Web/Mini 当前状态审计中的小型修复，不新增业务流程或路由。

**隔离工作树：** `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`。

**允许修改路径：**

- `apps/mini-program/src/pages/visitor.test.ts`
- `apps/mini-program/src/pages/mini-brand-ui.test.ts`
- `apps/mini-program/src/pages/parent-entry.test.ts`
- `apps/mini-program/src/pages/mini-ui-polish.test.ts`
- `apps/mini-program/pages/parent/learning/index.wxss`

**根因与范围：** 当前 `app.json` 已保留原 7 条路由并增加家长首页、绑定页、学习页，共 10 条；三份测试仍精确期望旧的 9 条。UI 文案测试将整页“模拟/演示/合成”披露一并禁止，与项目要求保留“模拟数据”说明冲突。液态玻璃覆盖列表也漏掉家长学习页。本修复只让测试反映真实 10 路由，检查按钮/交互标签的正式名称而保留披露，并让学习页卡片与按钮沿用现有绿黄液态玻璃风格。

**禁止范围：** 不改 `staff.test.ts`，不改 `app.json`、路由、页面逻辑、生成 JS、依赖或配置；不修改主工作树产品代码；不提交、推送、部署或发布。

**验收与验证：** 三份路由相关 focused tests 和 `mini-ui-polish.test.ts` 通过；Mini typecheck 与 `scripts/mini-runtime.mjs` 护栏通过且无生成文件变化；对本写集运行 ESLint、Prettier、`git diff --check`，并审查隔离树目标路径状态。微信开发者工具人工点击因本轮没有可用控制器，仍记为 `NOT_RUN`；开发者工具项目目录应为 `apps/mini-program`，不能从仓库根启动。

**停止条件：** 如需改动上述路径之外的文件、接入真实服务或扩大到学习业务流程，停止并更新审计计划；不得为了测试变绿删掉合成数据披露或删除已注册页面。

**本次执行结果：** 四份目标测试从原先的三项路由失败及一项披露断言失败，改为 `40/40` 通过；另十份关系、成长记录、请假、健康和学习流程测试 `92/92` 通过。Mini typecheck、ESLint、目标文件 Prettier 通过；`node scripts/mini-runtime.mjs` 为 `MINI_RUNTIME_PASS pages=10 outputs=32 updated=0`，确认没有生成 JS 改动。微信开发者工具未做人工点击复核。

## 网页与 Mini 当前状态审计及剩余实施顺序

本节是 2026-10-08 的新鲜审计补记，不覆盖 V3 路线中的历史状态。证据来源为当前 `PLANS.md`、V3 路线、各隔离工作树只读审查、上述实际测试输出，以及项目方案 V2.0（SHA-256：`4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`）。

| 范围                    | 当前证据                                                                                                                                                                              | 状态                               | 后续交付                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mini 页面注册与页面产物 | `apps/mini-program/app.json` 注册 10 页，十页的 `.json/.ts/.js/.wxml/.wxss` 均存在；Mini typecheck 通过；编译护栏 10 页/32 输出/0 变化。                                              | `PASS_LOCAL_AUTOMATED`             | 原生开发者工具仍须打开 `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign\apps\mini-program`，逐角色点击关系、成长记录、日报/通知、请假、健康、学习等关键流程。仓库根没有 `app.json`，从仓库根打开导致启动失败。 |
| Mini 流程与样式聚焦验证 | 路由、品牌、注册和液态玻璃页面测试 `40/40`；绑定/审核、成长记录、请假、健康和学习相关流程测试 `92/92`。学习页现纳入十页样式检查，按钮按文字宽度。                                     | `PASS_FOCUSED_ONLY`                | 以上自动测试不等于微信原生控件实点；未验证的项目不得标成“已可正式使用”。                                                                                                                                               |
| Mini 全量测试基线       | 排除受保护的 `staff.test.ts` 后，Mini `src` 测试为 `197/197`；四个之前的失败原因已在测试层修正。受保护 `staff.test.ts` 的既有只读结果为 `5/7`，两项断言仍依赖旧按钮文案与旧路由数量。 | `PARTIAL_EXCLUDING_PROTECTED_TEST` | 保持 `staff.test.ts` 不变；微信开发者工具中的人工点击也尚未执行。不能把排除受保护测试的本地自动化通过写成全部 Mini 验收。                                                                                              |
| 主树 User Web           | 当前主树有访客与员工公开页面；尚无家长隐私请求页面。G6.2 家长页面仅在隔离工作树，完成度是本机合成、视觉复核未运行、未整合。                                                           | `PARTIAL`                          | G6 共享运行时逐文件同步后，再接通家长固定隐私请求、撤回和负责人审核页面，并进行真实本地浏览器点击复核。                                                                                                                |
| 主树 Admin Web          | G5.5 媒体生命周期页已在主工作树接通本机合成服务；G5.3B 员工材料/招聘、G5.4 租户与配额、G6.2 隐私审核页面的主树状态不在本轮复核范围。 | PARTIAL | 后续按对应合同逐文件选择性整合，保留已有主树现场并分别验证。 |
| 主树 API 与共享服务     | G5.5 媒体生命周期路由已在当前主树 local-synthetic 服务中并通过 5 项媒体测试；普通 API 类型检查仍保留此前记录的跨工作树旧导出/统计诊断。 | PARTIAL | 继续按服务域收敛共享契约和验证；Admin 页面同步不等于完整 API 验收。 |
| V2 隐私要求             | G6.1/G6.2 仅支持本机合成申请与负责人模拟审核，结果固定 `dataChanged=false`。当前未发现同意版本台账、监护人授权撤回记录、影响评估、保存期限及到期删除流程。                            | `NOT_IMPLEMENTED_FOR_REAL_DATA`    | 增加仅合成的同意记录与保存期限演练；正式数据、真实删除、法务审查和生产迁移均需另行决策，不伪称本地演示已满足生产隐私治理。                                                                                             |
| Web/Mini 视觉证据       | 最近完整微信开发者工具点击未执行；浏览器插件运行时缺失。现有自动页面测试和 CSS 静态检查只能证明脚本行为/样式规则。                                                                    | `NOT_RUN`                          | 工具恢复后按正确 Mini 目录、真实角色及窄屏状态实点；网页用实际本地浏览器复核并记录页面错误、请求和截图。                                                                                                               |

### 后续实施目标

1. **Mini 人工流程验收。** 自动化测试已恢复，但必须在微信开发者工具中打开 `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign\apps\mini-program`，实际点击家长绑定、员工审核、成长记录发布、日报/通知、请假、健康、学习等关键入口；`staff.test.ts` 的两条旧断言需另按保护规则处理，不能隐瞒为全量通过。
2. **剩余主树选择性整合。** 逐文件比较来源与当前主树版本；G5.3B、G5.4、G5.5、G6.4 与 G5.1A 已有同步记录，不再重复整合。G5.2B 仍记录为主树同步未执行，是下一候选批次；先建立精确写集合同，再同步不冲突的最小增量。每批列出来源版本、测试和回退点；冲突或需扩写主树配置时先暂停该批，不覆盖已有现场。
3. **补齐合成同意与保存期限演练。** 依 V2 隐私基线建立授权目的/版本/监护人确认、撤回、负责人范围审核、访问留痕和到期处理的最小本机流程；不保存真实学生资料，不执行真实删除、数据库迁移、外发通知或真实法务判断。
4. **按 V3 未完成项补业务闭环。** 优先完成家长费用/收据/协议只读、教师任务与班级范围、日报/月反馈共享、物资申请/审核/领取、机构统计来源追溯；AI 学习只用固定题和分层提示，保持成人同意与教师接手，不调用正式模型。每一项先确认主树是否已存在，再修复断链，避免重复建页。
5. **端到端验收。** 浏览器和微信工具恢复后，从实际入口跑家长申请→员工/负责人审核→家长查看/确认/撤回，以及成长记录草稿→审核→发布→家长查看；确认返回刷新、角色权限、范围隔离、窄屏按钮和无外网请求。没有人工工具证据的项继续标 `NOT_RUN`。
6. **正式运营仍受前置条件限制。** 真实认证、真实机构数据、数据库、对象存储/伙伴云、短信/通知、支付、正式 AI、备份恢复、部署与发布不在当前本机演示交付中。先完成机构、主体、授权、供应商、安全和预算决策，再另行做正式化设计与审批。

## 完成检查

- [x] 逐项核对项目方案隐私要求、V3 G6 清单和 G6.1/G6.2 当前验证证据。
- [x] 保留 G6.2 的 `PARTIAL`，明确格式、视觉复核、Owner Review 与主工作树同步缺口。
- [x] 按 `PLANS.md` 现有优先级记录下一目标；不改业务代码，不更改 V3 冻结计划。
- [x] 对本计划与 `PLANS.md` 执行 `git diff --check`，并核对合同/文件哈希和写集。

## Mini 全量测试基线修复子任务

**任务：** `TASK20_MINI_FULL_TEST_BASELINE_RECOVERY`，只修正 Mini 本地测试的临时端口隔离、TypeScript 测试入口和共享月反馈断言；不更改产品行为。

**隔离工作树：** `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`。

**允许修改路径：**

- `apps/mini-program/src/local-synthetic/attendance.test.ts`
- `apps/mini-program/src/local-synthetic/multi-student.test.ts`
- `apps/mini-program/src/pages/staff-daily.test.ts`
- `apps/mini-program/src/pages/supply-request.test.ts`

**根因与处理：** 两个真实页面 HTTP 测试固定监听 `127.0.0.1:4317`，在端口被占用时会失败；改为每个测试启动临时端口，并让测试内的本机请求转发到该地址，不终止或更改既有进程。日报测试以 `.js` 导入不存在的运行时文件，改为直接导入当前 `.ts` 源。物资页测试仍读取已经撤销的顶层 `monthlyFeedbackOptions`，改为核对共享投影的月度反馈字段与页面共享模板入口。

**禁止范围：** 不改产品源码、`staff.test.ts`、路由、生成 JS、Mini 配置、依赖或 lockfile；不修改主工作树产品代码；不停止/终止任何现有进程；不接入真实服务、数据或持久化；不提交、推送、部署或发布。

**验收与验证：** 四个目标测试通过；相关 Mini 流程测试、Mini typecheck、目标 ESLint/Prettier、Mini 编译护栏和 `git diff --check` 通过；审查本任务精确差异与隔离工作树状态。验证只证明本机自动化，不替代微信开发者工具实点；人工视觉/点击验收继续标记 `NOT_RUN`。

**停止条件：** 如需要修改四个测试文件以外路径、产品代码、配置或运行中进程，停止该子任务并先回报具体证据，不扩大写集。

**执行结果：** 四个失败原因均按测试层修复，四文件聚焦测试 `19/19` 通过；Mini `src` 下排除受保护 `staff.test.ts` 后的全量测试 `197/197` 通过。Mini typecheck、目标 ESLint/Prettier 通过；`node scripts/mini-runtime.mjs` 输出 `MINI_RUNTIME_PASS pages=10 outputs=32 updated=0`，没有生成 JS 变化。测试只使用各自的临时本机端口，没有停止原先监听 `4317` 的进程。`staff.test.ts` 未修改，其历史只读检查中的旧路由/文案断言仍未纳入本轮通过数。微信开发者工具人工点击仍为 `NOT_RUN`。

## G6 共享服务选择性同步子任务

**任务：** `TASK20_G6_SHARED_RUNTIME_SELECTIVE_RECONCILIATION`。先复核隔离来源中的本地合成共享服务和契约，再只选择性同步可作为后续 Web/Admin 功能底座的最小服务端增量。不能把本地演示描述成真实认证、正式多租户、持久化或生产就绪。

**隔离来源：** `C:\Users\HU\.codex\worktrees\task20-local-shared-core`，基线 `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。复制前必须逐文件确认来源和主树目标；来源仅作为只读输入。

**主工作树精确写集：**

创建 `apps/api/src/local-synthetic/` 下的 `attendance.service.ts`、`binding-leave.service.ts`、`care-record.service.ts`、`fees.service.ts`、`health-incident.service.ts`、`learning-session.service.ts`、`media-assets.service.ts`、`monthly-feedback.service.ts`、`notice.service.ts`、`operational-statistics.service.ts`、`pickup-credentials.ts`、`pickup.service.ts`、`privacy-requests.service.ts`、`repository.ts`、`resource-library.service.ts`、`routes.ts`、`server.ts`、`sessions.ts`、`staff-credentials.service.ts`、`staff-daily.service.ts`、`supply-request.service.ts`、`task-assignment.service.ts`。

创建 `apps/api/test/` 下的 `local-synthetic-attendance.test.ts`、`local-synthetic-care.test.ts`、`local-synthetic-fee-ledger.test.ts`、`local-synthetic-fees.test.ts`、`local-synthetic-health-incident.test.ts`、`local-synthetic-learning-session.test.ts`、`local-synthetic-media-assets.test.ts`、`local-synthetic-membership.test.ts`、`local-synthetic-monthly-feedback.test.ts`、`local-synthetic-multi-student.test.ts`、`local-synthetic-notice.test.ts`、`local-synthetic-operational-statistics.test.ts`、`local-synthetic-pickup.test.ts`、`local-synthetic-privacy-requests.test.ts`、`local-synthetic-resource-library.test.ts`、`local-synthetic-staff-credentials.test.ts`、`local-synthetic-staff-daily.test.ts`、`local-synthetic-supply-request.test.ts`、`local-synthetic-task-assignment.test.ts`。

创建 `packages/contracts/src/` 下的 `finance.ts`、`health-incident.ts`、`learning-session.ts`、`media-asset.ts`、`monthly-feedback.ts`、`notice.ts`、`operational-statistics.ts`、`resource-library.ts`、`staff-daily.ts`、`supply-request.ts`，并创建 `packages/contracts/test/finance.test.ts`。

创建 `scripts/start-local-demo.mjs`、`scripts/start-local-synthetic.mjs`；创建 `tests/local-synthetic/` 下的 `attendance.test.mjs`、`demo-launcher.test.mjs`、`fees.test.mjs`、`health-incident.test.mjs`、`learning-session.test.mjs`、`media-assets.test.mjs`、`monthly-feedback.test.mjs`、`multi-student.test.mjs`、`notice.test.mjs`、`operational-statistics.test.mjs`、`pickup.test.mjs`、`resource-library.test.mjs`、`runtime.test.mjs`、`staff-daily.test.mjs`、`supply-request.test.mjs`、`task-assignment.test.mjs`。

仅修改 `packages/contracts/src/identity.ts`、`packages/contracts/src/index.ts`、`packages/contracts/test/identity.test.ts`、`packages/auth/test/policy.test.ts`。另允许修改本计划与 `PLANS.md` 记录执行结果和实际差异。

**限定的测试修正：** 对 `local-synthetic-fee-ledger.test.ts`、`local-synthetic-membership.test.ts`、`local-synthetic-staff-credentials.test.ts` 仅修正计算仓库根目录时多退一级的问题；对 `local-synthetic-learning-session.test.ts` 仅修正教师汇总条数预期，使其计入前一条已转交记录和新建记录；对 `tests/local-synthetic/learning-session.test.mjs` 将隔离工作树专用 `.g4-dist` 引用改为主树 API 标准编译目录。先用测试复现并确认，不调整服务实现来迎合测试。

**复审发现的最小源码修正：** 成员状态更新目前不校验预期版本，旧页面可能覆盖较新的暂停/恢复操作。只在已列入写集的 `sessions.ts`、`routes.ts` 和 `local-synthetic-membership.test.ts` 中增加返回版本、要求更新请求带当前版本并让过期请求返回冲突；调用页面后续按独立同步任务传递该版本。`start-local-demo.mjs` 当前硬编码隔离工作树兄弟路径，复制到主树后会指向错误目录；仅将默认网页、管理端、小程序路径改为主树本身及 `apps/mini-program`，并用已列入写集的启动器测试核验。

**明确排除：** `apps/api/.g4-dist/**` 和其他构建产物、所有 `dist/**`、Mini、Web/Admin 产品页面、`apps/api/package.json`、任何配置、依赖和 lockfile、`apps/mini-program/src/pages/staff.test.ts`，以及来源合同/执行记录。禁止真实认证、网络外部服务、数据库、持久化、真实学生资料、伙伴云、正式 AI、提交、推送、部署和发布。

**验证：** 逐个运行新增 API 合成服务测试、合同与权限测试、`tests/local-synthetic` 回归；运行 API/Contracts/Auth 类型检查、ESLint、目标格式检查、相关构建、`git diff --check` 和精确范围审计。若仓库默认类型检查因其他工作树遗留的编译输出阻塞，记录真实原因并用不写入依赖/配置的最小源码检查补充；不得把补充检查冒充默认检查通过。

**停止条件：** 任何目标文件已有主树内容、来源出现真实服务/真实数据、必须修改写集外代码或配置、或验证发现服务端范围隔离风险时，停止该批并先在本计划记录证据与最小解决方式，不覆盖现场、不扩大范围。

**当前预检发现：** 独立只读复审认为来源可作为选择性同步输入，未发现严重级安全问题；三个 API 测试根目录多退一级，学习汇总用例少计一条；另发现成员状态更新缺少版本冲突保护、统一启动器仍指向隔离工作树。以上均在本任务现有精确写集中处理，不复制构建目录。执行前主树目标新增路径均不存在，来源和目标基线同为 `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。

**本次验证：** 首次成员版本回归按 TDD 先失败（旧接口不返回版本并把带版本请求拒为 400），增加版本检查后 4 个 API 目标文件组 `13/13` 通过。新增/同步的 19 个 API 本地合成测试文件 `PASS`；Contracts `5/5`、Auth `5/5`、既有 API 基线 `45/45`、跨端合成 HTTP 回归（排除统一启动器）`17/17` 通过。Contracts 构建、Auth 类型检查及 API 类型检查通过；74 个代码文件 ESLint 和 75 个代码/本计划文件 Prettier 检查通过。根 `PLANS.md` 的完整 Prettier 检查原基线本身也失败，故保留既有整文件格式，只做当前字段差异检查。`pnpm` 被本机 11.19.0 与项目要求 11.22.0 的版本差异挡住，未安装或升级依赖，改用仓库已有 `tsc`/Node 直接执行验证。

**统一启动器阶段结果：** 小程序 freshness 现通过 TypeScript 只读编译输出比较及 `scripts/verify_mini_page_registration.mjs --require-generated-js`；仅编译更新 `apps/mini-program/app.js` 与 `apps/mini-program/pages/visitor/home/index.js` 两个已列入写集的输出。`tests/local-synthetic` 共 24 项，23 通过、0 失败、1 项因已有本机进程占用固定端口 `127.0.0.1:4317` 而跳过；测试没有停止或替换该进程。Mini typecheck、注册护栏、目标 ESLint、目标 Prettier、`git diff --check` 均通过。统一启动器随机端口集成覆盖 API、家长/Admin 页面、来源限制和自建监听关闭。固定端口 CLI 因占用未实测；微信开发者工具/浏览器人工视觉实点为 `NOT_RUN`。以上只证明本机 API 与静态页面入口可启动，Web/Mini 实际业务页面仍未接线为同一共享 API 流程。

## TASK20 G6 本机统一启动入口修复

**任务：** `TASK20_G6_LOCAL_DEMO_LAUNCHER_RECONCILIATION`。在不改变业务页面的前提下，让主工作树统一启动器调用现有 Mini 注册护栏和 TypeScript 输出新鲜度检查，并为已存在的 Admin Web 构建入口提供本机预览服务。此前独立复核确认，启动器默认检查的 `scripts/mini-runtime.mjs` 与 `apps/admin-web/preview.mjs` 均不存在；主树已有 `scripts/verify_mini_page_registration.mjs`、Mini `tsconfig.json`、Admin Web `index.html` 和 TypeScript 构建输出，可在不增加依赖的条件下复用。

**主工作树精确写集：**

- 修改 `scripts/start-local-demo.mjs`：用 `verifyBuild(tree, "mini-program")` 比较现有 Mini TypeScript 编译输出，并调用 `scripts/verify_mini_page_registration.mjs --require-generated-js`；错误指引改为真实存在的命令。先启动本机网页预览，再将其实际 loopback 来源传给既有 API `allowedOrigins`，使本地跨域请求只允许本次启动的页面来源。
- 新建 `apps/admin-web/preview.mjs`：仅绑定 `127.0.0.1`，提供 Admin `index.html`/`dist` 静态资源与 `/admin/*` 页面回退，沿用仓库已有 Node 原生 HTTP 能力。
- 修改 `apps/user-web/preview.mjs`：让启动器生成的 `/web/parent/binding` URL 回退到已有 SPA 首页；不改页面路由或业务逻辑。
- 修改 `tests/local-synthetic/demo-launcher.test.mjs`：覆盖 Mini 检查命令和 Admin 预览实际入口，并运行统一启动器集成用例。
- 仅在编译器证明内容不一致时更新 `apps/mini-program/app.js`、`apps/mini-program/pages/visitor/home/index.js`；只能由现有 TypeScript 编译器生成，不手工编辑，不允许触碰其他生成 JS。只读比较确认当前正好这两个输出过期。
- 仅为记录状态修改 `PLANS.md` 与本计划。

**禁止范围：** 不改业务页面、Admin 源码/HTML、Mini 页面/路由/配置、除上述两个精确生成输出外的任何文件、API 服务、其他预览器、依赖或 lockfile；不安装依赖、不改用户已有文件、不提交、推送、部署或发布。不连接外网、数据库、持久化、真实认证、真实学生资料、伙伴云或正式 AI。

**验收与验证：** 先以最小测试证明现有命令路径缺失；已只读计算出 Mini 类型诊断为 0，编译器仅报告 `app.js` 与访客首页 `index.js` 两个输出内容过期。两个目标已由 TypeScript 编译器选择性更新。随后启动器集成测试发现家长预览 URL 返回 404，以及固定 API 来源设置不接受随机本机预览来源。因此启动器按实际两个预览来源配置现有 API `allowedOrigins`，不改 API 服务源码。独立复核发现静态路径检查未解析 junction 真实目标、关停检查会把请求超时当作关闭；新增测试先分别以 `200 != 404` 失败，修复后两项均通过。终止进程后的端口检查现用最多 3 秒的 `canListen()` 重试，固定端口 `4317` 已占用时保持跳过且不触碰占用进程。重跑 Mini 类型检查和页面注册护栏、`tests/local-synthetic`、启动器专项测试、相关 ESLint/Prettier、`git diff --check` 与精确写集审计。启动器集成测试仅能证明 localhost 上的合成 API 和静态预览可运行，不证明网页操作已接到共享 API；未在浏览器/微信开发者工具实点的界面继续标记 `NOT_RUN`。

**停止条件：** 需要修改写集之外的内容、编译器报告这两个目标以外的过期 JS、需要新增依赖、发现启动器要求接真实服务、或测试会触及非本任务进程/数据时立即停止并记录证据。

**实施记录：** 目标路径测试先复现 Admin 预览入口缺失和 Mini freshness 命令失效，后续实测又发现家长页面缺少 SPA 回退、动态网页来源未加入本机 API 允许列表，以及集成测试把 API 请求发给静态页面端口。现已分别补齐 Admin loopback 预览、家长页面回退、按实际预览地址设置 API `allowedOrigins`，并修正测试请求目标。第二轮独立复核确认真实路径边界、junction 防逃逸、关停端口重试及正常资源访问均符合要求，未发现 Critical、Important 或 Minor。`tests/local-synthetic` 共 26 项，25 通过、0 失败、1 项因已有本机进程占用 `127.0.0.1:4317` 而跳过；启动器专项 9 项中 8 通过、0 失败、1 项同因跳过。Mini typecheck、页面注册护栏、目标 ESLint/Prettier 与 diff 检查通过。微信开发者工具和浏览器人工视觉点击仍为 `NOT_RUN`。无论该入口测试结果如何，均不得据此宣称网页操作已接到共享 API。

## G6.3 合成同意与保存期限演练合同

**任务：** `TASK20_G63_CONSENT_RETENTION_SYNTHETIC`。实现服务端内存中的合成同意记录：固定用途与告知版本、监护人确认/撤回、负责人按租户/校区/班级查看、保存期限到期复核、必要保留标记和到期处理演练。此阶段只交付 API/领域模型，不新增网页或 Mini 页面；不声称满足真实法律合规，不删除真实数据。

**主工作树精确写集：**

- 新建 `packages/contracts/src/consent.ts`：定义固定用途、合成告知版本、数据类别、保存期限状态、同意记录和事件类型。
- 修改 `packages/contracts/src/index.ts`：导出新合约。
- 新建 `packages/contracts/test/consent.test.ts`：覆盖固定用途键的类型约束。
- 新建 `apps/api/src/local-synthetic/consent.service.ts`：使用内存 Map；只接受已审批监护关系；由可信会话生成授权人和租户/校区/班级范围；固定用途与告知版本；记录授予、撤回和负责人期限复核事件；每个状态事件均为 `dataChanged=false`。用途目录由 API 服务提供，合同包只导出类型，避免运行时依赖尚未构建的合同包产物。
- 修改 `apps/api/src/local-synthetic/sessions.ts`：仅给两个合成家长角色增加 `consent:manage`，仅给两位合成校区负责人增加 `consent:review`，并维护能力中文名称。
- 修改 `apps/api/src/local-synthetic/routes.ts`：注册目录、列表、创建、撤回、期限复核 API；请求只收固定枚举、版本和明确确认，不接受自由文本或客户端租户/学生范围。
- 修改 `apps/api/src/local-synthetic/server.ts`：注入新合成服务。
- 新建 `apps/api/test/local-synthetic-consent.test.ts`：覆盖确认/撤回、期限到期复核、保留标记/模拟到期、版本冲突、越权与跨校区隔离。
- 仅修改 `PLANS.md` 与本计划，记录状态、验证证据和边界。

**固定演示规则：** 目录必须明确标注用途、必要性、固定示例数据类别、告知版本和“仅演示、期限须由机构专业人员确认”的状态。示例保存天数仅用于验证界面/事件流，不代表法律期限、机构保留政策或影响评估结论。到期复核只能记为 `REVIEW_DUE`、`REQUIRED_HOLD` 或 `SIMULATED_EXPIRED`；任何“模拟到期”状态必须显式显示尚未删除任何数据，且响应中 `dataChanged=false`。不加入自由文本理由，不保存学生标识，不读写真实数据、不持久化、不调用外部服务。

**验收与验证：** 先写 API/领域回归并验证至少一项因行为缺失而失败；再实现最小服务。运行合约/API focused tests、现有隐私请求与绑定测试、全体 `tests/local-synthetic`、API/Contracts typecheck、目标 ESLint/Prettier、`git diff --check` 和精确写集审计。用不同合成角色实际调用 localhost API 验证授权人、告知版本、事件版本、范围隔离、撤回、到期/必要保留演示和 `dataChanged=false`。不得把 API 测试称为页面可用或法律审核通过；UI 与微信人工点击继续 `NOT_RUN`。

**停止条件：** 发现需要真实个人资料、数据库/持久化、外部服务、自由文本敏感信息、写集外修改或真实删除才能实现时，立即停止并记录；不得调整合同来合理化扩围。

**本次实施与验证结果（2026-10-08）：** 服务及领域契约已按上述写集完成。第一轮独立复核发现模拟到期响应缺少“尚未删除任何数据”说明、同意服务未再次核验绑定关系、隔离及版本断言不足；现已在返回记录中增加固定到期说明，要求已批准且关系为 `GUARDIAN`，并补齐非监护关系拒绝、跨租户/班级隔离及每次事件版本恰增 1 的断言。上游绑定类型本身限定 `GUARDIAN`，申请入口也拒绝其他关系；服务内再次校验用于防止后续接口扩展时误接。第三轮独立复核最终通过，未发现需修正问题。`packages/contracts` 与 `apps/api` typecheck 通过；同意/隐私 API 测试（含 localhost HTTP）`9/9`、合同测试 `1/1` 通过；既有 `tests/local-synthetic` 为 `25` 通过、`0` 失败、`1` 项因固定端口 `127.0.0.1:4317` 被其他本机进程占用而跳过。目标 ESLint、Prettier 与 `git diff --check` 通过；后者提示六个原有 Mini WXML/WXSS 文件将由 Git 转成 CRLF，本任务没有改动这些文件。两处临时编译输出目录 `apps/api/.g63-verify-20261008a`、`packages/contracts/.g63-verify-20261008a` 仍在主树中：工具的自动审批复核拒绝了目录清理，未尝试绕过。此结果只证明本地合成 API/类型/测试，不证明页面已接线、微信实机可用、真实删除或法律合规；浏览器与微信人工实点 `NOT_RUN`，负责人验收仍待完成。

## G6.4 下一阶段合同规划：家长同意入口与负责人审核界面

**任务：** `TASK20_G64_CONSENT_WEB_MINI_UI_SYNTHETIC`。将 G6.3 的用途说明、明确确认、同意状态/撤回和保存期限提示带到家长侧；负责人侧能按可信本机身份查看范围内记录并执行必要保留/模拟到期复核。先补网页端与管理网页入口，再补微信小程序入口；交互继续使用现有绿黄品牌和简洁表单，不加入自由文本、真实认证、存储或外部服务。

**G6.4A 首批写集（隔离工作树 `C:\Users\HU\.codex\worktrees\task20-admin-completion`）：** 已核对该树与主树的不同点：本机 API G6.3 只在主树，候选树已有未完成的 Admin 改动，不能用主树文件整份覆盖。页面客户端因此只新增可注入的 loopback HTTP 适配器，并沿用现有 G6.3 API 合约；不复制或改写 API 核心。精确 CREATE/MODIFY 写集为：

**实施前 SHA-256 基线：** User Web `src/main.ts`=`8AEF0F65AF69E534277D389AC48CDDA0A031A9F09D98D509929F0F0EBB0AF49F`、`preview.mjs`=`D7B63B6FC9254993CFB09781B30D5C2FB2908A15965E2A670BD5B3996F5D996B`；Admin `src/main.ts`=`6C93E4AFF450ED9A0B933F815E929D2A5A28C8B3583F30FEB97155F363042DA7`、`preview.mjs`=`2E746806A88B85E21349FF4BA54FE68E2340640F6909B7AD7EDBAE0D2FA4D2EB`。后两文件在本任务开始前已有未提交改动；仅在其中增加本任务路由，不覆盖既有改动。

- MODIFY `apps/user-web/src/main.ts`、`apps/user-web/preview.mjs`；CREATE `apps/user-web/src/pages/parent-consent.ts`、`apps/user-web/src/pages/parent-consent.test.ts`。
- MODIFY `apps/user-web/src/styles/user-web.css`，仅增加本机家长授权表单、状态与卡片样式。
- MODIFY `apps/admin-web/src/main.ts`、`apps/admin-web/preview.mjs`；CREATE `apps/admin-web/src/local-review/consent.ts`、`apps/admin-web/src/pages/consent-review.ts`、`apps/admin-web/test/consent-review.test.mjs`。
- 本批不改 API、Mini、package 配置、依赖或 lockfile；复用现有绿黄页面样式和预览服务。本机 API 客户端只请求 `http://127.0.0.1:4317`，测试可注入本机 fetcher，不使用外部地址。候选树中既有 Admin 文件保留原样，只做目标位置的增量编辑。

**实施顺序：** 先为新客户端与页面渲染写最小行为测试并确认失败，再实现家长端“提交模拟绑定申请—等待员工审核—读取固定用途—确认授权/撤回”，以及负责人端“按服务端范围查看—必要保留/模拟到期复核”。家长未有已批准关系时不得提交用途授权；页面仅显示固定合成别名，不显示 actor、租户、校区、班级或关系 ID。随后添加用户网页 `/web/parent/binding` 和管理网页 `/admin/consent-review` 的预览回退、页面导航与错误/空态。

**验收与验证：** 跑 User Web 与 Admin Web focused tests、typecheck、ESLint、Prettier、两端 build、静态路由 smoke、`git diff --check` 和精确写集审计；另确认 G6.3 API 合约已有 localhost HTTP 测试覆盖。完成代码审查后，使用 `scripts/start-local-demo.mjs --local-synthetic` 做实际 Web/Admin 页面点击与流程复核；若工具不可用，该项如实记 `NOT_RUN`，不把单元测试称作视觉验收。微信开发者工具实点属于 G6.4B，不在此批冒报。

**预检结果：** 候选隔离树的 User Web 仍只有访客/员工页面，用户网页预览器尚无家长绑定路径；Admin 已有隐私审核页、loopback API 客户端范式和带 `/local/` 转发的预览器，但没有同意期限审核入口。G6.3 API 使用固定 loopback 端口和启动时登记的本地网页来源；家长关系只允许通过现有绑定审核流程变为 `APPROVED`，因此家长页不能展示虚构的预批准关系。

**固定验收边界：** 页面只展示合成机构和虚构学生别名；明确显示固定用途、告知版本、必要性、示例类别、仅演示期限及待人工确认状态。家长只操作已批准的绑定；状态与事件版本一致；负责人不能跨机构/校区/班级查看；撤回、保留标记、模拟到期均不执行真实数据变更，并在模拟到期时说明尚未删除任何数据。Web/Admin 页面使用 localhost 的 G6.3 API，不建立平行内存流程。需有失败、空、成功、重复/过期版本和越权状态测试。浏览器/微信人工实点分别记录；自动化 PASS 不代替人工视觉验收。

**继续禁止：** 真实个人资料/真实学生数据、真实账号或身份验证、数据库与持久化、外部网络与 API、伙伴云、正式 AI、真实删除/期限决策、安装依赖或修改 lockfile、提交/推送/部署/发布。若当前页面无法在不改写历史现场的前提下接入本机 API，先更新合同范围和写集，再做任何扩展修改。

**状态与边界：** G6.3 内部本地验证和独立代码复核为 `PASS`，G6.3 负责人验收仍为 `PENDING`；按项目负责人已给出的全项目开发自主权，继续进行 G6.4A 不等于伪造 G6.3 验收结果。G6.4A 期间只用合成数据并复用本机 API；Web 页面已通过一次性本机 Playwright 浏览器实际点击复核，负责人视觉验收仍待进行。Mini 入口与微信开发者工具复核留给独立的 G6.4B。

### G6.4A 实施记录（2026-10-08）

G6.4A 在 `C:\Users\HU\.codex\worktrees\task20-admin-completion` 完成家长端 Web 页面和 Admin 审核页面；没有修改主工作树业务文件。家长端新增可见“家长服务”入口，且只把已审核的“模拟学生甲”绑定用于授权展示；Admin 确认状态在离开页面后会清除，校区标题随模拟审核角色变化。两个客户端固定请求 loopback API 并拒绝重定向。

User Web focused tests `18/18`、Admin Web focused tests `10/10`、两端 typecheck/build、ESLint、静态路由 smoke 和 `git diff --check` 通过；独立代码复核未发现 Critical/Important/Minor 问题。两份既有 `src/main.ts` 全文件 Prettier 检查仍失败，因其在本批之前已经有格式差异而未进行整文件改写；本批新增文件和其余目标文件通过格式检查。pnpm 本机版本低于项目要求，因此验证直接使用仓库已有 Node/TypeScript 工具，没有安装或升级依赖。

浏览器内实际点击、Web/Admin 操作流程和视觉验收 `NOT_RUN`；G6.4A 代码仍留在隔离工作树，主工作树选择性同步 `NOT_EXECUTED`。这些是待完成验收事项，不据此声称页面已可供主工作树直接使用；同时不阻止继续独立实施 Mini 批次。G6.3 Owner Review 也仍为 `PENDING`。

2026-10-08 主树 G6.4A 浏览器实际操作补记：使用独立内存服务 `127.0.0.1:4319` 和网页预览 `127.0.0.1:1725`，通过真实浏览器界面提交家长“查阅资料”申请、由东校区模拟负责人开始处理并完成演示、再由家长刷新查看完成状态。全程仅合成数据，回执保持 `dataChanged=false`；24 个网页 API 请求均重写到一次性 4319 服务，浏览器错误 0、外网请求 0。负责人页面与家长页面截图保存在系统临时目录 `g6-privacy-admin.png`、`g6-privacy-parent.png`。两个临时服务均已关闭；现有 4317 进程未接收请求、未重启。该证据是自动化浏览器实际点击和本地视觉检查，不等于负责人 Owner Review 或微信开发者工具验收；G6.3 Owner Review、G6.4 Owner Acceptance 和 Mini DevTools 复核仍未完成。

2026-10-08 G6.4 同意/撤回/到期 UI 补充诊断：两次完整浏览器点击脚本未能通过最终页面状态断言，故完整授权—撤回—到期流程暂不记通过。独立 API 控制时钟检查确认负责人回执为 `SIMULATED_EXPIRED`，家长页面能显示“已完成到期状态演练”；对应页面截图为系统临时目录 `g64-consent-parent-debug.png`。当前证据尚不能区分完整操作中的点击/断言问题与页面接线问题；没有修改业务代码，需下一轮依据逐步记录的请求、回执与页面状态定位。该项不影响已经单独通过的 G6.4A 隐私申请流程结论，也不替代负责人验收或微信开发者工具实点。

### G6.4B 实施合同：微信小程序家长数据授权页面

**任务：** `TASK20_G64B_CONSENT_MINI_SYNTHETIC`。在现有绿黄品牌小程序里，让家长可查看三项固定用途、版本、必要性与示例期限，在已审核的监护关系下明确确认授权，并可明确撤回；状态只通过 G6.3 统一本机 API 读取和更新。

**实施工作树：** `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`，基线 `bd0001faa8e2fd7bbabe86e3d778ba24431107e8`。该树已经包含其他 Mini 未提交工作；必须保留，仅在下列现有文件的相关位置追加改动，不清理或覆盖其他现场。

**实施前文件 SHA-256：** `apps/mini-program/app.json`=`01D901AD70D5862D493E4F7A822173B51475AB8C73C4B7A3624D005CB52AE898`；家长首页 `index.wxml`=`A01726FA8995CADF4A9CAF8E0D4FAF18B71571570B5ADABFC6FD8B4DC3088B0A`；`src/local-synthetic/client.ts`=`01D339EFBD8688FBF613EE04EB3DDB2C38FF629F0031B6B1FF705B2A6DC9E281`；`tsconfig.json`=`A6D431E5BFF9EBE6AEFB64F30A4A65986BCB8EDCEB6743DDA6657353A3FDC14B`；页面注册/视觉断言 `parent-entry.test.ts`=`20C0BB1CC8492A840975684EFABAC984676FF2801F19C652D2F24FE64FD2B592`、`mini-brand-ui.test.ts`=`32867A23DB88E30177FBCDEA8DA0DF89B834160DB5813BE47ACFD6BB5A6A3BD7`、`mini-ui-polish.test.ts`=`93E90EA7DF33D38C5F15BEF428151ADD1AE2088A22CC1D0D6E7CD9651D0AADD1`、`visitor.test.ts`=`959002F34A0907B25D51CA0E74177F5FBC7C69E9FC2F2D3164EDA3FFF9EE6A44`。新页面目标路径实施前均不存在。

**精确 CREATE/MODIFY 写集：**

- MODIFY `apps/mini-program/app.json`：在原页面顺序末尾注册 `pages/parent/consent/index`。
- MODIFY `apps/mini-program/pages/parent/home/index.wxml`：增加“数据授权”入口，链接到新页面。
- CREATE `apps/mini-program/pages/parent/consent/index.json`、`index.ts`、`index.wxml`、`index.wxss`。
- CREATE `apps/mini-program/src/pages/parent/consent.ts`、`consent.test.ts`。
- MODIFY `apps/mini-program/src/local-synthetic/client.ts`：仅将 G6.3 固定路径 `/local/consent-policies`、`/local/consents` 与 `/local/consents/{uuid}/revoke` 加入现有 loopback 路径白名单；不得放宽主机、端口或通用路径规则。
- MODIFY `apps/mini-program/tsconfig.json`：将新页面 TypeScript 文件加入现有编译入口。
- MODIFY `apps/mini-program/src/pages/parent-entry.test.ts`、`mini-brand-ui.test.ts`、`mini-ui-polish.test.ts`、`visitor.test.ts`：只更新页面注册数量/顺序与新页面入口和绿黄视觉表面相关断言，保留其他断言。不得修改 `staff.test.ts`。
- 仅当 TypeScript 编译器证明内容变化时生成/更新 `apps/mini-program/pages/parent/consent/index.js`、`apps/mini-program/src/pages/parent/consent.js` 和 `apps/mini-program/src/local-synthetic/client.js`；不得手工编辑生成文件，不得顺带更新其他 JS。编译预检发现修改 Mini 请求白名单也会生成 `src/local-synthetic/client.js`，预检在写入前阻止了该输出；现已将这份配套输出明确加入写集。

**流程和安全要求：** 页面使用现有 `miniTransport` 的 `http://127.0.0.1:4317` loopback 传输，并单独建立 API 合成家长会话；调用现有 G6.3 关系、用途目录与同意 API，不创建页面内存替代状态。只接受 API 返回的固定三个用途、已审核的 `student-alpha` 监护绑定和合法记录版本；UI 不展示身份/租户/校区/班级/绑定内部编号。未审核时只提示前往既有绑定页，禁止授权。每次授权/撤回均需要明确勾选；页面离开、刷新和角色/关系变化时清除临时勾选。冲突仅提示刷新，不自动重试。所有 API 回执必须保持 `dataChanged=false`；真实数据、存储、外部网络和真实认证均不接入。

页面使用现有中文品牌卡片与品牌绿/黄，按钮名称简短、文字居中，不新增图标素材。操作按钮采用正式业务名称（“确认授权”“撤回授权”）；页面明确说明内容为合成/示例且期限需专业人员确认，任何到期演示必须说明不会删除资料。

**验证：** 先补页面模型与请求权限测试，确认缺失时失败，再实现；运行新 consent focused tests、页面入口/注册断言、Mini 既有受影响 focused tests、Mini typecheck、页面注册护栏（要求生成 JS）、ESLint、Prettier、`git diff --check` 与写集审计。代码完成后做独立审查。只有在本机服务可用且微信开发者工具可交互时才做实点；否则明确记 `NOT_RUN`，不得把源代码或自动测试称作微信视觉验收。不得为了固定端口占用而停止或替换既有进程。

**停止条件：** 页面注册需要修改更新后写集之外的路径、服务端 G6.3 合约与当前客户端投影不兼容、需要真实数据或外部连接、TS 生成上述三份以外的 JS、出现不能安全保留的 Mini 现有改动，立即停下并报告，不得扩大范围。

#### G6.4B 本地实施和自动验证结果（2026-10-08）

- 在上述隔离工作树中完成家长数据授权入口；页面只读取固定三项用途，在“模拟学生甲”关系审核通过后允许勾选授权或撤回。页面只连接现有 `127.0.0.1:4317` 本机服务；授权回执只有明确返回 `dataChanged=false` 才显示更新成功，异常回执会提示状态未确认且不自动重试。
- 增补中文关系状态、页面勾选与离页清除测试，以及授权/撤回回执安全测试；页面注册和全部受影响 Mini focused tests 共 `71/71` 通过。Mini TypeScript 检查通过；源码 ESLint 通过；Prettier 对其支持的白名单文件通过；`git diff --check` 通过，只有仓库既存 LF/CRLF 提示。TypeScript 编译器检查 28 个 JS 输出，仅更新白名单内 3 个生成文件。
- 独立代码复核第一轮发现关系状态显示英文，已改为中文并新增实际事件测试；第二轮复核通过，未发现 Critical、Important 或 Minor 问题。
- 微信开发者工具原生编译与实际模拟器点击仍为 `NOT_RUN`；固定端口服务实连也未运行，因此本结果仅表示隔离工作树源码和自动检查通过，不代表微信视觉验收。主工作树选择性同步尚未执行。下一目标为 G6.4 选择性同步与网页/小程序人工验收。

## G6.4 主工作树选择性整合合同（2026-10-08）

**任务：** TASK20_G64_SELECTIVE_SYNC_AND_WEB_MINI_MANUAL_ACCEPTANCE。将已完成并通过自动验证的家长授权网页、管理端审核页及 Mini 家长/员工流程和新版绿黄 UI 选择性整合到主工作树。本批次只做本机合成演示，保留主树现有改动并逐段合并，不整份覆盖已有文件。

**依据与来源：** 负责人已要求由执行者自主推进剩余开发；来源工作树和主树的 HEAD 均为 bd0001faa8e2fd7bbabe86e3d778ba24431107e8。Mini 来源任务重新运行 205 项测试全部通过，Mini TypeScript 检查通过，ESLint 通过。一次未正确排除受保护 staff.test.ts 的测试运行暴露了两条旧断言：旧操作文案与原路由数量；未修改该文件，后续验证均明确排除它。来源工作树还存在一个 Prettier 格式问题（src/pages/health-incidents.ts）；主树整合后仅对本批新纳入文件做格式修正。微信开发者工具人工点击尚未执行。

**Mini 源码、页面、资源与测试写集：** 下节列明目标不同且需新增或合并的精确路径。目标相同内容不写入。

**User Web / Admin Web 的 G6.4A 增量：**
- MODIFY apps/user-web/src/main.ts
- MODIFY apps/user-web/preview.mjs
- CREATE apps/user-web/src/pages/parent-consent.ts
- CREATE apps/user-web/src/pages/parent-consent.test.ts
- MODIFY apps/user-web/src/styles/user-web.css
- MODIFY apps/admin-web/src/main.ts
- MODIFY apps/admin-web/preview.mjs
- CREATE apps/admin-web/src/local-review/consent.ts
- CREATE apps/admin-web/src/pages/consent-review.ts
- CREATE apps/admin-web/test/consent-review.test.mjs

**治理记录：** 仅修改本计划和 PLANS.md。

**验收与验证：** 在主树对 Mini 运行排除 staff.test.ts 的全部 Mini 测试、typecheck、页面注册检查、ESLint、Prettier（仅支持的格式）、编译输出差异复核和 git diff --check。User Web / Admin Web 分别运行 G6.4 focused tests、typecheck/build、ESLint、Prettier、路由 smoke。检查变更路径并由独立审查复核。本机自动验证通过后仍需微信开发者工具及浏览器实际操作；没有实际点击证据的页面验收记为 NOT_RUN。

**禁止：** 不改白名单外路径，不改 Mini 项目配置、依赖或 lockfile，不改 API/数据库/认证/伙伴云，不接网络或持久化，不改受保护 staff.test.ts，不删除或清理主树既有现场，不 commit、push、部署或发布。

**停止条件：** 发现目标路径在合同后发生变化、需要扩大写集、存在不能安全保留的主树改动，或编译器要求更新下节 35 个候选生成 JS 之外的文件，立即停止并保留现场报告。无微信开发者工具控制能力时，人工复核如实记 NOT_RUN。
Mini CREATE 清单（81 个）：
- CREATE apps/mini-program/assets/brand/tongxin-logo.png
- CREATE apps/mini-program/assets/icons/LICENSE-DOODLE-ICONS.txt
- CREATE apps/mini-program/assets/icons/LICENSE-TDESIGN.txt
- CREATE apps/mini-program/assets/icons/arrow-right-up.svg
- CREATE apps/mini-program/assets/icons/book-open.svg
- CREATE apps/mini-program/assets/icons/calendar.svg
- CREATE apps/mini-program/assets/icons/chat.svg
- CREATE apps/mini-program/assets/icons/chevron-left.svg
- CREATE apps/mini-program/assets/icons/chevron-right.svg
- CREATE apps/mini-program/assets/icons/home.svg
- CREATE apps/mini-program/assets/icons/palette.svg
- CREATE apps/mini-program/assets/icons/sunny.svg
- CREATE apps/mini-program/assets/visitor-home/activity-sharing.jpg
- CREATE apps/mini-program/assets/visitor-home/ai-classmates.jpg
- CREATE apps/mini-program/assets/visitor-home/ai-students-cutout.png
- CREATE apps/mini-program/assets/visitor-home/daily-flow.jpg
- CREATE apps/mini-program/assets/visitor-home/peer-growth.jpg
- CREATE apps/mini-program/pages/parent/binding/index.json
- CREATE apps/mini-program/pages/parent/binding/index.ts
- CREATE apps/mini-program/pages/parent/binding/index.wxml
- CREATE apps/mini-program/pages/parent/binding/index.wxss
- CREATE apps/mini-program/pages/parent/consent/index.json
- CREATE apps/mini-program/pages/parent/consent/index.ts
- CREATE apps/mini-program/pages/parent/consent/index.wxml
- CREATE apps/mini-program/pages/parent/consent/index.wxss
- CREATE apps/mini-program/pages/parent/home/index.json
- CREATE apps/mini-program/pages/parent/home/index.ts
- CREATE apps/mini-program/pages/parent/home/index.wxml
- CREATE apps/mini-program/pages/parent/home/index.wxss
- CREATE apps/mini-program/pages/parent/learning/index.json
- CREATE apps/mini-program/pages/parent/learning/index.ts
- CREATE apps/mini-program/pages/parent/learning/index.wxml
- CREATE apps/mini-program/pages/parent/learning/index.wxss
- CREATE apps/mini-program/src/local-synthetic/attendance.test.ts
- CREATE apps/mini-program/src/local-synthetic/client.test.ts
- CREATE apps/mini-program/src/local-synthetic/client.ts
- CREATE apps/mini-program/src/local-synthetic/learning-client.ts
- CREATE apps/mini-program/src/local-synthetic/multi-student.test.ts
- CREATE apps/mini-program/src/local-synthetic/page.ts
- CREATE apps/mini-program/src/pages/care-records.test.ts
- CREATE apps/mini-program/src/pages/care-records.ts
- CREATE apps/mini-program/src/pages/fees.test.ts
- CREATE apps/mini-program/src/pages/fees.ts
- CREATE apps/mini-program/src/pages/health-incidents.test.ts
- CREATE apps/mini-program/src/pages/health-incidents.ts
- CREATE apps/mini-program/src/pages/mini-brand-ui.test.ts
- CREATE apps/mini-program/src/pages/mini-ui-polish.test.ts
- CREATE apps/mini-program/src/pages/mini-workflow-ui.test.ts
- CREATE apps/mini-program/src/pages/monthly-feedback.test.ts
- CREATE apps/mini-program/src/pages/monthly-feedback.ts
- CREATE apps/mini-program/src/pages/notifications.test.ts
- CREATE apps/mini-program/src/pages/notifications.ts
- CREATE apps/mini-program/src/pages/parent-entry.test.ts
- CREATE apps/mini-program/src/pages/parent/binding.test.ts
- CREATE apps/mini-program/src/pages/parent/binding.ts
- CREATE apps/mini-program/src/pages/parent/consent.test.ts
- CREATE apps/mini-program/src/pages/parent/consent.ts
- CREATE apps/mini-program/src/pages/parent/health.test.ts
- CREATE apps/mini-program/src/pages/parent/health.ts
- CREATE apps/mini-program/src/pages/parent/learning.test.ts
- CREATE apps/mini-program/src/pages/parent/learning.ts
- CREATE apps/mini-program/src/pages/parent/leave.test.ts
- CREATE apps/mini-program/src/pages/parent/leave.ts
- CREATE apps/mini-program/src/pages/parent/session.ts
- CREATE apps/mini-program/src/pages/parent/updates.test.ts
- CREATE apps/mini-program/src/pages/parent/updates.ts
- CREATE apps/mini-program/src/pages/pickup.test.ts
- CREATE apps/mini-program/src/pages/pickup.ts
- CREATE apps/mini-program/src/pages/shared-fees.test.ts
- CREATE apps/mini-program/src/pages/shared-health.test.ts
- CREATE apps/mini-program/src/pages/shared-notice.test.ts
- CREATE apps/mini-program/src/pages/shared-pickup.test.ts
- CREATE apps/mini-program/src/pages/staff-daily.test.ts
- CREATE apps/mini-program/src/pages/staff-daily.ts
- CREATE apps/mini-program/src/pages/staff-parent-binding-review.test.ts
- CREATE apps/mini-program/src/pages/staff/leave-review.test.ts
- CREATE apps/mini-program/src/pages/staff/leave-review.ts
- CREATE apps/mini-program/src/pages/supply-request.test.ts
- CREATE apps/mini-program/src/pages/supply-request.ts
- CREATE apps/mini-program/src/pages/task-assignment.test.ts
- CREATE apps/mini-program/templates/local-synthetic.wxml

Mini MODIFY/RECONCILE 清单（27 个；逐段保留主树内容）：
- MODIFY/RECONCILE apps/mini-program/app.json
- MODIFY/RECONCILE apps/mini-program/app.wxss
- MODIFY/RECONCILE apps/mini-program/pages/staff/quick-action/index.ts
- MODIFY/RECONCILE apps/mini-program/pages/staff/quick-action/index.wxml
- MODIFY/RECONCILE apps/mini-program/pages/staff/quick-action/index.wxss
- MODIFY/RECONCILE apps/mini-program/pages/staff/workbench/index.ts
- MODIFY/RECONCILE apps/mini-program/pages/staff/workbench/index.wxml
- MODIFY/RECONCILE apps/mini-program/pages/staff/workbench/index.wxss
- MODIFY/RECONCILE apps/mini-program/pages/visitor/content/index.ts
- MODIFY/RECONCILE apps/mini-program/pages/visitor/content/index.wxml
- MODIFY/RECONCILE apps/mini-program/pages/visitor/content/index.wxss
- MODIFY/RECONCILE apps/mini-program/pages/visitor/home/index.ts
- MODIFY/RECONCILE apps/mini-program/pages/visitor/home/index.wxml
- MODIFY/RECONCILE apps/mini-program/pages/visitor/home/index.wxss
- MODIFY/RECONCILE apps/mini-program/src/pages/staff/quick-action.ts
- MODIFY/RECONCILE apps/mini-program/src/pages/visitor.test.ts
- MODIFY/RECONCILE apps/mini-program/src/pages/visitor/content.ts
- MODIFY/RECONCILE apps/mini-program/src/pages/visitor/home.ts
- MODIFY/RECONCILE apps/mini-program/tsconfig.json
- MODIFY/RECONCILE apps/mini-program/pages/visitor/day-flow/index.wxml
- MODIFY/RECONCILE apps/mini-program/pages/visitor/day-flow/index.wxss
- MODIFY/RECONCILE apps/mini-program/pages/visitor/home-school/index.wxml
- MODIFY/RECONCILE apps/mini-program/pages/visitor/home-school/index.wxss
- MODIFY/RECONCILE apps/mini-program/pages/visitor/institution/index.wxml
- MODIFY/RECONCILE apps/mini-program/pages/visitor/institution/index.wxss
- MODIFY/RECONCILE apps/mini-program/src/pages/staff-verticals.test.ts
- MODIFY/RECONCILE apps/mini-program/src/pages/visitor/public-verticals.ts

候选 TypeScript 生成 JS 清单（35 个；仅实际内容变化时编译器更新）：
- GENERATED_JS_IF_CHANGED apps/mini-program/app.js
- GENERATED_JS_IF_CHANGED apps/mini-program/pages/parent/binding/index.js
- GENERATED_JS_IF_CHANGED apps/mini-program/pages/parent/consent/index.js
- GENERATED_JS_IF_CHANGED apps/mini-program/pages/parent/home/index.js
- GENERATED_JS_IF_CHANGED apps/mini-program/pages/parent/learning/index.js
- GENERATED_JS_IF_CHANGED apps/mini-program/pages/staff/quick-action/index.js
- GENERATED_JS_IF_CHANGED apps/mini-program/pages/staff/workbench/index.js
- GENERATED_JS_IF_CHANGED apps/mini-program/pages/visitor/content/index.js
- GENERATED_JS_IF_CHANGED apps/mini-program/pages/visitor/day-flow/index.js
- GENERATED_JS_IF_CHANGED apps/mini-program/pages/visitor/home-school/index.js
- GENERATED_JS_IF_CHANGED apps/mini-program/pages/visitor/home/index.js
- GENERATED_JS_IF_CHANGED apps/mini-program/pages/visitor/institution/index.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/local-synthetic/client.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/local-synthetic/learning-client.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/local-synthetic/page.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/navigation/routes.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/care-records.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/fees.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/health-incidents.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/notifications.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/parent/binding.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/parent/consent.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/parent/health.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/parent/learning.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/parent/leave.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/parent/session.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/parent/updates.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/pickup.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/staff/leave-review.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/staff/quick-action.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/staff/workbench.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/visitor/content.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/visitor/home.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/pages/visitor/public-verticals.js
- GENERATED_JS_IF_CHANGED apps/mini-program/src/routes/staff.routes.js

候选与主树内容相同且无需写入（13 个）：
- NO_CHANGE apps/mini-program/src/navigation/routes.ts
- NO_CHANGE apps/mini-program/src/pages/staff/workbench.ts
- NO_CHANGE apps/mini-program/src/routes/staff.routes.ts
- NO_CHANGE apps/mini-program/pages/staff/quick-action/index.json
- NO_CHANGE apps/mini-program/pages/staff/workbench/index.json
- NO_CHANGE apps/mini-program/pages/visitor/content/index.json
- NO_CHANGE apps/mini-program/pages/visitor/day-flow/index.json
- NO_CHANGE apps/mini-program/pages/visitor/day-flow/index.ts
- NO_CHANGE apps/mini-program/pages/visitor/home-school/index.json
- NO_CHANGE apps/mini-program/pages/visitor/home-school/index.ts
- NO_CHANGE apps/mini-program/pages/visitor/home/index.json
- NO_CHANGE apps/mini-program/pages/visitor/institution/index.json
- NO_CHANGE apps/mini-program/pages/visitor/institution/index.ts

本次预检统计：Mini CREATE=81，RECONCILE=27，NO_CHANGE=13，生成 JS 候选=35。project.config.json、project.private.config.json、Mini 内临时执行计划以及受保护 staff.test.ts 均不在写集。

### G6.4 主工作树同步与自动复核结果（2026-10-08）

**同步结果：** 按上述清单逐文件选择性整合。Mini 81 个缺失目标已创建，27 个目标按来源增量合并，13 个相同文件未写入；35 个生成 JS 候选均逐项检查，只有内容缺失或不同的候选才由本轮批准的编译流程更新。User Web/Admin 页面与测试按合同路径整合；保留主树此前内容，不整份替换入口或样式文件。

**复核修正：** 独立复核发现网页家长端和管理端不能仅凭 HTTP 成功就显示 `dataChanged=false`。现在家长同意/撤回与负责人复核均必须检查回执中的 `dataChanged === false`；关系申请另验证固定监护关系、模拟学生和待审核状态，不再借用不适用的 `dataChanged` 字段。管理端 `READ_ONLY` 和 `CONFLICT` 模式不显示复核按钮、禁用确认框并阻止事件提交；切换审核校区时保留原模式参数，避免回到默认可操作模式。新增反例覆盖缺少回执、`dataChanged=true`、只读模式和冲突模式。

**自动验证：** User Web 家长授权与访客 focused tests `30/30` 通过，typecheck、编译、构建、目标 ESLint/Prettier 通过；Admin consent 与原管理页面 focused tests `12/12` 通过，typecheck、编译、目标 ESLint/Prettier 通过。两端预览路由、脚本、样式和新页面资源的本机 HTTP smoke 均返回 `200`。Mini 排除受保护 `apps/mini-program/src/pages/staff.test.ts` 后的测试 `205/205` 通过；Mini typecheck、页面注册护栏、目标 ESLint/Prettier 通过。Mini 全套测试从集成 scratch 工作树运行，因为测试夹具按当前工作目录解析相邻 `task20-local-shared-core`；typecheck 与注册检查直接针对主工作树。`git diff --check` 通过，提示仅为 Git 对既有 CRLF/LF 文件的换行转换说明。

**独立复核和范围：** 独立复核确认回执检查、管理端只读/冲突门禁及模式保留修正均已覆盖，未发现 Critical 或 Important 问题。合同路径数量与本轮写入清单一致。受保护 `staff.test.ts` 未读取或修改，但 Git 状态原本显示该文件已修改；`apps/mini-program/project.config.json` 和 `project.private.config.json` 仍是既有未跟踪文件，本轮均未读取内容或改动。不得把这些已有状态归因于 G6.4。

**未完成验收：** 本环境没有可交互的微信开发者工具或网页浏览器控制器。自动 HTTP smoke 不等于人工操作或视觉检查；Web 实际点击和微信模拟器点击继续为 `NOT_RUN`，负责人 Owner Review 也未声称通过。因此本任务当前为本地代码同步和自动检查通过、人工验收待执行。

**环境事件记录：** 先前一次在 scratch 工作树运行的 `corepack pnpm --filter ... typecheck` 意外触发 pnpm 自动链接缓存依赖到 scratch `node_modules`。主工作树清单和 lockfile 未改；对 scratch `node_modules` 的清理尝试被工具拒绝，此后未重试删除或再次调用包管理器。该目录保留在 scratch 工作树，不在本次业务写集内。

**2026-10-08 微信开发者工具实际复核补记：** 初次启动失败的原因已查明：开发者工具打开了隔离工作树根目录 `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign`，该目录没有 `app.json`；小程序项目实际根目录是 `C:\Users\HU\.codex\worktrees\task20-mini-brand-redesign\apps\mini-program`。切换到正确目录后，首页及页面路由正常加载，无需改业务源码或配置。随后在模拟器内使用本机合成角色完成“家长提交关系申请—东校区负责人审核通过—家长查看已绑定学生—打开授权页—授予成长记录用途—撤回该授权”实点流程；页面显示已审核、授权在示例期限内及最终“已撤回”，过程回执为 `dataChanged=false`。本轮复跑家长关系绑定/授权测试 `20/20`、访客与品牌 UI 测试 `26/26`、Mini TypeScript 检查通过。证据截图保存在系统临时目录 `task20-mini-bind-submit.png`、`task20-mini-owner-review-visible.png`、`task20-mini-parent-approved-binding.png`、`task20-mini-consent-granted.png`、`task20-mini-consent-revoked-verified.png`。本轮没有修改 Mini 源码；这只证明本机合成流程的开发者工具实点通过，不代表负责人 Owner Review、真实机构验收或发布通过。

## G6.2 主工作树家长隐私申请与负责人审核页面补齐合同（2026-10-08）

### 0. 目标与基线

只在现有合成页面中接通“家长提交/查看/撤回个人信息申请”和“机构负责人按当前范围开始/完成处理”的闭环。重新检查发现：G6.1 API 服务、路由和会话权限文件已存在于主工作树，但仍为未跟踪现场；既有 G6.2 页面源码在隔离工作树，不作为本轮整文件复制来源。该合同不把未跟踪现场改记为已审阅或已接受，先用实际 API 生命周期验证其可用性。

界面沿用 User Web 现有家长授权页、Admin Web 现有负责人审核页、品牌绿样式和 localhost 客户端模式；不新建用户网页路由、不新增 API 或代理层。服务端会话仍是唯一权限和机构/校区/班级范围依据，前端不得提交租户、校区、班级、角色或负责人范围字段。

### 1. 允许写集（精确）

- `MODIFY apps/user-web/src/main.ts`
- `MODIFY apps/user-web/src/pages/parent-consent.ts`
- `MODIFY apps/user-web/src/pages/parent-consent.test.ts`
- `MODIFY apps/user-web/src/styles/user-web.css`
- `CREATE apps/admin-web/src/local-review/privacy-requests.ts`
- `CREATE apps/admin-web/src/pages/privacy-requests.ts`
- `CREATE apps/admin-web/test/privacy-requests.test.mjs`
- `MODIFY apps/admin-web/src/main.ts`
- `MODIFY docs/superpowers/plans/2026-10-08-g6-roadmap-reconciliation-after-g62.md`
- `MODIFY PLANS.md`

`dist` 编译输出只作为被忽略的本地验证产物，不纳入交付写集。任何其他文件需要修改时停止本批次并记录原因。

### 2. 产品与隐私边界

- 家长只可在已审核通过的虚构监护关系下选择固定类型：查阅、更正、获取副本、删除申请；不开放自由文本、学生身份或资料上传。
- 家长可查看当前合成申请状态并撤回尚未完成的申请；页面只展示申请类型、状态和日期，不渲染学生、监护人、班级、校区、租户或内部身份标识。
- 负责人身份只允许 `owner-east`、`owner-west` 两个固定演示选项。API 会根据本机负责人会话确定范围，页面不自行筛选或声称超出接口回执的范围。
- 负责人只可将申请从待处理推进到处理中，再标记为“本机处理演示完成”；全过程仅改内存状态，必须显示未访问、复制、更正或删除真实资料及 `dataChanged=false`。
- 使用 `http://127.0.0.1:4317` 现有本机客户端模式；不连外网、不调用真实认证、API、数据库、伙伴云或 AI，不增加持久化、依赖或 lockfile 变更。

### 3. 验收与验证

- 先分别增加父端页面行为测试、管理端客户端/页面行为测试，观察其因新入口/状态缺失而失败，再实现最小改动。
- User Web：家长页面 focused tests、现有访客回归、typecheck、build、ESLint、触及文件 Prettier。
- Admin Web：隐私申请 focused tests、typecheck、build、ESLint、触及文件 Prettier。
- 本机 API 端到端：用父端和两个负责人合成身份实际调用既有接口，验证固定类型提交、负责人范围、开始/完成、父端撤回与重读；不得使用任何真实资料。确认请求和页面回执均保持 `dataChanged=false`。
- 运行 `git diff --check`、精确写集审计及状态审计；确认受保护 Mini 测试、Mini、API 源码、依赖和 lockfile 未改动。
- 本环境没有网页交互控制器；若仍不可用，网页实际点击与视觉验收如实标为 `NOT_RUN`，不将静态路由或 API smoke 说成视觉验收。

### 4. 停止条件

如果主树现有 API 无法通过父/负责人权限及范围验证、必须扩大写集、出现真实个人资料/外部网络、需要增加依赖或持久化，立即停止对应实现并报告；不通过放宽权限、断言或合同来制造通过。

## G6 家长费用查看与管理端费用概览同步记录（2026-10-08）

- 实施合同：`docs/superpowers/plans/2026-10-08-g6-parent-admin-fees-entry.md`，当前 SHA-256 `FBE49A74F07B1A6BFF9778B2BD3F01EA86F00DD66D381A5A4EA2E87FCEA73A6D`。
- 家长端增加只读费用与流水入口；未通过审核的关系不会读取费用数据。机构负责人仅查看当前范围汇总，平台视图只显示匿名数量与类型。
- 九个产品路径已逐文件核对并选择性同步到主工作树；没有同步合同白名单外的产品文件。全部使用预置合成数据，不含真实支付、认证或机构服务。
- 自动检查：User Web focused tests 41/41、Admin Web focused tests 10/10、两端类型检查/build/ESLint 通过，预览路由 HTTP smoke 通过，直接临时回环服务权限与隔离验证通过，`git diff --check` 通过。
- Prettier：除 `apps/admin-web/src/main.ts` 基线已有的全文件格式问题外，触及文件通过；本次新增区段单独格式检查通过。编译 API 测试加载器另有仓库根路径解析问题；用临时回环服务直接验证的费用权限流程通过。
- 本地常驻服务 `127.0.0.1:4317` 当前没有 `/local/fee-ledger-summary`，因此界面接入该运行实例时费用流水暂不可用。重启它会清除内存里的演示会话和申请；本次没有重启或清除。实际浏览器点击和视觉验收为 `NOT_RUN`，负责人验收未声称通过。

### 2026-10-08 本机重启与同意/期限浏览器复核补记

负责人随后明确允许重启本机演示服务。旧 API 进程 PID `23228` 已正常退出；统一演示进程组现由 API PID `28880`（`127.0.0.1:4317`）、User Web PID `36168`（`127.0.0.1:13853`）和 Admin Web PID `27020`（`127.0.0.1:13854`）提供服务，启动会话 `16589` 仍运行。重启会清空旧内存会话和演示申请；这些内容不是正式数据。重启后家长费用接口返回 6 条记录、4 条可用；东校区负责人汇总返回 7 份材料、5 份有效；费用流水返回 4 条；User Web 与 Admin Web 首页均为 HTTP `200`。

新服务上的 focused tests：家长授权页面 `13/13`、Admin 费用页 `5/5`、费用合成流程 `1/1` 通过。另在一次性 API `127.0.0.1:4319` 上，由实际浏览器点击完成“家长授权→撤回→再次授权→负责人期限到期演练→家长刷新查看”全流程：最终状态为 `REVIEW_DUE`，所有演示回执 `dataChanged=false`，页面错误 `0`、外部请求 `0`。页面截图留在系统临时目录 `%TEMP%\g64-parent-granted.png`、`%TEMP%\g64-admin-expired.png`、`%TEMP%\g64-parent-expired.png`；它们是自动化浏览器运行证据，不代表负责人视觉验收通过。先前自动点击失败由脚本把模拟时间设为过期会话的时间，以及 CDP 点击前未等待滚动稳定造成；调整测试运行方式后流程通过，本轮没有修改产品业务代码。

**当前边界：** 已重启服务和自动网页操作均通过；负责人视觉验收仍为 `PENDING`，微信开发者工具实际点击仍为 `NOT_RUN`。旧的“需确认重启/费用流水 404”记录是重启前快照，现由本补记和 `PLANS.md` 当前状态取代。随后重核当前主工作树发现 G6 已补齐 G5.2B 所需网页和管理端入口：家长端 `/web/parent/home` 只读显示当前已审核关系的费用与流水；管理端 `/admin/fees` 按范围展示校区汇总或平台匿名数量；Mini 七个 G5.2B 文件仍与原来源一致。没有重复复制产品代码。

**G5.2B 当前树复核：** User Web 家长费用页 `5/5`、Admin 费用页与预览 `6/6`、Mini 共享费用测试 `18/18` 通过。测试覆盖已审核关系过滤、待审不请求明细、跨孩子/畸形响应拒绝、管理端只允许 GET、平台端无金额及拒绝泄漏金额。此前的 `PARTIAL_MINI_CONTENT_ALREADY_IDENTICAL;WEB_ADMIN_ENTRY_SURFACES_MISSING` 是 G6 接入前的基线快照；当前需求由后续 G6 同步覆盖，状态记为 `PASS_REQUIREMENTS_COVERED_BY_LATER_G6_SYNC`，不表示原 G5.2B 来源文件逐个复制。

**下一目标：** 开始 G2.6 教师观察记录编辑、异常升级与撤回缺口审计。现有健康/异常共享流程已覆盖上报、审核、发布、家长查看及撤回，但仍有可编辑草稿/退回修订、明确升级路径或作者撤回等产品缺口记录。先按现有 V3 页面和服务逐项核实，再写精确合同；不会把已有流程重复实现，也不连接真实诊断或外部通知。

## G6.5 当前结论与历史状态纠偏（2026-10-08）

本节是后续执行补记，用于覆盖上文审计表中的过时快照；保留原文作为历史，不把旧状态继续当作当前事实。

- G6.2 家长网页固定四类隐私申请和 Admin 负责人审核页面已有主树实现记录；本次未重做 Web/Admin 页面，也未修改 API。G6.4 已将用途授权、撤回及期限页面接入 Web/Mini；原“G6.3 尚未接入 Web/Mini”的 API 阶段描述应结合后续 G6.4 实施结果理解。
- G6.5 已在 Mini 既有“数据授权与期限说明”页补入查阅、更正、获取副本、删除申请四种固定选项；删除仅创建模拟申请，不删除资料。授权会话与已审核关系校验、最少字段投影、当前版本撤回、失败清空及 `dataChanged=false` 均有页面模型测试。
- 主树选择性同步八个合同路径后，Mini focused tests `31/31`、类型检查、ESLint、Prettier、页面注册及生成 JS 一致性检查通过。隔离工作树没有注册护栏脚本，所以注册检查在主树执行；loopback 实际流程验证家长提交、负责人开始审核、家长刷新得到 `IN_REVIEW` 版本 2。当前状态仍仅为本机合成数据。
- 微信开发者工具对本次新隐私申请控件的人工点击和视觉检查为 `NOT_RUN`，因为没有可调用的 DevTools 控制器。此前 G6.4 的绑定/授权点击证据不代表本次新入口已实点；自动测试也不能替代这项验收。项目负责人验收未声称通过。
- 4317 本机服务按用户允许已重启；这会清除内存状态。随后本次仅建立虚构监护关系和一条审核中的 ACCESS 申请供演示，当前状态可在家长和负责人合成身份下查看，重启服务会再次清空。
- 2026-10-08 V3 矩阵复核补记：G5.2A 固定合成流水 API 已随 G6 共享服务选择性进入主树；主树复核先复现费用流水测试的编译后根目录计算错误，再按 G6 合同已允许的单行测试修正路径。API 编译、流水聚焦测试 `4/4`、账务合同测试 `1/1`、ESLint、Prettier 与差异检查通过；无需再复制 G5.2A 服务代码。隔离来源原先的全项目类型检查限制仍作为来源阶段记录保留，不被主树 API 编译结果改写。
- 本路线较早的“下一目标 G2.6”已被后续合同 `docs/superpowers/plans/2026-10-08-g26-health-observation-edit-escalation-withdrawal.md` 与 `TASK20_G26_MAIN_TREE_SYNC_STATUS` 记录的实施/主树同步覆盖；不得重复实现该缺口。接下来先据 V3 主路线刷新剩余矩阵，选取尚未在 Web/Mini 主树闭环的最高优先级事项，再建立单一精确写集合同。
