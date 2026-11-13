# 同芯学生托管机构智能化系统平台完整实施计划 V3.0

**Status:** `ORIGINAL_PLAN_TARGETS_CONFIRMED_2026_10_11;ARCHITECTURE_MIGRATION_AND_PARENT_SUMMARY_PENDING;LOCAL_SYNTHETIC_PROGRESS_RECONCILED_2026_10_10;MANUAL_ACCEPTANCE_OPEN;R0_BLOCKED`

> **For agentic workers:** 本文件是以正式项目方案为基线的主实施计划。当前普通本地开发授权已记录于 AGENTS.md / PLANS.md；记录精确 CREATE/MODIFY 写集和验收点后连续执行，不按子步骤重复请求批准。跨阶段恢复、执行顺序与验证证据统一维护在 `docs/exec-plans/active/project-completion.md`。真实服务、重大依赖及发布等边界仍须满足各自条件，不能用本计划代替。状态只能写 `pending`、`in_progress`、`verified`、`failed` 或 `blocked`。

**Goal:** 在不偏离正式项目方案的前提下，完成从 V0.1 三端合作验证、本地合成演示，到家长闭环、教师闭环、AI 小范围试点和 SaaS 经营基础的可审计实施路径。

**Architecture:** 微信小程序承担现场、即时、轻量操作；用户网页承担完整查看、历史和复杂编辑；机构管理网页承担配置、权限、审核、统计和批量管理。三端共享统一的身份、租户、校区、业务规则、API、数据库、文件和审计边界，但页面不机械复制。所有业务阶段先使用合成数据和内存状态；只有独立后端合同、机构确认、隐私与安全门禁全部通过后，才进入真实服务集成评估。

**Target Tech Stack（原方案第 17、40 页，2026-10-11 负责人确认按原方案执行）:** 小程序 Taro + React + TypeScript；用户网页 Next.js + React；管理网页 Next.js 独立应用/路由；后端 NestJS 模块化单体；PostgreSQL + Prisma；OpenAPI/统一类型契约。Redis 按需启用。文件与运行目标为腾讯云 COS、Docker + Nginx、CI/CD、日志与错误追踪、测试/生产环境分离，分别纳入文件、运维和交付阶段。

**Current Implementation（迁移基线，不代表目标已完成）:** Node.js 24、pnpm、TypeScript、Node `node:test`、ESLint、Prettier；网页原生 HTML/ES module、原生微信 TypeScript/WXML/WXSS、Fastify/API，以及 PostgreSQL/Prisma 契约、租户/认证/验证包和既有审计测试。保留现有功能和验证证据，按活动计划 A1 分端分流程迁移；兼容依赖版本、构建和包体尚待评估，不提前安装依赖或改 lockfile。

---

## 0. 权威来源、状态和优先级

### 0.1 权威来源

1. **主产品基线：** `C:\Users\HU\Desktop\同芯机构项目\开发方案\student-care-platform-complete-plan-v2.0.pdf`，SHA-256 `4375343BB2D32148500E5F4DC09780440784426819DEC2DABA910D3717D988C5`。该文件定义产品目标、端侧职责、V0.1 范围、Phase 2/3/3.5/4 路线、隐私、安全、质量和发布门禁。
2. **当前治理与授权控制面：** `AGENTS.md`、`PLANS.md`、V42 治理文件及已通过的 Task 01—18 验收记录。负责人最新明确决定及时记录于当前控制面；冻结的旧阶段快照不覆盖最新决定，V42 文件保持不变。
3. **历史执行路线：** `C:\Users\HU\.codex\worktrees\task20-followup-plan\docs\superpowers\plans\2026-09-24-task20-followup-accelerated-roadmap.md`，SHA-256 `10A4CA2CDF4C61D9D3D82DA59760F4B2646A8FBBF9D5B08AF6AAF93FF8CD65A0`。该文件只保留为 Task 20 加速执行记录，不再作为完整项目主计划。

### 0.2 当前状态快照（2026-10-10 校准）

本表取代本计划 2026-09-25 的旧状态快照。阶段需求和安全门槛仍以本文件及项目方案 PDF 为准；具体本地实现、测试、人工验收和真实运营证据分别记录，当前细项以 PLANS.md、本计划 §3 和活动完成路线图为准。状态不按功能数量推算百分比。

| 范围 | 当前状态 | 处理方式 |
| --- | --- | --- |
| Phase 1A Batch A/B | verified：已接受并冻结 | 只读引用，不重写冻结材料 |
| Task 01—18 | verified：已接受并冻结 | 作为历史基线，不代表后续家长流程已接入正式服务 |
| Task 19 | blocked：最终交付工件未闭合 | 保持未发布；单独核对最终交付条件 |
| M1 访客、员工、管理基础 | in_progress：本地合成页面和多波次测试已有证据，Wave2A 仍为 PARTIAL | 部分 Owner Review 和 Mini 原生实点仍待完成；受保护测试不触碰 |
| M1.4 / M2 合成演示 | verified：虚构机构与合成演练已通过负责人复核 | 只代表本地合成演示；真实机构合作、授权和试点未开始 |
| M3 家长核心闭环 | in_progress：绑定、日报、通知、请假、成长记录、健康和接送已有本地流程证据 | M3.2 仍待 Mini 原生复核；其他原生及负责人验收按阶段记录继续跟踪 |
| M4 教师工作流 | in_progress：任务、日报、月反馈、资源、物资、统计已有本地实现证据 | 负责人验收与适用的 Mini 原生实点仍有未结项 |
| M5 受监督学习 | in_progress：固定题、分层提示、巩固与匿名指标已有本地证据 | G4.1 已通过；G4.2/G4.3 等负责人和原生验收仍待完成；不接正式 AI |
| M6 SaaS 经营运维 | in_progress：经营对象、费用只读和本机恢复演练有合成证据 | D43 仅为临时合成文件演练；真实备份、恢复、多租户和生产运维未完成 |
| R0 发布门 | blocked：Task 19 最终交付未闭合，生产门槛无证据 | 不部署、不发布；本地合成通过不等于可上线 |
### 0.3 计划适用范围

- 本计划只定义满足正式项目方案的后续实施路线，不自动覆盖既有现场，不改变 V42，不替代 `PLANS.md` 当前控制面。
- 当前已有 Wave2A—E 代码必须先按“已实现/部分完成/已验证/未验证”分类，再决定是否补齐，不得将其回滚后重做。
- 每个实现波次都使用隔离 worktree；Web、Mini、admin-web、API、数据库和基础设施的写集相互分离。
- 任何新增路由、真实认证、API、数据库、依赖、lockfile、外部服务、部署或发布都必须在独立合同中列明。

## 1. 全局不可变边界

以下规则贯穿所有阶段：

- 公开演示和测试只使用明显虚构、不可回溯到真人的合成数据。
- 未成年人数据最小化、目的限定、可关闭、可删除、可审计；禁止真实姓名、手机号、身份证、地址、健康、考勤、接送、成绩和家庭关系数据。
- 所有机构对象带 `tenant_id`；校区对象带 `campus_id`；服务端从可信身份和成员关系注入范围，不信任前端租户 ID。
- 平台管理员默认不能查看学生具体内容；跨租户访问必须有独立批准、最小权限和审计证据。
- 不接入真实微信登录、短信、支付、伙伴云 API、正式 AI、生产数据库和生产数据，除非未来独立合同明确批准并完成安全评估。
- AI 只允许“小学作业引导 + 错题巩固”；学生先尝试，提示按 0/1/2/3 层递进，多次尝试后第 3 层可讲解完整过程并标注 AI 辅助，最后进入巩固层；保留最大轮次和转教师阈值，不默认直接给答案。禁止代写、作弊、情感陪伴、心理诊断、能力标签、纪律/绩效结论。
- 教师接收负责班级的教学摘要和待复核内容；家长可查看已批准绑定孩子的使用时长、完成情况、知识点摘要、需关注项，并开启/关闭、限制时长、联系教师。家长不得读取模型内部日志、其他学生或教师待复核材料；不得自动向家长发送敏感判断。机构与平台继续采用原方案规定的汇总和最小权限，不默认访问完整学生会话。
- 不使用 `git add .`、`git add -A`、强制覆盖、破坏性清理、push、deploy、release；commit 也必须由单独授权控制。
- 任何越界需要立即停止，保留现场并标记 `blocked`，不得通过降低断言或改变验证器制造通过。

## 2. 固定执行与验收流程

每个任务必须按以下顺序执行：

1. 建立任务合同：目标、非目标、精确 CREATE/MODIFY 写集、禁止范围、依赖、验收点、验证命令、停止条件、Owner 授权证据。
2. 在隔离 worktree 记录基线：当前 HEAD、目标文件 hash、tracked/untracked 路径集合和现有失败。
3. 先写最小失败测试或复现，再实现最小行为；纯样式/文档变更使用静态检查。
4. 运行 focused tests、typecheck、Lint、Prettier、构建和安全边界审计；前端任务增加浏览器/模拟器视觉核验。
5. 独立复核 diff、写集、生成文件、网络请求、租户范围、敏感字段和状态分支。
6. 形成准确的验证回执，保留负责人未验收项；按当前自主执行授权推进普通本地下一批，不由自动测试代签负责人验收，不越过真实服务或发布门槛。

统一回执字段：

```text
TASK_ID=
AUTHORIZATION=
WORKTREE=
CREATE_PATHS=
MODIFY_PATHS=
IMPLEMENTATION=PASS|PARTIAL|FAIL|NOT_RUN
TESTS=
TYPECHECK=
LINT_FORMAT=
BUILD=
VISUAL=
SECURITY_BOUNDARY=PASS|FAIL|NOT_RUN
WRITE_SET=PASS|FAIL
MAIN_TREE_PRESERVED=YES|NO
OWNER_REVIEW=REQUIRED|PASS|REJECTED
NEXT_GATE=
```

## 3. 主实施路线总览

下表反映截至 2026-10-10 的执行状态。M1—M6 的本地合成实现不能替代人工验收、真实机构试点或生产服务门槛；逐项证据见本计划 §0.2、项目完成路线图和 PLANS.md。

| 阶段 | 正式方案对应 | 目标 | 当前状态 | 下一门槛 |
| ---- | ------------- | ---- | -------- | -------- |
| M0 | Phase 1A/治理 | 基线、范围、角色、设计、安全、测试和变更控制 | verified：已冻结 | 只读维护 |
| M1 | Phase 1B V0.1 | 三端合作验证版：访客、教师介绍、指南、资源、伙伴云说明、管理网页 | in_progress：本地实现与历史验收并存，整体仍部分完成 | 收敛阶段验收和原生实点，不重复实现已有流程 |
| M2 | Phase 1.1 | 机构演示确认、反馈、两轮优化和试点确认 | verified：仅合成演示 Owner Review 通过 | 真实机构确认、隐私授权与试点未开始，不能由合成演练替代 |
| M3 | Phase 2 | 家长核心闭环 | in_progress：本地合成跨端流程已逐项实现 | 先完成 M3.2 Mini 原生验收，再按已记录的阶段门收口 |
| M4 | Phase 3 | 教师业务闭环 | in_progress：任务、日报、月反馈、资源、物资和统计有本地证据 | 处理未结 Owner Review 和 Mini 原生验收 |
| M5 | Phase 3.5 | AI 小范围试点 | in_progress：固定题、安全监督和匿名评测仅在本地合成范围验证 | G4.2/G4.3 等验收未完成；正式模型不在当前范围 |
| M6 | Phase 4 | 多校区、经营、财务、招生、证照、SaaS 商业化 | in_progress：若干本机合成能力已实现，整体仍部分完成 | 真实服务、生产隔离、备份恢复和运营尚未完成 |
| R0 | Release Gate | Task 19 final delivery 重新评估 | blocked：交付证据不足 | 独立评估与发布门槛；不由本地合成通过自动开启 |

## 4. M0：Phase 1A 与治理基线（已完成，冻结）

**目标：** 保持正式方案要求的产品、技术、权限、AI 安全、隐私、测试和交付边界。

**只读文件：** `docs/product/`、`docs/architecture/`、`docs/design/`、`docs/ai/`、`docs/contracts/`、`docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md`。

**验收：** Task 01—18 已按现有验收文件记录为 `ACCEPTED_AND_FROZEN`；不得因后续 UI 演示改写冻结文件。

**剩余风险：** Task 19 final artifact 仍未闭合；该风险不能由 Task 20 演示 PASS 抵消。

## 5. M1：Phase 1B V0.1 合作验证版

### Task M1.0：基线和阶段门收敛

**目标：** 先解决当前 Wave1/Wave2A 的状态记录缺口，形成可审计的 V0.1 入口。

**候选写集（需独立授权）：**

- `PLANS.md`
- `docs/superpowers/plans/2026-09-25-student-care-platform-complete-implementation-v3.md`
- 新合同中明确的只读证据清单

**验收：**

- 明确 Wave1 是否已完成视觉门禁和 Owner Review；不能使用“baseline preserved”代替 Owner Review 结果。
- 独立登记 Wave2A 的既有 `staff.test.ts` 失败，不修改冻结/禁止测试。
- 当前主树、896 条既有未跟踪现场和 Wave2B—E 功能保持不变。

**验证：** `git status --short`、目标路径 hash、`git diff --check`、PLANS 格式检查、现有 Wave2A—E focused tests。

### Task M1.1：访客公开信息完成度和跨端回归

**目标：** 满足正式方案访客产品线：机构介绍、家校共育、一日流程、教师团队、活动、餐食/食谱、环境与联系、联系/预约意向。

**现有路径：**

- Web：`apps/user-web/src/routes/visitor.routes.tsx`、`apps/user-web/src/pages/visitor-home.tsx`、`apps/user-web/src/pages/visitor-content.tsx`、`apps/user-web/src/pages/visitor-institution.tsx`、`apps/user-web/src/pages/visitor-day-flow.tsx`、`apps/user-web/src/pages/visitor-public-verticals.ts`、`apps/user-web/src/pages/visitor.test.tsx`、`apps/user-web/src/main.ts`、`apps/user-web/src/styles/user-web.css`。
- Mini：`apps/mini-program/app.json`、`apps/mini-program/pages/visitor/`、`apps/mini-program/src/pages/visitor/`、`apps/mini-program/src/navigation/routes.ts`、`apps/mini-program/src/pages/visitor.test.ts`。
- E2E：`tests/e2e/visitor.spec.ts`。

**必须覆盖：** `LOADING`、`EMPTY`、`ERROR`、`PUBLISHED`；只显示 `PUBLISHED + PUBLIC + 当前合成 tenant/campus + SIMULATED + FRESH + ENABLED`；草稿、私密、foreign、过期、禁用和未知 key 必须 fail closed；联系意向只保留本地确认，不写 storage、不发网络。

**验证：** Web visitor focused/E2E/typecheck/build/Lint/Prettier/三视口视觉；Mini visitor focused/typecheck/授权编译/页面注册护栏/DevTools 用户复核；网络、外部目的地和敏感字段审计。

### Task M1.2：员工入口、指南与教学资源

**目标：** 满足正式方案教师介绍、内部档案隔离、新人指南、培训中心、教学资源中心和伙伴云第一阶段边界。

**候选写集（需独立授权）：**

- Web：`apps/user-web/src/main.ts`、`apps/user-web/src/pages/staff-workbench.tsx`、`apps/user-web/src/pages/staff-guides.tsx`、`apps/user-web/src/pages/resources.tsx`、`apps/user-web/src/pages/partner-link.tsx`、对应 focused/E2E 测试。
- Mini：`apps/mini-program/pages/staff/`、`apps/mini-program/src/pages/staff/`、`apps/mini-program/src/routes/staff.routes.ts`、对应 focused tests。

**必须覆盖：** visitor/缺 membership/suspended/revoked/foreign tenant/campus/capability 缺失均 fail closed；对外教师资料与内部档案分离；指南和资源支持列表、无结果、详情、返回；伙伴云只显示不可交互说明，不生成外链、不调用服务。

**验证：** Web staff focused/runtime/typecheck/build/Lint/三视口；Mini staff focused/typecheck/编译/静态 WXML/WXSS；权限隔离、无网络、无敏感字段审计。

### Task M1.3：机构管理网页只读演示

**目标：** 满足正式方案管理网页的机构/校区、教师介绍、活动/餐食、指南/资源/伙伴云、员工账号、内容发布、文件和基础审计展示。

**现有候选路径：** `apps/admin-web/src/main.ts`、`apps/admin-web/src/pages/home-content.tsx`、`apps/admin-web/src/pages/public-teachers.tsx`、`apps/admin-web/src/pages/meals.tsx`、`apps/admin-web/src/pages/audit-logs.tsx`、`apps/admin-web/test/home-content.test.mjs`。

**必须覆盖：** 合成机构和校区范围、发布/下架/草稿状态、审计摘要、无权限和冲突状态；所有写入保持内存；不宣称已连接正式 API/数据库。

**验证：** admin-web focused tests/typecheck/build/Lint/Prettier；范围、权限、发布投影和审计检查；不得修改 API/数据库，除非新合同明确升级到后端集成。

### Task M1.4：V0.1 机构合作确认

**目标：** 补齐正式方案要求的“机构确认 → 低保真确认 → 高保真可点击原型 → V0.1 正式开发 → 测试环境演示 → 两轮优化 → 合作试点决策”门禁。

**交付物：** 机构确认清单、资料清单、试点范围、负责人、反馈记录、两轮变更记录和验收回执。内容必须脱敏且使用合成/经授权资料。

**停止条件：** 没有负责人、试点范围、数据授权或隐私确认时，停止进入真实业务闭环，不得用聊天确认替代机构合作证据。

## 6. M2：Phase 1.1 机构演示确认

**目标：** 在 M1 通过后，组织机构可审阅的本地演示、反馈和两轮可追踪优化。

**任务：**

1. 冻结 V0.1 演示包和浏览路径清单。
2. 记录机构对页面结构、术语、公开字段和流程的确认/拒绝。
3. 只在明确的变更合同中修改被拒绝项；每次变更重新运行受影响端的 focused、视觉、权限和无网络验证。
4. 形成 `PHASE_1_1_OWNER_REVIEW`，未通过时回到 M1，不进入家长真实闭环。

**发布边界：** 仍不上传微信体验版、不部署生产、不接真实数据。

## 7. M3：Phase 2 家长核心闭环

### Task M3.1：统一账号与家长/学生关系绑定

**候选新增路径（需单独合同）：**

- Web：`apps/user-web/src/routes/parent.routes.tsx`、`apps/user-web/src/pages/parent-home.tsx`、`apps/user-web/src/pages/parent-binding.tsx`、对应 tests。
- Mini：`apps/mini-program/pages/parent/home/`、`apps/mini-program/pages/parent/binding/`、`apps/mini-program/src/pages/parent/`、对应 tests。
- API/契约：`apps/api/src/modules/parent/`、`apps/api/src/routes/parent.route.ts`、`packages/contracts/src/parent.ts`、`packages/validation/src/parent.ts`、对应 schema/isolation tests。

**必须覆盖：** 人工审核优先、邀请码/学生名/班级/机构范围校验、重复关系、解除/更换、审计；拒绝跨租户和未审核关系；不使用真实手机号或学生信息。

### Task M3.2：日报、通知、请假和健康异常

**领域对象：** `Student`、`GuardianRelation`、`CareRecord`、`Leave`、`Notice`、`HealthIncident`、`ConsentRecord`。

**状态：** 草稿、已提交、已确认、已退回、已取消、异常待处理；每个状态都要有回退、重复提交和越权测试。

**端侧：** Mini 快速查看/提交，Web 历史/详情/批量处理，admin-web 审核和范围统计；不把学生敏感内容暴露给平台管理员。

### Task M3.3：接送授权与接送记录

**必须覆盖：** 授权、现场核验、教师确认、家长通知、异常阻断、审计记录；首期禁止人脸识别，使用人工核验和授权信息组合。

**安全门：** 无有效授权不得放行；跨校区、撤销授权、重复接送、异常信息必须 fail closed。

## 8. M4：Phase 3 教师业务闭环

### Task M4.1：教师工作台和任务

**候选路径：** `apps/mini-program/pages/staff/workbench/`、`apps/user-web/src/pages/staff-workbench.tsx`、`apps/user-web/src/pages/staff-report.tsx`、`apps/api/src/modules/task/`、对应 contract/tenant/auth tests。

**任务类型：** 日常、临时、学生、活动、应急；字段包括负责人、对象、截止时间/优先级、结果、检查人和审计。

**必须覆盖：** 待处理、进行中、已完成、已逾期、已取消；重复点击幂等；教师只能访问授权班级/学生；校区负责人范围更宽但仍受租户限制。

### Task M4.2：教师日报与月反馈

**流程：** 任务/考勤/接送/学生记录/异常 → 自动生成草稿 → 教师补充 → 负责人确认/退回 → 家长可见摘要。

**禁止：** 自动生成未经确认的敏感结论、学生能力/纪律/绩效标签或对外发送。

### Task M4.3：教学资源和机构知识

**必须覆盖：** 年级、学科、标签、版本、搜索、筛选、收藏、最近使用、来源/责任人/适用范围、过期和撤回；资源不得包含未授权学生信息。

## 9. M5：Phase 3.5 同芯 AI 小范围试点

### Task M5.1：提示式学习流程

**流程：** 选择学生/年级/学科 → 输入或拍照题目（首期仅合成/受控输入）→ 学生先尝试 → 第 0/1/2/3 层提示 → 巩固题 → 教师教学摘要与家长限定摘要。第 3 层须多次尝试后才可讲解完整过程并标注 AI 辅助，不跳过提示或转教师条件。

**角色投影（PDF 第 29、39 页）：** 家长仅看已批准绑定孩子的使用时长、完成情况、知识点摘要、需关注项，并可开启/关闭、限制时长、联系教师；教师看负责班级的完成情况、错误类型、未解决知识点、不确定输出，并可复核、布置巩固、关闭错误内容、加入日报。机构管理采用班级/学科汇总、安全事件、成本和使用率；平台仅系统运行、模型版本和匿名质量指标。家长新增需求归入活动计划 A2/D106，尚未实现，不能借用教师摘要已通过的测试宣称完成。

**验收：** 服务端按可信身份、有效绑定、租户/校区/学生范围过滤；两端家长四类字段和监督操作可用；换孩、解绑、关闭/删除及旧请求不恢复失效信息；不泄漏教师待复核内容、模型内部日志或其他学生。敏感需关注项先交教师复核，不自动推给家长；教师回流与人工接管保持可用。

**禁止：** 默认直接给答案、代写作文/作业、考试作弊、开放式万能聊天、情感陪伴、心理诊断、自动能力/纪律/绩效判断。

### Task M5.2：AI 安全、评测和人工接管

**必须覆盖：** 输入脱敏、年龄适配、学科/教材限制、提示策略、拒答/转人工、模型不可用回退、日志摘要、成本/版本/结果可复核、家长/教师可关闭和删除。

**验收指标：** 严重安全事件为 0；提示后重做率、同类题完成率、教师介入率和错误率可统计；不以调用次数代替价值指标。

## 10. M6：Phase 4 多租户 SaaS 经营基础

### Task M6.1：多校区、租户和权限

**必须覆盖：** `tenant_id`、`campus_id` 自动注入；成员、角色、能力、对象范围、文件前缀、缓存键、任务和审计均隔离；跨租户和跨校区测试必须 fail closed。

### Task M6.2：机构经营、财务、招生和证照

**领域对象：** `FeeItem`、`Bill`、`Payment`、`Refund`、`StaffPerformance`、`License`、`Recruitment`。

**边界：** 首期先完成只读/合成演示和权限模型，再决定真实支付、财务和招生集成；不在没有合同、备份和回滚方案时进行迁移。

### Task M6.3：部署、备份、恢复和供应链

**必须覆盖：** 本地/测试/预生产/生产分层、密钥管理、日志和告警、备份恢复演练、回滚目标、依赖扫描、第三方供应链审计；任何云端写入需独立部署合同。

## 11. 横向质量、安全和隐私门禁

每个 M1—M6 任务都必须提供：

- 产品/页面/状态测试：入口、加载、空、错误、成功、取消、返回。
- 权限测试：visitor、家长、教师、机构管理员、平台管理员、缺 membership、suspended/revoked、foreign scope。
- 数据测试：租户/校区、公开/内部、草稿/发布、过期/禁用、敏感字段和导出/删除。
- 工程检查：focused tests、typecheck、ESLint、Prettier、build、`git diff --check`。
- 前端检查：真实浏览器/微信模拟器可用时必须运行；不可用时明确 `NOT_RUN`，不把静态检查写成视觉通过。
- 安全检查：无未授权网络、外链、真实密钥、真实数据、持久化写入或生产配置。
- 审计证据：命令、退出码、测试计数、截图/JSON、目标文件 hash、写集和剩余风险。

## 12. R0：Task 19 Final Delivery 重新评估

只有 M1—M6 中已授权波次完成 Owner Review 后，才可以申请 R0。

**前置条件：** 当前 HEAD/工作树、冻结 verifier、依赖可用性、最终文件清单、manifest、完整 E2E、视觉证据、备份/回滚和安全审计均可复核。

**禁止提前做：** 不生成 release ZIP、不发布、不部署、不上传微信体验版、不推送远端；C1/C2 和 release 必须重新单独授权。

## 13. HISTORICAL/FROZEN：2026-09-25 初始执行顺序

以下仅保留当时任务与授权快照，不代表当前可执行范围。当前顺序以 `PLANS.md` 和活动计划的 D101B、D102–D108、A1/A2 对齐工作为准；2026-10-11 原方案目标决定和已存在的自主执行授权不再等待本节旧门禁。

1. `TASK20_REBASELINE_AND_PUBLIC_REGRESSION`：先收敛 Wave1 状态记录、Wave2A 已知测试例外和 Web/Mini 公开主路径证据。
2. `TASK20_PHASE_1B_STAFF_VERTICALS`：完成员工入口、教师公开资料隔离、新人指南和教学资源。
3. `TASK20_PHASE_1B_ADMIN_READONLY`：完成管理网页机构/校区、内容发布投影和审计展示。
4. `TASK20_PHASE_1B_COOPERATION_VALIDATION`：补齐机构确认、试点资料、反馈和两轮优化门禁。
5. Owner Review 通过后，才建立 M3 家长绑定合同。

2026-09-25 当时只允许启动第 1 项的新合同；当时本计划草案不自动授权第 2—5 项及 M3—M6、真实后端、部署或发布。该句为历史记录；当前真实服务及发布限制仍按 PLANS.md 执行。

## 14. 计划自审结果

- 附件1的访客、员工、管理、家长、教师、AI、SaaS、隐私、安全、质量和发布要求均在本计划中有对应阶段。
- 附件2的 Wave1—Wave5 作为历史加速路线被吸收到 M1 的子任务中，不再覆盖附件1的全局路线。
- 当前已实现的 Wave2A—E 被标记为既有现场，不被错误重述为完整 Phase 1B、Phase 2 或生产能力。
- 每个未来阶段都要求明确目标、隔离 worktree、精确写集和独立验证；普通本地任务沿用当前自主执行授权和同一活动计划，负责人验收与真实服务/发布门槛单独记录。
- 当前剩余风险已明确：Task 19 final artifact 阻塞、Wave1 阶段门记录缺口、Wave2A 既有 staff 测试例外、M1 员工/管理/机构合作门未完成。
