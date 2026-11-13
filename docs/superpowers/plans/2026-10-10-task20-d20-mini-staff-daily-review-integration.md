# TASK20 D20 Mini 员工内部日报审核跨端流程

- 任务标识：`TASK20_D20_MINI_STAFF_DAILY_REVIEW_INTEGRATION`
- 状态：`PASS_LOCAL_SYNTHETIC_SOURCE_AND_GENERATED`
- 依据：V2 项目方案第 33–34、50、55 页与 V3 G3.2。日报页面和服务已有固定选项、提交与负责人审核逻辑；尚缺 Mini 实际 Page、管理端实际审核客户端和同一共享服务的端到端回归。
- 目标：由 Mini 教师创建并提交合成日报，管理端负责人退回，教师在 Mini 修改固定选项并重提，负责人确认；验证同一日报 ID/版本贯穿流程，并确认家长不能读取内部日报。
- 基线：`tests/mini-shared-service.test.mjs` SHA-256 `DFF1592B1BA1EB77B35D2D82F01AC08775AF720D0A9431DD9F9D31785A4AD706`；D19 的 Mini↔Admin 任务检查流程两种 Mini 模式均通过。
- 构建：先运行管理端已有 TypeScript build，实际导入日报审核客户端；dist 只用于本机验证，不作为源文件交付。

## 精确写集

1. `tests/mini-shared-service.test.mjs`：增加 Mini 内部日报真实 Page 事件→Admin 日报审核客户端→Mini 更新的集成测试，并验证家长角色不能读取。
2. `PLANS.md`：记录 D20 控制状态与结果。
3. `docs/exec-plans/active/project-completion.md`：追加 D20 验证证据。
4. `docs/superpowers/plans/2026-10-03-project-progress-and-completion-roadmap.md`：记录 G3.2 证据及剩余事项。
5. 本合同。

## 禁止项

- 不读取、运行或修改 `apps/mini-program/src/pages/staff.test.ts`。
- 初始不修改业务源代码、页面、API、数据库、配置、依赖、lockfile 或编译生成产品 JS；若测试发现产品缺陷，先记录复现并调整合同写集。
- 不使用真实数据、身份、外网、持久化、正式通知；不提交、推送、部署或发布。
- 管理端 build 只生成既有 `dist` 验证产物；若必须修改其他文件，停止并先更新合同。

## 验收

- Mini 页面按“草稿→提交→退回→改选固定项→重提”操作同一日报；管理端真实审核客户端最终确认同一 ID，版本随每次变更递增。
- Mini 刷新后看到已确认状态；家长合成身份访问内部日报详情必须被拒绝且不泄露记录内容。
- Mini 源码与编译页面模式均通过；管理端 build/typecheck、Mini typecheck、目标 ESLint/Prettier、页面注册护栏、`git diff --check` 与路径范围检查通过；lockfile 不变。

## 实施结果与验证

- 同一条日报由 Mini quick-action Page 创建、提交，管理端 `StaffDailyReviewClient` 退回；教师在 Mini 通过固定选项修改并重提，负责人再确认。流程状态/版本为 `DRAFT v1 → SUBMITTED v2 → RETURNED v3 → SUBMITTED v4 → CONFIRMED v5`，Mini 与管理端始终读取同一日报 ID。
- 家长合成身份访问日报详情被拒绝，响应不含日报固定选项内容或学生信息。
- Mini 共享服务跨页回归源码模式 7/7、编译页面模式 7/7；管理端日报测试 2/2、服务日报测试 1/1。
- 管理端 build/typecheck、Mini TypeScript、目标 ESLint、Prettier API 格式核验、Mini 页面注册护栏和 `git diff --check` 均通过。
- 没有发现需修复的产品代码问题；本批只增加自动回归与治理记录。没有真实数据、身份、外网或持久化；未改依赖/lockfile，`staff.test.ts` 未读取、运行或修改。
